// Reglas de Citas que no necesitan SQL Server (MCA-12 y MCA-04). Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diaSemana,
  generarCodigo,
  horariosDisponibles,
  validarFecha,
  validarHoraInicio,
  validarIdsServicios,
} from '../src/modules/citas/citas.logica.js';

const agendaVacia = { horarios: [{ inicio: '09:00', fin: '12:00' }], bloqueos: [], ocupados: [] };

function codigoError(funcion) {
  try {
    funcion();
  } catch (error) {
    return error.codigo;
  }
  return null;
}

test('las horas de inicio van cada 30 minutos y cubren toda la duración (CU-MCA-12, criterio 9)', () => {
  assert.deepEqual(horariosDisponibles(agendaVacia, 60), ['09:00', '09:30', '10:00', '10:30', '11:00']);
  assert.deepEqual(horariosDisponibles(agendaVacia, 180), ['09:00']);
  assert.deepEqual(horariosDisponibles(agendaVacia, 181), []);
});

test('la duración total es la suma de los servicios: 45 + 45 minutos no caben a las 11:00 (criterio 6)', () => {
  assert.equal(horariosDisponibles(agendaVacia, 90).includes('11:00'), false);
  assert.equal(horariosDisponibles(agendaVacia, 90).includes('10:30'), true);
});

test('la disponibilidad considera bloqueos, citas y reservas pendientes (criterio 10)', () => {
  const agenda = {
    horarios: [{ inicio: '09:00', fin: '13:00' }],
    bloqueos: [{ inicio: '12:00', fin: '13:00' }],
    ocupados: [
      { inicio: '09:30', duracionMinutos: 45 }, // cita: ocupa 09:30-10:15
      { inicio: '11:00', duracionMinutos: 30 }, // reserva pendiente: 11:00-11:30
    ],
  };
  assert.deepEqual(horariosDisponibles(agenda, 30), ['09:00', '10:30', '11:30']);
  assert.deepEqual(horariosDisponibles(agenda, 60), []);
});

test('sin horario regular para ese día no hay horas disponibles', () => {
  assert.deepEqual(horariosDisponibles({ horarios: [], bloqueos: [], ocupados: [] }, 30), []);
});

test('tramos de horario contiguos se unen y un horario que no empieza en :00 o :30 se redondea', () => {
  const agenda = { horarios: [{ inicio: '09:15', fin: '10:00' }, { inicio: '10:00', fin: '11:00' }], bloqueos: [], ocupados: [] };
  assert.deepEqual(horariosDisponibles(agenda, 60), ['09:30', '10:00']);
});

test('el mismo día solo se ofrecen horas que todavía no han pasado (criterio 7)', () => {
  // 10:05 → desde el minuto 606.
  assert.deepEqual(horariosDisponibles(agendaVacia, 60, { desdeMinuto: 606 }), ['10:30', '11:00']);
});

test('la fecha debe existir y el día de la semana sigue a dbo.Horario (1 lunes … 7 domingo)', () => {
  assert.equal(validarFecha('2026-11-09'), '2026-11-09');
  assert.equal(codigoError(() => validarFecha('2026-02-30')), 'DATOS_INVALIDOS');
  assert.equal(codigoError(() => validarFecha('09/11/2026')), 'DATOS_INVALIDOS');
  assert.equal(diaSemana('2026-11-09'), 1); // lunes
  assert.equal(diaSemana('2026-11-14'), 6); // sábado
  assert.equal(diaSemana('2026-11-15'), 7); // domingo
});

test('la hora de inicio solo acepta minutos 00 o 30', () => {
  assert.equal(validarHoraInicio('09:30'), '09:30');
  assert.equal(codigoError(() => validarHoraInicio('09:15')), 'DATOS_INVALIDOS');
  assert.equal(codigoError(() => validarHoraInicio('9:00')), 'DATOS_INVALIDOS');
});

test('se debe seleccionar al menos un servicio (CU-MCA-12, flujo alterno)', () => {
  assert.equal(codigoError(() => validarIdsServicios([])), 'DATOS_INVALIDOS');
  assert.equal(codigoError(() => validarIdsServicios(['a'])), 'DATOS_INVALIDOS');
  assert.deepEqual(validarIdsServicios('1,2,2'), [1, 2]);
  assert.deepEqual(validarIdsServicios([3, 1]), [3, 1]);
});

test('el código de la cita es corto, sin caracteres confusos y distinto cada vez (criterio 14)', () => {
  const codigos = new Set(Array.from({ length: 500 }, generarCodigo));
  assert.equal(codigos.size, 500);
  for (const codigo of codigos) assert.match(codigo, /^C-[A-HJ-NP-Z2-9]{8}$/);
});

test('el cliente solo puede elegir desde el día siguiente (CU-MCA-01, criterios 4 y 5)', async () => {
  const { opcionesCliente } = await import('../src/modules/citas/citas.logica.js');
  // 6 nov 2026 a las 22:00 en Costa Rica (7 nov 04:00 UTC).
  const ahora = new Date('2026-11-07T04:00:00Z');
  assert.equal(codigoError(() => opcionesCliente('2026-11-06', ahora)), 'FECHA_NO_PERMITIDA');
  assert.equal(codigoError(() => opcionesCliente('2026-11-05', ahora)), 'FECHA_NO_PERMITIDA');
  assert.deepEqual(opcionesCliente('2026-11-07', ahora), { desdeMinuto: 0 });
});

test('cada tipo de solicitud exige su estado de cita (CU-MCA-06, restricciones 5 a 7)', async () => {
  const { estadoCitaEsperado, estaDisponible } = await import('../src/modules/solicitudes/solicitudes.logica.js');
  assert.equal(estadoCitaEsperado('Creacion'), 'Pendiente');
  assert.equal(estadoCitaEsperado('Reprogramacion'), 'Pendiente');
  assert.equal(estadoCitaEsperado('Cancelacion'), 'Confirmada');
  // Al aprobar, el período debe seguir dentro del horario y libre.
  assert.equal(estaDisponible(agendaVacia, '10:00', 60), true);
  assert.equal(estaDisponible(agendaVacia, '11:30', 60), false);
  assert.equal(estaDisponible({ ...agendaVacia, bloqueos: [{ inicio: '10:00', fin: '10:30' }] }, '10:00', 30), false);
});
