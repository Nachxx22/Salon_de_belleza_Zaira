// Reglas de MV-01 Registrar venta, MV-02 Consultar venta y MV-03 Anular venta
// (dueño: Persona B). Fuente: CU-MV-01 a CU-MV-03 en Jira (ERS sección 3.2.2).
// EXT-MV-U01 (actualizar venta) es una extensión aparte (paso 9).
// Sin SQL (D-017): todo acceso a la base pasa por ventas.datos.js.
import { ErrorApp, errores } from '../../shared/errores.js';
import { enteroPositivo, fecha as validarFecha, montoPositivo, textoOpcional, textoRequerido } from '../../shared/validacion.js';
import * as datos from './ventas.datos.js';

export const METODOS_PAGO = ['Efectivo', 'SINPE', 'Transferencia'];
export const ESTADOS_VENTA = ['Registrada', 'Anulada'];
// Mensaje exacto del ERS (MV-01 restricción 3, MPD-06 flujo alterno).
export const MENSAJE_CANTIDAD_INSUFICIENTE = 'Cantidad insuficiente';

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const centimos = (monto) => Math.round(monto * 100) / 100;

// MV-01: valida la solicitud antes de tocar la base.
export function validarVenta(entrada = {}) {
  // Restricción 8: solo con el pago confirmado por la administradora.
  if (entrada.pagoConfirmado !== true) {
    throw new ErrorApp(400, 'PAGO_NO_CONFIRMADO',
      'Confirme que recibió el pago antes de registrar la venta. El sistema no procesa pagos.', { campo: 'pagoConfirmado' });
  }

  const listaProductos = Array.isArray(entrada.productos) ? entrada.productos : [];
  const listaServicios = Array.isArray(entrada.servicios) ? entrada.servicios : [];
  // Restricción 2: al menos un producto o servicio.
  if (listaProductos.length + listaServicios.length === 0) {
    throw errores.datosInvalidos('La venta debe incluir al menos un producto o servicio.', { campo: 'productos' });
  }

  // Restricción 3: cantidad entera mayor que cero. Un producto repetido suma sus cantidades.
  const cantidades = new Map();
  for (const linea of listaProductos) {
    const id = enteroPositivo(linea?.id, 'producto');
    if (vacio(linea?.cantidad)) throw errores.datosInvalidos('Falta la cantidad de un producto.', { campo: 'cantidad' });
    const cantidad = enteroPositivo(linea.cantidad, 'cantidad');
    cantidades.set(id, (cantidades.get(id) ?? 0) + cantidad);
  }

  // Restricción 5: precio final numérico y mayor que cero. Cada servicio una vez por venta.
  const servicios = [];
  for (const linea of listaServicios) {
    const id = enteroPositivo(linea?.id, 'servicio');
    if (servicios.some((s) => s.id === id)) {
      throw errores.datosInvalidos('Un servicio solo puede incluirse una vez en la misma venta.', { campo: 'servicios' });
    }
    if (vacio(linea?.precioFinal)) throw errores.datosInvalidos('Falta el precio final cobrado de un servicio.', { campo: 'precio final' });
    servicios.push({ id, precioFinal: montoPositivo(linea.precioFinal, 'precio final') });
  }

  // Restricción 6: método de pago obligatorio.
  if (vacio(entrada.metodoPago)) throw errores.datosInvalidos('Seleccione el método de pago.', { campo: 'método de pago' });
  if (!METODOS_PAGO.includes(entrada.metodoPago)) {
    throw errores.datosInvalidos(`El método de pago debe ser ${METODOS_PAGO.join(', ')}.`, { campo: 'método de pago' });
  }

  return {
    // Restricción 1: la información del cliente es opcional.
    referenciaCliente: textoOpcional(entrada.referenciaCliente, 'referencia del cliente', { max: 150 }),
    metodoPago: entrada.metodoPago,
    productos: [...cantidades].map(([id, cantidad]) => ({ id, cantidad })),
    servicios,
  };
}

