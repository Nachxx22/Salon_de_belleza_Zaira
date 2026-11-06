# Diccionario de datos

Generado a partir de `database/migrations/0001_base.sql` (13 tablas) y `0002_ext_mv_u01_revision_venta.sql` (RevisionVenta). Total: 14 tablas. Si una migración nueva cambia una tabla, actualicen también este archivo.

- **Persona A:** Citas y Agenda. **Persona B (Ignacio):** acceso, servicios, proveedores, productos y ventas.
- Modelo aprobado por los dos el 5 nov 2026: nombres del texto de la sección 3.4.2 del ERS, PK `Id` y FK `<Tabla>Id` (`DECISIONES.md`, D-013).
- Montos en colones. Las fechas y horas de registro se guardan en hora de Costa Rica (UTC−6), sin depender de la zona de la computadora (D-015).
- Estados guardados sin tilde; la interfaz los muestra con tilde (tabla en `CONTRATOS_API.md`). Ninguna FK borra en cascada.

## Administradora

**Dueño:** Persona B (Ignacio). Cuenta única de la administradora (MA-01, MA-02). ContrasenaHash guarda el hash bcrypt, nunca la contraseña.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Usuario | NVARCHAR(50) | No | Único |
| ContrasenaHash | NVARCHAR(100) | No |  |

**Reglas:** Usuario único. Solo existe una cuenta: `npm run db:admin` la crea o la actualiza. Sin límite de intentos ni recuperación de contraseña (MA-01).

## Cliente

**Dueño:** Persona A (Citas y Agenda). Clientes sin cuenta; el teléfono los identifica.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Nombre | NVARCHAR(150) | No |  |
| Telefono | NVARCHAR(20) | No | Único |
| CorreoElectronico | NVARCHAR(254) | Sí |  |

**Reglas:** Teléfono único: 8 dígitos seguidos, sin guion ni código de país; el API quita espacios y guiones antes de guardar (D-016).

## Servicio

**Dueño:** Persona B (Ignacio). Servicios del salón (MS-01 a MS-05). Lo leen Citas (CitaServicio) y Ventas (VentaServicio).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Nombre | NVARCHAR(100) | No |  |
| Descripcion | NVARCHAR(500) | No |  |
| PrecioAproximado | DECIMAL(10,2) | No |  |
| DuracionMinutos | INT | No |  |
| PermiteDomicilio | BIT | No | Por defecto: 0 |
| Estado | NVARCHAR(15) | No | Por defecto: 'Activo' |

**Reglas:** PrecioAproximado ≥ 0: un solo monto; el catálogo avisa que el precio final puede variar según el tipo y el largo del cabello (D-014). DuracionMinutos > 0. Estado Activo o Desactivado: desactivar no borra. Contrato con Citas: Id, Nombre, DuracionMinutos, PermiteDomicilio y Estado.

## Proveedor

**Dueño:** Persona B (Ignacio). Proveedores de productos (MPV-01 a MPV-04).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Nombre | NVARCHAR(150) | No |  |
| Telefono | NVARCHAR(20) | No | Único |
| CorreoElectronico | NVARCHAR(254) | No | Único |
| Estado | NVARCHAR(15) | No | Por defecto: 'Activo' |

**Reglas:** Teléfono (8 dígitos) y correo únicos. Estado Activo o Desactivado: un proveedor desactivado no se asocia a productos nuevos.

## Producto

**Dueño:** Persona B (Ignacio). Productos a la venta (MPD-01 a MPD-06).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| ProveedorId | INT | No | FK → Proveedor.Id |
| Nombre | NVARCHAR(150) | No |  |
| Marca | NVARCHAR(100) | No |  |
| Categoria | NVARCHAR(100) | No |  |
| Descripcion | NVARCHAR(500) | No |  |
| Precio | DECIMAL(10,2) | No |  |
| Stock | INT | No | Por defecto: 0 |
| Estado | NVARCHAR(15) | No | Por defecto: 'Activo' |
| Disponibilidad | Calculada | — | Disponible si Stock > 0, si no Agotado |

**Reglas:** Precio ≥ 0; Stock entero ≥ 0. Un solo proveedor, activo al asociarlo (lo valida el API). Disponibilidad es calculada: Disponible si Stock > 0, si no Agotado. Estado Activo o Desactivado.

## Horario

**Dueño:** Persona A (Citas y Agenda). Horario regular de atención por día de la semana.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| DiaSemana | TINYINT | No |  |
| HoraInicio | TIME(0) | No |  |
| HoraFin | TIME(0) | No |  |

**Reglas:** DiaSemana de 1 (lunes) a 7 (domingo); HoraFin > HoraInicio. Varios tramos por día; las superposiciones las valida el API.

## BloqueoAgenda

**Dueño:** Persona A (Citas y Agenda). Períodos no disponibles en una fecha específica.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Fecha | DATE | No |  |
| HoraInicio | TIME(0) | No |  |
| HoraFin | TIME(0) | No |  |

**Reglas:** HoraFin > HoraInicio. Sin enlace a Horario.

## Cita

