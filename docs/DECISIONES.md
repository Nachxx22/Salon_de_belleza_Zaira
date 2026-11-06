# Decisiones del equipo

Registro de acuerdos que afectan a las dos personas. Cada decisión nueva se agrega al final con fecha. Las actas breves de las reuniones también van aquí.

## D-001 — Trabajo en la rama `main` (4 nov 2026)

Los dos trabajan directamente en `main`, con commits pequeños, `git pull --rebase` antes de subir y carpetas con dueño. Se descarta el flujo de ramas con pull requests del plan inicial (sección 6.2) por el plazo de 8 días. Para un cambio grande o arriesgado (por ejemplo, transacciones de ventas) se puede usar una rama corta. Detalle en `FLUJO_DE_TRABAJO.md`.

## D-002 — Modelo de datos: diagrama y texto de la sección 3.4 (4 nov 2026)

**Reemplazada por D-013 (5 nov 2026).** Se conserva como historial.

Las tablas y columnas siguen el **diagrama de entidades** de la sección 3.4 del ERS (mismos nombres en PascalCase) y las restricciones siguen el **texto** de 3.4.1 a 3.4.4. Donde no coinciden se resolvió así:

| Tema | Diagrama | Texto 3.4 | Resolución en `0001_base.sql` |
|---|---|---|---|
| Detalle de venta | `Detalle_Venta` (una tabla) | `VentaProducto` y `VentaServicio` | Una tabla `Detalle_Venta`: cada fila es de producto (cantidad y precio del catálogo) o de servicio (cantidad 1 y precio final). Un CHECK impide mezclar los dos. |
| Venta ↔ Cliente | `idcliente` FK | "no requerirá relación con Cliente" | `IdCliente` opcional (FK nula) y `ClienteReferencia` (texto) para la referencia que pide MV-01. |
| Venta ↔ Cita | `idcita` FK | no se menciona | `IdCita` opcional (FK nula). |
| Estado de pago | `estado_pago` | pago confirmado fuera del sistema | `EstadoPago` solo admite `Confirmado` (MV-01, restricción 8). |
| Anulada | booleano `Anulada` y `estado` | estado y motivo | `Anulada` es una columna calculada a partir de `Estado`, para que nunca se contradigan. |
| Bloqueo de agenda | `idHorario`, horas, sin fecha | fecha afectada y horas (MCA-08) | Se agregó `Fecha`; `IdHorario` queda opcional. |
| Categoría de servicio | `categoria` | no se menciona | `Categoria` opcional. |
| Contraseña | `contrasena` | contraseña | `Contrasena` guarda el hash bcrypt, nunca el texto. |
| Solicitud | `fecha` (date), `horaPropuesta` (datetime) | fecha y hora propuestas | `Fecha` guarda fecha y hora de la solicitud; `HoraPropuesta` es TIME. |

Tareas pendientes: actualizar el diagrama del ERS con `Fecha` en BloqueoAgenda y `ClienteReferencia` en Venta, para que el diagrama coincida con la base de datos.

## D-003 — Precio aproximado de un servicio (4 nov 2026)

**Reemplazada por D-014 (5 nov 2026).**

`PrecioAprox` es el monto mínimo aproximado ("desde ₡6 000"), una de las dos formas que permite MS-01. Si se quiere mostrar un rango, se agrega una columna con una migración nueva.

## D-004 — Rutas del API por grupo (4 nov 2026)

`/api/publico/...` sin sesión y `/api/admin/...` con sesión exigida una sola vez para todo el grupo. Así ninguna ruta administrativa queda desprotegida por olvido (AC-01).

## D-005 — Sesión administrativa (4 nov 2026)

Cookie de sesión httpOnly (`zaira.sid`) con express-session y contraseñas con bcrypt. Sesiones en memoria: suficiente para el prototipo local; al reiniciar el API hay que volver a iniciar sesión. En un despliegue real se usaría HTTPS y un almacén persistente (AC-02).

## D-006 — Fechas y horas locales (4 nov 2026)

**Actualizada por D-015 (5 nov 2026):** la hora de registro ya no depende de la zona configurada en la computadora.

Citas con `DATE` + `TIME(0)` en hora de Costa Rica, sin zona horaria. Fecha y hora de ventas y solicitudes con la hora del servidor (`SYSDATETIME()`), que corre en Costa Rica. En JSON: `YYYY-MM-DD` y `HH:mm`.

