# Contratos del API

Acuerdos de comunicación entre React y Express, y entre los módulos de cada persona. Antes de programar una pantalla que use datos del otro módulo, el contrato debe estar aquí. Los nombres de rutas son decisiones de implementación, no requerimientos del ERS.

## Convenciones generales

- **Base:** todas las rutas empiezan con `/api`. React usa rutas relativas por medio de `frontend/src/shared/api/cliente.js`.
- **Grupos de rutas:**
  - `/api/publico/<modulo>`: funciones del cliente, sin sesión. Solo devuelven información pública (Ley 8968, AC-03).
  - `/api/admin/<modulo>`: funciones administrativas. El servidor exige sesión para todo este grupo (AC-01); no basta con ocultar botones en React.
  - `/api/auth`: inicio y cierre de sesión.
  - `/api/salud`: público; solo indica si el API y SQL Server están conectados (sin nombres de base ni servidor).
  - `/api/admin/salud`: diagnóstico completo para la administradora (EXT-SAL-01, D-025).
- **JSON:** los nombres de los campos son los de las columnas en camelCase (`Id` → `id`, `DuracionMinutos` → `duracionMinutos`, `ClienteId` → `clienteId`).
- **Fechas y horas:** fecha `YYYY-MM-DD` y hora `HH:mm`, en hora de Costa Rica. No se convierten a UTC. La fecha y la hora actuales salen de `backend/src/shared/fechas.js`, no del reloj de la computadora (D-015).
- **Montos:** números en colones, con hasta 2 decimales.
- **Teléfonos:** 8 dígitos seguidos (`88887777`), sin código de país. El API acepta espacios y guiones al recibirlos y los quita; React los muestra como `8888-7777` (D-016).
- **Estados:** se envían tal como se guardan, sin tilde; React muestra el texto de la tabla siguiente.

### Valores de estados y listas

Son los mismos en SQL (CHECK), Express y React. No se escriben de otra forma.

| Campo | Valor guardado y enviado en JSON | Texto en pantalla |
|---|---|---|
| `Cita.Estado` | `Pendiente`, `Confirmada`, `Completada`, `Cancelada` | Pendiente, Confirmada, Completada, Cancelada |
| `SolicitudCita.Tipo` | `Creacion`, `Reprogramacion`, `Cancelacion` | Creación, Reprogramación, Cancelación |
| `SolicitudCita.Estado` | `Pendiente`, `Aprobada`, `Rechazada` | Pendiente, Aprobada, Rechazada |
| `Servicio.Estado`, `Producto.Estado`, `Proveedor.Estado` | `Activo`, `Desactivado` | Activo, Desactivado |
| `Producto.Disponibilidad` (calculada) | `Disponible`, `Agotado` | Disponible, Agotado |
| `Venta.Estado` | `Registrada`, `Anulada` | Registrada, Anulada |
| `Venta.MetodoPago` | `Efectivo`, `SINPE`, `Transferencia` | Efectivo, SINPE, Transferencia |

### Respuesta exitosa

```json
{ "ok": true, "data": { }, "mensaje": "Texto opcional para mostrar" }
```

Crear devuelve `201`; consultar, actualizar, desactivar o anular devuelven `200`.

### Respuesta de error

```json
{ "ok": false, "codigo": "HORARIO_OCUPADO", "mensaje": "El horario seleccionado ya no está disponible.", "detalles": { "campo": "hora" } }
```

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta un dato obligatorio o tiene un formato inválido. `detalles.campo` indica cuál. |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido. |
| 401 | `NO_AUTENTICADO` | Ruta administrativa sin sesión. |
| 401 | `CREDENCIALES_INVALIDAS` | Usuario o contraseña incorrectos (mensaje exacto del ERS). |
| 404 | `NO_ENCONTRADO` / `RUTA_NO_ENCONTRADA` | El registro o la ruta no existen. |
| 409 | `DUPLICADO` | Se repite un dato único (teléfono, correo, código). |
| 409 | código del módulo | Regla de negocio, por ejemplo `CANTIDAD_INSUFICIENTE`, `HORARIO_OCUPADO`, `VENTA_YA_ANULADA`. |
| 503 | `BASE_DATOS_NO_DISPONIBLE` | El API no se pudo conectar con SQL Server. |
| 500 | `ERROR_INTERNO` | Error no controlado (se registra en la consola del API). |

