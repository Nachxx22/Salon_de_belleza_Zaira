// Reglas de MV-01 que no necesitan SQL Server. Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotal, validarVenta } from '../src/modules/ventas/ventas.logica.js';

const base = {
  pagoConfirmado: true,
  metodoPago: 'SINPE',
  productos: [{ id: 1, cantidad: 2 }],
  servicios: [{ id: 3, precioFinal: 8000 }],
};

function codigoError(entrada) {
  try {
    validarVenta(entrada);
  } catch (error) {
    return error.codigo;
  }
  return null;
}

test('una venta de productos y servicios válida se acepta; el cliente es opcional (CU-MV-01, criterios 1 y 2)', () => {
  assert.deepEqual(validarVenta(base), {
    referenciaCliente: null,
    metodoPago: 'SINPE',
    productos: [{ id: 1, cantidad: 2 }],
    servicios: [{ id: 3, precioFinal: 8000 }],
  });
  assert.equal(validarVenta({ ...base, referenciaCliente: '  Ana  ' }).referenciaCliente, 'Ana');
});

test('sin confirmar el pago no se registra (CU-MV-01, criterio 7)', () => {
  assert.equal(codigoError({ ...base, pagoConfirmado: false }), 'PAGO_NO_CONFIRMADO');
  assert.equal(codigoError({ ...base, pagoConfirmado: 'sí' }), 'PAGO_NO_CONFIRMADO');
});

test('debe incluir al menos un producto o servicio (CU-MV-01, flujo alterno)', () => {
  assert.equal(codigoError({ ...base, productos: [], servicios: [] }), 'DATOS_INVALIDOS');
});

test('la cantidad es un entero mayor que cero (CU-MV-01, criterio 4)', () => {
  assert.equal(codigoError({ ...base, productos: [{ id: 1, cantidad: 0 }] }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, productos: [{ id: 1, cantidad: 1.5 }] }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, productos: [{ id: 1 }] }), 'DATOS_INVALIDOS');
});

test('un producto repetido suma sus cantidades', () => {
  const venta = validarVenta({ ...base, productos: [{ id: 1, cantidad: 2 }, { id: 1, cantidad: '3' }] });
  assert.deepEqual(venta.productos, [{ id: 1, cantidad: 5 }]);
});

test('el precio final del servicio es numérico y mayor que cero; un servicio va una vez (CU-MV-01, criterio 3)', () => {
  assert.equal(codigoError({ ...base, servicios: [{ id: 3, precioFinal: 0 }] }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, servicios: [{ id: 3, precioFinal: 'mucho' }] }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, servicios: [{ id: 3 }] }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, servicios: [{ id: 3, precioFinal: 1 }, { id: 3, precioFinal: 2 }] }), 'DATOS_INVALIDOS');
});

test('solo se acepta efectivo, SINPE o transferencia (CU-MV-01, criterio 5)', () => {
  assert.equal(codigoError({ ...base, metodoPago: '' }), 'DATOS_INVALIDOS');
  assert.equal(codigoError({ ...base, metodoPago: 'Tarjeta' }), 'DATOS_INVALIDOS');
  for (const metodo of ['Efectivo', 'SINPE', 'Transferencia']) assert.equal(codigoError({ ...base, metodoPago: metodo }), null);
});

test('el total suma precio del catálogo por cantidad y el precio final de cada servicio (CU-MV-01, criterio 3)', () => {
  const total = calcularTotal({
    productos: [{ precio: 7500, cantidad: 2 }, { precio: 1999.99, cantidad: 3 }],
    servicios: [{ precioFinal: 8000 }, { precioFinal: 0.01 }],
  });
  // 15000 + 5999.97 + 8000.01, redondeado a céntimos sin error de coma flotante.
  assert.equal(total, 28999.98);
  assert.equal(calcularTotal({ productos: [], servicios: [{ precioFinal: 6000 }] }), 6000);
});
