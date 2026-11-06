// Reglas de MCA-08 a MCA-11 que no necesitan SQL Server. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  problemaBloqueo,
  problemaEliminarHorario,
  problemaHorario,
  validarBloqueo,
  validarHorario,
} from '../src/modules/agenda/agenda.logica.js';

function codigoError(funcion) {
  try {
    funcion();
  } catch (error) {
    return error.codigo;
  }
  return null;
}

const confirmada = { origen: 'cita', codigo: 'C-AAAA2222', estado: 'Confirmada', fecha: '2026-11-16', inicio: '10:00', duracionMinutos: 60 };
const pendiente = { origen: 'solicitud', codigo: 'C-BBBB3333', estado: 'Pendiente', fecha: '2026-11-16', inicio: '15:00', duracionMinutos: 30 };

test('la hora final debe ser posterior a la inicial (CU-MCA-08, criterio 4)', () => {
  assert.equal(codigoError(() => validarHorario({ diaSemana: 1, horaInicio: '12:00', horaFin: '12:00' })), 'DATOS_INVALIDOS');
  assert.equal(codigoError(() => validarHorario({ diaSemana: 1, horaInicio: '13:00', horaFin: '09:00' })), 'DATOS_INVALIDOS');
  assert.deepEqual(validarHorario({ diaSemana: '6', horaInicio: '08:00', horaFin: '14:00' }), { diaSemana: 6, horaInicio: '08:00', horaFin: '14:00' });
});

test('el día va de 1 (lunes) a 7 (domingo) y las horas son HH:mm (CU-MCA-08, criterio 3)', () => {
  assert.equal(codigoError(() => validarHorario({ diaSemana: 8, horaInicio: '08:00', horaFin: '09:00' })), 'DATOS_INVALIDOS');
  assert.equal(codigoError(() => validarHorario({ diaSemana: 1, horaInicio: '8:00', horaFin: '09:00' })), 'DATOS_INVALIDOS');
});

test('un bloqueo necesita una fecha válida que no haya pasado', () => {
  assert.equal(codigoError(() => validarBloqueo({ fecha: '2026-11-05', horaInicio: '08:00', horaFin: '09:00' }, '2026-11-06')), 'FECHA_PASADA');
  assert.equal(validarBloqueo({ fecha: '2026-11-06', horaInicio: '08:00', horaFin: '09:00' }, '2026-11-06').fecha, '2026-11-06');
});

test('no se superponen horarios del mismo día; tocarse sí se permite (CU-MCA-08, criterio 5)', () => {
  const otros = [{ id: 1, diaSemana: 1, horaInicio: '09:00', horaFin: '12:00' }];
  assert.equal(problemaHorario({ diaSemana: 1, horaInicio: '11:00', horaFin: '14:00' }, { otros, anterior: null }).codigo, 'AGENDA_SUPERPOSICION');
  assert.equal(problemaHorario({ diaSemana: 1, horaInicio: '12:00', horaFin: '18:00' }, { otros, anterior: null }), null);
});

test('modificar un horario no puede dejar fuera una cita confirmada (CU-MCA-10, criterio 6)', () => {
  const anterior = { diaSemana: 1, restantes: [], ocupaciones: [confirmada] };
  const error = problemaHorario({ diaSemana: 1, horaInicio: '11:00', horaFin: '18:00' }, { otros: [], anterior });
  assert.equal(error.codigo, 'AGENDA_CITAS_AFECTADAS');
  assert.match(error.message, /C-AAAA2222/);
  // Mover el horario a otro día también deja sin cubrir la cita del lunes.
  assert.equal(problemaHorario({ diaSemana: 2, horaInicio: '09:00', horaFin: '18:00' }, { otros: [], anterior }).codigo, 'AGENDA_CITAS_AFECTADAS');
  // Si la sigue cubriendo, se acepta.
  assert.equal(problemaHorario({ diaSemana: 1, horaInicio: '09:00', horaFin: '11:00' }, { otros: [], anterior }), null);
});

test('ni dejar fuera una reserva pendiente (CU-MCA-10, criterio 7)', () => {
  const anterior = { diaSemana: 1, restantes: [], ocupaciones: [pendiente] };
  assert.equal(problemaHorario({ diaSemana: 1, horaInicio: '09:00', horaFin: '15:00' }, { otros: [], anterior }).codigo, 'AGENDA_RESERVAS_AFECTADAS');
});

test('eliminar un horario se impide si deja fuera citas o reservas (CU-MCA-11, criterios 3 y 4)', () => {
  assert.equal(problemaEliminarHorario({ restantes: [], ocupaciones: [confirmada] }).codigo, 'AGENDA_CITAS_AFECTADAS');
  assert.equal(problemaEliminarHorario({ restantes: [], ocupaciones: [pendiente] }).codigo, 'AGENDA_RESERVAS_AFECTADAS');
  // Otro tramo del mismo día que la cubre permite eliminarlo.
  const restantes = [{ horaInicio: '09:00', horaFin: '12:00' }, { horaInicio: '12:00', horaFin: '16:00' }];
  assert.equal(problemaEliminarHorario({ restantes, ocupaciones: [confirmada, pendiente] }), null);
  // Sin citas activas (las Canceladas o Completadas no llegan aquí) se puede eliminar.
  assert.equal(problemaEliminarHorario({ restantes: [], ocupaciones: [] }), null);
});

test('un bloqueo no se superpone con otro ni con citas o reservas (CU-MCA-08, criterios 5 y 6)', () => {
  const bloqueo = { fecha: '2026-11-16', horaInicio: '10:30', horaFin: '11:30' };
  assert.equal(problemaBloqueo(bloqueo, { otros: [{ horaInicio: '11:00', horaFin: '12:00' }], ocupaciones: [] }).codigo, 'AGENDA_SUPERPOSICION');
  assert.equal(problemaBloqueo(bloqueo, { otros: [], ocupaciones: [confirmada] }).codigo, 'AGENDA_CITAS_AFECTADAS');
  assert.equal(problemaBloqueo({ ...bloqueo, horaInicio: '15:00', horaFin: '16:00' }, { otros: [], ocupaciones: [pendiente] }).codigo, 'AGENDA_RESERVAS_AFECTADAS');
  // Justo después de la cita (termina 11:00) sí se puede.
  assert.equal(problemaBloqueo({ ...bloqueo, horaInicio: '11:00', horaFin: '12:00' }, { otros: [], ocupaciones: [confirmada] }), null);
});
