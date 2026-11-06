// Reglas de MPV-01 a MPV-04 (dueño: Persona B) y de la extensión EXT-MPV-R01.
// Fuente: CU-MPV-01 a CU-MPV-04 en Jira (ERS sección 3.2.2).
// Sin SQL (D-017): todo acceso a la base pasa por proveedores.datos.js.
import { ErrorApp, errores } from '../../shared/errores.js';
import { correo, telefono, textoRequerido } from '../../shared/validacion.js';
import * as datos from './proveedores.datos.js';

const OBLIGATORIOS = [
  ['nombre', 'nombre'],
  ['telefono', 'teléfono'],
  ['correoElectronico', 'correo electrónico'],
];

const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// MPV-01 y MPV-03: los tres datos son obligatorios y con formato válido.
export function validarProveedor(entrada = {}) {
  const faltantes = OBLIGATORIOS.filter(([campo]) => vacio(entrada[campo])).map(([, etiqueta]) => etiqueta);
  if (faltantes.length > 0) {
    throw errores.datosInvalidos(`Faltan datos obligatorios: ${faltantes.join(', ')}.`, { campo: faltantes[0] });
  }
  return {
    nombre: textoRequerido(entrada.nombre, 'nombre', { max: 150 }),
    telefono: telefono(entrada.telefono),
    correoElectronico: correo(entrada.correoElectronico),
  };
}

// MPV-01, restricción 4 y MPV-03, restricción 3.
async function verificarSinDuplicados(proveedor, excluirId = null) {
  const campo = await datos.datoDuplicado(proveedor, excluirId);
  if (campo) {
    const dato = campo === 'telefono' ? 'teléfono' : 'correo electrónico';
    throw new ErrorApp(409, 'DUPLICADO', `El ${dato} ingresado ya pertenece a otro proveedor registrado.`, { campo: dato });
  }
}

async function obtenerExistente(id) {
  const proveedor = await datos.obtenerPorId(id);
  if (!proveedor) throw errores.noEncontrado('No existe el proveedor solicitado.');
  return proveedor;
}

// MPV-02: listado con búsqueda opcional por nombre, teléfono o correo.
export async function listar({ buscar } = {}) {
  let texto = vacio(buscar) ? null : textoRequerido(String(buscar), 'búsqueda', { max: 254 });
  // Un teléfono escrito como 2222-0001 se busca como 22220001 (D-016).
  if (texto && /^[\d\s-]+$/.test(texto)) texto = texto.replace(/[\s-]/g, '');
  return datos.listar({ buscar: texto });
}

// MPV-02: detalle con sus productos asociados.
export async function detalle(id) {
  const proveedor = await obtenerExistente(id);
  return { ...proveedor, productos: await datos.productosAsociados(id) };
}

// MPV-01 Registrar proveedor.
export async function registrar(entrada) {
  const proveedor = validarProveedor(entrada);
  await verificarSinDuplicados(proveedor);
  const id = await datos.insertar(proveedor);
  return detalle(id);
}

// MPV-03 Actualizar proveedor: no toca estado ni productos asociados.
export async function actualizar(id, entrada) {
  await obtenerExistente(id);
  const proveedor = validarProveedor(entrada);
  await verificarSinDuplicados(proveedor, id);
  await datos.actualizar(id, proveedor);
  return detalle(id);
}

// MPV-04 Desactivar proveedor. Si ya estaba desactivado, informa y no cambia nada.
export async function desactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Desactivado') return { proveedor: await detalle(id), yaEstaba: true };
  await datos.cambiarEstado(id, { de: 'Activo', a: 'Desactivado' });
  return { proveedor: await detalle(id), yaEstaba: false };
}

// EXT-MPV-R01 Reactivar proveedor (extensión acordada, no está en el ERS; D-020).
export async function reactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Activo') return { proveedor: await detalle(id), yaEstaba: true };
  await datos.cambiarEstado(id, { de: 'Desactivado', a: 'Activo' });
  return { proveedor: await detalle(id), yaEstaba: false };
}
