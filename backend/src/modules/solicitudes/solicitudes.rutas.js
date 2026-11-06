// Módulo Solicitudes de cita — dueño: Persona A. Requerimientos: MCA-05 y MCA-06.
//
//   GET    /api/admin/solicitudes               MCA-05 consultar solicitudes pendientes
//   GET    /api/admin/solicitudes/resumen       MCA-05 aviso interno: cuántas hay pendientes
//   GET    /api/admin/solicitudes/:id           MCA-05 detalle de una solicitud
//   PATCH  /api/admin/solicitudes/:id/aprobar   MCA-06 aprobar solicitud (transacción)
//   PATCH  /api/admin/solicitudes/:id/rechazar  MCA-06 rechazar solicitud (transacción)
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// solicitudes.logica.js y el SQL en solicitudes.datos.js (D-017).
import { Router } from 'express';
import { responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './solicitudes.logica.js';

// Montado en /api/admin/solicitudes: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

rutasAdmin.get('/', async (req, res) => {
  responderOk(res, await logica.listarPendientes());
});

rutasAdmin.get('/resumen', async (req, res) => {
  responderOk(res, await logica.resumen());
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.detalle(idDeRuta(req.params.id)));
});

rutasAdmin.patch('/:id/aprobar', async (req, res) => {
  const { solicitud, mensaje } = await logica.procesar(idDeRuta(req.params.id), true);
  responderOk(res, solicitud, { mensaje });
});

rutasAdmin.patch('/:id/rechazar', async (req, res) => {
  const { solicitud, mensaje } = await logica.procesar(idDeRuta(req.params.id), false);
  responderOk(res, solicitud, { mensaje });
});
