// Pruebas de punta a punta contra SQL Server real: Integración 1 (acceso +
// servicios + citas), paso 7 (proveedores y productos), paso 8 (ventas) y
// paso 9 (EXT-MV-U01 corregir venta, extensión que no está en el ERS) y
// hito P0 (configuración de agenda, reprogramar y cancelar citas) y los P1 de
// citas (cliente, solicitudes y completar) y la página de salud del sistema.
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

  // 12. Ventas (MV-01 a MV-03, MPD-06 automático). El producto tiene stock 5 y precio 5200.
  console.log('Ventas');
  const stockDe = async () => (await llamar('GET', `/admin/productos/${producto.id}`)).cuerpo.data.stock;
  const referencia = `Cliente venta ${sufijo}`;
  const venta = (extra = {}) => ({
    referenciaCliente: referencia,
    productos: [{ id: producto.id, cantidad: 3 }],
    servicios: [{ id: servicio.id, precioFinal: 7000 }],
    metodoPago: 'SINPE',
    pagoConfirmado: true,
    ...extra,
  });

  r = await llamar('POST', '/admin/ventas', venta({ pagoConfirmado: false }));
  revisar('sin confirmar el pago no se registra (MV-01, criterio 7)', () => assert.equal(r.cuerpo.codigo, 'PAGO_NO_CONFIRMADO'));
  r = await llamar('POST', '/admin/ventas', venta({ productos: [], servicios: [] }));
  revisar('sin productos ni servicios no se registra (MV-01, flujo alterno)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));

  r = await llamar('POST', '/admin/ventas', venta());
  revisar('se registra la venta con código, estado Registrada y total calculado (MV-01, criterios 1, 3 y 10)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.match(r.cuerpo.data.codigo, /^V-\d{6}$/);
    assert.equal(r.cuerpo.data.estado, 'Registrada');
    assert.equal(r.cuerpo.data.total, 3 * 5200 + 7000);
    assert.equal(r.cuerpo.data.productos[0].precioAplicado, 5200);
    assert.match(r.cuerpo.data.fechaHora, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  const ventaUno = r.cuerpo.data;
  let stock = await stockDe();
  revisar('el stock bajó de 5 a 2 (MV-01 criterio 8, MPD-06 criterio 3)', () => assert.equal(stock, 2));

  r = await llamar('POST', '/admin/ventas', venta());
  revisar('si no alcanza el stock responde «Cantidad insuficiente» (MV-01, flujo alterno)', () => {
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.codigo, 'CANTIDAD_INSUFICIENTE');
    assert.equal(r.cuerpo.mensaje, 'Cantidad insuficiente');
    assert.equal(r.cuerpo.detalles.disponible, 2);
  });
  assert.equal(await stockDe(), 2);
  r = await llamar('GET', `/admin/ventas?cliente=${encodeURIComponent(referencia)}`);
  revisar('y no quedó ni venta parcial ni stock descontado (MV-01, excepciones)', () => assert.equal(r.cuerpo.data.length, 1));

  r = await llamar('POST', '/admin/ventas', { servicios: [{ id: servicio.id, precioFinal: 6000 }], metodoPago: 'Efectivo', pagoConfirmado: true });
  revisar('una venta solo de servicios y sin cliente se registra (MV-01, criterio 2)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.referenciaCliente, null);
    assert.deepEqual(r.cuerpo.data.productos, []);
  });
  const ventaServicios = r.cuerpo.data;

  // El precio registrado no cambia si después cambia el catálogo (MV-02, restricción 6).
  r = await llamar('PUT', `/admin/productos/${producto.id}`, { ...datosProducto, precio: 9999 });
  r = await llamar('GET', `/admin/ventas/${ventaUno.id}`);
  revisar('el detalle conserva cantidades y el precio del momento de la venta (MV-02, criterios 5 y 6)', () => {
    assert.equal(r.cuerpo.data.productos[0].cantidad, 3);
    assert.equal(r.cuerpo.data.productos[0].precioAplicado, 5200);
    assert.equal(r.cuerpo.data.servicios[0].precioFinal, 7000);
  });
  r = await llamar('GET', `/admin/ventas?codigo=${ventaUno.codigo.toLowerCase()}`);
  revisar('se busca por código (MV-02, criterio 3)', () => assert.deepEqual(r.cuerpo.data.map((v) => v.id), [ventaUno.id]));
  r = await llamar('GET', `/admin/ventas?desde=${hoyCostaRica()}&hasta=${hoyCostaRica()}&metodoPago=Efectivo`);
  revisar('se filtra por rango de fechas y método de pago (MV-02, criterio 3)', () => {
    assert.ok(r.cuerpo.data.some((v) => v.id === ventaServicios.id));
    assert.ok(r.cuerpo.data.every((v) => v.metodoPago === 'Efectivo'));
  });

  r = await llamar('PATCH', `/admin/ventas/${ventaUno.id}/anular`, { motivo: '  ' });
  revisar('el motivo de anulación es obligatorio (MV-03, criterio 2)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('PATCH', `/admin/ventas/${ventaUno.id}/anular`, { motivo: 'Error en la cantidad.' });
  revisar('se anula con su motivo y conserva sus datos (MV-03, criterios 3, 4 y 5)', () => {
    assert.equal(r.cuerpo.data.estado, 'Anulada');
    assert.equal(r.cuerpo.data.motivoAnulacion, 'Error en la cantidad.');
    assert.equal(r.cuerpo.data.total, ventaUno.total);
    assert.equal(r.cuerpo.data.productos[0].cantidad, 3);
  });
  stock = await stockDe();
  revisar('el stock volvió de 2 a 5 (MV-03 criterio 6, MPD-06 criterio 6)', () => assert.equal(stock, 5));
  r = await llamar('PATCH', `/admin/ventas/${ventaUno.id}/anular`, { motivo: 'Otra vez.' });
  revisar('no se puede anular dos veces (MV-03, criterio 7)', () => {
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.codigo, 'VENTA_YA_ANULADA');
  });
  assert.equal(await stockDe(), 5);
  r = await llamar('PATCH', `/admin/ventas/${ventaServicios.id}/anular`, { motivo: 'Prueba solo servicios.' });
  revisar('una venta solo de servicios se anula sin tocar el inventario (MV-03, criterio 6)', () => assert.equal(r.cuerpo.data.estado, 'Anulada'));
  assert.equal(await stockDe(), 5);
  r = await llamar('GET', `/admin/ventas?estado=Anulada&cliente=${encodeURIComponent(referencia)}`);
  revisar('la venta anulada sigue disponible en la consulta (MV-03 criterio 8, MV-02 criterio 1)', () => assert.equal(r.cuerpo.data.length, 1));

  r = await llamar('PATCH', `/admin/productos/${producto.id}/desactivar`);
  r = await llamar('POST', '/admin/ventas', venta({ productos: [{ id: producto.id, cantidad: 1 }] }));
  revisar('un producto desactivado no se puede vender (D-021)', () => assert.equal(r.cuerpo.codigo, 'PRODUCTO_NO_DISPONIBLE'));
  assert.equal(await stockDe(), 5);
  await llamar('PATCH', `/admin/productos/${producto.id}/reactivar`);

  // 13. EXT-MV-U01 Corregir venta (extensión acordada, no está en el ERS; D-008, D-022)
  console.log('Corregir venta (EXT-MV-U01)');
  await llamar('PUT', `/admin/productos/${producto.id}`, { ...datosProducto, precio: 3000 });
  r = await llamar('POST', '/admin/ventas', venta({ productos: [{ id: producto.id, cantidad: 2 }] }));
  const ventaEditable = r.cuerpo.data;
  revisar('venta nueva: 2 unidades a 3000 y el servicio a 7000 (stock 5 → 3)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(ventaEditable.total, 2 * 3000 + 7000);
  });
  await llamar('PUT', `/admin/productos/${producto.id}`, { ...datosProducto, precio: 1000 });
  const correccion = (extra = {}) => ({
    referenciaCliente: referencia,
    productos: [{ id: producto.id, cantidad: 4 }],
    servicios: [{ id: servicio.id, precioFinal: 8000 }],
    metodoPago: 'Efectivo',
    pagoConfirmado: true,
    motivo: 'Se llevó 2 unidades más.',
    ...extra,
  });
  r = await llamar('PUT', `/admin/ventas/${ventaEditable.id}`, correccion({ motivo: '' }));
  revisar('corregir pide un motivo', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('PUT', `/admin/ventas/${ventaEditable.id}`, correccion());
  revisar('se corrige: mismo código, nueva cantidad y precio original del producto', () => {
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.codigo, ventaEditable.codigo);
    assert.equal(r.cuerpo.data.fechaHora, ventaEditable.fechaHora);
    assert.equal(r.cuerpo.data.metodoPago, 'Efectivo');
    assert.equal(r.cuerpo.data.productos[0].cantidad, 4);
    assert.equal(r.cuerpo.data.productos[0].precioAplicado, 3000);
    assert.equal(r.cuerpo.data.total, 4 * 3000 + 8000);
  });
  revisar('queda guardado cómo estaba antes, en RevisionVenta', () => {
    assert.equal(r.cuerpo.data.revisiones.length, 1);
    assert.equal(r.cuerpo.data.revisiones[0].motivo, 'Se llevó 2 unidades más.');
    assert.equal(r.cuerpo.data.revisiones[0].datosAnteriores.total, 2 * 3000 + 7000);
    assert.equal(r.cuerpo.data.revisiones[0].datosAnteriores.productos[0].cantidad, 2);
  });
  stock = await stockDe();
  revisar('el stock se ajusta a la corrección: 5 − 4 = 1', () => assert.equal(stock, 1));

  r = await llamar('PUT', `/admin/ventas/${ventaEditable.id}`, correccion({ productos: [{ id: producto.id, cantidad: 6 }] }));
  revisar('si la corrección no alcanza el stock responde «Cantidad insuficiente» (disponible 1 + 4 = 5)', () => {
    assert.equal(r.cuerpo.codigo, 'CANTIDAD_INSUFICIENTE');
    assert.equal(r.cuerpo.detalles.disponible, 5);
  });
  stock = await stockDe();
  r = await llamar('GET', `/admin/ventas/${ventaEditable.id}`);
  revisar('y no cambia nada: ni stock, ni venta, ni historial', () => {
    assert.equal(stock, 1);
    assert.equal(r.cuerpo.data.productos[0].cantidad, 4);
    assert.equal(r.cuerpo.data.revisiones.length, 1);
  });

  r = await llamar('PUT', `/admin/ventas/${ventaEditable.id}`, correccion({ productos: [], motivo: 'No se llevó productos.' }));
  stock = await stockDe();
  revisar('quitar el producto en una corrección lo devuelve al stock (vuelve a 5)', () => {
    assert.deepEqual(r.cuerpo.data.productos, []);
    assert.equal(r.cuerpo.data.revisiones.length, 2);
    assert.equal(stock, 5);
  });

  await llamar('PATCH', `/admin/ventas/${ventaEditable.id}/anular`, { motivo: 'Prueba de corrección.' });
  r = await llamar('PUT', `/admin/ventas/${ventaEditable.id}`, correccion());
  revisar('una venta anulada no se puede corregir', () => {
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.codigo, 'VENTA_NO_EDITABLE');
  });
  stock = await stockDe();
  revisar('y el stock no cambia', () => assert.equal(stock, 5));

  // 14. Configuración de agenda (MCA-08 a MCA-11). En `fecha` (lunes) hay dos citas
  //     Confirmadas del paso 3: hora1 (09:00) y 16:00 (60 min).
  console.log('Configuración de agenda');
  r = await llamar('GET', '/admin/agenda');
  const horarioLunes = r.cuerpo.data.horarios.find((h) => h.diaSemana === 1);
  revisar('se consultan horarios regulares y bloqueos por separado (MCA-09)', () => {
    assert.ok(horarioLunes, 'el lunes tiene horario en las semillas');
    assert.ok(Array.isArray(r.cuerpo.data.bloqueos));
  });
  r = await llamar('POST', '/admin/agenda/horarios', { diaSemana: 1, horaInicio: '12:00', horaFin: '12:00' });
  revisar('la hora final debe ser posterior a la inicial (MCA-08, criterio 4)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('POST', '/admin/agenda/horarios', { diaSemana: 1, horaInicio: '17:00', horaFin: '19:00' });
  revisar('no se superponen horarios del mismo día (MCA-08, criterio 5)', () => assert.equal(r.cuerpo.codigo, 'AGENDA_SUPERPOSICION'));
  r = await llamar('POST', '/admin/agenda/horarios', { diaSemana: 7, horaInicio: '10:00', horaFin: '12:00' });
  revisar('se registra un horario regular para el domingo (MCA-08)', () => assert.equal(r.estado, 201, JSON.stringify(r.cuerpo)));
  const horarioDomingo = r.cuerpo.data;
  const domingo = new Date(`${fecha}T00:00:00Z`);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  const fechaDomingo = domingo.toISOString().slice(0, 10);
  r = await llamar('GET', `/admin/citas/disponibilidad?fecha=${fechaDomingo}&servicios=${servicio.id}`);
  revisar('el horario nuevo se usa para la disponibilidad (MCA-08, criterio 8)', () => assert.deepEqual(r.cuerpo.data.horarios, ['10:00', '10:30', '11:00']));
  r = await llamar('PUT', `/admin/agenda/horarios/${horarioDomingo.id}`, { diaSemana: 7, horaInicio: '10:00', horaFin: '13:00' });
  r = await llamar('GET', `/admin/citas/disponibilidad?fecha=${fechaDomingo}&servicios=${servicio.id}`);
  revisar('al modificarlo, la disponibilidad usa el horario nuevo (MCA-10, criterio 10)', () => assert.ok(r.cuerpo.data.horarios.includes('12:00')));
  r = await llamar('DELETE', `/admin/agenda/horarios/${horarioDomingo.id}`);
  r = await llamar('GET', `/admin/citas/disponibilidad?fecha=${fechaDomingo}&servicios=${servicio.id}`);
  revisar('al eliminarlo, el domingo vuelve a no tener horas (MCA-11, criterio 9)', () => assert.deepEqual(r.cuerpo.data.horarios, []));

  r = await llamar('PUT', `/admin/agenda/horarios/${horarioLunes.id}`, { diaSemana: 1, horaInicio: '10:00', horaFin: '18:00' });
  revisar('modificar el horario no puede dejar fuera una cita confirmada (MCA-10, criterio 6)', () => {
    assert.equal(r.cuerpo.codigo, 'AGENDA_CITAS_AFECTADAS');
    assert.match(r.cuerpo.mensaje, new RegExp(cita1.codigo));
  });
  r = await llamar('DELETE', `/admin/agenda/horarios/${horarioLunes.id}`);
  revisar('tampoco se puede eliminar si deja fuera citas confirmadas (MCA-11, criterio 3)', () => assert.equal(r.cuerpo.codigo, 'AGENDA_CITAS_AFECTADAS'));

  r = await llamar('POST', '/admin/agenda/bloqueos', { fecha, horaInicio: hora1, horaFin: '10:00' });
  revisar('un bloqueo no puede tapar una cita confirmada (MCA-08, criterio 6)', () => assert.equal(r.cuerpo.codigo, 'AGENDA_CITAS_AFECTADAS'));
  r = await llamar('POST', '/admin/agenda/bloqueos', { fecha, horaInicio: '12:00', horaFin: '13:00' });
  revisar('se registra un bloqueo libre (MCA-08)', () => assert.equal(r.estado, 201, JSON.stringify(r.cuerpo)));
  const bloqueo = r.cuerpo.data;
  r = await llamar('GET', ruta(servicio.id));
  revisar('el bloqueo se descuenta de la disponibilidad (MCA-08, criterio 8)', () => {
    assert.ok(!r.cuerpo.data.horarios.includes('12:00'));
    assert.ok(!r.cuerpo.data.horarios.includes('11:30')); // 11:30 + 60 min choca con el bloqueo
  });
  r = await llamar('POST', '/admin/agenda/bloqueos', { fecha, horaInicio: '12:30', horaFin: '13:30' });
  revisar('no se superponen bloqueos de la misma fecha (MCA-08, criterio 5)', () => assert.equal(r.cuerpo.codigo, 'AGENDA_SUPERPOSICION'));
  r = await llamar('PUT', `/admin/agenda/bloqueos/${bloqueo.id}`, { fecha, horaInicio: '16:00', horaFin: '17:00' });
  revisar('modificar el bloqueo hacia una cita confirmada se rechaza (MCA-10, criterio 6)', () => assert.equal(r.cuerpo.codigo, 'AGENDA_CITAS_AFECTADAS'));
  r = await llamar('PUT', `/admin/agenda/bloqueos/${bloqueo.id}`, { fecha, horaInicio: '12:30', horaFin: '13:30' });
  revisar('se modifica el bloqueo a un período libre (MCA-10, criterio 8)', () => assert.equal(r.cuerpo.data.horaInicio, '12:30'));
  r = await llamar('DELETE', `/admin/agenda/bloqueos/${bloqueo.id}`);
  r = await llamar('GET', '/admin/agenda');
  revisar('el bloqueo eliminado deja de mostrarse (MCA-11, criterio 10)', () => assert.ok(!r.cuerpo.data.bloqueos.some((b) => b.id === bloqueo.id)));

  // 15. Reprogramar (MCA-13) y cancelar (MCA-14) por la administradora.
  console.log('Reprogramar y cancelar citas');
  r = await llamar('GET', `/admin/citas?fecha=${fecha}&cliente=${telefono}`);
  const cita2 = r.cuerpo.data.find((c) => c.hora === '16:00');
  r = await llamar('GET', `/admin/citas/${cita1.id}/disponibilidad?fecha=${fecha}`);
  revisar('la disponibilidad para reprogramar no choca con la propia cita (MCA-13, criterio 6)', () => {
    assert.equal(r.cuerpo.data.duracionTotalMinutos, 30);
    assert.ok(r.cuerpo.data.horarios.includes(hora1));
    assert.ok(!r.cuerpo.data.horarios.includes('16:00'));
  });
  r = await llamar('PATCH', `/admin/citas/${cita1.id}/reprogramar`, { fecha, hora: '10:00' });
  revisar('se reprograma: sigue Confirmada, con los mismos servicios (MCA-13, criterios 1, 3 y 9)', () => {
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.hora, '10:00');
    assert.equal(r.cuerpo.data.estado, 'Confirmada');
    assert.equal(r.cuerpo.data.codigo, cita1.codigo);
    assert.deepEqual(r.cuerpo.data.servicios.map((s) => s.duracionAplicadaMinutos), [30]);
  });
  r = await llamar('PATCH', `/admin/citas/${cita2.id}/reprogramar`, { fecha, hora: '10:00' });
  revisar('no se reprograma a un período ocupado (MCA-13, criterio 8)', () => assert.equal(r.cuerpo.codigo, 'HORARIO_OCUPADO'));

  r = await llamar('PATCH', `/admin/citas/${cita1.id}/cancelar`, { motivo: '' });
  revisar('el motivo de cancelación es obligatorio (MCA-14, criterio 4)', () => assert.equal(r.cuerpo.codigo, 'DATOS_INVALIDOS'));
  r = await llamar('PATCH', `/admin/citas/${cita1.id}/cancelar`, { motivo: 'La clienta llamó para cancelar.' });
  revisar('se cancela con su motivo y no se elimina (MCA-14, criterios 6 y 7)', () => {
    assert.equal(r.cuerpo.data.estado, 'Cancelada');
    assert.equal(r.cuerpo.data.motivoCancelacion, 'La clienta llamó para cancelar.');
  });
  r = await llamar('GET', ruta(servicio.id));
  revisar('el período de la cita cancelada queda libre (MCA-14, criterio 8)', () => assert.ok(r.cuerpo.data.horarios.includes('10:00')));
  r = await llamar('PATCH', `/admin/citas/${cita1.id}/cancelar`, { motivo: 'Otra vez.' });
  revisar('una cita cancelada no se cancela otra vez (MCA-14, criterio 2)', () => assert.equal(r.cuerpo.codigo, 'CITA_NO_CONFIRMADA'));
  r = await llamar('PATCH', `/admin/citas/${cita1.id}/reprogramar`, { fecha, hora: '11:00' });
  revisar('ni se reprograma (MCA-13, criterio 2)', () => assert.equal(r.cuerpo.codigo, 'CITA_NO_CONFIRMADA'));

  // 16. Citas del cliente (P1): MCA-01 a MCA-03, MCA-05 a MCA-07. En `fecha`
  //     queda solo cita2 (16:00, 60 min, Confirmada). El servicio dura 60 min.
  console.log('Citas del cliente y solicitudes (P1)');
  const telCliente = `7${sufijo.padStart(7, '0')}`;
  const acceso = (codigo) => ({ codigo, telefono: `${telCliente.slice(0, 4)}-${telCliente.slice(4)}` });
  const solicitudDe = async (codigo) => (await llamar('GET', '/admin/solicitudes')).cuerpo.data.find((s) => s.cita.codigo === codigo);
  const libres = async () => (await llamar('GET', ruta(servicio.id))).cuerpo.data.horarios;

  r = await llamar('GET', `/publico/citas/disponibilidad?fecha=${hoyCostaRica()}&servicios=${servicio.id}`);
  revisar('el cliente no puede pedir cita para hoy (MCA-01, criterio 4)', () => assert.equal(r.cuerpo.codigo, 'FECHA_NO_PERMITIDA'));
  r = await llamar('GET', `/publico/citas/disponibilidad?fecha=${fecha}&servicios=${servicio.id}`);
  revisar('ve las horas libres desde mañana (MCA-01, criterios 5 a 7)', () => assert.ok(r.cuerpo.data.horarios.includes('13:00')));

  const citaCliente = (hora) => ({
    cliente: { nombre: 'Clienta web', telefono: telCliente, correoElectronico: '' },
    servicios: [servicio.id],
    fecha,
    hora,
  });
  r = await llamar('POST', '/publico/citas', citaCliente('13:00'));
  revisar('la cita del cliente queda Pendiente con su solicitud de creación (MCA-01, criterios 12 a 14)', () => {
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.estado, 'Pendiente');
    assert.equal(r.cuerpo.data.solicitudPendiente, 'Creacion');
    assert.equal('cliente' in r.cuerpo.data, false);
  });
  const codigoCliente = r.cuerpo.data.codigo;
  const libresTrasPedir = await libres();
  revisar('el período queda reservado mientras está pendiente (MCA-01, criterio 15)', () => assert.ok(!libresTrasPedir.includes('13:00')));
  r = await llamar('GET', '/admin/solicitudes/resumen');
  revisar('la administradora recibe el aviso interno (MCA-01 criterio 16, MCA-05 criterio 12)', () => assert.ok(r.cuerpo.data.pendientes >= 1));

  r = await llamar('POST', '/publico/citas/consulta', { codigo: codigoCliente, telefono: '88880000' });
  revisar('con un teléfono que no corresponde no muestra la cita (MCA-02, criterio 1)', () => {
    assert.equal(r.estado, 404);
    assert.equal(r.cuerpo.codigo, 'CITA_NO_ENCONTRADA');
  });
  r = await llamar('POST', '/publico/citas/cancelacion', acceso(codigoCliente));
  revisar('una cita Pendiente no admite otra solicitud (MCA-03, criterio 2)', () => assert.equal(r.cuerpo.codigo, 'CITA_NO_CONFIRMADA'));

  let solicitud = await solicitudDe(codigoCliente);
  revisar('la solicitud aparece en pendientes con su tipo (MCA-05, criterios 2 a 6)', () => assert.equal(solicitud?.tipo, 'Creacion'));
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/aprobar`);
  revisar('aprobar una creación confirma la cita (MCA-06, criterio 4)', () => {
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.data.estado, 'Aprobada');
    assert.equal(r.cuerpo.data.cita.estado, 'Confirmada');
  });
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/rechazar`);
  revisar('una solicitud procesada no se procesa otra vez (MCA-06, criterio 11)', () => assert.equal(r.cuerpo.codigo, 'SOLICITUD_YA_PROCESADA'));

  // MCA-02: reprogramación del cliente
  r = await llamar('POST', '/publico/citas/reprogramacion/horarios', { ...acceso(codigoCliente), fecha });
  revisar('ve horas para reprogramar con la duración de sus servicios (MCA-02, criterio 7)', () => assert.ok(r.cuerpo.data.horarios.includes('14:00')));
  r = await llamar('POST', '/publico/citas/reprogramacion', { ...acceso(codigoCliente), fecha, hora: '14:00' });
  revisar('la reprogramación deja la cita Pendiente y conserva la fecha original (MCA-02, criterios 8 a 10)', () => {
    assert.equal(r.cuerpo.data.estado, 'Pendiente');
    assert.equal(r.cuerpo.data.hora, '13:00');
    assert.equal(r.cuerpo.data.solicitudPendiente, 'Reprogramacion');
  });
  let horasLibres = await libres();
  revisar('quedan reservados el período original y el propuesto (MCA-02, criterio 11)', () => {
    assert.ok(!horasLibres.includes('13:00'));
    assert.ok(!horasLibres.includes('14:00'));
  });
  solicitud = await solicitudDe(codigoCliente);
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/rechazar`);
  horasLibres = await libres();
  revisar('rechazarla devuelve la cita a Confirmada en su fecha y libera solo lo propuesto (MCA-06, criterio 7)', () => {
    assert.equal(r.cuerpo.data.cita.estado, 'Confirmada');
    assert.equal(r.cuerpo.data.cita.hora, '13:00');
    assert.ok(horasLibres.includes('14:00'));
    assert.ok(!horasLibres.includes('13:00'));
  });
  await llamar('POST', '/publico/citas/reprogramacion', { ...acceso(codigoCliente), fecha, hora: '14:00' });
  solicitud = await solicitudDe(codigoCliente);
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/aprobar`);
  horasLibres = await libres();
  revisar('aprobarla aplica la nueva hora y libera la original (MCA-06, criterio 6)', () => {
    assert.equal(r.cuerpo.data.cita.estado, 'Confirmada');
    assert.equal(r.cuerpo.data.cita.hora, '14:00');
    assert.ok(horasLibres.includes('13:00'));
    assert.ok(!horasLibres.includes('14:00'));
  });

  // MCA-03: cancelación del cliente
  r = await llamar('POST', '/publico/citas/cancelacion', acceso(codigoCliente));
  revisar('solicitar la cancelación no cancela todavía (MCA-03, criterios 5 a 8)', () => {
    assert.equal(r.cuerpo.data.estado, 'Confirmada');
    assert.equal(r.cuerpo.data.solicitudPendiente, 'Cancelacion');
  });
  r = await llamar('POST', '/publico/citas/cancelacion', acceso(codigoCliente));
  revisar('no se registra otra solicitud mientras hay una pendiente (MCA-03, criterio 3)', () => assert.equal(r.cuerpo.codigo, 'SOLICITUD_PENDIENTE'));
  const idCitaCliente = (await solicitudDe(codigoCliente)).cita.id;
  r = await llamar('PATCH', `/admin/citas/${idCitaCliente}/completar`);
  revisar('la administradora no puede completarla con una solicitud pendiente (MCA-07, criterio 8)', () => assert.equal(r.cuerpo.codigo, 'SOLICITUD_PENDIENTE'));
  solicitud = await solicitudDe(codigoCliente);
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/rechazar`);
  revisar('rechazar la cancelación deja la cita Confirmada (MCA-06, criterio 9)', () => assert.equal(r.cuerpo.data.cita.estado, 'Confirmada'));
  await llamar('POST', '/publico/citas/cancelacion', acceso(codigoCliente));
  solicitud = await solicitudDe(codigoCliente);
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/aprobar`);
  horasLibres = await libres();
  revisar('aprobarla cancela la cita y libera su período (MCA-06, criterio 8)', () => {
    assert.equal(r.cuerpo.data.cita.estado, 'Cancelada');
    assert.ok(horasLibres.includes('14:00'));
  });

  r = await llamar('POST', '/publico/citas', citaCliente('13:00'));
  solicitud = await solicitudDe(r.cuerpo.data.codigo);
  r = await llamar('PATCH', `/admin/solicitudes/${solicitud.id}/rechazar`);
  horasLibres = await libres();
  revisar('rechazar una creación cancela la cita y libera el horario (MCA-06, criterio 5)', () => {
    assert.equal(r.cuerpo.data.cita.estado, 'Cancelada');
    assert.ok(horasLibres.includes('13:00'));
  });

  // MCA-07
  r = await llamar('PATCH', `/admin/citas/${cita2.id}/completar`);
  revisar('una cita Confirmada se marca como Completada (MCA-07, criterios 1 y 4)', () => assert.equal(r.cuerpo.data.estado, 'Completada'));
  r = await llamar('PATCH', `/admin/citas/${cita2.id}/completar`);
  revisar('una cita Completada no se completa otra vez (MCA-07, criterio 3)', () => assert.equal(r.cuerpo.codigo, 'CITA_NO_CONFIRMADA'));

  console.log('Salud del sistema (EXT-SAL-01)');
  r = await llamar('GET', '/admin/salud');
  const salud = r.cuerpo.data;
  const problemas = salud.modulos.flatMap((m) => m.endpoints.filter((e) => e.estado !== 'OK').map((e) => `${e.metodo} ${e.ruta}: ${e.estado} ${e.detalle}`));
  revisar('todos los endpoints de los 5 CRUD y de los módulos de apoyo están OK', () => assert.deepEqual(problemas, []));
  revisar('las migraciones están al día y la revisión general está OK', () => {
    assert.equal(salud.migraciones.estado, 'OK');
    assert.equal(salud.general, 'OK');
  });
  const filasAntes = Object.fromEntries(salud.tablas.map((t) => [t.nombre, t.filas]));
  for (const modulo of salud.modulos.filter((m) => m.pruebaEscritura)) {
    r = await llamar('POST', `/admin/salud/escritura/${modulo.clave}`);
    revisar(`la prueba de escritura de ${modulo.nombre} pasa`, () => {
      assert.equal(r.cuerpo.data.estado, 'OK', JSON.stringify(r.cuerpo.data.pasos));
      assert.ok(r.cuerpo.data.pasos.every((p) => ['OK', 'OMITIDA'].includes(p.estado)));
    });
  }
  r = await llamar('GET', '/admin/salud');
  const filasDespues = Object.fromEntries(r.cuerpo.data.tablas.map((t) => [t.nombre, t.filas]));
  revisar('las pruebas de escritura se revirtieron: ninguna tabla cambió de tamaño', () => assert.deepEqual(filasDespues, filasAntes));

  r = await llamar('POST', '/auth/logout');
  revisar('la administradora cierra sesión (MA-02)', () => assert.equal(r.estado, 200));
  r = await llamar('GET', '/admin/salud');
  revisar('sin sesión, la página de salud responde 401 (AC-01)', () => assert.equal(r.estado, 401));

  console.log(`\nTodo bien: ${revisiones} revisiones de punta a punta.`);
} catch (error) {
  console.error(`\nFalló después de ${revisiones} revisiones:`, error.message);
  process.exitCode = 1;
} finally {
  servidor.close();
  await cerrarPool();
}
