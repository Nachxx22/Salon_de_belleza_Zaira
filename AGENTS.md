# Instrucciones para agentes de IA

Contexto para cualquier agente (Claude u otro) que trabaje en este repositorio, por ejemplo desde una actividad asignada en Jira.

## Proyecto

- Prototipo del sistema web del Salón de Belleza Zaira. Fuente de los requisitos: la ERS final (Confluence, espacio SA) y las actividades de Jira del espacio **SCRUM**. Cada requerimiento funcional (RF) tiene un caso de uso con restricciones, flujos, criterios de aceptación y excepciones: implementen exactamente eso.
- Tecnologías fijadas por el ERS: React (Vite) en `frontend/`, Node.js + Express en `backend/`, SQL Server en `database/`. JavaScript, Node.js 26.13.0 LTS.
- Arquitectura de 3 capas (ERS 3.7.1): React nunca accede a la base de datos; todo pasa por el API.
- Idioma del código, la interfaz y los mensajes: español.

## Reglas

1. **Respeten los dueños de las carpetas** (README, "Estructura y dueños"). Persona A: Citas, Agenda, Solicitudes, Clientes y `frontend/src/shared/ui`. Persona B: Acceso, Servicios, Proveedores, Productos, Ventas, `backend/src/app`, `backend/src/shared` y `frontend/src/shared/api`. No modifiquen el módulo de la otra persona si la tarea no lo pide.
2. **Base de datos:** nunca editen migraciones existentes; agreguen una nueva en `database/migrations` con nombre `AAAAMMDD_HHMM_<inicial>_<descripcion>.sql`. Nada de borrados físicos de historial (desactivar, cancelar o anular).
3. **API:** sigan `docs/CONTRATOS_API.md` (respuesta `{ ok, data }`, errores `{ ok: false, codigo, mensaje }`). Rutas públicas en `rutasPublicas` y administrativas en `rutasAdmin` del archivo `.rutas.js` del módulo; las administrativas ya exigen sesión.
4. **Capas del módulo:** `<modulo>.rutas.js` (HTTP), `<modulo>.logica.js` (reglas del caso de uso), `<modulo>.datos.js` (SQL parametrizado con `consulta` o `enTransaccion` de `backend/src/shared/db.js`). Nunca concatenen datos del usuario en el SQL.
5. **Operaciones de varias tablas** (venta + stock, cita + solicitud) van en una sola transacción con `enTransaccion`.
6. **Interfaz:** usen los componentes de `frontend/src/shared/ui/componentes.jsx` y las variables de `tema.css`; nada de colores fijos. Formularios con etiquetas y mensajes claros (AC-04, AC-05, AC-07).
7. **Extensiones fuera del ERS** se marcan como `EXT-...` y se registran en `docs/DECISIONES.md` (por ejemplo, EXT-MV-U01 Actualizar venta). No las presenten como requisitos del ERS.
8. **Nunca suban** `.env`, contraseñas, respaldos `.bak` ni archivos de SQL Server. El repositorio es público.
9. **No cambien nada en Jira** (estados, campos, comentarios) sin permiso explícito de una persona del equipo.

## Antes de terminar una tarea

- `npm test` pasa y `npm run build` compila.
- El commit menciona la clave de Jira del requerimiento: `SCRUM-39 MS-01: registrar servicio` (claves en `docs/MATRIZ_RF_PRUEBAS.md`).
- Si cambió un contrato o una tabla, actualicen `docs/CONTRATOS_API.md` o `docs/DICCIONARIO_DATOS.md`.
- Indiquen qué criterios de aceptación del caso de uso se probaron y cuáles faltan.
