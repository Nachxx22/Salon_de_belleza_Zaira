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

## D-019 — Citas para la Integración 1, código de cita y disponibilidad (6 nov 2026)

- **Quién:** por pedido del equipo, Ignacio programó en el módulo de Persona A lo mínimo para la Integración 1: MCA-12 Crear cita (Administrador), MCA-04 Consultar citas, la disponibilidad y `clientes.datos.js`. El módulo sigue siendo de Persona A: ella lo revisa, lo ajusta y continúa con MCA-01 a MCA-03, MCA-05 a MCA-07, MCA-13 y MCA-14.
- **Código de cita:** `C-` seguido de 8 caracteres al azar (`crypto.randomInt`) de un alfabeto sin `0`, `O`, `1` ni `I`, para dictarlo por teléfono sin confusiones (por ejemplo `C-K7MQ2XPA`). Hay más de un billón de combinaciones, así que no se puede adivinar junto con un teléfono.
- **Disponibilidad:** un solo algoritmo en `citas.logica.js` (`horariosDisponibles`). Ofrece horas cada 30 minutos dentro del horario regular del día (los tramos que se tocan se unen), donde cabe la duración total, sin chocar con bloqueos, citas `Pendiente` o `Confirmada` ni reprogramaciones `Pendiente`. Para la administradora, el mismo día solo ofrece horas que todavía no han pasado y rechaza fechas pasadas (`FECHA_PASADA`). La anticipación mínima del cliente (MCA-01) se agregará con la ruta pública.
- **Transacción:** `citas.datos.js` (`registrarCita`) toma el bloqueo `agenda`, vuelve a leer la agenda, pregunta a la lógica si la hora sigue libre y registra cliente, cita y servicios juntos (D-016, D-017).

## D-020 — EXT-MPV-R01 y EXT-MPD-R01: reactivar proveedor y producto (6 nov 2026)

**Extensiones acordadas, no son parte del ERS.** Como en D-018 (servicios), el ERS solo define desactivar un proveedor (MPV-04) o un producto (MPD-02). Se agregan `PATCH /api/admin/proveedores/:id/reactivar` y `PATCH /api/admin/productos/:id/reactivar`, con confirmación en pantalla. No se cambian ventas, productos asociados ni stock. **Las ventas no tienen esta extensión:** una venta anulada (MV-03) queda anulada para siempre.

Otras decisiones del paso 7: el catálogo público de productos no muestra stock, proveedor ni estado (MPD-03, restricción 1); al actualizar un producto que conserva su mismo proveedor, se acepta aunque ese proveedor esté desactivado, porque los productos conservan la asociación (MPV-04, restricción 3); el stock solo cambia con MPD-06 o con una venta.

## D-021 — Reglas de ventas (6 nov 2026)

- **Solo se vende lo activo:** un producto o servicio desactivado no se puede incluir en una venta nueva (`PRODUCTO_NO_DISPONIBLE`, `SERVICIO_NO_DISPONIBLE`). Desactivar significa que deja de ofrecerse (MPD-02, MS-04); las ventas anteriores no cambian.
- **Stock sin carreras:** el descuento es `UPDATE ... SET Stock = Stock - @cantidad WHERE Stock >= @cantidad` dentro de la transacción de la venta (D-016). Si una línea no alcanza, se revierte toda la venta y se responde «Cantidad insuficiente» (mensaje exacto del ERS) con el producto, lo disponible y lo pedido.
- **Precio y total los pone el servidor:** el precio de cada producto se toma del catálogo en el momento de la venta y queda fijo en `VentaProducto.PrecioAplicado`; el total lo calcula `ventas.logica.js`. React solo muestra una vista previa.
- **Líneas repetidas:** un producto repetido suma sus cantidades; un servicio solo puede ir una vez por venta (llave de `VentaServicio`).
- **Pago:** el campo `pagoConfirmado: true` es obligatorio (MV-01, restricción 8). No se guarda: sin él la venta no existe.
- **Anular:** solo cambia `Estado` y `MotivoAnulacion` y suma de vuelta las cantidades al stock, todo en una transacción (MV-03). Una venta anulada no se reactiva (D-020).
- `validarFecha` pasó a `shared/validacion.js` (`fecha`) para que Ventas no dependa del módulo de Citas.

## D-022 — Cómo funciona EXT-MV-U01 Corregir venta (6 nov 2026)

**Extensión acordada, no es parte del ERS** (D-008). El ERS indica anular y registrar otra venta; esta corrección se agrega para mostrar el CRUD completo de Ventas.