Cada módulo agrega aquí sus códigos de negocio. Usen los mensajes exactos del ERS cuando el caso de uso los define (por ejemplo, «Cantidad insuficiente» en MV-01).

## Acceso administrativo (implementado) — Persona B

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/login` | `{ "usuario": "admin", "contrasena": "..." }` | `200 { usuario }` y cookie de sesión `zaira.sid`; `401 CREDENCIALES_INVALIDAS` |
| POST | `/api/auth/logout` | — | `200`; la sesión queda cerrada |
| GET | `/api/auth/sesion` | — | `200 { autenticada: true, usuario }` o `{ autenticada: false }` |

La sesión dura 8 horas de inactividad y se guarda en memoria del servidor: si el API se reinicia, hay que iniciar sesión otra vez.

## Servicio (urgente: lo consume Citas) — Persona B

| Método | Ruta | Grupo | Requerimiento | Cuerpo | Respuesta |
|---|---|---|---|---|---|
| GET | `/api/publico/servicios` | público | MS-02 | — | `200 [servicio]`, solo `Activo` |
| GET | `/api/admin/servicios` | admin | MS-05 | — | `200 [servicio]`, activos y desactivados |
| GET | `/api/admin/servicios/:id` | admin | MS-05 | — | `200 servicio`; `404 NO_ENCONTRADO` |
| POST | `/api/admin/servicios` | admin | MS-01 | `{ nombre, descripcion, precioAproximado, duracionMinutos, permiteDomicilio }` | `201 servicio` (queda `Activo`) |
| PUT | `/api/admin/servicios/:id` | admin | MS-03 | igual que POST; no cambia el estado | `200 servicio` |
| PATCH | `/api/admin/servicios/:id/desactivar` | admin | MS-04 | — | `200 servicio`; si ya estaba desactivado, responde igual con el mensaje «El servicio ya estaba desactivado.» |
| PATCH | `/api/admin/servicios/:id/reactivar` | admin | **EXT-MS-R01** (extensión, no está en el ERS; D-018) | — | `200 servicio` en estado `Activo`; si ya estaba activo, responde igual con «El servicio ya estaba activo.» |

Errores de validación: `400 DATOS_INVALIDOS`. Cuando faltan datos, el mensaje los enumera (por ejemplo «Faltan datos obligatorios: nombre, descripción.») y `detalles.campo` indica el primero. Reglas: nombre hasta 100 caracteres; descripción hasta 500; precio aproximado ≥ 0; duración entero mayor que cero; `permiteDomicilio` opcional, `false` por defecto.

Forma de un servicio en las respuestas:

```json
{
  "id": 1,
  "nombre": "Corte de cabello",
  "descripcion": "Corte y secado.",
  "precioAproximado": 6000,
  "duracionMinutos": 45,
  "permiteDomicilio": true,
  "estado": "Activo"
}
```

- Citas usa `id`, `nombre`, `duracionMinutos`, `permiteDomicilio` y `estado` (tabla `Servicio`, columnas `Id`, `Nombre`, `DuracionMinutos`, `PermiteDomicilio`, `Estado`).
- `GET /api/publico/servicios` devuelve solo servicios `Activo` (MS-02). Citas lo usa para que el cliente elija servicios.
- `GET /api/admin/servicios` devuelve servicios `Activo` y `Desactivado` (MS-05).
- `precioAproximado` es un solo monto; el catálogo lo muestra con un aviso de que el precio final puede variar según el tipo y el largo del cabello (D-014).
- Citas guarda la duración en `CitaServicio.DuracionAplicadaMinutos` al registrar la cita; un cambio posterior de `duracionMinutos` no afecta citas existentes.
- Un servicio `Desactivado` no se ofrece para citas nuevas, pero sigue apareciendo en citas y ventas anteriores.
- No se renombran ni eliminan estos campos sin acuerdo de los dos.

## Citas (MCA-01 a MCA-04, MCA-07, MCA-12 a MCA-14) — Persona A

Programado por Ignacio a pedido del equipo para la Integración 1 (D-019); el módulo sigue siendo de Persona A.

| Método | Ruta | Requerimiento | Entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/admin/citas` | MCA-04 | `?fecha=YYYY-MM-DD&estado=Confirmada&cliente=texto` (todos opcionales; `cliente` busca en nombre o teléfono) | `200 [resumen]`; lista vacía si no hay resultados |
| GET | `/api/admin/citas/:id` | MCA-04 | — | `200 detalle`; `404 NO_ENCONTRADO` |
| GET | `/api/admin/citas/disponibilidad` | MCA-12 | `?fecha=YYYY-MM-DD&servicios=1,2` | `200 { fecha, duracionTotalMinutos, horarios: ["09:00", "09:30", ...] }` |
| GET | `/api/admin/citas/clientes` | MCA-12 | `?telefono=8888-7777` | `200 cliente` o `200 null` si no existe |
| POST | `/api/admin/citas` | MCA-12 | ver abajo | `201 detalle`, estado `Confirmada`; no crea `SolicitudCita` |
| GET | `/api/admin/citas/:id/disponibilidad` | MCA-13 | `?fecha=YYYY-MM-DD` | `200 { fecha, duracionTotalMinutos, horarios }` sin contar la propia cita |
| PATCH | `/api/admin/citas/:id/reprogramar` | MCA-13 | `{ fecha, hora }` | `200 detalle`; sigue `Confirmada`, mismos servicios |
| PATCH | `/api/admin/citas/:id/cancelar` | MCA-14 | `{ motivo }` (obligatorio, hasta 500) | `200 detalle`, estado `Cancelada` |
| PATCH | `/api/admin/citas/:id/completar` | MCA-07 | — | `200 detalle`, estado `Completada`; no crea ventas |
| GET | `/api/publico/citas/disponibilidad` | MCA-01 | `?fecha=YYYY-MM-DD&servicios=1,2` (desde mañana) | `200 { fecha, duracionTotalMinutos, horarios }` |
| POST | `/api/publico/citas` | MCA-01 | igual que `POST /api/admin/citas` (sin `estado`) | `201 vista del cliente`, estado `Pendiente`, con `SolicitudCita` de creación |
| POST | `/api/publico/citas/consulta` | MCA-02, MCA-03 | `{ codigo, telefono }` | `200 vista del cliente`; `404 CITA_NO_ENCONTRADA` sin decir qué dato falla |
| POST | `/api/publico/citas/reprogramacion/horarios` | MCA-02 | `{ codigo, telefono, fecha }` | `200 { fecha, duracionTotalMinutos, horarios }` |
| POST | `/api/publico/citas/reprogramacion` | MCA-02 | `{ codigo, telefono, fecha, hora }` | `200 vista del cliente`; la cita pasa a `Pendiente` y conserva su fecha |
| POST | `/api/publico/citas/cancelacion` | MCA-03 | `{ codigo, telefono }` | `200 vista del cliente`; la cita sigue `Confirmada` |

