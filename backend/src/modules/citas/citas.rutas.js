// Módulo Citas — dueño: Persona A. Requerimientos: MCA-01 a MCA-07 y MCA-12 a MCA-14.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/citas                   MCA-04 consultar citas
//   GET    /api/admin/citas/:id               MCA-04 detalle de una cita
//   POST   /api/admin/citas                   MCA-12 crear cita (administradora), queda Confirmada
//   PATCH  /api/admin/citas/:id/reprogramar   MCA-13 reprogramar cita (administradora)
//   PATCH  /api/admin/citas/:id/cancelar      MCA-14 cancelar cita (administradora)
//   PATCH  /api/admin/citas/:id/completar     MCA-07 marcar cita como completada
//   GET    /api/publico/citas/disponibilidad  Horarios disponibles (un solo algoritmo, en el servidor)
//   POST   /api/publico/citas                 MCA-01 crear cita (cliente), queda Pendiente
//   POST   /api/publico/citas/consulta        Buscar la cita con código y teléfono
//   POST   /api/publico/citas/reprogramacion  MCA-02 solicitar reprogramación (código y teléfono)
//   POST   /api/publico/citas/cancelacion     MCA-03 solicitar cancelación (código y teléfono)
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   citas.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   citas.logica.js  reglas y validaciones del caso de uso del ERS
//   citas.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/citas: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/citas: sin sesión; devolver solo información pública.
export const rutasPublicas = Router();