## D-007 — Estados como texto con CHECK (4 nov 2026)

Los estados se guardan como texto sin tildes (`Pendiente`, `Confirmada`, `Registrada`, `Anulada`, `Reprogramacion`...) con un CHECK en la base. La interfaz muestra el texto con tildes.

## D-008 — EXT-MV-U01 Actualizar venta (4 nov 2026)

**Extensión acordada, no está en el ERS.** El ERS define registrar, consultar y anular ventas, y ante un error indica anular y crear otra. El equipo agrega la edición para mostrar el CRUD completo de Ventas. Reglas: solo ventas Registradas; revertir y aplicar el stock en la misma transacción; guardar la revisión en `RevisionVenta` (migración `0002`); nunca borrar ventas. No se presenta como parte del ERS.

## D-009 — Credenciales fuera del repositorio (4 nov 2026)

Se usa el login SQL de desarrollo que el equipo ya tenía. Usuario y contraseña van solo en `backend/.env`, que está en `.gitignore`. El repositorio es público.

## D-010 — Versiones (4 nov 2026)

Node.js 26.13.0 LTS, JavaScript (sin TypeScript), React 19 con Vite y React Router, Express 5, `mssql` para SQL Server y `bcryptjs` (sin módulos nativos, para que instale igual en las dos computadoras Windows).

## D-011 — Migraciones con nombre ordenable (4 nov 2026)

`0001_base.sql` y `0002_...` son la base. Las migraciones nuevas usan fecha, hora e inicial (`20261105_1730_B_...sql`) para que los dos no choquen con el mismo número. `npm run db:migrar` las aplica en orden y registra cada una en `SchemaMigrations`.

## D-012 — Tema visual en un solo archivo (4 nov 2026)

Colores, tipografía, bordes y espaciado salen de `frontend/src/shared/ui/tema.css`. Cuando haya identidad visual definitiva se cambia solo ese archivo.

## D-013 — Modelo de datos unificado, aprobado por los dos (5 nov 2026)

Reemplaza a D-002. La base sigue el **texto** de la sección 3.4.2 del ERS y la propuesta de Persona A (`PROPUESTA_BD_ZAIRA_PARA_REVISION_IGNACIO.md`), revisada con Ignacio y con las correcciones de los dos:

- `0001_base.sql` crea 13 tablas: Administradora, Cliente, Servicio, Proveedor, Producto, Horario, BloqueoAgenda, Cita, CitaServicio, SolicitudCita, Venta, VentaProducto y VentaServicio. `0002` crea `RevisionVenta` (EXT-MV-U01). Total: 14 tablas.
- Nombres: PK `Id`, FK `<Tabla>Id` y los nombres de tabla del texto del ERS.
- Diferencias con el diagrama, resueltas según el texto: dos tablas de detalle de venta; Venta sin FK a Cliente ni a Cita (la referencia del cliente es texto); BloqueoAgenda sin enlace a Horario. Ninguna FK borra en cascada.
- CHECK acordados en las tablas de Citas: la hora de inicio de una cita y la hora propuesta tienen minutos 00 o 30 y segundos 00, y `HoraPropuesta` es nula cuando no es una reprogramación. `MotivoCancelacion` solo se guarda cuando `Cita.Estado = 'Cancelada'`; puede quedar nulo si la cancelación vino de una solicitud del cliente aprobada y es obligatorio cuando cancela la administradora (MCA-14, lo valida el API).
- Estados guardados sin tilde; Servicio, Producto y Proveedor usan `Activo` y `Desactivado`. Los valores exactos están en `CONTRATOS_API.md`.
- `0001_base.sql` se reescribió en el mismo archivo porque nadie lo había ejecutado. Fue la única excepción a la regla de no editar migraciones: desde ahora cualquier cambio va en una migración nueva.
- Pendiente: actualizar el diagrama de la sección 3.4 del ERS (y el de clases, si usa los nombres anteriores) para que coincida con la base.

## D-014 — Precio aproximado de un servicio (5 nov 2026)

Reemplaza a D-003. `Servicio.PrecioAproximado` guarda un solo monto, sin valores negativos: el monto mínimo aproximado que permite MS-01. No se usa rango porque la dueña no puede fijar un máximo: el precio depende del tipo y el largo del cabello. El catálogo muestra el monto con un aviso de que el precio final puede variar según el cabello (MS-01, supuesto 1).

