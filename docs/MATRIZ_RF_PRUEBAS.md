# Matriz de requerimientos, Jira y pruebas

Seguimiento de los 34 requerimientos funcionales del ERS y de la extensión acordada. Actualícenla cada día (plan, sección 10).

- **Jira RF / Jira CU:** clave de la actividad del requerimiento y de su caso de uso. Pongan la clave del RF en cada commit (ver `FLUJO_DE_TRABAJO.md`).
- **Fase:** P0 = parte de los cinco CRUD que se demuestran; P1 = resto de comportamientos del ERS.
- **Estado:** pendiente → en curso → integrado → probado.
- **Prueba:** qué se probó contra los criterios de aceptación del caso de uso (flujo normal, alternos y excepciones).

## Acceso administrativo — Persona B (Ignacio)

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MA-01 | Iniciar sesión | Alta | SCRUM-99 | SCRUM-101 | P0 | en curso | Estructura inicial: login en servidor y React; pruebas automáticas de rutas protegidas. Falta probar con SQL Server. |
| MA-02 | Cerrar sesión | Alta | SCRUM-100 | SCRUM-102 | P0 | en curso | Estructura inicial: cierre de sesión en servidor y React. Falta probar con SQL Server. |

## Servicios — Persona B (Ignacio)

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MS-01 | Registrar servicio | Alta | SCRUM-39 | SCRUM-93 | P0 | probado | Pruebas automáticas de validación y prueba manual con SQL Server (6 nov): registrar, datos inválidos, cancelar. |
| MS-02 | Consultar servicio (Cliente) | Alta | SCRUM-40 | SCRUM-94 | P0 | probado | Catálogo con SQL Server: solo servicios activos, aviso de precio aproximado. |
| MS-03 | Actualizar servicio | Alta | SCRUM-41 | SCRUM-95 | P0 | probado | Actualización probada con SQL Server. Criterio 3 (citas existentes conservan la duración) probado de punta a punta en `npm run api:integracion`. |
| MS-04 | Desactivar servicio | Media | SCRUM-42 | SCRUM-96 | P0 | probado | Baja lógica con confirmación, probada con SQL Server: sale del catálogo y queda en el listado administrativo. |
| MS-05 | Consultar servicios (Administrador) | Alta | SCRUM-43 | SCRUM-97 | P0 | probado | Listado administrativo con activos y desactivados, probado con SQL Server. |
| EXT-MS-R01 | Reactivar servicio (**extensión acordada, no está en el ERS**; D-018) | — | — | — | P0 | probado | Reactivar con confirmación, probado con SQL Server: vuelve al catálogo. |

## Proveedores — Persona B (Ignacio)

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MPV-01 | Registrar proveedor | Media | SCRUM-31 | SCRUM-85 | P0 | probado | Validación, duplicados de teléfono y correo, estado Activo. Pruebas automáticas y de punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPV-02 | Consultar proveedor | Media | SCRUM-32 | SCRUM-86 | P0 | probado | Listado con búsqueda por nombre, teléfono o correo y detalle con productos asociados. Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPV-03 | Actualizar proveedor | Media | SCRUM-33 | SCRUM-87 | P0 | probado | Mismas reglas que el registro; no cambia estado ni productos. Probado en pantalla con SQL Server (6 nov). |
| MPV-04 | Desactivar proveedor | Media | SCRUM-34 | SCRUM-88 | P0 | probado | Baja lógica con confirmación; conserva productos; impide asociaciones nuevas. Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |

## Productos — Persona B (Ignacio)

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MPD-01 | Registrar producto | Alta | SCRUM-25 | SCRUM-79 | P0 | probado | Proveedor activo obligatorio, precio ≥ 0, stock entero ≥ 0, Disponible/Agotado. Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPD-02 | Desactivar producto | Media | SCRUM-26 | SCRUM-80 | P0 | probado | Baja lógica con confirmación; sale del catálogo público. Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPD-03 | Consultar producto | Alta | SCRUM-27 | SCRUM-81 | P0 | probado | Catálogo público sin stock ni proveedor; consulta administrativa completa. Probado en pantalla con SQL Server (6 nov). |
| MPD-04 | Consultar stock | Alta | SCRUM-28 | SCRUM-82 | P0 | probado | Vista «Consultar stock». Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPD-05 | Actualizar producto | Alta | SCRUM-29 | SCRUM-83 | P0 | probado | No cambia el stock; proveedor nuevo debe estar activo. Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| MPD-06 | Actualizar stock | Alta | SCRUM-30 | SCRUM-84 | P0 | probado | Ajuste manual probado en pantalla (6 nov). Descuento al vender (MV-01) y reposición al anular (MV-03) de punta a punta con SQL Server (CI). |
| EXT-MPV-R01 | Reactivar proveedor (**extensión acordada, no está en el ERS**; D-020) | — | — | — | P0 | probado | Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |
| EXT-MPD-R01 | Reactivar producto (**extensión acordada, no está en el ERS**; D-020) | — | — | — | P0 | probado | Punta a punta con SQL Server (CI). Probado en pantalla con SQL Server (6 nov). |

