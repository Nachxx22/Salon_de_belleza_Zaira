// Módulo Productos — dueño: Persona B (Ignacio). Requerimientos: MPD-01 a MPD-06.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/productos                 MPD-03 listar productos
//   GET    /api/admin/productos/inventario      MPD-04 consultar stock
//   GET    /api/admin/productos/:id             MPD-03 detalle de un producto
//   POST   /api/admin/productos                 MPD-01 registrar producto
//   PUT    /api/admin/productos/:id             MPD-05 actualizar producto
//   PATCH  /api/admin/productos/:id/stock       MPD-06 actualizar stock manualmente
//   PATCH  /api/admin/productos/:id/desactivar  MPD-02 desactivar producto (baja lógica)
//   GET    /api/publico/productos               MPD-03 catálogo informativo (Disponible / Agotado)
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   productos.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   productos.logica.js  reglas y validaciones del caso de uso del ERS
//   productos.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/productos: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/productos: sin sesión; devolver solo información pública.
export const rutasPublicas = Router();
