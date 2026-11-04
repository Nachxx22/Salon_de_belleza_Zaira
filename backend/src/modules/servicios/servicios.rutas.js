// Módulo Servicios — dueño: Persona B (Ignacio). Requerimientos: MS-01 a MS-05.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/servicios                 MS-05 listar servicios activos e inactivos
//   GET    /api/admin/servicios/:id             MS-05 detalle de un servicio
//   POST   /api/admin/servicios                 MS-01 registrar servicio
//   PUT    /api/admin/servicios/:id             MS-03 actualizar servicio
//   PATCH  /api/admin/servicios/:id/desactivar  MS-04 desactivar servicio (baja lógica)
//   GET    /api/publico/servicios               MS-02 catálogo público de servicios activos
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   servicios.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   servicios.logica.js  reglas y validaciones del caso de uso del ERS
//   servicios.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/servicios: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/servicios: sin sesión; devolver solo información pública.
export const rutasPublicas = Router();
