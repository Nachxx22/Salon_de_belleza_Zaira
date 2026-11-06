// Reglas de MPV-01, MPV-03, MPD-01, MPD-05 y MPD-06 que no necesitan SQL Server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarProveedor } from '../src/modules/proveedores/proveedores.logica.js';
import { validarProducto, validarStock } from '../src/modules/productos/productos.logica.js';
import { aProducto, aProductoPublico } from '../src/modules/productos/productos.datos.js';

function errorDe(funcion) {
  try {
    funcion();
  } catch (error) {
    return error;
  }
  return null;
}

const proveedor = { nombre: 'Distribuidora Sol', telefono: '2222-0003', correoElectronico: 'ventas@sol.example' };

test('un proveedor válido se acepta y el teléfono queda en 8 dígitos (CU-MPV-01, criterio 1)', () => {
  assert.deepEqual(validarProveedor(proveedor), { ...proveedor, telefono: '22220003' });
});

test('los tres datos del proveedor son obligatorios y se indica cuáles faltan (CU-MPV-01, criterio 2)', () => {
  const error = errorDe(() => validarProveedor({ nombre: 'Sol' }));
  assert.equal(error.codigo, 'DATOS_INVALIDOS');
  assert.match(error.message, /teléfono, correo electrónico/);
});

test('teléfono o correo con formato incorrecto se rechazan (CU-MPV-01, criterio 3)', () => {
  assert.equal(errorDe(() => validarProveedor({ ...proveedor, telefono: '1234' })).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe(() => validarProveedor({ ...proveedor, correoElectronico: 'ventas-sol' })).codigo, 'DATOS_INVALIDOS');
});

const producto = {
  nombre: 'Tinte castaño',
  marca: 'ColorPro',
  categoria: 'Coloración',
  descripcion: 'Tinte permanente.',
  precio: 6500,
  proveedorId: 1,
  stock: 4,
};

test('un producto válido se acepta con su stock (CU-MPD-01)', () => {
  assert.deepEqual(validarProducto(producto, { conStock: true }), producto);
});

test('faltantes del producto se indican todos juntos (CU-MPD-01, flujo alterno)', () => {
  const error = errorDe(() => validarProducto({ nombre: 'Tinte' }, { conStock: true }));
  assert.match(error.message, /marca, categoría, descripción, precio, proveedor, stock/);
});

test('el precio debe ser numérico y no negativo (CU-MPD-01 criterio 1, CU-MPD-05 criterio 3)', () => {
  assert.equal(errorDe(() => validarProducto({ ...producto, precio: -1 })).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe(() => validarProducto({ ...producto, precio: 'caro' })).codigo, 'DATOS_INVALIDOS');
});

test('el stock es un entero no negativo; cero es válido (CU-MPD-01 criterio 2, CU-MPD-06 criterio 2)', () => {
  assert.equal(validarStock(0), 0);
  assert.equal(validarStock('12'), 12);
  assert.equal(errorDe(() => validarStock(-1)).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe(() => validarStock(2.5)).codigo, 'DATOS_INVALIDOS');
  assert.equal(errorDe(() => validarStock('')).codigo, 'DATOS_INVALIDOS');
});

test('actualizar un producto no recibe stock (CU-MPD-05, restricción 4)', () => {
  const sinStock = validarProducto({ ...producto, stock: 999 });
  assert.equal('stock' in sinStock, false);
});

test('el catálogo público no muestra stock, proveedor ni estado (CU-MPD-03, restricción 1)', () => {
  const fila = {
    Id: 1, Nombre: 'Shampoo', Marca: 'X', Categoria: 'Cuidado', Descripcion: 'D', Precio: '7500.00',
    Stock: 0, Disponibilidad: 'Agotado', Estado: 'Activo', ProveedorId: 2, ProveedorNombre: 'P', ProveedorEstado: 'Activo',
  };
  assert.deepEqual(Object.keys(aProductoPublico(fila)).sort(), ['categoria', 'descripcion', 'disponibilidad', 'id', 'marca', 'nombre', 'precio']);
  const admin = aProducto(fila);
  assert.equal(admin.stock, 0);
  assert.equal(admin.disponibilidad, 'Agotado');
  assert.deepEqual(admin.proveedor, { id: 2, nombre: 'P', estado: 'Activo' });
});
