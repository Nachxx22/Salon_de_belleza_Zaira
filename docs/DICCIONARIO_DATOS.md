# Diccionario de datos

Generado a partir de `database/migrations/0001_base.sql` y `0002_ext_mv_u01_revision_venta.sql`. Si una migración nueva cambia una tabla, actualicen también este archivo.

- **Persona A:** Citas y Agenda. **Persona B (Ignacio):** acceso, servicios, proveedores, productos y ventas.
- Montos en colones. Fechas y horas en hora local de Costa Rica.
- Los nombres de tablas y columnas siguen el diagrama de entidades de la sección 3.4 del ERS (ver `DECISIONES.md`, D-002).

## Usuario_Admin

**Dueño:** Persona B (Ignacio). Cuenta única de la administradora (MA-01, MA-02). Contrasena guarda el hash bcrypt.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdAdmin | INT | No | Identidad; PK |
| Usuario | NVARCHAR(50) | No | Único |
| Contrasena | NVARCHAR(100) | No |  |

**Reglas:** Usuario único. Solo existe una cuenta (`npm run db:admin` la crea o la actualiza).

## Cliente

**Dueño:** Persona A. Clientes sin cuenta; el teléfono los identifica y no se repite.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdCliente | INT | No | Identidad; PK |
| Nombre | NVARCHAR(100) | No |  |
| Telefono | NVARCHAR(20) | No | Único |
| Correo | NVARCHAR(150) | Sí |  |

**Reglas:** Telefono único: identifica al cliente y evita registros duplicados.

## Servicio

**Dueño:** Persona B (Ignacio). Catálogo de servicios con precio aproximado (monto mínimo) y duración en minutos.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdServicio | INT | No | Identidad; PK |
| Nombre | NVARCHAR(100) | No |  |
| Descripcion | NVARCHAR(500) | No |  |
| PrecioAprox | DECIMAL(10,2) | No |  |
| DuracionMin | INT | No |  |
| Categoria | NVARCHAR(60) | Sí |  |
| ADomicilio | BIT | No | Por defecto: 0 |
| Activo | BIT | No | Por defecto: 1 |

**Reglas:** PrecioAprox ≥ 0; DuracionMin > 0. Desactivar = Activo 0 (no se borra).

## Cita

**Dueño:** Persona A. Citas del salón. Estados: Pendiente, Confirmada, Completada, Cancelada.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdCita | INT | No | Identidad; PK |
| Codigo | NVARCHAR(20) | No | Único |
| IdCliente | INT | No | FK → Cliente.IdCliente |
| Fecha | DATE | No |  |
| HoraInicio | TIME(0) | No |  |
| HoraFin | TIME(0) | No |  |
| Estado | NVARCHAR(20) | No | Por defecto: N'Pendiente' |
| DireccionDomicilio | NVARCHAR(250) | Sí |  |
| Observaciones | NVARCHAR(500) | Sí |  |
| ADomicilio | BIT | No | Por defecto: 0 |

**Reglas:** Codigo único; Estado en Pendiente, Confirmada, Completada o Cancelada; HoraFin > HoraInicio; si ADomicilio = 1, DireccionDomicilio es obligatoria. Cancelar = cambiar Estado (no se borra).

## Cita_Servicio

**Dueño:** Persona A. Servicios de cada cita con la duración aplicada al registrarla.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdCitaServicio | INT | No | Identidad; PK |
| IdCita | INT | No | FK → Cita.IdCita |
| IdServicio | INT | No | FK → Servicio.IdServicio |
| DuracionAplicadaMinutos | INT | No |  |

**Reglas:** Un servicio no se repite en la misma cita; DuracionAplicadaMinutos > 0.

## Horario

**Dueño:** Persona A. Horario regular de atención por día de la semana (1 = lunes ... 7 = domingo).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdHorario | INT | No | Identidad; PK |
| DiaSemana | TINYINT | No |  |
| HoraApertura | TIME(0) | No |  |
| HoraCierre | TIME(0) | No |  |

**Reglas:** DiaSemana entre 1 y 7; HoraCierre > HoraApertura. Las superposiciones se validan en el servidor.

## BloqueoAgenda

**Dueño:** Persona A. Períodos no disponibles en una fecha específica.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdBloqueo | INT | No | Identidad; PK |
| IdHorario | INT | Sí | FK → Horario.IdHorario |
| Fecha | DATE | No |  |
| HorarioInicio | TIME(0) | No |  |
| HorarioFin | TIME(0) | No |  |

**Reglas:** HorarioFin > HorarioInicio. Si se elimina el horario relacionado, IdHorario queda vacío.

## SolicitudCita

