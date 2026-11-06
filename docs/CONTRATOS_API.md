# Contratos del API

Acuerdos de comunicación entre React y Express, y entre los módulos de cada persona. Antes de programar una pantalla que use datos del otro módulo, el contrato debe estar aquí. Los nombres de rutas son decisiones de implementación, no requerimientos del ERS.

## Convenciones generales

- **Base:** todas las rutas empiezan con `/api`. React usa rutas relativas por medio de `frontend/src/shared/api/cliente.js`.
- **Grupos de rutas:**
  - `/api/publico/<modulo>`: funciones del cliente, sin sesión. Solo devuelven información pública (Ley 8968, AC-03).
  - `/api/admin/<modulo>`: funciones administrativas. El servidor exige sesión para todo este grupo (AC-01); no basta con ocultar botones en React.
  - `/api/auth`: inicio y cierre de sesión.
  - `/api/salud`: estado del API y de la conexión con SQL Server.
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

## Pendientes de definir

Cada responsable completa la tabla de rutas de su módulo antes de programarlo. Las rutas propuestas están en el comentario inicial de cada archivo `backend/src/modules/<modulo>/<modulo>.rutas.js`.

- **Proveedores, Productos, Ventas** (Persona B).
- **Citas, Agenda, Solicitudes** (Persona A). La disponibilidad se calcula con un solo algoritmo en el servidor; React no decide si un horario es válido.