- `PUT /api/admin/ventas/:id` con el mismo cuerpo que registrar más un `motivo` obligatorio. Solo ventas `Registrada` (`409 VENTA_NO_EDITABLE`).
- En una sola transacción: bloquea la venta, guarda en `RevisionVenta.DatosAnteriores` (JSON) la referencia, el método de pago, el total y el detalle anteriores, devuelve al stock las cantidades anteriores, reemplaza el detalle por el nuevo descontando stock con `Stock >= cantidad` y actualiza referencia, método de pago y total. Si algo falla («Cantidad insuficiente», producto o servicio no disponible) no cambia nada.
- El código y la fecha de la venta no cambian. Los productos que ya estaban conservan su precio original y se pueden mantener aunque hoy estén desactivados; los productos o servicios nuevos deben estar activos y toman el precio del catálogo.
- Las filas de `VentaProducto` y `VentaServicio` se reemplazan; la versión anterior completa queda en `RevisionVenta`, así que no se pierde historial. La venta nunca se borra.
- El detalle de la venta (MV-02) muestra las correcciones con su fecha y motivo.
- Formulario de venta: los servicios muestran el precio aproximado guardado solo como referencia; el precio final se escribe en colones enteros.

## D-023 — Agenda, reprogramar y cancelar para el hito P0 (6 nov 2026)

- **Quién:** igual que en D-019, Ignacio programó a pedido del equipo MCA-08 a MCA-11 (configuración de agenda), MCA-13 (reprogramar) y MCA-14 (cancelar), que son del módulo de Persona A. Ella los revisa y continúa con los P1 (MCA-01 a MCA-03, MCA-05 a MCA-07).
- **«Futuras»:** al cambiar o eliminar un horario regular se revisan las citas Pendientes o Confirmadas y las reprogramaciones Pendientes de ese día de la semana desde ahora (hora de Costa Rica) en adelante. Una ocupación debe quedar completa dentro de un tramo del día (los tramos que se tocan se unen). Para un bloqueo se revisa la fecha completa.
- **Mensajes:** si hay alguna cita Confirmada afectada se responde `AGENDA_CITAS_AFECTADAS` («citas activas» del ERS); si solo hay citas o reprogramaciones Pendientes, `AGENDA_RESERVAS_AFECTADAS`. El mensaje lista los códigos para que la administradora los ubique.
- **Bloqueos de fechas pasadas:** se rechazan (`FECHA_PASADA`).
- **Eliminar:** una configuración de agenda no es historial, así que MCA-11 elimina el registro. Ninguna operación de agenda cambia citas ni solicitudes.
- **Reprogramar:** la disponibilidad excluye la propia cita (puede moverse dentro de su mismo horario) y se verifica otra vez dentro de la transacción con el bloqueo `agenda`. La cita conserva servicios, duración aplicada y código.
- **Bloqueo `agenda`:** `tomarBloqueoAgenda` quedó en `agenda.datos.js` y lo usan Agenda y Citas (D-016).

## D-024 — Citas del cliente, solicitudes y completar (P1) (6 nov 2026)

- **Quién:** igual que en D-019 y D-023, Ignacio programó a pedido del equipo MCA-01 a MCA-03, MCA-05 a MCA-07 y las pantallas públicas «Solicitar cita» y «Mi cita», en los módulos de Persona A. Ella los revisa.
- **Anticipación mínima:** el cliente elige desde el día calendario siguiente (fecha mayor que hoy en hora de Costa Rica). La administradora no tiene esta regla (MCA-12, MCA-13).
- **Privacidad (Ley 8968, AC-03):** las rutas públicas reciben el teléfono en el cuerpo de la solicitud, nunca en la URL, y devuelven solo la vista del cliente (código, fecha, hora, servicios, estado), sin datos de contacto ni dirección. Si el código y el teléfono no coinciden, el mensaje no dice cuál de los dos falla.
- **Reprogramación del cliente:** el período propuesto no choca con la propia cita (puede moverla dentro de su horario). Mientras está Pendiente quedan reservados el original (cita Pendiente) y el propuesto (`SolicitudCita.FechaPropuesta`).
- **Procesar (MCA-06):** una sola transacción con el bloqueo `agenda` actualiza solicitud y cita según la tabla del caso de uso. Al aprobar una creación o reprogramación se verifica otra vez que el período siga dentro del horario y libre (`CONFLICTO_AGENDA`). Una cancelación aprobada deja `MotivoCancelacion` vacío porque no la decidió la administradora (MCA-14).
- **Aviso interno (MCA-05, criterios 12 y 13):** el panel consulta `GET /api/admin/solicitudes/resumen` cada 20 segundos y muestra un aviso cuando llega una solicitud nueva (y al entrar, si hay pendientes). No usa WhatsApp ni correo. La solicitud sigue en «Solicitudes» aunque se cierre el aviso.
- **Completar (MCA-07):** solo citas Confirmadas sin solicitud pendiente; no registra ventas ni pagos.