**Dueño:** Persona A. Solicitudes de creación, reprogramación o cancelación hechas por clientes. Estados: Pendiente, Aprobada, Rechazada.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdSolicitud | INT | No | Identidad; PK |
| IdCita | INT | No | FK → Cita.IdCita |
| TipoSolicitud | NVARCHAR(20) | No |  |
| Fecha | DATETIME2(0) | No | Por defecto: SYSDATETIME() |
| Estado | NVARCHAR(20) | No | Por defecto: N'Pendiente' |
| FechaPropuesta | DATE | Sí | solo reprogramación |
| HoraPropuesta | TIME(0) | Sí | solo reprogramación |

**Reglas:** TipoSolicitud en Creacion, Reprogramacion o Cancelacion; Estado en Pendiente, Aprobada o Rechazada; FechaPropuesta y HoraPropuesta solo (y obligatorias) en reprogramaciones; una cita tiene como máximo una solicitud Pendiente.

## Proveedor

**Dueño:** Persona B (Ignacio). Proveedores de productos; teléfono y correo únicos.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdProveedor | INT | No | Identidad; PK |
| Nombre | NVARCHAR(100) | No |  |
| Telefono | NVARCHAR(20) | No | Único |
| Correo | NVARCHAR(150) | No | Único |
| Activo | BIT | No | Por defecto: 1 |

**Reglas:** Telefono único y Correo único. Desactivar = Activo 0 (no se borra).

## Producto

**Dueño:** Persona B (Ignacio). Productos con stock no negativo; Disponible si Stock > 0, Agotado si Stock = 0.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdProducto | INT | No | Identidad; PK |
| IdProveedor | INT | No | FK → Proveedor.IdProveedor |
| Nombre | NVARCHAR(100) | No |  |
| Marca | NVARCHAR(60) | No |  |
| Categoria | NVARCHAR(60) | No |  |
| Descripcion | NVARCHAR(500) | No |  |
| Precio | DECIMAL(10,2) | No |  |
| Stock | INT | No | Por defecto: 0 |
| Activo | BIT | No | Por defecto: 1 |

**Reglas:** Precio ≥ 0; Stock ≥ 0. Desactivar = Activo 0 (no se borra).

## Venta

**Dueño:** Persona B (Ignacio). Ventas de productos y servicios. Estados: Registrada, Anulada. Pago confirmado fuera del sistema.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdVenta | INT | No | Identidad; PK |
| IdCliente | INT | Sí | FK → Cliente.IdCliente |
| IdCita | INT | Sí | FK → Cita.IdCita |
| ClienteReferencia | NVARCHAR(150) | Sí |  |
| Fecha | DATE | No | Por defecto: CAST(SYSDATETIME() AS DATE) |
| Hora | TIME(0) | No | Por defecto: CAST(SYSDATETIME() AS TIME(0)) |
| Subtotal | DECIMAL(12,2) | No |  |
| Total | DECIMAL(12,2) | No |  |
| EstadoPago | NVARCHAR(20) | No | Por defecto: N'Confirmado' |
| CodigoVenta | NVARCHAR(20) | No | Único |
| MetodoPago | NVARCHAR(20) | No |  |
| Estado | NVARCHAR(20) | No | Por defecto: N'Registrada' |
| Anulada | BIT (calculada) | — | Calculada: CAST(CASE WHEN Estado = N'Anulada' THEN 1 ELSE 0 END AS BIT) |
| MotivoAnulacion | NVARCHAR(250) | Sí |  |

**Reglas:** CodigoVenta único; MetodoPago en Efectivo, SINPE o Transferencia; Estado en Registrada o Anulada; MotivoAnulacion obligatorio solo si está Anulada; EstadoPago siempre Confirmado; Subtotal y Total ≥ 0. Anular = cambiar Estado (no se borra).

## Detalle_Venta

**Dueño:** Persona B (Ignacio). Una fila por producto (cantidad y precio del catálogo) o por servicio (cantidad 1 y precio final).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdDetalle | INT | No | Identidad; PK |
| IdVenta | INT | No | FK → Venta.IdVenta |
| IdProducto | INT | Sí | FK → Producto.IdProducto |
| IdServicio | INT | Sí | FK → Servicio.IdServicio |
| Cantidad | INT | No |  |
| Precio | DECIMAL(10,2) | No |  |

**Reglas:** Cada fila es de producto (Cantidad > 0, Precio ≥ 0) o de servicio (Cantidad = 1, Precio > 0), nunca de ambos.

## RevisionVenta

**Dueño:** Persona B (Ignacio). EXTENSIÓN EXT-MV-U01 (no está en el ERS): historial de correcciones de una venta.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| IdRevision | INT | No | Identidad; PK |
| IdVenta | INT | No | FK → Venta.IdVenta |
| FechaHora | DATETIME2(0) | No | Por defecto: SYSDATETIME() |
| Motivo | NVARCHAR(250) | No |  |
| TotalAnterior | DECIMAL(12,2) | No |  |
| DetalleAnterior | NVARCHAR(MAX) | No | JSON con productos y servicios antes del cambio |

**Reglas:** DetalleAnterior debe ser JSON válido.
