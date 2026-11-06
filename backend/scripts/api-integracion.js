// Pruebas de punta a punta contra SQL Server real: Integración 1 (acceso +
// servicios + citas) y paso 7 (proveedores y productos).
// Uso: npm run api:integracion  (lee backend/.env; necesita db:migrar, db:semillas y db:admin)
//
// OJO: deja datos de prueba (un servicio, un cliente y citas). Úsenlo en una
// base de prueba (ZairaCI en GitHub Actions o ZairaIntegracion), no en la de la demo.
// Sigue los pasos de docs/FLUJO_DE_TRABAJO.md, «Integración 1».
import assert from 'node:assert/strict';
import { crearApp } from '../src/app/app.js';
import { cerrarPool } from '../src/shared/db.js';
import { hoyCostaRica } from '../src/shared/fechas.js';

const usuario = process.env.ADMIN_USUARIO;
const contrasena = process.env.ADMIN_CONTRASENA;
if (!usuario || !contrasena) {
  console.error('Faltan ADMIN_USUARIO y ADMIN_CONTRASENA en backend/.env.');
  process.exit(1);
}

const servidor = crearApp().listen(0);
await new Promise((resolver) => servidor.once('listening', resolver));
const base = `http://127.0.0.1:${servidor.address().port}/api`;
let cookie = '';
let revisiones = 0;

async function llamar(metodo, ruta, cuerpo) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const nueva = respuesta.headers.get('set-cookie');
  if (nueva) cookie = nueva.split(';')[0];
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

function revisar(descripcion, comprobar) {
  comprobar();
  revisiones += 1;
  console.log(`  OK  ${descripcion}`);
}

