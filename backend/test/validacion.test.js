import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telefono, correo, enteroPositivo, montoNoNegativo, montoPositivo, textoRequerido } from '../src/shared/validacion.js';

test('telefono acepta 8 dígitos y los normaliza como 0000-0000', () => {
  assert.equal(telefono('88887777'), '8888-7777');
  assert.equal(telefono('8888 7777'), '8888-7777');
  assert.equal(telefono('8888-7777'), '8888-7777');
  assert.throws(() => telefono('1234'), { codigo: 'DATOS_INVALIDOS' });
});

test('correo valida el formato y lo guarda en minúscula', () => {
  assert.equal(correo('Ventas@Ejemplo.com'), 'ventas@ejemplo.com');
  assert.throws(() => correo('no-es-correo'), { codigo: 'DATOS_INVALIDOS' });
});

test('enteroPositivo rechaza cero, negativos y decimales', () => {
  assert.equal(enteroPositivo(3, 'cantidad'), 3);
  assert.equal(enteroPositivo('5', 'cantidad'), 5);
  assert.equal(enteroPositivo(0, 'stock', { permitirCero: true }), 0);
  for (const malo of [0, -1, 1.5, 'abc', null]) {
    assert.throws(() => enteroPositivo(malo, 'cantidad'), { codigo: 'DATOS_INVALIDOS' });
  }
});

test('montos: no negativos y positivos según el ERS', () => {
  assert.equal(montoNoNegativo(0, 'precio'), 0);
  assert.equal(montoNoNegativo('1500.555', 'precio'), 1500.56);
  assert.throws(() => montoNoNegativo(-1, 'precio'), { codigo: 'DATOS_INVALIDOS' });
  assert.throws(() => montoPositivo(0, 'precio final'), { codigo: 'DATOS_INVALIDOS' });
});

test('textoRequerido recorta espacios y exige contenido', () => {
  assert.equal(textoRequerido('  Corte  ', 'nombre'), 'Corte');
  assert.throws(() => textoRequerido('   ', 'nombre'), { codigo: 'DATOS_INVALIDOS' });
});
