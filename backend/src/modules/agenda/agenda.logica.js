// Reglas de MCA-08 a MCA-11, configuración de agenda (dueño: Persona A).
// Fuente: CU-MCA-08 a CU-MCA-11 en Jira (ERS sección 3.2.2).
// Sin SQL (D-017): todo acceso a la base pasa por agenda.datos.js. Las
// funciones `problema...` son la regla que agenda.datos.js aplica dentro de la
// transacción con el bloqueo 'agenda' tomado.
import { ErrorApp, errores } from '../../shared/errores.js';
import { ahoraCostaRica, hoyCostaRica } from '../../shared/fechas.js';
import { enteroPositivo, fecha as validarFecha } from '../../shared/validacion.js';
import * as datos from './agenda.datos.js';

export const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

export function validarHora(valor, campo) {
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
    throw errores.datosInvalidos(`La ${campo} debe tener el formato HH:mm.`, { campo });
  }
  return valor;
}

// MCA-08 restricción 4: la hora final debe ser posterior a la inicial.
function validarRango(entrada) {
  const horaInicio = validarHora(entrada.horaInicio, 'hora de inicio');
  const horaFin = validarHora(entrada.horaFin, 'hora de finalización');
  if (aMinutos(horaFin) <= aMinutos(horaInicio)) {
    throw errores.datosInvalidos('El rango horario no es válido: la hora de finalización debe ser posterior a la hora de inicio.', { campo: 'hora de finalización' });
  }
  return { horaInicio, horaFin };
}

export function validarHorario(entrada = {}) {
  const diaSemana = enteroPositivo(entrada.diaSemana, 'día de la semana');
  if (diaSemana > 7) throw errores.datosInvalidos('El día de la semana debe ser de 1 (lunes) a 7 (domingo).', { campo: 'día de la semana' });
  return { diaSemana, ...validarRango(entrada) };
}

export function validarBloqueo(entrada = {}, hoy = hoyCostaRica()) {
  const fecha = validarFecha(entrada.fecha);
  if (fecha < hoy) throw new ErrorApp(400, 'FECHA_PASADA', 'No se pueden bloquear fechas pasadas.', { campo: 'fecha' });
  return { fecha, ...validarRango(entrada) };
}

const seSuperponen = (a, b) => aMinutos(a.horaInicio) < aMinutos(b.horaFin) && aMinutos(b.horaInicio) < aMinutos(a.horaFin);
const finDe = (o) => aMinutos(o.inicio) + o.duracionMinutos;

// Une tramos que se tocan (09:00-12:00 + 12:00-18:00) y dice si una ocupación cabe completa en alguno.
function cubre(tramos, ocupacion) {
  const ordenados = tramos.map((t) => [aMinutos(t.horaInicio), aMinutos(t.horaFin)]).sort((a, b) => a[0] - b[0]);
  const unidos = [];
  for (const [i, f] of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && i <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], f);
    else unidos.push([i, f]);
  }
  return unidos.some(([i, f]) => aMinutos(ocupacion.inicio) >= i && finDe(ocupacion) <= f);
}

// Mensajes de los flujos alternos: citas confirmadas («citas activas») o reservas pendientes.
function errorAfectadas(afectadas, accion) {
  const confirmadas = afectadas.filter((o) => o.origen === 'cita' && o.estado === 'Confirmada');
  const lista = (grupo) => [...new Set(grupo.map((o) => `${o.codigo} (${o.fecha} ${o.inicio})`))].join(', ');
  if (confirmadas.length > 0) {
    return new ErrorApp(409, 'AGENDA_CITAS_AFECTADAS',
      `No se puede ${accion}: existen citas confirmadas afectadas: ${lista(confirmadas)}.`, { citas: confirmadas.map((o) => o.codigo) });
  }
  return new ErrorApp(409, 'AGENDA_RESERVAS_AFECTADAS',
    `No se puede ${accion}: existen citas o solicitudes pendientes afectadas: ${lista(afectadas)}.`, { citas: afectadas.map((o) => o.codigo) });
}

// MCA-08 y MCA-10 para un horario regular.
export function problemaHorario(horario, { otros, anterior }, accion = 'guardar el horario') {
  const choque = otros.find((h) => seSuperponen(h, horario));
  if (choque) {
    return new ErrorApp(409, 'AGENDA_SUPERPOSICION',
      `El horario se superpone con otro horario del ${DIAS[horario.diaSemana]} (${choque.horaInicio} a ${choque.horaFin}).`);
  }
  if (anterior) {
    // MCA-10 restricciones 5 y 6: el día anterior no puede dejar fuera citas o reservas.
    const tramos = anterior.diaSemana === horario.diaSemana ? [...anterior.restantes, horario] : anterior.restantes;
    const afectadas = anterior.ocupaciones.filter((o) => !cubre(tramos, o));
    if (afectadas.length > 0) return errorAfectadas(afectadas, accion);
  }
  return null;
}

