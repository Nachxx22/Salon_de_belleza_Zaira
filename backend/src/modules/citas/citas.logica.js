// Reglas de Citas (dueño: Persona A). Por ahora: MCA-04 Consultar citas y
// MCA-12 Crear cita (Administrador), con el cálculo de disponibilidad.
// Fuente: CU-MCA-04 y CU-MCA-12 en Jira (ERS sección 3.2.2).
// Sin SQL (D-017): todo acceso a la base pasa por citas.datos.js,
// clientes.datos.js y servicios.datos.js.
import { randomInt } from 'node:crypto';
import { errores, ErrorApp } from '../../shared/errores.js';
import { hoyCostaRica, ahoraCostaRica } from '../../shared/fechas.js';
import { correo, fecha, telefono, textoOpcional, textoRequerido } from '../../shared/validacion.js';
import * as datos from './citas.datos.js';
import * as clientesDatos from '../clientes/clientes.datos.js';
import * as serviciosDatos from '../servicios/servicios.datos.js';

export const ESTADOS_CITA = ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'];
const INTERVALO_MINUTOS = 30; // MCA-12, restricción 9

// ---------------------------------------------------------------------------
// Horas y fechas
// ---------------------------------------------------------------------------
const dos = (n) => String(n).padStart(2, '0');

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function aHora(minutos) {
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

// 'YYYY-MM-DD' de una fecha real (rechaza 2026-02-30); la regla está en shared/validacion.js.
export const validarFecha = fecha;

// 1 = lunes … 7 = domingo, como dbo.Horario.DiaSemana.
export function diaSemana(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

// Hora de inicio 'HH:mm' con minutos 00 o 30 (MCA-12, restricción 9; CHECK de dbo.Cita).
export function validarHoraInicio(valor) {
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(valor)) {
    throw errores.datosInvalidos('La hora de inicio debe tener el formato HH:mm, con minutos 00 o 30.', { campo: 'hora' });
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Disponibilidad: un solo algoritmo, en el servidor (CONTRATOS_API.md)
// ---------------------------------------------------------------------------

// Une tramos de horario que se tocan o se superponen (09:00-12:00 + 12:00-18:00).
function unirTramos(tramos) {
  const ordenados = tramos.map((t) => [aMinutos(t.inicio), aMinutos(t.fin)]).sort((a, b) => a[0] - b[0]);
  const unidos = [];
  for (const [inicio, fin] of ordenados) {
    const ultimo = unidos.at(-1);
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin);
    else unidos.push([inicio, fin]);
  }
  return unidos;
}

// Horas de inicio posibles (cada 30 minutos) en las que cabe la duración completa
// sin chocar con bloqueos, citas Pendientes o Confirmadas ni reservas Pendientes
// (MCA-12, restricciones 9 a 11). `desdeMinuto` descarta horas ya pasadas de hoy.
export function horariosDisponibles(agenda, duracionMinutos, { desdeMinuto = 0 } = {}) {
  const ocupados = [
    ...agenda.bloqueos.map((b) => [aMinutos(b.inicio), aMinutos(b.fin)]),
    ...agenda.ocupados.map((o) => [aMinutos(o.inicio), aMinutos(o.inicio) + o.duracionMinutos]),
  ];
  const libres = [];
  for (const [inicio, fin] of unirTramos(agenda.horarios)) {
    const primero = Math.ceil(inicio / INTERVALO_MINUTOS) * INTERVALO_MINUTOS;
    for (let t = primero; t + duracionMinutos <= fin; t += INTERVALO_MINUTOS) {
      if (t < desdeMinuto) continue;
      const choca = ocupados.some(([a, b]) => t < b && a < t + duracionMinutos);
      if (!choca) libres.push(t);
    }
  }
  return libres.map(aHora);
}

// La administradora puede agendar el mismo día, sin anticipación mínima
// (MCA-12, restricciones 4 y 5), pero no en una hora que ya pasó ni en días pasados.
function opcionesDeFecha(fecha, ahora = new Date()) {
  const hoy = hoyCostaRica(ahora);
  if (fecha < hoy) {
    throw new ErrorApp(400, 'FECHA_PASADA', 'No se pueden agendar citas en fechas pasadas.', { campo: 'fecha' });
  }
  if (fecha > hoy) return { desdeMinuto: 0 };
  const horaActual = ahoraCostaRica(ahora).slice(11, 16);
  return { desdeMinuto: aMinutos(horaActual) + 1 };
}

// El cliente solo puede elegir desde el día calendario siguiente (MCA-01 y MCA-02, anticipación mínima).
export function opcionesCliente(fecha, ahora = new Date()) {
  if (fecha <= hoyCostaRica(ahora)) {
    throw new ErrorApp(400, 'FECHA_NO_PERMITIDA', 'Seleccione una fecha a partir de mañana: las citas se solicitan con un día de anticipación.', { campo: 'fecha' });
  }
  return { desdeMinuto: 0 };
}

// ---------------------------------------------------------------------------
// Servicios de la cita
// ---------------------------------------------------------------------------
export function validarIdsServicios(valor) {
  const lista = Array.isArray(valor) ? valor : typeof valor === 'string' && valor.trim() !== '' ? valor.split(',') : [];
  const ids = [...new Set(lista.map((v) => Number(v)))];
  if (ids.length === 0) {
    throw errores.datosInvalidos('Debe seleccionar al menos un servicio.', { campo: 'servicios' });
  }
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw errores.datosInvalidos('La lista de servicios no es válida.', { campo: 'servicios' });
  }
  return ids;
}

// Servicios activos y su duración total (MCA-12, restricciones 6 a 8).
async function serviciosActivos(ids) {
  const encontrados = await serviciosDatos.obtenerVariosPorId(ids);
  const porId = new Map(encontrados.map((s) => [s.id, s]));
  const servicios = ids.map((id) => porId.get(id));
  const noDisponible = servicios.find((s) => !s || s.estado !== 'Activo');
  if (noDisponible !== undefined) {
    const nombre = noDisponible ? `«${noDisponible.nombre}»` : 'seleccionado';
    throw new ErrorApp(409, 'SERVICIO_NO_DISPONIBLE', `El servicio ${nombre} no está disponible para citas nuevas.`, { campo: 'servicios' });
  }
  const duracionTotal = servicios.reduce((total, s) => total + s.duracionMinutos, 0);
  return { servicios, duracionTotal };
}

// ---------------------------------------------------------------------------
// Código de la cita: corto y difícil de adivinar (D-016)
// ---------------------------------------------------------------------------
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo por teléfono

export function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < 8; i += 1) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return `C-${codigo}`;
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