// Próximo lunes con al menos 7 días de margen: el horario de las semillas atiende de 09:00 a 18:00.
function proximoLunes() {
  const fecha = new Date(`${hoyCostaRica()}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 7);
  while (fecha.getUTCDay() !== 1) fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

try {
  console.log('Integración 1: acceso + servicios + citas');

  // 1. Acceso (MA-01)
  let r = await llamar('GET', '/admin/citas');
  revisar('sin sesión, las citas administrativas responden 401 (AC-01)', () => assert.equal(r.estado, 401));
  r = await llamar('POST', '/auth/login', { usuario, contrasena });
  revisar('la administradora inicia sesión (MA-01)', () => assert.equal(r.estado, 200));

  // 2. Servicio de 30 minutos que permite domicilio (MS-01)
  const sufijo = Date.now().toString().slice(-6);
  r = await llamar('POST', '/admin/servicios', {
    nombre: `Prueba integración ${sufijo}`,
    descripcion: 'Servicio creado por la prueba de integración.',
    precioAproximado: 5000,
    duracionMinutos: 30,
    permiteDomicilio: true,
  });
  revisar('se registra un servicio Activo de 30 minutos (MS-01)', () => {
    assert.equal(r.estado, 201);
    assert.equal(r.cuerpo.data.estado, 'Activo');
  });
  const servicio = r.cuerpo.data;
  r = await llamar('GET', '/publico/servicios');
  revisar('aparece en el catálogo público (MS-02)', () => assert.ok(r.cuerpo.data.some((s) => s.id === servicio.id)));

  // 3. Cita con ese servicio (MCA-12)
  const fecha = proximoLunes();
  const ruta = (ids) => `/admin/citas/disponibilidad?fecha=${fecha}&servicios=${ids}`;
  r = await llamar('GET', ruta(servicio.id));
  revisar('la disponibilidad ofrece horas cada 30 minutos (MCA-12)', () => {
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.data.duracionTotalMinutos, 30);
    assert.ok(r.cuerpo.data.horarios.length > 0);
    assert.ok(r.cuerpo.data.horarios.every((h) => /:(00|30)$/.test(h)));
  });
  const hora1 = r.cuerpo.data.horarios[0];

  const telefono = `6${sufijo.padStart(7, '0')}`;
  r = await llamar('GET', `/admin/citas/clientes?telefono=${telefono}`);
  revisar('un teléfono nuevo no corresponde a ningún cliente', () => assert.equal(r.cuerpo.data, null));

  const nuevaCita = (hora, extra = {}) => ({
    cliente: { telefono: `${telefono.slice(0, 4)}-${telefono.slice(4)}`, nombre: 'Cliente de prueba', correoElectronico: '' },
    servicios: [servicio.id],
    fecha,
    hora,
    ...extra,
  });
  r = await llamar('POST', '/admin/citas', nuevaCita(hora1));
  revisar('la cita queda Confirmada, con código y cliente nuevo (MCA-12)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.estado, 'Confirmada');
    assert.match(r.cuerpo.data.codigo, /^C-[A-Z2-9]{8}$/);
    assert.equal(r.cuerpo.data.cliente.telefono, telefono);
    assert.equal(r.cuerpo.data.duracionMinutos, 30);
  });
  const cita1 = r.cuerpo.data;

  r = await llamar('POST', '/admin/citas', nuevaCita(hora1));
  revisar('el mismo horario ya no se puede ocupar otra vez (409 HORARIO_OCUPADO)', () => {
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.codigo, 'HORARIO_OCUPADO');
  });
  r = await llamar('GET', ruta(servicio.id));
  revisar('la hora ocupada ya no se ofrece (MCA-12, criterio 15)', () => assert.ok(!r.cuerpo.data.horarios.includes(hora1)));

  // 4. La duración queda fija en la cita (MS-03, criterio 3)
  r = await llamar('PUT', `/admin/servicios/${servicio.id}`, { ...servicio, duracionMinutos: 60 });
  revisar('se cambia la duración del servicio a 60 minutos (MS-03)', () => assert.equal(r.cuerpo.data.duracionMinutos, 60));
  r = await llamar('GET', `/admin/citas/${cita1.id}`);
  revisar('la cita existente conserva sus 30 minutos (MS-03, criterio 3)', () => {
    assert.equal(r.cuerpo.data.duracionMinutos, 30);
    assert.equal(r.cuerpo.data.servicios[0].duracionAplicadaMinutos, 30);
  });
  r = await llamar('POST', '/admin/citas', nuevaCita('16:00'));
  revisar('una cita nueva ya usa 60 minutos y reutiliza al cliente existente (MS-03 criterio 4, MCA-12 criterio 2)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.duracionMinutos, 60);
    assert.equal(r.cuerpo.data.cliente.id, cita1.cliente.id);
  });

  // 5. Domicilio y validaciones (MCA-12)
  r = await llamar('GET', '/publico/servicios');
  const sinDomicilio = r.cuerpo.data.find((s) => !s.permiteDomicilio);
  if (sinDomicilio) {
    r = await llamar('POST', '/admin/citas', nuevaCita('10:00', { servicios: [servicio.id, sinDomicilio.id], esDomicilio: true, direccion: 'San José' }));
    revisar('no permite domicilio si algún servicio no lo ofrece (MCA-12, criterio 11)', () => assert.equal(r.cuerpo.codigo, 'DOMICILIO_NO_DISPONIBLE'));
  }
  r = await llamar('POST', '/admin/citas', nuevaCita('10:00', { esDomicilio: true }));
  revisar('a domicilio la dirección es obligatoria (MCA-12, criterio 12)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('POST', '/admin/citas', nuevaCita('10:00', { servicios: [] }));
  revisar('sin servicios no se registra (MCA-12, flujo alterno)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));

  // 6. Servicio desactivado y reactivado (MS-04 criterio 3, EXT-MS-R01)
  r = await llamar('PATCH', `/admin/servicios/${servicio.id}/desactivar`);
  revisar('se desactiva el servicio (MS-04)', () => assert.equal(r.cuerpo.data.estado, 'Desactivado'));
  r = await llamar('GET', ruta(servicio.id));
  revisar('un servicio desactivado no se puede elegir para citas nuevas (MS-04, criterio 3)', () => {
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.codigo, 'SERVICIO_NO_DISPONIBLE');
  });
  r = await llamar('GET', `/admin/citas/${cita1.id}`);
  revisar('la cita anterior sigue mostrando el servicio (MS-04, criterio 5)', () => {
    assert.equal(r.cuerpo.data.servicios[0].id, servicio.id);
    assert.equal(r.cuerpo.data.servicios[0].estado, 'Desactivado');
  });
  r = await llamar('PATCH', `/admin/servicios/${servicio.id}/reactivar`);
  r = await llamar('GET', ruta(servicio.id));
  revisar('al reactivarlo se puede volver a elegir (EXT-MS-R01)', () => assert.equal(r.estado, 200));

  // 7. Consultar citas (MCA-04)
  r = await llamar('GET', `/admin/citas?fecha=${fecha}&cliente=${telefono.slice(0, 4)}-${telefono.slice(4)}`);
  revisar('se filtran por fecha y por teléfono del cliente (MCA-04, criterios 3 y 5)', () => assert.equal(r.cuerpo.data.length, 2));
  r = await llamar('GET', `/admin/citas?fecha=${fecha}&estado=Cancelada&cliente=${telefono}`);
  revisar('sin coincidencias responde una lista vacía, no un error (MCA-04, criterio 9)', () => {
    assert.equal(r.estado, 200);
    assert.deepEqual(r.cuerpo.data, []);
  });
  r = await llamar('GET', '/admin/citas?estado=Otra');
  revisar('un estado inválido se rechaza (MCA-04)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));

  // 8. Proveedores (MPV-01 a MPV-04, EXT-MPV-R01)
  console.log('Proveedores y productos');
  const telProveedor = `2${sufijo.padStart(7, '0')}`;
  const datosProveedor = { nombre: `Proveedor prueba ${sufijo}`, telefono: telProveedor, correoElectronico: `p${sufijo}@prueba.example` };
  r = await llamar('POST', '/admin/proveedores', datosProveedor);
  revisar('se registra un proveedor Activo (MPV-01)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.estado, 'Activo');
  });
  const proveedor = r.cuerpo.data;
  r = await llamar('POST', '/admin/proveedores', { ...datosProveedor, correoElectronico: `otro${sufijo}@prueba.example` });
  revisar('no se repite el teléfono de otro proveedor (MPV-01, criterio 4)', () => {
    assert.equal(r.estado, 409);
    assert.match(r.cuerpo.mensaje, /teléfono/);
  });
  r = await llamar('GET', `/admin/proveedores?buscar=${telProveedor.slice(0, 4)}-${telProveedor.slice(4)}`);
  revisar('se busca por teléfono (MPV-02, criterio 2)', () => assert.equal(r.cuerpo.data[0]?.id, proveedor.id));

  // 9. Productos (MPD-01 a MPD-06)
  const datosProducto = {
    nombre: `Producto prueba ${sufijo}`, marca: 'Marca', categoria: 'Pruebas', descripcion: 'Creado por la prueba.',
    precio: 4500, stock: 0, proveedorId: proveedor.id,
  };
  r = await llamar('POST', '/admin/productos', datosProducto);
  revisar('se registra un producto con stock 0 y aparece Agotado (MPD-01, criterio 5)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.disponibilidad, 'Agotado');
  });
  const producto = r.cuerpo.data;
  r = await llamar('PATCH', `/admin/productos/${producto.id}/stock`, { stock: 5 });
  revisar('el ajuste manual de stock lo deja Disponible (MPD-06, criterios 1 y 4)', () => {
    assert.equal(r.cuerpo.data.stock, 5);
    assert.equal(r.cuerpo.data.disponibilidad, 'Disponible');
  });
  r = await llamar('PATCH', `/admin/productos/${producto.id}/stock`, { stock: -1 });
  revisar('un stock negativo se rechaza (MPD-06, criterio 2)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('PUT', `/admin/productos/${producto.id}`, { ...datosProducto, precio: 5000, stock: 99 });
  revisar('actualizar el producto no cambia el stock (MPD-05, criterio 4)', () => {
    assert.equal(r.cuerpo.data.precio, 5000);
    assert.equal(r.cuerpo.data.stock, 5);
  });
  r = await llamar('GET', '/admin/productos/inventario');
  revisar('el inventario muestra el stock actual (MPD-04)', () => assert.equal(r.cuerpo.data.find((p) => p.id === producto.id)?.stock, 5));
  r = await llamar('GET', '/publico/productos');
  revisar('el catálogo público lo muestra sin stock ni proveedor (MPD-03)', () => {
    const publico = r.cuerpo.data.find((p) => p.id === producto.id);
    assert.equal(publico.disponibilidad, 'Disponible');
    assert.equal('stock' in publico || 'proveedor' in publico, false);
  });

  // 10. Proveedor desactivado (MPV-04)
  r = await llamar('PATCH', `/admin/proveedores/${proveedor.id}/desactivar`);
  revisar('se desactiva el proveedor y conserva sus productos (MPV-04, criterios 3 y 5)', () => {
    assert.equal(r.cuerpo.data.estado, 'Desactivado');
    assert.ok(r.cuerpo.data.productos.some((p) => p.id === producto.id));
  });
  r = await llamar('PATCH', `/admin/proveedores/${proveedor.id}/desactivar`);
  revisar('desactivarlo otra vez informa que ya está desactivado (MPV-04, flujo alterno)', () => assert.match(r.cuerpo.mensaje, /ya está desactivado/));
  r = await llamar('POST', '/admin/productos', { ...datosProducto, nombre: `Otro ${sufijo}` });
  revisar('no se asocian productos nuevos a un proveedor desactivado (MPV-04, criterio 6)', () => assert.equal(r.cuerpo.codigo, 'PROVEEDOR_NO_DISPONIBLE'));
  r = await llamar('PUT', `/admin/productos/${producto.id}`, { ...datosProducto, precio: 5200 });
  revisar('un producto existente se puede actualizar conservando su proveedor desactivado (MPD-05)', () => assert.equal(r.cuerpo.data.precio, 5200));
  r = await llamar('PATCH', `/admin/proveedores/${proveedor.id}/reactivar`);
  revisar('se reactiva el proveedor (EXT-MPV-R01)', () => assert.equal(r.cuerpo.data.estado, 'Activo'));

  // 11. Producto desactivado y reactivado (MPD-02, EXT-MPD-R01)
  r = await llamar('PATCH', `/admin/productos/${producto.id}/desactivar`);
  r = await llamar('GET', '/publico/productos');
  revisar('un producto desactivado sale del catálogo público (MPD-02, criterio 3)', () => assert.ok(!r.cuerpo.data.some((p) => p.id === producto.id)));
  r = await llamar('GET', `/admin/productos/${producto.id}`);
  revisar('pero sigue en la consulta administrativa (MPD-02 criterio 4, MPD-03 criterio 3)', () => assert.equal(r.cuerpo.data.estado, 'Desactivado'));
  r = await llamar('PATCH', `/admin/productos/${producto.id}/reactivar`);
  r = await llamar('GET', '/publico/productos');
  revisar('al reactivarlo vuelve al catálogo (EXT-MPD-R01)', () => assert.ok(r.cuerpo.data.some((p) => p.id === producto.id)));

  r = await llamar('POST', '/auth/logout');
  revisar('la administradora cierra sesión (MA-02)', () => assert.equal(r.estado, 200));

  console.log(`\nTodo bien: ${revisiones} revisiones de punta a punta.`);
} catch (error) {
  console.error(`\nFalló después de ${revisiones} revisiones:`, error.message);
  process.exitCode = 1;
} finally {
  servidor.close();
  await cerrarPool();
}
