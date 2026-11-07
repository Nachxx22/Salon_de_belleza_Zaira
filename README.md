# Salón de Belleza Zaira — prototipo

Prototipo del sistema web del Salón de Belleza Zaira para el curso Requerimientos de Software (TEC). Implementa la ERS final, que está documentada en Confluence y gestionada en Jira (espacio **SCRUM**).

- **Presentación:** React (Vite) — carpeta `frontend/`
- **Lógica de negocio:** Node.js + Express — carpeta `backend/`
- **Datos:** Microsoft SQL Server — carpeta `database/`


## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | **26.13.0 LTS** (archivo `.nvmrc`) |
| SQL Server | 2022 Express o Developer, con **TCP/IP habilitado** y autenticación mixta (SQL Server y Windows) |
| Login SQL | El login de desarrollo que ya usan (el de Base de Datos 1). Sus datos van solo en `backend/.env` |
| Git | Cualquier versión reciente |

En **SQL Server Configuration Manager** → Protocolos de SQLEXPRESS → TCP/IP → Habilitado. En la pestaña *Direcciones IP* → *IPAll*, dejen *Puertos dinámicos* vacío y pongan *Puerto TCP* = `1433`, y reinicien el servicio de SQL Server.

## Instalación 

```bash
git clone https://github.com/Nachxx22/Salon_de_belleza_Zaira.git
cd Salon_de_belleza_Zaira
npm install
```


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
| `npm run db:verificar` | Comprueba en SQL Server las 14 tablas, sus restricciones, la hora de Costa Rica y el login; no deja datos |
| `npm run db:preparar` | `db:migrar` + `db:semillas` |


- La identidad visual (colores, tipografía, bordes) se cambia solo en `frontend/src/shared/ui/tema.css`.
- Todas las rutas de pantallas (`frontend/src/app/rutas.jsx`) y del API (`backend/src/app/rutas.js`) ya están registradas; cada persona completa las páginas y rutas de su módulo.

## Documentación

- [Flujo de trabajo en GitHub y Jira](docs/FLUJO_DE_TRABAJO.md): rutina diaria en `main` y claves de Jira en los commits.
- [Contratos del API](docs/CONTRATOS_API.md): formato de respuestas, errores y acuerdos entre módulos.
- [Decisiones](docs/DECISIONES.md): acuerdos del equipo y diferencias con el ERS.
- [Diccionario de datos](docs/DICCIONARIO_DATOS.md): tablas, columnas y reglas.
- [Matriz de requerimientos y pruebas](docs/MATRIZ_RF_PRUEBAS.md): los 34 RF con sus claves de Jira y su estado.
- [Requisitos no funcionales](docs/REQUISITOS_NO_FUNCIONALES.md): cómo se cumplen PR-01 a PR-07 y AC-01 a AC-13, con evidencia y mediciones.
- [Diagramas](docs/DIAGRAMAS/README.md): contexto, casos de uso, entidades (3.4), arquitectura, clases, estados, colaboración y actividad (3.7), según el sistema implementado.
- Salud del sistema: en el panel, menú «Salud del sistema» (`/admin/salud`), muestra si cada endpoint de los 5 CRUD funciona o si falla por conexión, login, permisos o tablas (D-025).
- [Instrucciones para agentes de IA](AGENTS.md).