// Paso 13-14 de MCA-12: horas de inicio disponibles para una fecha y servicios.
export async function disponibilidadAdmin({ fecha, servicios }, ahora = new Date()) {
  const dia = validarFecha(fecha);
  const ids = validarIdsServicios(servicios);
  const opciones = opcionesDeFecha(dia, ahora);
  const { duracionTotal } = await serviciosActivos(ids);
  const agenda = await datos.leerAgendaDelDia(dia, diaSemana(dia));
  return {
    fecha: dia,
    duracionTotalMinutos: duracionTotal,
    horarios: horariosDisponibles(agenda, duracionTotal, opciones),
  };
}

// Pasos 5-7 de MCA-12: buscar al cliente por su teléfono.
export async function buscarCliente(valorTelefono) {
  return clientesDatos.buscarPorTelefono(telefono(valorTelefono));
}

// MCA-12 Crear cita (Administrador): queda Confirmada y no genera SolicitudCita.
// MCA-12 (administradora): Confirmada, sin solicitud, desde hoy.
export function crearCitaAdmin(entrada = {}, ahora = new Date()) {
  return registrarCitaNueva(entrada, ahora, { estado: 'Confirmada', conSolicitudCreacion: false, opcionesDe: opcionesDeFecha });
}

// MCA-01 (cliente): Pendiente, con SolicitudCita de creación, desde mañana.
export function crearCitaCliente(entrada = {}, ahora = new Date()) {
  return registrarCitaNueva(entrada, ahora, { estado: 'Pendiente', conSolicitudCreacion: true, opcionesDe: opcionesCliente });
}

