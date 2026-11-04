// Módulo Proveedores — dueño: Persona B (Ignacio). Requerimientos: MPV-01 a MPV-04.
//
// Rutas propuestas (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   GET    /api/admin/proveedores                 MPV-02 listar proveedores
//   GET    /api/admin/proveedores/:id             MPV-02 detalle con sus productos asociados
//   POST   /api/admin/proveedores                 MPV-01 registrar proveedor
//   PUT    /api/admin/proveedores/:id             MPV-03 actualizar proveedor
//   PATCH  /api/admin/proveedores/:id/desactivar  MPV-04 desactivar proveedor (baja lógica)
//
// Organización del módulo (crear los otros dos archivos al empezar):
//   proveedores.rutas.js   recibe la solicitud HTTP y responde con responderOk / errores
//   proveedores.logica.js  reglas y validaciones del caso de uso del ERS
//   proveedores.datos.js   consultas SQL parametrizadas (usar consulta / enTransaccion de shared/db.js)
import { Router } from 'express';

// Montado en /api/admin/proveedores: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();
