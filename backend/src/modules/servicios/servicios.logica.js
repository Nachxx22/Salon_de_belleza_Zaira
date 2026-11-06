// Reglas de los casos de uso MS-01 a MS-05 (dueño: Persona B).
// Fuente: CU-MS-01 a CU-MS-05 en Jira (ERS sección 3.2.2).
// Sin SQL ni nombres de tablas o columnas: todo acceso a la base pasa por
// servicios.datos.js, que entrega objetos en camelCase (D-017).
import { errores } from '../../shared/errores.js';
import { enteroPositivo, montoNoNegativo, textoRequerido } from '../../shared/validacion.js';
import * as datos from './servicios.datos.js';

const OBLIGATORIOS = [
  ['nombre', 'nombre'],
  ['descripcion', 'descripción'],
  ['precioAproximado', 'precio aproximado'],
  ['duracionMinutos', 'duración en minutos'],
];

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

// Convierte la entrada del API en un servicio válido o lanza DATOS_INVALIDOS.
// Lo usan MS-01 (registrar) y MS-03 (actualizar): las mismas reglas para ambos.
export function validarServicio(entrada = {}) {
  // Flujo alterno de MS-01: indicar qué datos faltan.
  const faltantes = OBLIGATORIOS.filter(([campo]) => vacio(entrada[campo])).map(([, etiqueta]) => etiqueta);
  if (faltantes.length > 0) {
    throw errores.datosInvalidos(`Faltan datos obligatorios: ${faltantes.join(', ')}.`, { campo: faltantes[0] });
  }

  const nombre = textoRequerido(entrada.nombre, 'nombre', { max: 100 });
  const descripcion = textoRequerido(entrada.descripcion, 'descripción', { max: 500 });
  // Precio aproximado: un monto (D-014), nunca negativo (MS-01, restricción 4).
  const precioAproximado = montoNoNegativo(entrada.precioAproximado, 'precio aproximado');
  // Duración en minutos, mayor que cero (MS-01, restricción 4).
  const duracionMinutos = enteroPositivo(entrada.duracionMinutos, 'duración en minutos');

  // Domicilio es opcional: si no viene, el servicio no se ofrece a domicilio.
  let permiteDomicilio = entrada.permiteDomicilio ?? false;
  if (typeof permiteDomicilio !== 'boolean') {
    throw errores.datosInvalidos('El campo atención a domicilio debe ser verdadero o falso.', { campo: 'atención a domicilio' });
  }

  return { nombre, descripcion, precioAproximado, duracionMinutos, permiteDomicilio };
}

async function obtenerExistente(id) {
  const servicio = await datos.obtenerPorId(id);
  if (!servicio) throw errores.noEncontrado('No existe el servicio solicitado.');
  return servicio;
}

// MS-02: catálogo público, solo servicios disponibles.
export async function listarPublicos() {
  return datos.listarActivos();
}

// MS-05: todos los servicios, activos e inactivos.
export async function listarAdmin() {
  return datos.listarTodos();
}

export async function obtenerAdmin(id) {
  return obtenerExistente(id);
}

// MS-01 Registrar servicio.
export async function registrar(entrada) {
  const servicio = validarServicio(entrada);
  const id = await datos.insertar(servicio);
  return obtenerExistente(id);
}

// MS-03 Actualizar servicio. Las citas existentes no cambian su duración (CitaServicio la copia).
export async function actualizar(id, entrada) {
  await obtenerExistente(id);
  const servicio = validarServicio(entrada);
  await datos.actualizar(id, servicio);
  return obtenerExistente(id);
}

// MS-04 Desactivar servicio (baja lógica). Si ya estaba desactivado, no repite la operación.
export async function desactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Desactivado') {
    return { servicio: actual, yaEstaba: true };
  }
  await datos.desactivar(id);
  return { servicio: await obtenerExistente(id), yaEstaba: false };
}

// EXT-MS-R01 Reactivar servicio (extensión acordada, no está en el ERS; D-018).
// Vuelve a mostrarlo en el catálogo y en citas nuevas; no cambia citas ni ventas.
export async function reactivar(id) {
  const actual = await obtenerExistente(id);
  if (actual.estado === 'Activo') {
    return { servicio: actual, yaEstaba: true };
  }
  await datos.reactivar(id);
  return { servicio: await obtenerExistente(id), yaEstaba: false };
}
