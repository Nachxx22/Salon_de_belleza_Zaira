// Reglas de MS-01 y MS-03 que no necesitan SQL Server. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aServicio, validarServicio } from '../src/modules/servicios/servicios.logica.js';

const valido = {
  nombre: 'Corte de cabello',
  descripcion: 'Corte y secado.',
  precioAproximado: 6000,
  duracionMinutos: 45,
  permiteDomicilio: true,
};

function errorDe(entrada) {
  try {
    validarServicio(entrada);
  } catch (error) {
    return error;
  }
  return null;
}

test('un servicio completo y válido se acepta (CU-MS-01, criterios 1 a 5)', () => {
  assert.deepEqual(validarServicio(valido), valido);
});

test('el nombre y la descripción se recortan y no pueden quedar vacíos (CU-MS-01, criterio 1)', () => {
  const limpio = validarServicio({ ...valido, nombre: '  Tinte  ', descripcion: ' Color completo. ' });
  assert.equal(limpio.nombre, 'Tinte');
  assert.equal(limpio.descripcion, 'Color completo.');
  assert.equal(errorDe({ ...valido, nombre: '   ' }).codigo, 'DATOS_INVALIDOS');
});

test('si faltan datos obligatorios, indica cuáles faltan y no registra (CU-MS-01, flujo alterno)', () => {
  const error = errorDe({ nombre: 'Tinte' });
  assert.equal(error.codigo, 'DATOS_INVALIDOS');
  assert.match(error.message, /descripción/);
  assert.match(error.message, /precio aproximado/);
  assert.match(error.message, /duración en minutos/);
});

test('la duración debe ser un entero mayor que cero en minutos (CU-MS-01, criterio 3)', () => {
  assert.equal(errorDe({ ...valido, duracionMinutos: 0 }).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe({ ...valido, duracionMinutos: -30 }).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe({ ...valido, duracionMinutos: 45.5 }).codigo, 'DATOS_INVALIDOS');
  assert.equal(validarServicio({ ...valido, duracionMinutos: '60' }).duracionMinutos, 60);
});

test('el precio aproximado no puede ser negativo ni inválido (CU-MS-01, restricción 4)', () => {
  assert.equal(errorDe({ ...valido, precioAproximado: -1 }).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe({ ...valido, precioAproximado: 'mucho' }).codigo, 'DATOS_INVALIDOS');
  assert.equal(validarServicio({ ...valido, precioAproximado: 1500.555 }).precioAproximado, 1500.56);
});

test('la atención a domicilio es opcional y, si viene, debe ser verdadero o falso (CU-MS-01, criterio 5)', () => {
  const sinDomicilio = { ...valido };
  delete sinDomicilio.permiteDomicilio;
  assert.equal(validarServicio(sinDomicilio).permiteDomicilio, false);
  assert.equal(errorDe({ ...valido, permiteDomicilio: 'sí' }).codigo, 'DATOS_INVALIDOS');
});

test('un valor demasiado largo se rechaza con el campo indicado', () => {
  const error = errorDe({ ...valido, nombre: 'a'.repeat(101) });
  assert.equal(error.codigo, 'DATOS_INVALIDOS');
  assert.equal(error.detalles.campo, 'nombre');
});

test('la forma que se entrega al cliente usa camelCase y precio numérico', () => {
  const salida = aServicio({
    Id: 3,
    Nombre: 'Tinte',
    Descripcion: 'Color completo.',
    PrecioAproximado: '12000.00',
    DuracionMinutos: 90,
    PermiteDomicilio: 0,
    Estado: 'Activo',
  });
  assert.deepEqual(salida, {
    id: 3,
    nombre: 'Tinte',
    descripcion: 'Color completo.',
    precioAproximado: 12000,
    duracionMinutos: 90,
    permiteDomicilio: false,
    estado: 'Activo',
  });
});
