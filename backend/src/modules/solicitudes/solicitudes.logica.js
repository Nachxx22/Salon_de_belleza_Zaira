// Reglas de MCA-05 Consultar solicitudes pendientes y MCA-06 Procesar solicitud
// pendiente (dueño: Persona A). Fuente: CU-MCA-05 y CU-MCA-06 en Jira.
// Sin SQL (D-017): todo acceso a la base pasa por solicitudes.datos.js.
import { ErrorApp, errores } from '../../shared/errores.js';
import { horariosDisponibles } from '../citas/citas.logica.js';
import * as datos from './solicitudes.datos.js';

const TIPOS = { Creacion: 'creación', Reprogramacion: 'reprogramación', Cancelacion: 'cancelación' };

// MCA-06, restricciones 5 a 7: estado que debe tener la cita según el tipo de solicitud.
export function estadoCitaEsperado(tipo) {
  return tipo === 'Cancelacion' ? 'Confirmada' : 'Pendiente';
}

// Al aprobar una creación o reprogramación, el período debe seguir dentro del
// horario y sin chocar con otras ocupaciones (la propia cita no cuenta).
export function estaDisponible(agenda, hora, duracionMinutos) {
  return horariosDisponibles(agenda, duracionMinutos).includes(hora);
}

export async function listarPendientes() {
  return datos.listarPendientes();
}

export async function resumen() {
  return datos.resumenPendientes();
}

export async function detalle(id) {
  const solicitud = await datos.obtener(id);
  if (!solicitud) throw errores.noEncontrado('No existe la solicitud indicada.');
  return solicitud;
}

// MCA-06: aprobar o rechazar; solicitud, cita y agenda cambian juntas.
export async function procesar(id, aprobar) {
  const resultado = await datos.procesar(id, aprobar, { estadoCitaEsperado, estaDisponible });
  if (resultado.noExiste) throw errores.noEncontrado('No existe la solicitud indicada.');
  if (resultado.yaProcesada) {
    throw new ErrorApp(409, 'SOLICITUD_YA_PROCESADA', `La solicitud ya no se encuentra Pendiente (está ${resultado.yaProcesada}) y no puede procesarse de nuevo.`);
  }
  if (resultado.inconsistente) {
    throw new ErrorApp(409, 'SOLICITUD_INCONSISTENTE',
      `La solicitud no puede procesarse: la cita está ${resultado.inconsistente}, lo que no corresponde al tipo de solicitud. No se modificó nada.`);
  }
  if (resultado.conflicto) {
    throw new ErrorApp(409, 'CONFLICTO_AGENDA',
      `No se puede aprobar: el período del ${resultado.conflicto.fecha} a las ${resultado.conflicto.hora} ya no está disponible en la agenda. No se modificó nada.`);
  }
  const solicitud = await detalle(id);
  return { solicitud, mensaje: `Solicitud de ${TIPOS[solicitud.tipo]} ${aprobar ? 'aprobada' : 'rechazada'}. La cita ${solicitud.cita.codigo} quedó ${solicitud.cita.estado}.` };
}