Cuerpo de `POST /api/admin/citas`:

```json
{
  "cliente": { "telefono": "8888-7777", "nombre": "Ana Mora", "correoElectronico": "" },
  "servicios": [1, 3],
  "fecha": "2026-11-16",
  "hora": "09:30",
  "esDomicilio": false,
  "direccion": null,
  "observaciones": null
}
```

- Si ya existe un cliente con ese teléfono, la cita se asocia a él y no se cambian sus datos; si no, se crea en la misma transacción.
- Resumen (listado): `{ id, codigo, fecha, hora, horaFin, duracionMinutos, estado, esDomicilio, cliente: { nombre, telefono }, servicios: "Corte, Tinte" }`.
- Detalle: `{ id, codigo, fecha, hora, horaFin, duracionMinutos, estado, esDomicilio, direccion, observaciones, motivoCancelacion, tieneSolicitudPendiente, cliente: { id, nombre, telefono, correoElectronico }, servicios: [{ id, nombre, estado, duracionAplicadaMinutos }] }`.
- Códigos de negocio: `409 HORARIO_OCUPADO` («El horario seleccionado ya no está disponible. Seleccione otro horario.»), `409 SERVICIO_NO_DISPONIBLE`, `409 DOMICILIO_NO_DISPONIBLE`, `400 FECHA_PASADA`, `409 CITA_NO_CONFIRMADA` (reprogramar o cancelar una cita que no está Confirmada), `409 SOLICITUD_PENDIENTE` (primero se procesa la solicitud con MCA-06).
- Vista del cliente (rutas públicas): `{ codigo, fecha, hora, horaFin, duracionMinutos, estado, esDomicilio, servicios: [{ nombre, duracionMinutos }], solicitudPendiente: "Creacion" | "Reprogramacion" | "Cancelacion" | null, puedeSolicitarCambios }`. No incluye datos del cliente ni dirección. El teléfono siempre va en el cuerpo, nunca en la URL.
- El cliente elige fechas desde el día siguiente (`400 FECHA_NO_PERMITIDA`). Con una solicitud pendiente no puede registrar otra (`409 SOLICITUD_PENDIENTE`).
- La disponibilidad se calcula con un solo algoritmo en el servidor (`horariosDisponibles` en `citas.logica.js`): horas cada 30 minutos dentro del horario regular, donde cabe la duración total, sin chocar con bloqueos, citas `Pendiente` o `Confirmada` ni reprogramaciones `Pendiente`. Al registrar se vuelve a verificar con el bloqueo `agenda` tomado (D-016).