**Dueño:** Persona A (Citas y Agenda). Citas del salón (MCA-01 a MCA-14).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Codigo | NVARCHAR(30) | No | Único |
| ClienteId | INT | No | FK → Cliente.Id |
| Fecha | DATE | No |  |
| Hora | TIME(0) | No |  |
| Estado | NVARCHAR(20) | No |  |
| EsDomicilio | BIT | No | Por defecto: 0 |
| Direccion | NVARCHAR(300) | Sí |  |
| Observaciones | NVARCHAR(500) | Sí |  |
| MotivoCancelacion | NVARCHAR(500) | Sí |  |

**Reglas:** Codigo único, generado por el API de Citas (corto y difícil de adivinar). Estado: Pendiente, Confirmada, Completada o Cancelada. Hora con minutos 00 o 30 y segundos 00; el fin es Hora + suma de las duraciones de CitaServicio. Dirección obligatoria si EsDomicilio = 1. MotivoCancelacion solo en citas Canceladas: obligatorio cuando cancela la administradora (MCA-14, lo valida el API) y nulo si la cancelación vino de una solicitud del cliente aprobada.

## CitaServicio

**Dueño:** Persona A (Citas y Agenda). Servicios de cada cita. Une Citas con el Servicio de la Persona B.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| CitaId | INT | No | PK compuesta; FK → Cita.Id |
| ServicioId | INT | No | PK compuesta; FK → Servicio.Id |
| DuracionAplicadaMinutos | INT | No |  |

**Reglas:** Llave compuesta (CitaId, ServicioId). DuracionAplicadaMinutos > 0, copiada del servicio al agendar: un cambio posterior del servicio no altera la cita.

## SolicitudCita

**Dueño:** Persona A (Citas y Agenda). Solicitudes de los clientes sobre una cita.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| CitaId | INT | No | FK → Cita.Id |
| Tipo | NVARCHAR(20) | No |  |
| FechaSolicitud | DATETIME2(0) | No | Por defecto: hora de Costa Rica (UTC−6) |
| Estado | NVARCHAR(20) | No | Por defecto: 'Pendiente' |
| FechaPropuesta | DATE | Sí |  |
| HoraPropuesta | TIME(0) | Sí |  |

**Reglas:** Tipo: Creacion, Reprogramacion o Cancelacion. Estado: Pendiente, Aprobada o Rechazada. FechaPropuesta y HoraPropuesta solo en reprogramación (si no, nulas); HoraPropuesta con minutos 00 o 30 y segundos 00. Una sola solicitud Pendiente por cita (índice único filtrado). FechaSolicitud en hora de Costa Rica (D-015).

## Venta

**Dueño:** Persona B (Ignacio). Ventas de productos y servicios (MV-01 a MV-03).

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| Codigo | Calculada | — | 'V-' + Id con 6 dígitos (V-000001); Único |
| FechaHora | DATETIME2(0) | No | Por defecto: hora de Costa Rica (UTC−6) |
| ReferenciaCliente | NVARCHAR(150) | Sí |  |
| MetodoPago | NVARCHAR(15) | No |  |
| Total | DECIMAL(12,2) | No |  |
| Estado | NVARCHAR(15) | No | Por defecto: 'Registrada' |
| MotivoAnulacion | NVARCHAR(500) | Sí |  |

**Reglas:** Codigo calculado (V-000001), único. FechaHora en hora de Costa Rica al registrar (D-015). ReferenciaCliente opcional y sin FK. MetodoPago: Efectivo, SINPE o Transferencia. Estado Registrada o Anulada; MotivoAnulacion obligatorio solo si está Anulada. Al anular solo cambian Estado y MotivoAnulacion.

## VentaProducto

**Dueño:** Persona B (Ignacio). Productos de cada venta.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| VentaId | INT | No | PK compuesta; FK → Venta.Id |
| ProductoId | INT | No | PK compuesta; FK → Producto.Id |
| Cantidad | INT | No |  |
| PrecioAplicado | DECIMAL(10,2) | No |  |

**Reglas:** Llave compuesta (VentaId, ProductoId). Cantidad > 0. PrecioAplicado ≥ 0, copiado del catálogo al vender. El stock se descuenta en la misma transacción.

## VentaServicio

**Dueño:** Persona B (Ignacio). Servicios de cada venta.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| VentaId | INT | No | PK compuesta; FK → Venta.Id |
| ServicioId | INT | No | PK compuesta; FK → Servicio.Id |
| PrecioFinal | DECIMAL(10,2) | No |  |

**Reglas:** Llave compuesta (VentaId, ServicioId): cada servicio una vez por venta. PrecioFinal > 0, lo escribe la administradora.

## RevisionVenta

**Dueño:** Persona B (Ignacio). **Extensión EXT-MV-U01, no es parte del ERS** (migración 0002). Historial de correcciones de una venta.

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| Id | INT | No | Identidad; PK |
| VentaId | INT | No | FK → Venta.Id |
| FechaHora | DATETIME2(0) | No | Por defecto: hora de Costa Rica (UTC−6) |
| Motivo | NVARCHAR(500) | No |  |
| DatosAnteriores | NVARCHAR(MAX) | No |  |

**Reglas:** Antes de corregir una venta Registrada se guarda en DatosAnteriores, como JSON válido, cómo estaba. Motivo obligatorio. FechaHora en hora de Costa Rica.
