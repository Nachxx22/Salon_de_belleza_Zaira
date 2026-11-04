# Decisiones del equipo

Registro de acuerdos que afectan a las dos personas. Cada decisión nueva se agrega al final con fecha. Las actas breves de las reuniones también van aquí.

## D-001 — Trabajo en la rama `main` (4 nov 2026)

Los dos trabajan directamente en `main`, con commits pequeños, `git pull --rebase` antes de subir y carpetas con dueño. Se descarta el flujo de ramas con pull requests del plan inicial (sección 6.2) por el plazo de 8 días. Para un cambio grande o arriesgado (por ejemplo, transacciones de ventas) se puede usar una rama corta. Detalle en `FLUJO_DE_TRABAJO.md`.

## D-002 — Modelo de datos: diagrama y texto de la sección 3.4 (4 nov 2026)

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

`PrecioAprox` es el monto mínimo aproximado ("desde ₡6 000"), una de las dos formas que permite MS-01. Si se quiere mostrar un rango, se agrega una columna con una migración nueva.

## D-004 — Rutas del API por grupo (4 nov 2026)

`/api/publico/...` sin sesión y `/api/admin/...` con sesión exigida una sola vez para todo el grupo. Así ninguna ruta administrativa queda desprotegida por olvido (AC-01).

## D-005 — Sesión administrativa (4 nov 2026)

Cookie de sesión httpOnly (`zaira.sid`) con express-session y contraseñas con bcrypt. Sesiones en memoria: suficiente para el prototipo local; al reiniciar el API hay que volver a iniciar sesión. En un despliegue real se usaría HTTPS y un almacén persistente (AC-02).

## D-006 — Fechas y horas locales (4 nov 2026)

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
