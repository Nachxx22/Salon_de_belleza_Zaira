// Módulo Agenda — dueño: Persona A. Requerimientos: MCA-08 a MCA-11.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/agenda               MCA-09 consultar horarios regulares y bloqueos
//   POST   /api/admin/agenda/horarios      MCA-08 registrar horario regular
//   PUT    /api/admin/agenda/horarios/:id  MCA-10 modificar horario regular
//   DELETE /api/admin/agenda/horarios/:id  MCA-11 eliminar horario regular
//   POST   /api/admin/agenda/bloqueos      MCA-08 registrar bloqueo de agenda
//   PUT    /api/admin/agenda/bloqueos/:id  MCA-10 modificar bloqueo de agenda
//   DELETE /api/admin/agenda/bloqueos/:id  MCA-11 eliminar bloqueo de agenda
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   agenda.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   agenda.logica.js  reglas y validaciones del caso de uso del ERS
//   agenda.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/agenda: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();
