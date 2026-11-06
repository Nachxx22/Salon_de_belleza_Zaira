# Base de datos

La estructura vive en scripts versionados, no en cambios hechos a mano en SSMS.

| Carpeta | Contenido |
|---|---|
| `setup/` | `00_crear_bd_y_permisos.sql`: se ejecuta una vez por computadora en SSMS para crear la base y dar permisos al login de desarrollo |
| `migrations/` | Cambios de esquema en orden. `0001_base.sql` crea las 13 tablas de la sección 3.4 del ERS aprobadas por los dos; `0002_...` crea `RevisionVenta` (extensión EXT-MV-U01). Total: 14 tablas (`docs/DICCIONARIO_DATOS.md`) |
| `seeds/` | Datos de prueba ficticios. Se pueden ejecutar varias veces |

## Comandos (desde la raíz del repositorio)

```bash
npm run db:migrar     # crea la base si falta y aplica las migraciones pendientes
npm run db:semillas   # carga los datos de prueba
npm run db:admin      # crea o actualiza la cuenta de la administradora (valores de backend/.env)
npm run db:verificar  # comprueba tablas, restricciones, hora de Costa Rica y login; no deja datos
```

`db:migrar` lleva el registro en la tabla `SchemaMigrations`. Si un archivo ya aplicado se modificó, se detiene: el cambio debe ir en una migración nueva.

## Nueva migración

1. Crear `migrations/AAAAMMDD_HHMM_<inicial>_<descripcion>.sql`, por ejemplo `20261105_1730_B_indice_ventas.sql`.
2. Separar los lotes con `GO` (igual que en SSMS).
3. Probarla en la base propia con `npm run db:migrar`.
4. Actualizar `docs/DICCIONARIO_DATOS.md`, subirla y avisar a la otra persona.

## Base limpia para integrar o para la demostración

Con `DB_NAME=ZairaIntegracion` en `backend/.env` (después de crearla con el script de `setup/`):

```bash
npm run db:migrar && npm run db:semillas && npm run db:admin
```

Si funciona desde cero, el proyecto no depende de cambios manuales olvidados. Antes de la demostración, hagan un respaldo `.bak` fuera de la carpeta del repositorio.
