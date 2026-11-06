// Capa de datos del módulo Servicios (dueño: Persona B).
// Solo SQL parametrizado; las reglas de negocio están en servicios.logica.js.
import { consulta, sql } from '../../shared/db.js';

const COLUMNAS = 'Id, Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio, Estado';

// Catálogo público (MS-02): solo servicios disponibles.
export async function listarActivos() {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio WHERE Estado = N'Activo' ORDER BY Nombre`,
  );
  return filas;
}

// Listado administrativo (MS-05): activos primero, luego desactivados.
export async function listarTodos() {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio
     ORDER BY CASE WHEN Estado = N'Activo' THEN 0 ELSE 1 END, Nombre`,
  );
  return filas;
}

export async function obtenerPorId(id) {
  const { filas } = await consulta(
    `SELECT ${COLUMNAS} FROM dbo.Servicio WHERE Id = @id`,
    { id },
  );
  return filas[0] ?? null;
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
