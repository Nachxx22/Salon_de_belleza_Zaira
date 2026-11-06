// Prueba de desempeño contra SQL Server real: PR-01 a PR-06 del ERS (sección 3.3).
// Uso: npm run api:rendimiento  (lee backend/.env; necesita db:migrar, db:semillas y db:admin)
//
// Simula 10 usuarios a la vez (PR-06): cada uno inicia sesión y repite las operaciones
// medidas. Compara el peor tiempo de cada operación con su límite y falla si alguno
// se pasa o si alguna operación responde con error.
//
// OJO: registra ventas de prueba y sube el stock de un producto. Úsenlo en una base de
// prueba (ZairaCI en GitHub Actions o ZairaIntegracion), no en la de la demo.
//
// Mide el tiempo del API (petición → respuesta). La pantalla de React agrega muy poco
// porque solo pinta el resultado; la medición completa en el navegador se hace a mano
// en la demo con las herramientas del navegador (docs/REQUISITOS_NO_FUNCIONALES.md).
import { performance } from 'node:perf_hooks';
import { crearApp } from '../src/app/app.js';
import { cerrarPool } from '../src/shared/db.js';
import { hoyCostaRica } from '../src/shared/fechas.js';

const USUARIOS = 10; // PR-06
const REPETICIONES = 5;
const LIMITES = {
  'PR-01 Catálogo de servicios': 3000,
  'PR-01 Catálogo de productos': 3000,
  'PR-01 Consulta administrativa (ventas)': 3000,
  'PR-02 Inicio de sesión': 3000,
  'PR-03 Actualización administrativa (servicio)': 3000,
  'PR-04 Disponibilidad de citas': 4000,
  'PR-05 Registro de venta con inventario': 4000,
};

const usuario = process.env.ADMIN_USUARIO;
const contrasena = process.env.ADMIN_CONTRASENA;
if (!usuario || !contrasena) {
  console.error('Faltan ADMIN_USUARIO y ADMIN_CONTRASENA en backend/.env.');
  process.exit(1);
}

const servidor = crearApp().listen(0);
await new Promise((resolver) => servidor.once('listening', resolver));
const base = `http://127.0.0.1:${servidor.address().port}/api`;
const tiempos = Object.fromEntries(Object.keys(LIMITES).map((k) => [k, []]));
const fallos = [];

function cliente() {
  let cookie = '';
  return async function llamar(metodo, ruta, cuerpo) {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const nueva = respuesta.headers.get('set-cookie');
    if (nueva) cookie = nueva.split(';')[0];
    return { estado: respuesta.status, cuerpo: await respuesta.json() };
  };
}

async function medir(nombre, llamada) {
  const inicio = performance.now();
  const r = await llamada();
  tiempos[nombre].push(performance.now() - inicio);
  if (!r.cuerpo.ok) fallos.push(`${nombre}: ${r.estado} ${r.cuerpo.codigo} ${r.cuerpo.mensaje}`);
  return r;
}

function proximoLunes() {
  const fecha = new Date(`${hoyCostaRica()}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 7);
  while (fecha.getUTCDay() !== 1) fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

const percentil = (lista, p) => {
  const orden = [...lista].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
};

try {
  // Preparación: un servicio y un producto activos con stock suficiente para todas las ventas.
  const preparar = cliente();
  await preparar('POST', '/auth/login', { usuario, contrasena });
  const servicio = (await preparar('GET', '/admin/servicios')).cuerpo.data.find((s) => s.estado === 'Activo');
  const producto = (await preparar('GET', '/admin/productos')).cuerpo.data.find((p) => p.estado === 'Activo');
  await preparar('PATCH', `/admin/productos/${producto.id}/stock`, { stock: producto.stock + USUARIOS * REPETICIONES });
  const datosServicio = {
    nombre: servicio.nombre,
    descripcion: servicio.descripcion,
    precioAproximado: servicio.precioAproximado,
    duracionMinutos: servicio.duracionMinutos,
    permiteDomicilio: servicio.permiteDomicilio,
  };
  const fecha = proximoLunes();

  console.log(`Desempeño: ${USUARIOS} usuarios a la vez, ${REPETICIONES} repeticiones cada uno (PR-06)`);
  const inicioTotal = performance.now();
  await Promise.all(Array.from({ length: USUARIOS }, async () => {
    const llamar = cliente();
    for (let i = 0; i < REPETICIONES; i += 1) {
      await medir('PR-02 Inicio de sesión', () => llamar('POST', '/auth/login', { usuario, contrasena }));
      await medir('PR-01 Catálogo de servicios', () => llamar('GET', '/publico/servicios'));
      await medir('PR-01 Catálogo de productos', () => llamar('GET', '/publico/productos'));
      await medir('PR-01 Consulta administrativa (ventas)', () => llamar('GET', '/admin/ventas'));
      await medir('PR-03 Actualización administrativa (servicio)', () => llamar('PUT', `/admin/servicios/${servicio.id}`, datosServicio));
      await medir('PR-04 Disponibilidad de citas', () => llamar('GET', `/publico/citas/disponibilidad?fecha=${fecha}&servicios=${servicio.id}`));
      await medir('PR-05 Registro de venta con inventario', () => llamar('POST', '/admin/ventas', {
        referenciaCliente: 'Prueba de desempeño',
        productos: [{ id: producto.id, cantidad: 1 }],
        servicios: [{ id: servicio.id, precioFinal: 5000 }],
        metodoPago: 'Efectivo',
        pagoConfirmado: true,
      }));
    }
  }));
  const segundos = ((performance.now() - inicioTotal) / 1000).toFixed(1);

  console.log('\n| Operación | Límite | Veces | Mediana | p95 | Máximo | Resultado |');
  console.log('|---|---|---|---|---|---|---|');
  let todoBien = fallos.length === 0;
  for (const [nombre, limite] of Object.entries(LIMITES)) {
    const lista = tiempos[nombre];
    const maximo = Math.max(...lista);
    const cumple = maximo <= limite;
    todoBien &&= cumple;
    const ms = (v) => `${Math.round(v)} ms`;
    console.log(`| ${nombre} | ${limite / 1000} s | ${lista.length} | ${ms(percentil(lista, 50))} | ${ms(percentil(lista, 95))} | ${ms(maximo)} | ${cumple ? 'Cumple' : 'NO cumple'} |`);
  }
  console.log(`\n${USUARIOS * REPETICIONES * Object.keys(LIMITES).length} operaciones en ${segundos} s; errores: ${fallos.length}.`);
  if (fallos.length) console.log(fallos.slice(0, 10).join('\n'));
  console.log(todoBien ? 'Todo bien: se cumplen PR-01 a PR-06.' : 'Hay operaciones fuera del límite o con error.');
  if (!todoBien) process.exitCode = 1;
} catch (error) {
  console.error('Falló la prueba de desempeño:', error.message);
  process.exitCode = 1;
} finally {
  servidor.close();
  await cerrarPool();
}
