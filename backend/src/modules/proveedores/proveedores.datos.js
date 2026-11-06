// Capa de datos del módulo Proveedores (dueño: Persona B).
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
import { consulta } from '../../shared/db.js';

const COLUMNAS = 'Id, Nombre, Telefono, CorreoElectronico, Estado';

export function aProveedor(fila) {
  return {
    id: fila.Id,
    nombre: fila.Nombre,
    telefono: fila.Telefono,
    correoElectronico: fila.CorreoElectronico,
    estado: fila.Estado,
  };
}

function patronContiene(texto) {
  return `%${texto.replace(/[\\%_[]/g, (c) => `\\${c}`)}%`;
}

// MPV-02: activos primero; `buscar` filtra por nombre, teléfono o correo.
export async function listar({ buscar = null } = {}) {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Proveedor
     WHERE @patron IS NULL
        OR Nombre LIKE @patron ESCAPE N'\\'
        OR Telefono LIKE @patron ESCAPE N'\\'
        OR CorreoElectronico LIKE @patron ESCAPE N'\\'
     ORDER BY CASE WHEN Estado = N'Activo' THEN 0 ELSE 1 END, Nombre`,
    { patron: buscar ? patronContiene(buscar) : null },
  );
  return filas.map(aProveedor);
}

export async function obtenerPorId(id) {
  const { filas } = await consulta(`SELECT ${COLUMNAS} FROM dbo.Proveedor WHERE Id = @id`, { id });
  return filas[0] ? aProveedor(filas[0]) : null;
}

// MPV-02: productos asociados al proveedor (los asigna el módulo de productos).
export async function productosAsociados(proveedorId) {
  const { filas } = await consulta(
    `SELECT Id, Nombre, Marca, Stock, Disponibilidad, Estado
     FROM dbo.Producto WHERE ProveedorId = @proveedorId ORDER BY Nombre`,
    { proveedorId },
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

// MPV-01 y MPV-03: qué dato ya pertenece a otro proveedor ('telefono', 'correoElectronico' o null).
export async function datoDuplicado({ telefono, correoElectronico }, excluirId = null) {
  const { filas } = await consulta(
    `SELECT TOP (1)
            CASE WHEN Telefono = @telefono THEN N'telefono' ELSE N'correoElectronico' END AS Campo
     FROM dbo.Proveedor
     WHERE (Telefono = @telefono OR CorreoElectronico = @correo)
       AND (@excluirId IS NULL OR Id <> @excluirId)
     ORDER BY CASE WHEN Telefono = @telefono THEN 0 ELSE 1 END`,
    { telefono, correo: correoElectronico, excluirId },
  );
  return filas[0]?.Campo ?? null;
}

// MPV-01: el proveedor nace Activo (columna por defecto).
export async function insertar({ nombre, telefono, correoElectronico }) {
  const { filas } = await consulta(
    `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
     OUTPUT INSERTED.Id
     VALUES (@nombre, @telefono, @correo)`,
    { nombre, telefono, correo: correoElectronico },
  );
  return filas[0].Id;
}

// MPV-03: no cambia el estado ni los productos asociados.
export async function actualizar(id, { nombre, telefono, correoElectronico }) {
  const { filasAfectadas } = await consulta(
    `UPDATE dbo.Proveedor SET Nombre = @nombre, Telefono = @telefono, CorreoElectronico = @correo
     WHERE Id = @id`,
    { id, nombre, telefono, correo: correoElectronico },
  );
  return filasAfectadas;
}

// MPV-04 (baja lógica) y EXT-MPV-R01 (reactivar). Solo cambia si el estado actual es el esperado.
export async function cambiarEstado(id, { de, a }) {
  const { filasAfectadas } = await consulta(
    'UPDATE dbo.Proveedor SET Estado = @a WHERE Id = @id AND Estado = @de',
    { id, de, a },
  );
  return filasAfectadas;
}
