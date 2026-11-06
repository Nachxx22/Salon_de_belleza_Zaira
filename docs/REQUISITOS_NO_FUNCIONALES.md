# Requisitos no funcionales: cómo se cumplen

Verificación de los 20 requisitos no funcionales del ERS final: desempeño (sección 3.3, PR-01 a PR-07) y atributos de calidad (sección 3.6, AC-01 a AC-13). Claves de Jira: SCRUM-103 a SCRUM-122.

Cada requisito indica **cómo lo cumple el sistema**, la **evidencia** y **cómo mostrarlo en la demo**. Fecha de la verificación: 6 de noviembre de 2026.

## Resumen

| Código | Requisito | Estado | Evidencia principal |
|---|---|---|---|
| PR-01 | Páginas y consultas comunes ≤ 3 s | Cumple | `npm run api:rendimiento`: máximo 633 ms |
| PR-02 | Inicio de sesión ≤ 3 s | Cumple | Máximo 931 ms |
| PR-03 | Registro o actualización administrativa ≤ 3 s | Cumple | Máximo 526 ms |
| PR-04 | Disponibilidad de citas ≤ 4 s | Cumple | Máximo 445 ms |
| PR-05 | Venta con inventario ≤ 4 s | Cumple | Máximo 869 ms |
| PR-06 | Al menos 10 usuarios a la vez | Cumple | 10 usuarios, 350 operaciones, 0 errores |
| PR-07 | Pantalla actualizada sin recargar | Cumple | Cada pantalla vuelve a consultar el API al terminar |
| AC-01 | Funciones administrativas solo con sesión | Cumple | Prueba automática: 401 en los 7 módulos |
| AC-02 | HTTPS en producción; React sin acceso a la base | Cumple (HTTPS al desplegar) | Cookie `secure`, HSTS y redirección en producción; prueba de aislamiento del frontend |
| AC-03 | Datos solo mediante funciones autorizadas | Cumple | Rutas públicas con vista reducida; teléfono fuera de la URL |
| AC-04 | Nombres, campos y mensajes comprensibles | Cumple | Etiquetas, `*` en obligatorios, mensajes que nombran el campo |
| AC-05 | Informar el resultado de cada operación | Cumple | Mensaje de éxito o de error en todas las operaciones |
| AC-06 | Computadoras y teléfonos | Cumple | 14 pantallas a 390 px sin salirse del ancho |
| AC-07 | Accesibilidad WCAG 2.2 | Cumple (revisión automática) | axe-core: 0 fallas en 14 pantallas |
| AC-08 | Sin cambios parciales ante fallos | Cumple | Transacciones; pruebas de «no cambia nada» |
| AC-09 | Lo mostrado coincide con lo guardado | Cumple | Cada escritura responde con lo releído de SQL Server |
| AC-10 | Separación React / Express / SQL Server | Cumple | 3 capas y D-017; pruebas automáticas |
| AC-11 | Organización modular | Cumple | Un módulo por área en backend y frontend |
| AC-12 | Chrome, Firefox, Edge y Safari | Cumple en Chromium; resto a mano | Prueba automática en Chromium; lista para revisar a mano |
| AC-13 | Disponible fuera del horario del salón | Cumple | Ninguna función depende de la hora; solo del servidor encendido |

## Desempeño (ERS 3.3)

### PR-01 a PR-06: tiempos y concurrencia

**Cómo se cumple:** consultas parametrizadas e indexadas (índices `IX_` en las llaves foráneas y en `Cita.Fecha` y `Venta.FechaHora`), un solo pool de conexiones a SQL Server, transacciones cortas, y React solo pinta lo que responde el API.

**Evidencia:** `backend/scripts/api-rendimiento.js` (`npm run api:rendimiento`). Simula **10 usuarios a la vez**: cada uno inicia sesión y repite 5 veces todas las operaciones medidas contra SQL Server 2022. Falla si una operación pasa su límite o responde con error. Corre en GitHub Actions en cada push. Resultado del 6 de noviembre (ejecución 42306596692):