async function registrarCitaNueva(entrada, ahora, { estado, conSolicitudCreacion, opcionesDe }) {
  // MCA-12 restricción 12 y MCA-01 restricción 11: nombre y teléfono obligatorios; correo opcional.
  const datosCliente = entrada.cliente ?? {};
  const correoEscrito = textoOpcional(datosCliente.correoElectronico, 'correo electrónico', { max: 254 });
  const cliente = {
    telefono: telefono(datosCliente.telefono),
    nombre: textoRequerido(datosCliente.nombre, 'nombre del cliente', { max: 150 }),
    correoElectronico: correoEscrito === null ? null : correo(correoEscrito),
  };

  const ids = validarIdsServicios(entrada.servicios);
  const fecha = validarFecha(entrada.fecha);
  const hora = validarHoraInicio(entrada.hora);
  const opciones = opcionesDe(fecha, ahora);

  const esDomicilio = entrada.esDomicilio ?? false;
  if (typeof esDomicilio !== 'boolean') {
    throw errores.datosInvalidos('El campo servicio a domicilio debe ser verdadero o falso.', { campo: 'esDomicilio' });
  }

  const { servicios, duracionTotal } = await serviciosActivos(ids);

  // MCA-12, restricciones 16 y 17.
  let direccion = null;
  let observaciones = null;
  if (esDomicilio) {
    if (servicios.some((s) => !s.permiteDomicilio)) {
      throw new ErrorApp(409, 'DOMICILIO_NO_DISPONIBLE',
        'La modalidad a domicilio no está disponible para todos los servicios seleccionados.', { campo: 'esDomicilio' });
    }
    direccion = textoRequerido(entrada.direccion, 'dirección', { max: 300 });
    observaciones = textoOpcional(entrada.observaciones, 'observaciones', { max: 500 });
  }

  const resultado = await datos.registrarCita(
    {
      codigo: generarCodigo(),
      cliente,
      fecha,
      diaSemana: diaSemana(fecha),
      hora,
      estado,
      conSolicitudCreacion,
      esDomicilio,
      direccion,
      observaciones,
      servicios,
    },
    // Paso 16: se vuelve a verificar dentro de la transacción, con el bloqueo tomado.
    (agenda) => horariosDisponibles(agenda, duracionTotal, opciones).includes(hora),
  );

  if (resultado.conflicto) {
    throw new ErrorApp(409, 'HORARIO_OCUPADO', 'El horario seleccionado ya no está disponible. Seleccione otro horario.', { campo: 'hora' });
  }
  return { cita: await detalle(resultado.id), clienteNuevo: resultado.clienteNuevo };
}

// MCA-04: filtros opcionales por fecha, estado y cliente (nombre o teléfono).
export async function listar(filtros = {}) {
  const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
  const fecha = vacio(filtros.fecha) ? null : validarFecha(filtros.fecha);
  let estado = null;
  if (!vacio(filtros.estado)) {
    if (!ESTADOS_CITA.includes(filtros.estado)) {
      throw errores.datosInvalidos(`El estado debe ser uno de: ${ESTADOS_CITA.join(', ')}.`, { campo: 'estado' });
    }
    estado = filtros.estado;
  }
  let cliente = vacio(filtros.cliente) ? null : textoRequerido(String(filtros.cliente), 'cliente', { max: 150 });
  // Un teléfono escrito como 8888-7777 se busca como 88887777 (D-016).
  if (cliente && /^[\d\s-]+$/.test(cliente)) cliente = cliente.replace(/[\s-]/g, '');

  const citas = await datos.listar({ fecha, estado, cliente });
  return citas.map((c) => ({ ...c, horaFin: aHora(aMinutos(c.hora) + c.duracionMinutos) }));
}

// MCA-04: detalle de una cita.
export async function detalle(id) {
  const cita = await datos.obtenerDetalle(id);
  if (!cita) throw errores.noEncontrado('No existe la cita solicitada.');
  const duracionMinutos = cita.servicios.reduce((total, s) => total + s.duracionAplicadaMinutos, 0);
  return { ...cita, duracionMinutos, horaFin: aHora(aMinutos(cita.hora) + duracionMinutos) };
}

// ---------------------------------------------------------------------------
// MCA-13 Reprogramar cita (Administrador) y MCA-14 Cancelar cita (Administrador)
// ---------------------------------------------------------------------------

