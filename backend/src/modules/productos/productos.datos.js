// Capa de datos del módulo Productos (dueño: Persona B).
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
// Disponibilidad es una columna calculada en la base: Disponible si Stock > 0.
import { consulta, sql } from '../../shared/db.js';

const SELECT_ADMIN = `
  SELECT p.Id, p.Nombre, p.Marca, p.Categoria, p.Descripcion, p.Precio, p.Stock,
         p.Disponibilidad, p.Estado, p.ProveedorId, pv.Nombre AS ProveedorNombre, pv.Estado AS ProveedorEstado
  FROM dbo.Producto p
  JOIN dbo.Proveedor pv ON pv.Id = p.ProveedorId`;

// Forma administrativa (MPD-03, criterio 3): incluye stock, proveedor y estado.
export function aProducto(f) {
  return {
    id: f.Id,
    nombre: f.Nombre,
    marca: f.Marca,
    categoria: f.Categoria,
    descripcion: f.Descripcion,
    precio: Number(f.Precio),
    stock: f.Stock,
    disponibilidad: f.Disponibilidad,
    estado: f.Estado,
    proveedor: { id: f.ProveedorId, nombre: f.ProveedorNombre, estado: f.ProveedorEstado },
  };
}

// Forma pública (MPD-03, criterio 2): sin stock, proveedor ni estado.
export function aProductoPublico(f) {
  return {
    id: f.Id,
    nombre: f.Nombre,
    marca: f.Marca,
    categoria: f.Categoria,
    descripcion: f.Descripcion,
    precio: Number(f.Precio),
    disponibilidad: f.Disponibilidad,
  };
}

// MPD-03 catálogo público: solo productos activos.
export async function listarPublicos() {
  const { filas } = await consulta(
    `SELECT Id, Nombre, Marca, Categoria, Descripcion, Precio, Disponibilidad
     FROM dbo.Producto WHERE Estado = N'Activo' ORDER BY Categoria, Nombre`,
  );
  return filas.map(aProductoPublico);
}

// MPD-03 administrativo: activos y desactivados.
export async function listarTodos() {
  const { filas } = await consulta(
    `${SELECT_ADMIN} ORDER BY CASE WHEN p.Estado = N'Activo' THEN 0 ELSE 1 END, p.Nombre`,
  );
  return filas.map(aProducto);
}

// MPD-04: cantidades actuales de cada producto.
export async function inventario() {
  const { filas } = await consulta(
    `SELECT Id, Nombre, Marca, Stock, Disponibilidad, Estado FROM dbo.Producto
     ORDER BY CASE WHEN Estado = N'Activo' THEN 0 ELSE 1 END, Nombre`,
  );
  return filas.map((f) => ({
    id: f.Id,
    nombre: f.Nombre,
    marca: f.Marca,
    stock: f.Stock,
    disponibilidad: f.Disponibilidad,
    estado: f.Estado,
  }));
}

export async function obtenerPorId(id) {
  const { filas } = await consulta(`${SELECT_ADMIN} WHERE p.Id = @id`, { id });
  return filas[0] ? aProducto(filas[0]) : null;
}

// MPD-01: el producto nace Activo (columna por defecto).
export async function insertar(producto) {
  const { filas } = await consulta(
    `INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
     OUTPUT INSERTED.Id
     VALUES (@proveedorId, @nombre, @marca, @categoria, @descripcion, @precio, @stock)`,
    {
      proveedorId: producto.proveedorId,
      nombre: producto.nombre,
      marca: producto.marca,
      categoria: producto.categoria,
      descripcion: producto.descripcion,
      precio: [sql.Decimal(10, 2), producto.precio],
      stock: producto.stock,
    },
  );
  return filas[0].Id;
}

// MPD-05: no toca el stock (MPD-05, restricción 4) ni el estado.
export async function actualizar(id, producto) {
  const { filasAfectadas } = await consulta(
    `UPDATE dbo.Producto
     SET ProveedorId = @proveedorId, Nombre = @nombre, Marca = @marca, Categoria = @categoria,
         Descripcion = @descripcion, Precio = @precio
     WHERE Id = @id`,
    {
      id,
      proveedorId: producto.proveedorId,
      nombre: producto.nombre,
      marca: producto.marca,
      categoria: producto.categoria,
      descripcion: producto.descripcion,
      precio: [sql.Decimal(10, 2), producto.precio],
    },
  );
  return filasAfectadas;
}

// MPD-06 ajuste manual: fija la cantidad (la base rechaza negativos con CK_Producto_Stock).
export async function fijarStock(id, stock) {
  const { filasAfectadas } = await consulta('UPDATE dbo.Producto SET Stock = @stock WHERE Id = @id', { id, stock });
  return filasAfectadas;
}

// MPD-02 (baja lógica) y EXT-MPD-R01 (reactivar). Solo cambia si el estado actual es el esperado.
export async function cambiarEstado(id, { de, a }) {
  const { filasAfectadas } = await consulta(
    'UPDATE dbo.Producto SET Estado = @a WHERE Id = @id AND Estado = @de',
    { id, de, a },
  );
  return filasAfectadas;
}