// MCA-11 para un horario regular: lo que queda del día debe seguir cubriendo citas y reservas.
export function problemaEliminarHorario({ restantes, ocupaciones }) {
  const afectadas = ocupaciones.filter((o) => !cubre(restantes, o));
  return afectadas.length > 0 ? errorAfectadas(afectadas, 'eliminar el horario') : null;
}

// MCA-08 y MCA-10 para un bloqueo: sin superponerse con otro bloqueo ni con citas o reservas.
export function problemaBloqueo(bloqueo, { otros, ocupaciones }, accion = 'guardar el bloqueo') {
  const choque = otros.find((b) => seSuperponen(b, bloqueo));
  if (choque) {
    return new ErrorApp(409, 'AGENDA_SUPERPOSICION',
      `El bloqueo se superpone con otro bloqueo del ${bloqueo.fecha} (${choque.horaInicio} a ${choque.horaFin}).`);
  }
  const rango = { horaInicio: bloqueo.horaInicio, horaFin: bloqueo.horaFin };
  const afectadas = ocupaciones.filter((o) => {
    const fin = finDe(o);
    const horaFin = `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
    return seSuperponen(rango, { horaInicio: o.inicio, horaFin });
  });
  return afectadas.length > 0 ? errorAfectadas(afectadas, accion) : null;
}

function desdeAhora(ahora = new Date()) {
  return { hoy: hoyCostaRica(ahora), ahora: ahoraCostaRica(ahora).slice(11, 16) };
}

function resolver(resultado, noExiste) {
  if (resultado.noExiste) throw errores.noEncontrado(noExiste);
  if (resultado.problema) throw resultado.problema;
  return resultado;
}

// MCA-09 Consultar configuración de agenda: horarios y bloqueos, diferenciados.
export async function consultar() {
  const [horarios, bloqueos] = await Promise.all([datos.listarHorarios(), datos.listarBloqueos()]);
  return {
    horarios: horarios.map((h) => ({ ...h, tipo: 'Horario regular', dia: DIAS[h.diaSemana] })),
    bloqueos: bloqueos.map((b) => ({ ...b, tipo: 'Bloqueo de agenda' })),
  };
}

export async function registrarHorario(entrada) {
  const horario = validarHorario(entrada);
  const { id } = resolver(await datos.guardarHorario(null, horario, desdeAhora(), (c) => problemaHorario(horario, c, 'registrar el horario')));
  return { ...(await datos.obtenerHorario(id)), tipo: 'Horario regular', dia: DIAS[horario.diaSemana] };
}

export async function modificarHorario(id, entrada) {
  const horario = validarHorario(entrada);
  resolver(await datos.guardarHorario(id, horario, desdeAhora(), (c) => problemaHorario(horario, c, 'modificar el horario')),
    'No existe el horario solicitado.');
  return { ...(await datos.obtenerHorario(id)), tipo: 'Horario regular', dia: DIAS[horario.diaSemana] };
}

export async function eliminarHorario(id) {
  const { eliminado } = resolver(await datos.eliminarHorario(id, desdeAhora(), problemaEliminarHorario), 'No existe el horario solicitado.');
  return { ...eliminado, tipo: 'Horario regular', dia: DIAS[eliminado.diaSemana] };
}

export async function registrarBloqueo(entrada) {
  const bloqueo = validarBloqueo(entrada);
  const { id } = resolver(await datos.guardarBloqueo(null, bloqueo, (c) => problemaBloqueo(bloqueo, c, 'registrar el bloqueo')));
  return { ...(await datos.obtenerBloqueo(id)), tipo: 'Bloqueo de agenda' };
}

export async function modificarBloqueo(id, entrada) {
  const bloqueo = validarBloqueo(entrada);
  resolver(await datos.guardarBloqueo(id, bloqueo, (c) => problemaBloqueo(bloqueo, c, 'modificar el bloqueo')), 'No existe el bloqueo solicitado.');
  return { ...(await datos.obtenerBloqueo(id)), tipo: 'Bloqueo de agenda' };
}

export async function eliminarBloqueo(id) {
  const { eliminado } = resolver(await datos.eliminarBloqueo(id), 'No existe el bloqueo solicitado.');
  return { ...eliminado, tipo: 'Bloqueo de agenda' };
}