## Solicitudes de cita (MCA-05 y MCA-06) — Persona A

| Método | Ruta | Requerimiento | Respuesta |
|---|---|---|---|
| GET | `/api/admin/solicitudes` | MCA-05 | `200 [solicitud]`, solo `Pendiente`, de la más antigua a la más reciente |
| GET | `/api/admin/solicitudes/resumen` | MCA-05 (aviso interno) | `200 { pendientes, ultimaId }`; el panel lo consulta cada 20 segundos |
| GET | `/api/admin/solicitudes/:id` | MCA-05 | `200 solicitud` |
| PATCH | `/api/admin/solicitudes/:id/aprobar` | MCA-06 | `200 solicitud` ya `Aprobada`, con la cita actualizada |
| PATCH | `/api/admin/solicitudes/:id/rechazar` | MCA-06 | `200 solicitud` ya `Rechazada`, con la cita actualizada |

- Solicitud: `{ id, tipo, estado, fechaSolicitud, propuesta: { fecha, hora } | null, cita: { id, codigo, fecha, hora, estado, duracionMinutos, servicios, esDomicilio, direccion, observaciones }, cliente: { nombre, telefono, correoElectronico } }`.
- Resultado según la tabla de CU-MCA-06: creación aprobada → cita `Confirmada`, rechazada → `Cancelada`; reprogramación aprobada → nueva fecha y `Confirmada`, rechazada → `Confirmada` con la fecha original; cancelación aprobada → `Cancelada` (sin motivo), rechazada → sigue `Confirmada`.
- Errores: `409 SOLICITUD_YA_PROCESADA`, `409 SOLICITUD_INCONSISTENTE` (la cita no está en el estado que corresponde al tipo), `409 CONFLICTO_AGENDA` (el período ya no es válido al aprobar). Todo en una transacción con el bloqueo `agenda`.

## Configuración de agenda (MCA-08 a MCA-11) — Persona A