## D-015 — Hora de Costa Rica sin depender de la computadora (5 nov 2026)

`SolicitudCita.FechaSolicitud`, `Venta.FechaHora` y `RevisionVenta.FechaHora` toman por defecto `DATEADD(HOUR, -6, SYSUTCDATETIME())`: Costa Rica está en UTC−6 todo el año, sin horario de verano, así que la hora guardada es la de Costa Rica aunque la computadora tenga otra zona configurada. En el API, `backend/src/shared/fechas.js` da la fecha y la hora actuales de Costa Rica (`hoyCostaRica`, `ahoraCostaRica`) para reglas como «el cliente reserva desde el día siguiente». `mssql` entrega las fechas como objetos `Date` en UTC con el valor guardado; se pasan al JSON con `fechaDeSql` y `horaDeSql` del mismo archivo.

## D-016 — Teléfonos, códigos y concurrencia (5 nov 2026)

- **Teléfonos** de Cliente y Proveedor: exactamente 8 dígitos, sin código de país (+506 no se usa). Al escribir se aceptan espacios y guiones; el API los quita (`validacion.telefono`) y guarda los 8 dígitos seguidos (`88887777`), y un CHECK lo verifica. Así la restricción de único compara siempre lo mismo. La interfaz los muestra como `8888-7777`.
- **Códigos:** el de venta lo calcula la base a partir del Id (`V-000001`). El de cita lo genera el API de Citas, corto y difícil de adivinar, porque el cliente lo usa junto con su teléfono.
- **Concurrencia en Citas:** toda operación que cambia la disponibilidad toma el mismo bloqueo de aplicación `agenda` (`sp_getapplock`, modo exclusivo, dueño la transacción) antes de revisar y guardar: crear, aprobar o reprogramar una cita, y crear, cambiar o eliminar horarios y bloqueos. Un solo bloqueo cubre la reprogramación entre dos fechas y los cambios del horario semanal sin riesgo de interbloqueo; para la cantidad de operaciones del salón no afecta la velocidad.
- **Concurrencia en Ventas:** el stock se descuenta con `UPDATE ... SET Stock = Stock - @cantidad WHERE Id = @id AND Stock >= @cantidad`; si no actualiza la fila, se deshace la venta y se responde «Cantidad insuficiente».
- `npm run db:verificar` comprueba en SQL Server las reglas de la base, y GitHub Actions lo ejecuta en cada push sobre un SQL Server 2022 temporal.

## D-017 — Nada de SQL fuera de la capa de datos (5 nov 2026)

Solo los archivos `<modulo>.datos.js` escriben SQL y usan `consulta` o `enTransaccion` de `shared/db.js`. Los archivos `.logica.js` y `.rutas.js` no importan `shared/db.js` ni `mssql`, no escriben SQL y no usan nombres de tablas ni de columnas: la capa de datos recibe y devuelve objetos en camelCase (la forma del contrato) y ahí se convierten las filas. Las transacciones de varias tablas (venta + stock, cita + solicitud) son una función completa de `.datos.js`; si una condición se comprueba en el SQL, la función devuelve el resultado y la lógica decide el error. Así un cambio en la base solo toca un archivo, las reglas del caso de uso se pueden probar sin SQL Server y el SQL parametrizado queda en un solo lugar (AGENTS.md, regla 4). `backend/test/capas.test.js` lo revisa en cada `npm test`. La infraestructura (`backend/src/app`, `backend/src/shared`, scripts de `backend/scripts`) puede usar `shared/db.js`, por ejemplo para `/api/salud`.

## D-018 — EXT-MS-R01 Reactivar servicio (5 nov 2026)

**Extensión acordada, no es parte del ERS.** El ERS solo define desactivar un servicio (MS-04) y MS-03 no cambia el estado, así que un servicio desactivado por error no se podía volver a ofrecer. Se agrega `PATCH /api/admin/servicios/:id/reactivar`, que cambia `Estado` de `Desactivado` a `Activo` con confirmación en la pantalla administrativa. El servicio vuelve al catálogo público y a citas nuevas; las citas y ventas anteriores no cambian. Si ya estaba activo, no repite la operación. No necesita cambios en la base.