// Errores comunes: solo citas Confirmadas sin una solicitud Pendiente (MCA-13 y MCA-14, restricciones 1 a 3).
function errorDeCambio(resultado, accion) {
  if (resultado.noExiste) return errores.noEncontrado('No existe la cita solicitada.');
  if (resultado.noConfirmada) {
    return new ErrorApp(409, 'CITA_NO_CONFIRMADA',
      `Solo se pueden ${accion} citas Confirmadas; esta cita está ${resultado.noConfirmada}.`);
  }
  if (resultado.solicitudPendiente) {
    return new ErrorApp(409, 'SOLICITUD_PENDIENTE',
      `La cita tiene una solicitud pendiente: primero debe procesarse (MCA-06) antes de ${accion}la.`);
  }
  return null;
}

function verificarCambiable(cita, accion) {
  const error = errorDeCambio(
    { noConfirmada: cita.estado !== 'Confirmada' ? cita.estado : null, solicitudPendiente: cita.tieneSolicitudPendiente },
    accion,
  );
  if (error) throw error;
}

// MCA-13 pasos 5-7: horas libres para la nueva fecha, con la duración de los servicios de la cita.
export async function disponibilidadReprogramar(id, valorFecha, ahora = new Date()) {
  const cita = await detalle(id);
  verificarCambiable(cita, 'reprogramar');
  const dia = validarFecha(valorFecha);
  const opciones = opcionesDeFecha(dia, ahora);
  const agenda = await datos.leerAgendaDelDia(dia, diaSemana(dia), null, id);
  return { fecha: dia, duracionTotalMinutos: cita.duracionMinutos, horarios: horariosDisponibles(agenda, cita.duracionMinutos, opciones) };
}

// MCA-13: nueva fecha y hora; servicios y estado Confirmada se conservan; no crea SolicitudCita.
export async function reprogramar(id, entrada = {}, ahora = new Date()) {
  const fechaNueva = validarFecha(entrada.fecha);
  const hora = validarHoraInicio(entrada.hora);
  const opciones = opcionesDeFecha(fechaNueva, ahora);
  const resultado = await datos.reprogramarCita(
    id,
    { fecha: fechaNueva, diaSemana: diaSemana(fechaNueva), hora },
    (agenda, duracion) => horariosDisponibles(agenda, duracion, opciones).includes(hora),
  );
  const error = errorDeCambio(resultado, 'reprogramar');
  if (error) throw error;
  if (resultado.conflicto) {
    throw new ErrorApp(409, 'HORARIO_OCUPADO', 'El horario seleccionado ya no está disponible. Seleccione otro horario.', { campo: 'hora' });
  }
  return detalle(id);
}

// MCA-14: motivo obligatorio; la cita pasa a Cancelada y libera su período.
export async function cancelar(id, entrada = {}) {
  const vacioMotivo = entrada.motivo === undefined || entrada.motivo === null || String(entrada.motivo).trim() === '';
  if (vacioMotivo) throw errores.datosInvalidos('El motivo de cancelación es obligatorio.', { campo: 'motivo' });
  const motivo = textoRequerido(entrada.motivo, 'motivo', { max: 500 });
  const resultado = await datos.cancelarCita(id, motivo);
  const error = errorDeCambio(resultado, 'cancelar');
  if (error) throw error;
  return detalle(id);
}

// MCA-07 Marcar cita como completada: solo Confirmadas sin solicitud pendiente. No crea ventas.
export async function completar(id) {
  const resultado = await datos.completarCita(id);
  const error = errorDeCambio(resultado, 'completar');
  if (error) throw error;
  return detalle(id);
}

// ---------------------------------------------------------------------------
// Funciones públicas del cliente: MCA-01, MCA-02 y MCA-03 (sin cuenta)
// ---------------------------------------------------------------------------

// Horas libres para una cita nueva del cliente (desde mañana).
export async function disponibilidadPublica({ fecha: valorFecha, servicios }, ahora = new Date()) {
  const dia = validarFecha(valorFecha);
  const ids = validarIdsServicios(servicios);
  const opciones = opcionesCliente(dia, ahora);
  const { duracionTotal } = await serviciosActivos(ids);
  const agenda = await datos.leerAgendaDelDia(dia, diaSemana(dia));
  return { fecha: dia, duracionTotalMinutos: duracionTotal, horarios: horariosDisponibles(agenda, duracionTotal, opciones) };
}