| Método | Ruta | Requerimiento | Entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/admin/agenda` | MCA-09 | — | `200 { horarios: [{ id, tipo: "Horario regular", diaSemana, dia, horaInicio, horaFin }], bloqueos: [{ id, tipo: "Bloqueo de agenda", fecha, horaInicio, horaFin }] }` |
| POST | `/api/admin/agenda/horarios` | MCA-08 | `{ diaSemana: 1-7, horaInicio: "HH:mm", horaFin }` | `201 horario` |
| PUT | `/api/admin/agenda/horarios/:id` | MCA-10 | igual que POST | `200 horario` |
| DELETE | `/api/admin/agenda/horarios/:id` | MCA-11 | — | `200` con el horario eliminado |
| POST | `/api/admin/agenda/bloqueos` | MCA-08 | `{ fecha, horaInicio, horaFin }` | `201 bloqueo` |
| PUT | `/api/admin/agenda/bloqueos/:id` | MCA-10 | igual que POST | `200 bloqueo` |
| DELETE | `/api/admin/agenda/bloqueos/:id` | MCA-11 | — | `200` con el bloqueo eliminado |

- `diaSemana`: 1 lunes … 7 domingo. La hora final debe ser posterior a la inicial (`400 DATOS_INVALIDOS`); un bloqueo no puede ser de una fecha pasada (`400 FECHA_PASADA`).
- `409 AGENDA_SUPERPOSICION`: se superpone con otro horario del mismo día o con otro bloqueo de la misma fecha (tocarse, como 12:00 y 12:00, sí se permite).
- `409 AGENDA_CITAS_AFECTADAS`: dejaría fuera (horario) o taparía (bloqueo) una cita futura Confirmada; el mensaje lista los códigos. `409 AGENDA_RESERVAS_AFECTADAS`: lo mismo con citas Pendientes o reprogramaciones Pendientes.
- Ninguna operación cambia citas ni solicitudes. Todas toman el bloqueo `agenda` (D-016).

## Proveedores — Persona B

| Método | Ruta | Requerimiento | Entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/admin/proveedores` | MPV-02 | `?buscar=` nombre, teléfono o correo (opcional) | `200 [proveedor]`, activos primero |
| GET | `/api/admin/proveedores/:id` | MPV-02 | — | `200 proveedor` con `productos: [{ id, nombre, marca, stock, disponibilidad, estado }]` |
| POST | `/api/admin/proveedores` | MPV-01 | `{ nombre, telefono, correoElectronico }` (los tres obligatorios) | `201 proveedor` (queda `Activo`) |
| PUT | `/api/admin/proveedores/:id` | MPV-03 | igual que POST; no cambia estado ni productos | `200 proveedor` |
| PATCH | `/api/admin/proveedores/:id/desactivar` | MPV-04 | — | `200 proveedor`; si ya estaba desactivado: «El proveedor ya está desactivado.» |
| PATCH | `/api/admin/proveedores/:id/reactivar` | **EXT-MPV-R01** (extensión, no está en el ERS; D-020) | — | `200 proveedor` en `Activo` |

- Proveedor: `{ id, nombre, telefono, correoElectronico, estado }`.
- `409 DUPLICADO` con el mensaje «El teléfono ingresado ya pertenece a otro proveedor registrado.» (o «El correo electrónico…»).

## Productos — Persona B

| Método | Ruta | Requerimiento | Entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/publico/productos` | MPD-03 | — | `200 [{ id, nombre, marca, categoria, descripcion, precio, disponibilidad }]`, solo `Activo`; sin stock ni proveedor |
| GET | `/api/admin/productos` | MPD-03 | — | `200 [producto]`, activos y desactivados |
| GET | `/api/admin/productos/inventario` | MPD-04 | — | `200 [{ id, nombre, marca, stock, disponibilidad, estado }]` |
| GET | `/api/admin/productos/:id` | MPD-03 | — | `200 producto` |
| POST | `/api/admin/productos` | MPD-01 | `{ nombre, marca, categoria, descripcion, precio, stock, proveedorId }` | `201 producto` (queda `Activo`) |
| PUT | `/api/admin/productos/:id` | MPD-05 | igual que POST sin `stock` (si viene, se ignora) | `200 producto`; el stock no cambia |
| PATCH | `/api/admin/productos/:id/stock` | MPD-06 | `{ stock }` entero ≥ 0 | `200 producto` |
| PATCH | `/api/admin/productos/:id/desactivar` | MPD-02 | — | `200 producto`; sale del catálogo público |
| PATCH | `/api/admin/productos/:id/reactivar` | **EXT-MPD-R01** (extensión, no está en el ERS; D-020) | — | `200 producto` en `Activo` |

- Producto (admin): `{ id, nombre, marca, categoria, descripcion, precio, stock, disponibilidad, estado, proveedor: { id, nombre, estado } }`.
- `409 PROVEEDOR_NO_DISPONIBLE`: el proveedor elegido no existe o está desactivado. Al actualizar, si el producto conserva su mismo proveedor, se acepta aunque ese proveedor esté desactivado (MPV-04, restricción 3).
- El descuento y la reposición automática de stock (MPD-06 desde MV-01 y MV-03) se hacen en la transacción de la venta.

## Ventas — Persona B

| Método | Ruta | Requerimiento | Entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/admin/ventas` | MV-02 | `?codigo=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&cliente=&metodoPago=&estado=` (todos opcionales) | `200 [{ id, codigo, fechaHora, referenciaCliente, metodoPago, total, estado }]`, más recientes primero |
| GET | `/api/admin/ventas/:id` | MV-02 | — | `200 venta` |
| POST | `/api/admin/ventas` | MV-01 | ver abajo | `201 venta`, estado `Registrada` |
| PATCH | `/api/admin/ventas/:id/anular` | MV-03 | `{ motivo }` (obligatorio, hasta 500) | `200 venta`, estado `Anulada`; repone el stock |
| PUT | `/api/admin/ventas/:id` | **EXT-MV-U01** (extensión acordada, no está en el ERS; D-008, D-022) | igual que POST más `motivo` (obligatorio) | `200 venta` corregida; mismo código y fecha |

