import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyCostaRica, ahoraCostaRica, fechaDeSql, horaDeSql, fechaHoraDeSql } from '../src/shared/fechas.js';

test('la fecha y la hora de Costa Rica no dependen de la zona de la computadora (D-015)', () => {
  // 6 nov 2026 a las 03:30 UTC son las 21:30 del 5 nov en Costa Rica (UTC-6).
  const instante = new Date('2026-11-06T03:30:15Z');
  assert.equal(hoyCostaRica(instante), '2026-11-05');
  assert.equal(ahoraCostaRica(instante), '2026-11-05 21:30:15');
  // La medianoche se escribe 00, no 24.
  assert.equal(ahoraCostaRica(new Date('2026-11-06T06:00:00Z')), '2026-11-06 00:00:00');
});

test('los valores que entrega SQL Server se leen tal como se guardaron', () => {
  assert.equal(fechaDeSql(new Date('2026-11-12T00:00:00Z')), '2026-11-12');
  assert.equal(horaDeSql(new Date('1970-01-01T07:30:00Z')), '07:30');
  assert.equal(fechaHoraDeSql(new Date('2026-11-05T21:30:00Z')), '2026-11-05 21:30');
  assert.equal(fechaDeSql(null), null);
  assert.equal(horaDeSql(undefined), null);
});
