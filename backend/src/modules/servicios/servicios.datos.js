// Capa de datos del módulo Servicios (dueño: Persona B).
// Es la única capa que conoce SQL, tablas y columnas (D-017): recibe y devuelve
// objetos en camelCase, como los del contrato. Las reglas están en servicios.logica.js.
import { consulta, sql } from '../../shared/db.js';

const COLUMNAS = 'Id, Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio, Estado';

// Convierte una fila de dbo.Servicio en la forma del contrato (docs/CONTRATOS_API.md).
export function aServicio(fila) {
  return {
    id: fila.Id,
    nombre: fila.Nombre,
    descripcion: fila.Descripcion,
    precioAproximado: Number(fila.PrecioAproximado),
    duracionMinutos: fila.DuracionMinutos,
    permiteDomicilio: Boolean(fila.PermiteDomicilio),
    estado: fila.Estado,
  };
}

// Catálogo público (MS-02): solo servicios disponibles.
export async function listarActivos() {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio WHERE Estado = N'Activo' ORDER BY Nombre`,
  );
  return filas.map(aServicio);
}

// Listado administrativo (MS-05): activos primero, luego desactivados.
export async function listarTodos() {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio
     ORDER BY CASE WHEN Estado = N'Activo' THEN 0 ELSE 1 END, Nombre`,
  );
  return filas.map(aServicio);
}

// Devuelve el servicio o null si no existe.
export async function obtenerPorId(id) {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio WHERE Id = @id`,
    { id },
  );
  return filas[0] ? aServicio(filas[0]) : null;
}

// Para Citas (MCA-01, MCA-12): varios servicios por id, activos o no.
// Citas decide qué hacer si alguno no existe o está desactivado.
export async function obtenerVariosPorId(ids) {
  if (ids.length === 0) return [];
  // Un parámetro por id: nunca se concatena el valor en el SQL.
  const parametros = Object.fromEntries(ids.map((id, i) => [`id${i}`, id]));
  const lista = ids.map((_, i) => `@id${i}`).join(', ');
  const { filas } = await consulta(`SELECT ${COLUMNAS} FROM dbo.Servicio WHERE Id IN (${lista})`, parametros);
  return filas.map(aServicio);
}

// MS-01: el servicio nace Activo (lo pone la columna por defecto).
export async function insertar(servicio) {
  const { filas } = await consulta(
    `INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
     OUTPUT INSERTED.Id
     VALUES (@nombre, @descripcion, @precioAproximado, @duracionMinutos, @permiteDomicilio)`,
    {
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      precioAproximado: [sql.Decimal(10, 2), servicio.precioAproximado],
      duracionMinutos: servicio.duracionMinutos,
      permiteDomicilio: servicio.permiteDomicilio,
    },
  );
  return filas[0].Id;
}

// MS-03: no cambia Estado (eso es MS-04). Devuelve las filas afectadas.
export async function actualizar(id, servicio) {
  const { filasAfectadas } = await consulta(
    `UPDATE dbo.Servicio
     SET Nombre = @nombre,
         Descripcion = @descripcion,
         PrecioAproximado = @precioAproximado,
         DuracionMinutos = @duracionMinutos,
         PermiteDomicilio = @permiteDomicilio
     WHERE Id = @id`,
    {
      id,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      precioAproximado: [sql.Decimal(10, 2), servicio.precioAproximado],
      duracionMinutos: servicio.duracionMinutos,
      permiteDomicilio: servicio.permiteDomicilio,
    },
  );
  return filasAfectadas;
}

// MS-04: baja lógica. Solo cambia si el servicio sigue Activo.
export async function desactivar(id) {
  const { filasAfectadas } = await consulta(
    `UPDATE dbo.Servicio SET Estado = N'Desactivado' WHERE Id = @id AND Estado = N'Activo'`,
    { id },
  );
  return filasAfectadas;
}

// EXT-MS-R01 (extensión, no está en el ERS): vuelve a ofrecer un servicio desactivado.
export async function reactivar(id) {
  const { filasAfectadas } = await consulta(
    `UPDATE dbo.Servicio SET Estado = N'Activo' WHERE Id = @id AND Estado = N'Desactivado'`,
    { id },
  );
  return filasAfectadas;
}