| Operación | Límite | Veces | Mediana | p95 | Máximo | Resultado |
|---|---|---|---|---|---|---|
| PR-01 Catálogo de servicios | 3 s | 50 | 17 ms | 454 ms | 633 ms | Cumple |
| PR-01 Catálogo de productos | 3 s | 50 | 97 ms | 204 ms | 594 ms | Cumple |
| PR-01 Consulta administrativa (ventas) | 3 s | 50 | 28 ms | 181 ms | 526 ms | Cumple |
| PR-02 Inicio de sesión | 3 s | 50 | 519 ms | 925 ms | 931 ms | Cumple |
| PR-03 Actualización administrativa (servicio) | 3 s | 50 | 37 ms | 195 ms | 526 ms | Cumple |
| PR-04 Disponibilidad de citas | 4 s | 50 | 40 ms | 123 ms | 445 ms | Cumple |
| PR-05 Registro de venta con inventario | 4 s | 50 | 185 ms | 857 ms | 869 ms | Cumple |

350 operaciones en 5,4 s, **0 errores de concurrencia** (PR-06). El inicio de sesión es la operación más lenta a propósito: bcrypt con costo 10 para que adivinar contraseñas sea caro.

- Las ventas simultáneas no venden más de lo que hay: el descuento usa `Stock >= cantidad` dentro de la transacción (D-016, D-021).
- Las citas simultáneas no ocupan el mismo horario: se registran con el bloqueo `agenda` (D-016).
- Se mide el API; la pantalla de React solo agrega el pintado del resultado.

**En la demo:** abrir las herramientas del navegador (F12) → pestaña Red, recargar el catálogo y registrar una venta: el tiempo de cada petición queda muy por debajo de 3 o 4 segundos.

### PR-07: información actualizada sin recargar

**Cómo se cumple:** después de cada operación exitosa la pantalla vuelve a pedir los datos al API o usa lo que el API respondió (por ejemplo, `cargar()` en listados y `alCambiar(...)` en detalles). Ejemplos: al registrar una venta, la lista de ventas la muestra; al anularla, el detalle cambia a Anulada; al aprobar una solicitud, desaparece de pendientes; el aviso de solicitudes nuevas aparece solo (cada 20 segundos).

**En la demo:** registrar un servicio y ver que aparece en la tabla sin presionar F5.

## Atributos de calidad (ERS 3.6)

### AC-01 Seguridad: funciones administrativas solo con sesión

**Cómo se cumple:** todas las rutas `/api/admin/...` pasan por `requiereAdministradora` en el servidor (`backend/src/app/rutas.js`); no basta con ocultar botones. La sesión vive en una cookie `httpOnly` (JavaScript no la puede leer), con `sameSite=lax` y 8 horas de inactividad. Las contraseñas se guardan con bcrypt, nunca en texto.

**Evidencia:** `backend/test/api.test.js` comprueba que los 7 módulos administrativos responden `401 NO_AUTENTICADO` sin sesión; la prueba de punta a punta lo verifica contra SQL Server.

**En la demo:** cerrar sesión y abrir `/admin/ventas`: vuelve al inicio de sesión.

### AC-02 Seguridad: HTTPS en producción y React sin acceso a la base

**Cómo se cumple:**

- Con `NODE_ENV=production` (`backend/src/app/app.js`): la cookie de sesión es `secure` (solo viaja por HTTPS), las peticiones HTTP se redirigen a HTTPS, se envía `Strict-Transport-Security` y el servidor no arranca sin `SESSION_SECRET`. El certificado lo da el alojamiento.
- La demo es local (`http://localhost`), donde los navegadores no exigen HTTPS.
- React solo habla con el API por `frontend/src/shared/api/cliente.js`. La conexión a SQL Server (usuario, contraseña) existe solo en `backend/.env`, que nunca se sube.

**Evidencia:** `backend/test/capas.test.js` falla si el frontend tiene un driver de SQL Server, importa código del backend o contiene SQL.

**Pendiente al desplegar:** publicar detrás de HTTPS y con `NODE_ENV=production`.