## Ventas — Persona B (Ignacio)

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MV-01 | Registrar venta | Alta | SCRUM-35 | SCRUM-89 | P0 | integrado | Venta de productos y/o servicios en una transacción con el stock (Stock >= cantidad), «Cantidad insuficiente», pago confirmado, total del servidor. Pruebas de reglas y de punta a punta con SQL Server (CI). Falta probar en pantalla. |
| MV-02 | Consultar venta | Alta | SCRUM-36 | SCRUM-90 | P0 | integrado | Listado con filtros por código, fechas, cliente, método y estado; detalle con precios registrados. Punta a punta con SQL Server (CI). Falta probar en pantalla. |
| MV-03 | Anular venta | Media | SCRUM-38 | SCRUM-92 | P0 | integrado | Motivo obligatorio, confirmación, repone el stock en la misma transacción, no se anula dos veces. Punta a punta con SQL Server (CI). Falta probar en pantalla. |
| EXT-MV-U01 | Actualizar venta (**extensión acordada, no está en el ERS**) | — | — | — | P0 | pendiente | |

## Citas y Agenda — Persona A

| Código | Requerimiento | Prioridad ERS | Jira RF | Jira CU | Fase | Estado | Prueba |
|---|---|---|---|---|---|---|---|
| MCA-01 | Crear cita (cliente) | Alta | SCRUM-11 | SCRUM-65 | P1 | pendiente | |
| MCA-02 | Reprogramar cita (cliente) | Alta | SCRUM-12 | SCRUM-66 | P1 | pendiente | |
| MCA-03 | Cancelar cita (cliente) | Alta | SCRUM-13 | SCRUM-67 | P1 | pendiente | |
| MCA-04 | Consultar citas | Alta | SCRUM-14 | SCRUM-68 | P0 | probado | Programado para la Integración 1 (D-019). Filtros por fecha, estado y cliente; detalle. Prueba de punta a punta con SQL Server en `npm run api:integracion` (CI). Probado en pantalla con SQL Server (6 nov). Falta revisión de Persona A. |
| MCA-05 | Consultar solicitudes pendientes | Alta | SCRUM-15 | SCRUM-69 | P1 | pendiente | |
| MCA-06 | Procesar solicitud pendiente | Alta | SCRUM-16 | SCRUM-70 | P1 | pendiente | |
| MCA-07 | Marcar cita como completada | Alta | SCRUM-17 | SCRUM-71 | P1 | pendiente | |
| MCA-08 | Registrar configuración de agenda | Media | SCRUM-18 | SCRUM-72 | P0 | pendiente | |
| MCA-09 | Consultar configuración de agenda | Media | SCRUM-19 | SCRUM-73 | P0 | pendiente | |
| MCA-10 | Modificar configuración de agenda | Media | SCRUM-20 | SCRUM-74 | P0 | pendiente | |
| MCA-11 | Eliminar configuración de agenda | Media | SCRUM-21 | SCRUM-75 | P0 | pendiente | |
| MCA-12 | Crear cita (Administrador) | Media | SCRUM-22 | SCRUM-76 | P0 | probado | Programado para la Integración 1 (D-019). Pruebas del algoritmo de disponibilidad y de punta a punta con SQL Server (horario ocupado, cliente nuevo y existente, domicilio, sin servicios). Probado en pantalla con SQL Server (6 nov). Falta revisión de Persona A. |
| MCA-13 | Reprogramar cita (Administrador) | Media | SCRUM-23 | SCRUM-77 | P0 | pendiente | |
| MCA-14 | Cancelar cita (Administrador) | Media | SCRUM-24 | SCRUM-78 | P0 | pendiente | |

## Requerimientos no funcionales

Están en Jira bajo la épica SCRUM-10: desempeño PR-01 a PR-07 (SCRUM-103 a SCRUM-109) y atributos de calidad AC-01 a AC-13 (SCRUM-110 a SCRUM-122). Las pruebas mínimas de cada uno están en la sección 9 del plan de desarrollo.
