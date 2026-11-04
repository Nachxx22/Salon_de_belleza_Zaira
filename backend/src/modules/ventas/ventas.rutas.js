// Módulo Ventas — dueño: Persona B (Ignacio). Requerimientos: MV-01 a MV-03 y la extensión EXT-MV-U01.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/ventas             MV-02 listar ventas con filtros
//   GET    /api/admin/ventas/:id         MV-02 detalle de una venta
//   POST   /api/admin/ventas             MV-01 registrar venta (transacción con el stock)
//   PUT    /api/admin/ventas/:id         EXT-MV-U01 actualizar venta (extensión, no está en el ERS)
//   PATCH  /api/admin/ventas/:id/anular  MV-03 anular venta y reintegrar el stock
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   ventas.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   ventas.logica.js  reglas y validaciones del caso de uso del ERS
//   ventas.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/ventas: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();