// Lo que ve el cliente de su cita: sin datos internos ni de contacto.
function vistaCliente(cita, tipoPendiente) {
  return {
    codigo: cita.codigo,
    fecha: cita.fecha,
    hora: cita.hora,
    horaFin: cita.horaFin,
    duracionMinutos: cita.duracionMinutos,
    estado: cita.estado,
    esDomicilio: cita.esDomicilio,
    servicios: cita.servicios.map((s) => ({ nombre: s.nombre, duracionMinutos: s.duracionAplicadaMinutos })),
    solicitudPendiente: tipoPendiente, // 'Creacion', 'Reprogramacion', 'Cancelacion' o null
    puedeSolicitarCambios: cita.estado === 'Confirmada' && !tipoPendiente,
  };
}

// Código y teléfono deben corresponder a la misma cita; el mensaje no dice cuál falla (MCA-02 y MCA-03).
async function citaDelCliente(entrada = {}) {
  const codigo = textoRequerido(entrada.codigo, 'código de cita', { max: 30 }).toUpperCase();
  const tel = telefono(entrada.telefono);
  const id = await datos.idPorCodigoYTelefono(codigo, tel);
  if (!id) {
    throw new ErrorApp(404, 'CITA_NO_ENCONTRADA', 'No se encontró una cita con ese código y ese teléfono. Revise los datos.');
  }
  return id;
}

function errorCliente(resultado, accion) {
  if (resultado.noConfirmada) {
    return new ErrorApp(409, 'CITA_NO_CONFIRMADA', `La cita no se encuentra en un estado válido para solicitar su ${accion}.`);
  }
  if (resultado.solicitudPendiente) {
    return new ErrorApp(409, 'SOLICITUD_PENDIENTE', 'Ya existe una solicitud en proceso para esta cita. Espere a que sea resuelta.');
  }
  if (resultado.noExiste) return errores.noEncontrado('No existe la cita solicitada.');
  return null;
}

export async function consultarCitaCliente(entrada) {
  const id = await citaDelCliente(entrada);
  return vistaCliente(await detalle(id), await datos.tipoSolicitudPendiente(id));
}

// MCA-02 pasos 7-11: horas libres para la nueva fecha (desde mañana), con la duración de sus servicios.
export async function disponibilidadReprogramacionCliente(entrada = {}, ahora = new Date()) {
  const id = await citaDelCliente(entrada);
  const cita = await detalle(id);
  const tipoPendiente = await datos.tipoSolicitudPendiente(id);
  const error = errorCliente({ noConfirmada: cita.estado !== 'Confirmada', solicitudPendiente: Boolean(tipoPendiente) }, 'reprogramación');
  if (error) throw error;
  const dia = validarFecha(entrada.fecha);
  const opciones = opcionesCliente(dia, ahora);
  const agenda = await datos.leerAgendaDelDia(dia, diaSemana(dia), null, id);
  return { fecha: dia, duracionTotalMinutos: cita.duracionMinutos, horarios: horariosDisponibles(agenda, cita.duracionMinutos, opciones) };
}

// MCA-02: la cita pasa a Pendiente y la fecha propuesta queda en la solicitud.
export async function solicitarReprogramacionCliente(entrada = {}, ahora = new Date()) {
  const id = await citaDelCliente(entrada);
  const fechaNueva = validarFecha(entrada.fecha);
  const hora = validarHoraInicio(entrada.hora);
  const opciones = opcionesCliente(fechaNueva, ahora);
  const resultado = await datos.solicitarReprogramacion(
    id,
    { fecha: fechaNueva, diaSemana: diaSemana(fechaNueva), hora },
    (agenda, duracion) => horariosDisponibles(agenda, duracion, opciones).includes(hora),
  );
  const error = errorCliente(resultado, 'reprogramación');
  if (error) throw error;
  if (resultado.conflicto) {
    throw new ErrorApp(409, 'HORARIO_OCUPADO', 'El horario seleccionado ya no está disponible. Seleccione otro horario.', { campo: 'hora' });
  }
  return vistaCliente(await detalle(id), 'Reprogramacion');
}

// MCA-03: la cita sigue Confirmada hasta que la administradora procese la solicitud.
export async function solicitarCancelacionCliente(entrada = {}) {
  const id = await citaDelCliente(entrada);
  const resultado = await datos.solicitarCancelacion(id);
  const error = errorCliente(resultado, 'cancelación');
  if (error) throw error;
  return vistaCliente(await detalle(id), 'Cancelacion');
}
