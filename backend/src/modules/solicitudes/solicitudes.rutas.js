// Módulo Solicitudes de cita — dueño: Persona A. Requerimientos: MCA-05 y MCA-06.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/solicitudes               MCA-05 consultar solicitudes pendientes
//   GET    /api/admin/solicitudes/:id           MCA-05 detalle de una solicitud
//   PATCH  /api/admin/solicitudes/:id/aprobar   MCA-06 aprobar solicitud (transacción)
//   PATCH  /api/admin/solicitudes/:id/rechazar  MCA-06 rechazar solicitud (transacción)
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   solicitudes.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   solicitudes.logica.js  reglas y validaciones del caso de uso del ERS
//   solicitudes.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/solicitudes: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();