// Total de la venta: precio del catálogo × cantidad + precio final de cada servicio (MV-01, paso 9).
export function calcularTotal({ productos, servicios }) {
  const totalProductos = productos.reduce((suma, p) => suma + centimos(p.precio * p.cantidad), 0);
  const totalServicios = servicios.reduce((suma, s) => suma + s.precioFinal, 0);
  return centimos(totalProductos + totalServicios);
}

export async function detalle(id) {
  const venta = await datos.obtenerDetalle(id);
  if (!venta) throw errores.noEncontrado('No existe la venta solicitada.');
  return venta;
}

// MV-01 Registrar venta. Venta y stock se guardan juntos o no se guarda nada.
export async function registrar(entrada) {
  const venta = validarVenta(entrada);
  const resultado = await datos.registrarVentaConStock(venta, calcularTotal);
  const { problema } = resultado;
  if (problema?.tipo === 'stock') {
    throw new ErrorApp(409, 'CANTIDAD_INSUFICIENTE', MENSAJE_CANTIDAD_INSUFICIENTE, {
      campo: 'cantidad',
      producto: problema.nombre,
      disponible: problema.disponible,
      solicitado: problema.pedido,
    });
  }
  if (problema?.tipo === 'producto') {
    throw new ErrorApp(409, 'PRODUCTO_NO_DISPONIBLE',
      `El producto ${problema.nombre ? `«${problema.nombre}» ` : ''}no está disponible para la venta.`, { campo: 'productos' });
  }
  if (problema?.tipo === 'servicio') {
    throw new ErrorApp(409, 'SERVICIO_NO_DISPONIBLE',
      `El servicio ${problema.nombre ? `«${problema.nombre}» ` : ''}no está disponible para la venta.`, { campo: 'servicios' });
  }
  return detalle(resultado.id);
}

// MV-02 Consultar venta: filtros opcionales.
export async function listar(filtros = {}) {
  const texto = (valor, campo) => (vacio(valor) ? null : textoRequerido(String(valor), campo, { max: 150 }));
  const desde = vacio(filtros.desde) ? null : validarFecha(filtros.desde, 'fecha inicial');
  const hasta = vacio(filtros.hasta) ? null : validarFecha(filtros.hasta, 'fecha final');
  if (desde && hasta && desde > hasta) {
    throw errores.datosInvalidos('La fecha inicial no puede ser posterior a la fecha final.', { campo: 'fecha inicial' });
  }
  const metodoPago = vacio(filtros.metodoPago) ? null : filtros.metodoPago;
  if (metodoPago && !METODOS_PAGO.includes(metodoPago)) {
    throw errores.datosInvalidos(`El método de pago debe ser ${METODOS_PAGO.join(', ')}.`, { campo: 'método de pago' });
  }
  const estado = vacio(filtros.estado) ? null : filtros.estado;
  if (estado && !ESTADOS_VENTA.includes(estado)) {
    throw errores.datosInvalidos(`El estado debe ser ${ESTADOS_VENTA.join(' o ')}.`, { campo: 'estado' });
  }
  return datos.listar({
    codigo: texto(filtros.codigo, 'código')?.toUpperCase() ?? null,
    desde,
    hasta,
    cliente: texto(filtros.cliente, 'cliente'),
    metodoPago,
    estado,
  });
}

// MV-03 Anular venta: motivo obligatorio; solo ventas Registradas; repone el stock.
export async function anular(id, entrada = {}) {
  const actual = await detalle(id);
  if (actual.estado === 'Anulada') {
    throw new ErrorApp(409, 'VENTA_YA_ANULADA', 'La venta ya está anulada y no puede anularse nuevamente.');
  }
  if (vacio(entrada.motivo)) {
    throw errores.datosInvalidos('El motivo de anulación es obligatorio.', { campo: 'motivo' });
  }
  const motivo = textoRequerido(entrada.motivo, 'motivo', { max: 500 });
  const { anulada } = await datos.anularVentaConStock(id, motivo);
  if (!anulada) {
    throw new ErrorApp(409, 'VENTA_YA_ANULADA', 'La venta ya está anulada y no puede anularse nuevamente.');
  }
  return detalle(id);
}