### AC-03 Seguridad y privacidad (Ley 8968)

**Cómo se cumple:**

- Las rutas públicas solo devuelven información pública: catálogo de servicios activos, catálogo de productos sin stock ni proveedor.
- La cita del cliente se ve solo con código **y** teléfono, y la respuesta no incluye datos de contacto ni dirección.
- Si el código o el teléfono no coinciden, el mensaje no dice cuál de los dos falla.
- El teléfono viaja en el cuerpo de la petición, nunca en la URL (no queda en historiales ni registros).
- Los errores inesperados responden un mensaje genérico, sin detalles internos. En producción, `/api/salud` tampoco muestra el detalle técnico de la conexión a SQL Server.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.

**Evidencia:** prueba de punta a punta («con un teléfono que no corresponde no muestra la cita», «el catálogo público lo muestra sin stock ni proveedor») y `api.test.js` (cabeceras; la consulta de citas no existe por GET).

### AC-04 Usabilidad: nombres, campos y mensajes comprensibles

**Cómo se cumple:** todo en español; cada campo tiene su etiqueta y los obligatorios llevan `*`; ayudas de formato («8 dígitos, por ejemplo 8888-7777»); estados con tilde en pantalla. Los errores nombran el dato: «Faltan datos obligatorios: nombre, descripción.», «El teléfono ingresado ya pertenece a otro proveedor registrado.», «Cantidad insuficiente: «Shampoo» tiene 2 en stock y se pidieron 3.»

**En la demo:** registrar un proveedor sin teléfono y ver el mensaje.

### AC-05 Usabilidad: informar el resultado de cada operación

**Cómo se cumple:** cada operación muestra un mensaje de éxito (verde) o de error (rojo) con el componente `Mensaje`, y las que cambian algo importante piden confirmación antes (desactivar, anular, cancelar, eliminar, aprobar o rechazar). Si la base de datos no responde, se muestra «No se pudo conectar con la base de datos» y no una pantalla en blanco.

### AC-06 Adaptabilidad: computadoras y teléfonos

**Cómo se cumple:** diseño fluido con CSS Grid; en pantallas de hasta 760 px el panel pasa a una columna y el menú se acomoda en varias líneas; las tablas se desplazan dentro de su recuadro (`.tabla-contenedor`) sin ensanchar la página; botones de al menos 44 px de alto para tocarlos con el dedo.

**Evidencia:** revisión automática de las 14 pantallas (públicas y administrativas) a 1280 px y a 390 px (tamaño de un iPhone 14): ninguna se sale del ancho. Antes de esta revisión, 6 pantallas administrativas se salían entre 272 y 405 px; se corrigió.

**En la demo:** F12 → modo dispositivo (Ctrl+Shift+M) → iPhone, y recorrer el catálogo y el panel.

### AC-07 Accesibilidad (WCAG 2.2)

**Cómo se cumple:** HTML semántico (encabezados, `label` en cada campo, `fieldset` y `legend`, tablas con encabezados), enlace «Saltar al contenido», foco visible (`:focus-visible`), todo se usa con teclado (Tab, Enter, Espacio), avisos con `role="status"`, colores desde las variables de `tema.css`, y las tablas desplazables reciben el foco del teclado.

**Evidencia:** axe-core 4 (WCAG 2.0, 2.1 y 2.2 niveles A y AA) en las 14 pantallas: **0 fallas**. La revisión automática no cubre todo WCAG; en la demo conviene mostrar la navegación solo con teclado.

### AC-08 Confiabilidad: sin cambios parciales ante fallos

**Cómo se cumple:** las operaciones de varias tablas van en una sola transacción de SQL Server (`enTransaccion`), que se revierte completa si algo falla:

- venta + stock (MV-01);
- anulación + reposición (MV-03);
- corrección de venta + historial + stock (EXT-MV-U01);
- cliente + cita + servicios + solicitud (MCA-01, MCA-12);
- solicitud + cita (MCA-02, MCA-03, MCA-06);
- configuración de agenda (MCA-08 a MCA-11).

