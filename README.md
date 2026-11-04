# Salón de Belleza Zaira — prototipo

Prototipo del sistema web del Salón de Belleza Zaira para el curso Requerimientos de Software (TEC). Implementa la ERS final, que está documentada en Confluence y gestionada en Jira (espacio **SCRUM**).

- **Presentación:** React (Vite) — carpeta `frontend/`
- **Lógica de negocio:** Node.js + Express — carpeta `backend/`
- **Datos:** Microsoft SQL Server — carpeta `database/`

Demostración: jueves 12 de noviembre de 2026, 7:30 a. m., ejecutando todo localmente en la computadora de la Persona A.

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | **26.13.0 LTS** (archivo `.nvmrc`) |
| SQL Server | 2022 Express o Developer, con **TCP/IP habilitado** y autenticación mixta (SQL Server y Windows) |
| Login SQL | El login de desarrollo que ya usan (el de Base de Datos 1). Sus datos van solo en `backend/.env` |
| Git | Cualquier versión reciente |

En **SQL Server Configuration Manager** → Protocolos de SQLEXPRESS → TCP/IP → Habilitado. En la pestaña *Direcciones IP* → *IPAll*, dejen *Puertos dinámicos* vacío y pongan *Puerto TCP* = `1433`, y reinicien el servicio de SQL Server.

## Instalación (una vez por computadora)

```bash
git clone https://github.com/Nachxx22/Salon_de_belleza_Zaira.git
cd Salon_de_belleza_Zaira
npm install
```

1. Copien `backend/.env.example` como `backend/.env` y completen:
   - `SESSION_SECRET`: una frase larga cualquiera.
   - `DB_NAME`: `ZairaDev_A` (Persona A) o `ZairaDev_B` (Persona B).
   - `DB_USER` y `DB_PASSWORD`: el login SQL de desarrollo.
   - `ADMIN_USUARIO` y `ADMIN_CONTRASENA`: la cuenta de prueba de la administradora (mínimo 8 caracteres).
2. En SSMS, conectados con autenticación de Windows, abran `database/setup/00_crear_bd_y_permisos.sql`, cambien los dos valores del inicio y ejecútenlo. No hagan commit de ese cambio.
3. Preparen la base de datos:
   ```bash
   npm run db:migrar     # crea las tablas (0001, 0002, ...)
   npm run db:semillas   # datos de prueba ficticios
   npm run db:admin      # crea la cuenta de la administradora desde backend/.env
   ```
4. Arranquen todo:
   ```bash
   npm run dev
   ```
   - Página web: http://localhost:5173
   - Verificación de la instalación: http://localhost:5173/estado (debe decir que React llega al API y el API a SQL Server)
   - Panel administrativo: http://localhost:5173/admin

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API (puerto 3000, se recarga solo) y web (puerto 5173) al mismo tiempo |
| `npm test` | Pruebas automáticas del backend |
| `npm run build` | Compila el frontend para la demostración |
| `npm start` | Arranca solo el API; si existe `frontend/dist`, también sirve la web en http://localhost:3000 |
| `npm run db:migrar` | Aplica las migraciones pendientes de `database/migrations` |
| `npm run db:semillas` | Carga los datos de prueba de `database/seeds` (se puede repetir) |
| `npm run db:admin` | Crea o actualiza la cuenta de la administradora |
| `npm run db:preparar` | `db:migrar` + `db:semillas` |

**Para la demostración** (computadora de la Persona A): `npm run build` y luego `npm start`. Todo queda en http://localhost:3000.

## Estructura y dueños

Cada persona trabaja en sus carpetas para no pisarse (plan de desarrollo, sección 4.1).

```text
frontend/src/
  app/              rutas y páginas generales                  compartido (cambios avisados)
  shared/ui/        tema.css, estilos y componentes             Persona A
  shared/api/       cliente HTTP (cliente.js)                   Persona B
  features/auth, servicios, proveedores, productos, ventas      Persona B
  features/citas, agenda, solicitudes                           Persona A
backend/src/
  app/              configuración, Express y registro de rutas  Persona B
  shared/           conexión SQL, errores, sesión, validación   Persona B
  modules/auth, servicios, proveedores, productos, ventas       Persona B
  modules/citas, agenda, solicitudes, clientes                  Persona A
database/
  migrations/       cambios de esquema (nunca se editan los ya subidos)
  seeds/            datos de prueba ficticios
  setup/            script de una sola vez para crear la base y los permisos
docs/               contratos, decisiones, diccionario de datos y matriz de pruebas
```

- La identidad visual (colores, tipografía, bordes) se cambia solo en `frontend/src/shared/ui/tema.css`.
- Todas las rutas de pantallas (`frontend/src/app/rutas.jsx`) y del API (`backend/src/app/rutas.js`) ya están registradas; cada persona completa las páginas y rutas de su módulo.

## Documentación

- [Flujo de trabajo en GitHub y Jira](docs/FLUJO_DE_TRABAJO.md): rutina diaria en `main` y claves de Jira en los commits.
- [Contratos del API](docs/CONTRATOS_API.md): formato de respuestas, errores y acuerdos entre módulos.
- [Decisiones](docs/DECISIONES.md): acuerdos del equipo y diferencias con el ERS.
- [Diccionario de datos](docs/DICCIONARIO_DATOS.md): tablas, columnas y reglas.
- [Matriz de requerimientos y pruebas](docs/MATRIZ_RF_PRUEBAS.md): los 34 RF con sus claves de Jira y su estado.
- [Instrucciones para agentes de IA](AGENTS.md).

## Seguridad

- Nunca suban `backend/.env`, contraseñas, respaldos `.bak` ni archivos `.mdf`/`.ldf` (ya están en `.gitignore`).
- Este repositorio es **público**: todo lo que se sube lo puede ver cualquier persona.
