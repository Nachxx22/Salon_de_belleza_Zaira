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
