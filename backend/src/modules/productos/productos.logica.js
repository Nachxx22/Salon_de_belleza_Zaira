// Reglas de MPD-01 a MPD-06 (dueño: Persona B) y de la extensión EXT-MPD-R01.
// Fuente: CU-MPD-01 a CU-MPD-06 en Jira (ERS sección 3.2.2).
// El descuento y la reposición automática del stock (MPD-06 desde MV-01 y MV-03)
// se programan con Ventas, en la misma transacción de la venta.
// Sin SQL (D-017): todo acceso a la base pasa por productos.datos.js y proveedores.datos.js.
import { ErrorApp, errores } from '../../shared/errores.js';
import { enteroPositivo, montoNoNegativo, textoRequerido } from '../../shared/validacion.js';
import * as datos from './productos.datos.js';
import * as proveedoresDatos from '../proveedores/proveedores.datos.js';

const OBLIGATORIOS = [
  ['nombre', 'nombre'],
  ['marca', 'marca'],
  ['categoria', 'categoría'],
  ['descripcion', 'descripción'],
  ['precio', 'precio'],
  ['proveedorId', 'proveedor'],
];

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Stock: entero no negativo (MPD-01 restricción 4, MPD-06 restricción 1).
export function validarStock(valor) {
  if (vacio(valor)) throw errores.datosInvalidos('Falta la cantidad en stock.', { campo: 'stock' });
  return enteroPositivo(valor, 'stock', { permitirCero: true });
}

// MPD-01 y MPD-05: mismos datos; el stock solo se pide al registrar.
export function validarProducto(entrada = {}, { conStock = false } = {}) {
  const obligatorios = conStock ? [...OBLIGATORIOS, ['stock', 'stock']] : OBLIGATORIOS;
  const faltantes = obligatorios.filter(([campo]) => vacio(entrada[campo])).map(([, etiqueta]) => etiqueta);
  if (faltantes.length > 0) {
    throw errores.datosInvalidos(`Faltan datos obligatorios: ${faltantes.join(', ')}.`, { campo: faltantes[0] });
  }
  const producto = {
    nombre: textoRequerido(entrada.nombre, 'nombre', { max: 150 }),
    marca: textoRequerido(entrada.marca, 'marca', { max: 100 }),
    categoria: textoRequerido(entrada.categoria, 'categoría', { max: 100 }),
    descripcion: textoRequerido(entrada.descripcion, 'descripción', { max: 500 }),
    precio: montoNoNegativo(entrada.precio, 'precio'),
    proveedorId: enteroPositivo(entrada.proveedorId, 'proveedor'),
  };
  if (conStock) producto.stock = validarStock(entrada.stock);
  return producto;
}

// Un proveedor desactivado no se puede asociar (MPD-01 restricción 6, MPV-04 criterio 6).
async function verificarProveedorActivo(proveedorId) {
  const proveedor = await proveedoresDatos.obtenerPorId(proveedorId);
  if (!proveedor || proveedor.estado !== 'Activo') {
    throw new ErrorApp(409, 'PROVEEDOR_NO_DISPONIBLE',
      'El proveedor seleccionado no está disponible para nuevas asociaciones. Seleccione un proveedor activo.', { campo: 'proveedor' });
  }
}

async function obtenerExistente(id) {
  const producto = await datos.obtenerPorId(id);
  if (!producto) throw errores.noEncontrado('No existe el producto solicitado.');
  return producto;
}

// MPD-03 catálogo público.
export async function listarPublicos() {
  return datos.listarPublicos();
}

// MPD-03 administrativo.
export async function listarAdmin() {
  return datos.listarTodos();
}

export async function detalle(id) {
  return obtenerExistente(id);
}

// MPD-04 Consultar stock.
export async function inventario() {
  return datos.inventario();
}

// MPD-01 Registrar producto.
export async function registrar(entrada) {
  const producto = validarProducto(entrada, { conStock: true });
  await verificarProveedorActivo(producto.proveedorId);
  const id = await datos.insertar(producto);
  return obtenerExistente(id);
}

// MPD-05 Actualizar producto. Si cambia el proveedor, el nuevo debe estar activo;
// si se mantiene el mismo, se conserva aunque esté desactivado (MPV-04, restricción 3).
export async function actualizar(id, entrada) {
  const actual = await obtenerExistente(id);
  const producto = validarProducto(entrada);
  if (producto.proveedorId !== actual.proveedor.id) await verificarProveedorActivo(producto.proveedorId);
  await datos.actualizar(id, producto);
  return obtenerExistente(id);
}

// MPD-06 Actualizar stock (ajuste manual).
export async function actualizarStock(id, entrada = {}) {
  await obtenerExistente(id);
  await datos.fijarStock(id, validarStock(entrada.stock));
  return obtenerExistente(id);
}

// MPD-02 Desactivar producto. Si ya estaba desactivado, no repite la operación.
export async function desactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Desactivado') return { producto: actual, yaEstaba: true };
  await datos.cambiarEstado(id, { de: 'Activo', a: 'Desactivado' });
  return { producto: await obtenerExistente(id), yaEstaba: false };
}

// EXT-MPD-R01 Reactivar producto (extensión acordada, no está en el ERS; D-020).
export async function reactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Activo') return { producto: actual, yaEstaba: true };
  await datos.cambiarEstado(id, { de: 'Desactivado', a: 'Activo' });
  return { producto: await obtenerExistente(id), yaEstaba: false };
}
