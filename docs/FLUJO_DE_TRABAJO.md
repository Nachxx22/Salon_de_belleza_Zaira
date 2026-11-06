# Flujo de trabajo en GitHub y Jira

Trabajamos los dos directamente en la rama `main` (decisión D-001). Funciona porque cada persona edita carpetas distintas y sube cambios pequeños y probados.

## Rutina para cada cambio

1. **Antes de empezar**, traer lo último:
   ```bash
   git pull --rebase origin main
   npm install          # solo si cambió algún package.json
   npm run db:migrar    # solo si llegaron migraciones nuevas
   ```
2. **Programar** solo en las carpetas de tu módulo (tabla de dueños en el README).
3. **Probar**: `npm test` y revisar la pantalla en el navegador.
4. **Guardar el cambio** con un commit pequeño:
   ```bash
   git status                     # revisar qué se va a subir (nunca .env)
   git add backend/src/modules/servicios frontend/src/features/servicios
   git commit -m "SCRUM-39 MS-01: registrar servicio"
   ```
5. **Antes de subir**, traer lo que subió la otra persona y volver a probar:
   ```bash
   git pull --rebase origin main
   npm test
   git push origin main
   ```

Si `git push` responde que hay cambios nuevos en el remoto, es normal: repitan el paso 5.

## Reglas

- Nunca `git push --force` sobre `main`.
- Nunca suban algo que no arranca: si una pantalla está a medias, dejen la ruta con la página provisional.
- Los archivos compartidos (`package.json`, `backend/src/app/*`, `backend/src/shared/*`, `frontend/src/app/*`, `frontend/src/shared/*`) los cambia su dueño. Si necesitan un cambio ahí, avisen antes.
- Si `git pull --rebase` muestra un conflicto en un archivo compartido, resuélvanlo juntos en llamada. Nunca elijan "aceptar todo lo mío" sin revisar.
- Las decisiones que afecten a los dos se anotan en `docs/DECISIONES.md`; los chats de IA no son la fuente del proyecto.

## Base de datos

- Cada quien tiene su base local (`ZairaDev_A` o `ZairaDev_B`); se sincronizan con los scripts de `database/`, no compartiendo la base.
- Un cambio de tablas es **una migración nueva** en `database/migrations` con fecha, hora e inicial, por ejemplo `20261105_1730_B_indice_ventas.sql`.
- Nunca editen una migración que ya está en GitHub: `npm run db:migrar` detecta el cambio y se detiene.
- Avisen cuando suban una migración; la otra persona corre `npm run db:migrar` después del `git pull`.
- Para integrar, se crea una base limpia (`ZairaIntegracion`) y se ejecutan `npm run db:migrar`, `npm run db:semillas` y `npm run db:admin` con `DB_NAME=ZairaIntegracion` en el `.env`.

## Commits enlazados con Jira

Jira está conectado con este repositorio. Si el mensaje del commit incluye la clave de una actividad, el commit aparece en esa actividad de Jira (panel Desarrollo):

```text
SCRUM-39 MS-01: registrar servicio
SCRUM-31 SCRUM-32 MPV: registrar y consultar proveedores
```

- Usen la clave del **requerimiento funcional** (columna *Jira RF* de `docs/MATRIZ_RF_PRUEBAS.md`).
- Para tareas técnicas que no son de un requerimiento (configuración, documentación), escriban el mensaje sin clave.
- Mover actividades en el tablero de Jira (To Do → In Progress → In Review → Done) se hace en Jira; el commit solo las enlaza.

## Integración 1: acceso + servicios + citas

Se hace cuando Citas tenga crear cita (MCA-12 o MCA-01) en `main`. Con una base limpia `ZairaIntegracion` (ver arriba), en una sola computadora:

1. **Acceso (MA-01, MA-02):** iniciar sesión en `/admin/login`, entrar al panel y cerrar sesión. Sin sesión, `/admin/...` vuelve al login.
2. **Servicios (MS-01 a MS-05):** registrar un servicio nuevo de 30 minutos que permita domicilio; aparece en `/servicios`.
3. **Cita con un servicio real:** crear una cita que use ese servicio. Citas lo lee de `GET /api/publico/servicios` (solo activos) con `id`, `nombre`, `duracionMinutos` y `permiteDomicilio` (`CONTRATOS_API.md`). La hora de fin de la cita es la hora de inicio + 30 minutos.
4. **La duración queda fija en la cita (MS-03, criterio 3):** cambiar la duración del servicio a 60 minutos. La cita del paso 3 sigue durando 30 (`CitaServicio.DuracionAplicadaMinutos`); una cita nueva ya usa 60.
5. **Servicio desactivado (MS-04, criterio 3):** desactivar el servicio. Ya no se puede elegir para una cita nueva, y la cita del paso 3 sigue mostrándolo.
6. **Reactivar (EXT-MS-R01, extensión):** reactivarlo; vuelve a poder elegirse.
7. Anotar el resultado en `MATRIZ_RF_PRUEBAS.md` y corregir en el momento lo que no calce con el contrato.