Cuerpo de `POST /api/admin/ventas`:

```json
{
  "referenciaCliente": "Ana Mora",
  "productos": [{ "id": 1, "cantidad": 2 }],
  "servicios": [{ "id": 3, "precioFinal": 8000 }],
  "metodoPago": "SINPE",
  "pagoConfirmado": true
}
```

- Venta: `{ id, codigo, fechaHora: "2026-11-06 10:30", referenciaCliente, metodoPago, total, estado, motivoAnulacion, productos: [{ id, nombre, marca, cantidad, precioAplicado }], servicios: [{ id, nombre, precioFinal }], revisiones: [{ id, fechaHora, motivo, datosAnteriores }] }`. `revisiones` pertenece a la extensión EXT-MV-U01 (vacío si nunca se corrigió).
- El precio de cada producto lo toma el servidor del catálogo al registrar (no se envía); el total lo calcula el servidor. Un producto repetido suma sus cantidades; un servicio va una sola vez.
- EXT-MV-U01: `409 VENTA_NO_EDITABLE` si la venta está Anulada. Los productos que ya estaban conservan su precio original; los nuevos toman el del catálogo.
- Códigos de negocio: `409 CANTIDAD_INSUFICIENTE` con el mensaje exacto «Cantidad insuficiente» y `detalles: { producto, disponible, solicitado }`; `400 PAGO_NO_CONFIRMADO`; `409 PRODUCTO_NO_DISPONIBLE` y `409 SERVICIO_NO_DISPONIBLE` (desactivado o inexistente); `409 VENTA_YA_ANULADA`.
- Registrar descuenta el stock y anular lo repone en la misma transacción que la venta (D-016, D-017); nunca quedan cambios parciales.

## Salud del sistema (EXT-SAL-01, herramienta interna, no está en el ERS) — Persona B

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/admin/salud` | Revisión completa del API, SQL Server, migraciones, tablas y endpoints |
| POST | `/api/admin/salud/escritura/:modulo` | Prueba de escritura que siempre se revierte (`servicios`, `proveedores`, `productos`, `ventas`, `agenda`) |

- `GET` devuelve `{ revisadoEn, duracionMs, general, api, baseDatos, migraciones, tablas, modulos, sugerencias }`. `general` es `OK`, `CON_PROBLEMAS` o el tipo de error de la conexión.
- Cada módulo: `{ clave, nombre, crud, requerimientos, estado, operaciones: { C, R, U, D }, lectura: { ok, ms, registros }, pruebaEscritura, endpoints: [{ metodo, ruta, operacion, rf, accion, estado, detalle, necesita }] }`.
- Estados: `OK`, `SIN_CONEXION`, `LOGIN`, `BASE_NO_EXISTE`, `FALTA_TABLA`, `SIN_PERMISO`, `RESTRICCION`, `ERROR`. Los errores traen `{ tipo, codigo, numero, mensaje, sugerencia }`.
- `POST` devuelve `{ modulo, nombre, revertida: true, duracionMs, estado, pasos: [{ operacion, descripcion, estado, ms, error }] }`; un paso puede quedar `OMITIDA` o `NO_PROBADA`. Un módulo sin prueba responde `400 DATOS_INVALIDOS`.

## Pendientes de definir

Cada responsable completa la tabla de rutas de su módulo antes de programarlo. Las rutas propuestas están en el comentario inicial de cada archivo `backend/src/modules/<modulo>/<modulo>.rutas.js`.