Además, las restricciones de la base (CHECK, llaves foráneas, únicos) rechazan datos inválidos aunque fallara el API.

**Evidencia:** pruebas de punta a punta «si no alcanza el stock responde «Cantidad insuficiente» … y no quedó ni venta parcial ni stock descontado», «y no cambia nada: ni stock, ni venta, ni historial»; `npm run db:verificar` (19 revisiones de restricciones).

### AC-09 Integridad: lo mostrado coincide con lo guardado

**Cómo se cumple:** cada operación que guarda responde con el registro **releído de SQL Server** después de confirmar (no con lo que envió el formulario), y la pantalla muestra esa respuesta. Los totales y los precios de las ventas los calcula el servidor; las fechas y horas se guardan en hora de Costa Rica (D-015).

**Evidencia:** la prueba de punta a punta compara, después de cada escritura, lo que devuelve el API con lo esperado: stock después de vender y anular, precio aplicado de la venta, duración de la cita, estado de la solicitud.

### AC-10 Mantenibilidad: separación React / Express / SQL Server

**Cómo se cumple:** tres capas (ERS 3.7.1): `frontend/` (React), `backend/` (Node.js + Express), `database/` (scripts de SQL Server). Dentro del backend, cada módulo separa `.rutas.js` (HTTP), `.logica.js` (reglas del caso de uso) y `.datos.js` (SQL). **Regla D-017: nada de SQL fuera de `.datos.js`.**

**Evidencia:** `backend/test/capas.test.js` revisa en cada `npm test` que ningún `.logica.js` ni `.rutas.js` tenga SQL ni importe la base, y que el frontend no pueda conectarse a SQL Server.

### AC-11 Mantenibilidad: organización modular

**Cómo se cumple:** un módulo por área en el backend (`backend/src/modules/`: auth, servicios, proveedores, productos, ventas, citas, clientes, agenda, solicitudes) y en el frontend (`frontend/src/features/`). Cada módulo tiene dueño (README) y contrato (`CONTRATOS_API.md`), así que un cambio en ventas no toca citas.

### AC-12 Compatibilidad: Chrome, Firefox, Edge y Safari

**Cómo se cumple:** React 19 compilado con Vite, que apunta a las versiones vigentes de los cuatro navegadores; solo HTML, CSS y JavaScript estándar, sin complementos.

**Evidencia:** las pruebas automáticas de pantallas corren en Chromium (el mismo motor de Chrome y Edge). Firefox y Safari se revisan a mano: abrir el catálogo, solicitar una cita, iniciar sesión y registrar una venta. En Safari, sirve un iPhone o una Mac.

| Navegador | Revisión |
|---|---|
| Chrome | Automática (Chromium) y a mano |
| Edge | Automática (Chromium) y a mano |
| Firefox | A mano, antes de la demo |
| Safari | A mano, antes de la demo |

### AC-13 Disponibilidad: fuera del horario del salón

**Cómo se cumple:** ninguna función depende de la hora del día. El horario de atención solo limita **qué horas se ofrecen para citas**, no cuándo se puede usar el sistema: el cliente puede solicitar una cita a medianoche y la administradora procesar solicitudes un domingo. La disponibilidad real depende de que el servidor, SQL Server y el alojamiento estén encendidos, como indica el requisito.

**Evidencia:** GitHub Actions ejecuta las pruebas a cualquier hora en que se sube un cambio, y todas las operaciones responden igual.

## Cómo volver a verificar

```powershell
npm test                    # 61 pruebas: reglas, capas (D-017), seguridad del API
npm run db:verificar        # 19 revisiones de restricciones de la base (no guarda nada)
npm run api:integracion     # 114 revisiones de punta a punta (usa una base de prueba)
npm run api:rendimiento     # PR-01 a PR-06 con 10 usuarios a la vez (usa una base de prueba)
```

`api:integracion` y `api:rendimiento` dejan datos de prueba: úsenlos en `ZairaIntegracion` o en la base de GitHub Actions, no en la base de la demo.
