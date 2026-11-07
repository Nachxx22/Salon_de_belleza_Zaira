// Módulo Salud del sistema (EXT-SAL-01, D-025). No necesita SQL Server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET ??= 'secreto-de-pruebas-automaticas';

const { crearApp } = await import('../src/app/app.js');
const { MODULOS } = await import('../src/modules/salud/salud.logica.js');
const datos = await import('../src/modules/salud/salud.datos.js');
const { rutasAuth } = await import('../src/modules/auth/auth.rutas.js');

const MONTAJES = {
  servicios: ['/api/admin/servicios', '/api/publico/servicios'],
  proveedores: ['/api/admin/proveedores', null],
  productos: ['/api/admin/productos', '/api/publico/productos'],
  ventas: ['/api/admin/ventas', null],
  agenda: ['/api/admin/agenda', null],
  citas: ['/api/admin/citas', '/api/publico/citas'],
  solicitudes: ['/api/admin/solicitudes', null],
};

function rutasDe(router, prefijo) {
  return router.stack.filter((capa) => capa.route).flatMap((capa) => Object.keys(capa.route.methods)
    .map((metodo) => `${metodo.toUpperCase()} ${prefijo}${capa.route.path === '/' ? '' : capa.route.path}`));
}

let servidor;
let base;
before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(() => servidor.close());

test('la página de salud solo es para la administradora (AC-01)', async () => {
  for (const [metodo, ruta] of [['GET', '/admin/salud'], ['POST', '/admin/salud/escritura/servicios']]) {
    const respuesta = await fetch(base + ruta, { method: metodo });
    assert.equal(respuesta.status, 401, `${metodo} ${ruta} debe pedir sesión`);
    assert.equal((await respuesta.json()).codigo, 'NO_AUTENTICADO');
  }
});

test('la ruta pública /api/salud no muestra el nombre de la base (AC-03)', async () => {
  const cuerpo = await (await fetch(`${base}/salud`)).json();
  assert.equal(cuerpo.data.api, 'activa');
  assert.equal(cuerpo.data.baseDatos.nombre, undefined);
});

test('el catálogo de la página coincide con las rutas reales de cada módulo', async () => {
  const reales = rutasDe(rutasAuth, '/api/auth');
  for (const [clave, [admin, publico]] of Object.entries(MONTAJES)) {
    const rutas = await import(`../src/modules/${clave}/${clave}.rutas.js`);
    reales.push(...rutasDe(rutas.rutasAdmin, admin));
    if (publico) reales.push(...rutasDe(rutas.rutasPublicas, publico));
  }
  const catalogo = MODULOS.flatMap((m) => m.endpoints.map((e) => `${e.metodo} ${e.ruta}`));
  assert.deepEqual([...catalogo].sort(), [...new Set(catalogo)].sort(), 'no debe haber endpoints repetidos');
  assert.deepEqual([...catalogo].sort(), [...reales].sort());
});

test('los 5 CRUD tienen C, R, U y D, y cada operación sabe qué permisos necesita', () => {
  const cruds = MODULOS.filter((m) => m.crud);
  assert.deepEqual(cruds.map((m) => m.clave), ['servicios', 'proveedores', 'productos', 'ventas', 'agenda']);
  const todas = datos.TABLAS.map((nombre) => ({ nombre, existe: true, permisos: { SELECT: true, INSERT: true, UPDATE: true, DELETE: true } }));
  const operaciones = datos.revisarOperaciones(todas);
  for (const m of cruds) {
    assert.deepEqual([...new Set(m.endpoints.map((e) => e.operacion))].sort(), ['C', 'D', 'R', 'U'], m.clave);
    assert.ok(datos.MODULOS_CON_ESCRITURA.includes(m.clave), `${m.clave} debe tener prueba de escritura`);
  }
  for (const m of MODULOS) {
    for (const e of m.endpoints.filter((x) => x.operacion)) {
      const op = operaciones[m.clave]?.[e.operacion];
      assert.ok(op && op.necesita.length > 0, `${m.clave} ${e.operacion} sin permisos definidos`);
      assert.deepEqual(op.faltan, []);
    }
  }
});

test('detecta permisos que faltan y tablas que no existen', () => {
  const tablas = datos.TABLAS.map((nombre) => ({ nombre, existe: nombre !== 'RevisionVenta', permisos: { SELECT: true, INSERT: true, UPDATE: true, DELETE: true } }));
  tablas.find((t) => t.nombre === 'VentaProducto').permisos.INSERT = false;
  const { ventas, servicios } = datos.revisarOperaciones(tablas);
  assert.deepEqual(ventas.C.faltan, ['INSERT en VentaProducto']);
  assert.deepEqual(ventas.R.faltanTablas, ['RevisionVenta']);
  assert.deepEqual(servicios.C.faltan, []);
});

test('clasifica los errores de conexión, login, permisos y tablas', () => {
  const tipo = (e) => datos.clasificarError(e).tipo;
  assert.equal(tipo({ code: 'ESOCKET', message: 'Failed to connect' }), 'SIN_CONEXION');
  assert.equal(tipo({ code: 'ETIMEOUT' }), 'SIN_CONEXION');
  assert.equal(tipo({ code: 'ELOGIN', number: 18456 }), 'LOGIN');
  assert.equal(tipo({ code: 'ELOGIN', number: 4060 }), 'BASE_NO_EXISTE');
  assert.equal(tipo({ code: 'EREQUEST', number: 229 }), 'SIN_PERMISO');
  assert.equal(tipo({ code: 'EREQUEST', number: 208 }), 'FALTA_TABLA');
  assert.equal(tipo({ code: 'EREQUEST', number: 547 }), 'RESTRICCION');
  assert.equal(tipo(new Error('otra cosa')), 'ERROR');
});
