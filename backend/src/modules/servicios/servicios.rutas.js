// Módulo Servicios — dueño: Persona B (Ignacio). Requerimientos: MS-01 a MS-05.
//
//   GET    /api/admin/servicios                 MS-05 listar servicios activos e inactivos
//   GET    /api/admin/servicios/:id             MS-05 detalle de un servicio
//   POST   /api/admin/servicios                 MS-01 registrar servicio
//   PUT    /api/admin/servicios/:id             MS-03 actualizar servicio
//   PATCH  /api/admin/servicios/:id/desactivar  MS-04 desactivar servicio (baja lógica)
//   PATCH  /api/admin/servicios/:id/reactivar   EXT-MS-R01 reactivar servicio (extensión, no está en el ERS)
//   GET    /api/publico/servicios               MS-02 catálogo público de servicios activos
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// servicios.logica.js y el SQL en servicios.datos.js.
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './servicios.logica.js';

// Montado en /api/admin/servicios: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/servicios: sin sesión; devolver solo información pública.
export const rutasPublicas = Router();

rutasPublicas.get('/', async (req, res) => {
  responderOk(res, await logica.listarPublicos());
});

rutasAdmin.get('/', async (req, res) => {
  responderOk(res, await logica.listarAdmin());
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.obtenerAdmin(idDeRuta(req.params.id)));
});

rutasAdmin.post('/', async (req, res) => {
  const servicio = await logica.registrar(req.body);
  responderCreado(res, servicio, 'Servicio registrado en estado Activo.');
});

rutasAdmin.put('/:id', async (req, res) => {
  const servicio = await logica.actualizar(idDeRuta(req.params.id), req.body);
  responderOk(res, servicio, { mensaje: 'Servicio actualizado.' });
});

rutasAdmin.patch('/:id/desactivar', async (req, res) => {
  const { servicio, yaEstaba } = await logica.desactivar(idDeRuta(req.params.id));
  const mensaje = yaEstaba ? 'El servicio ya estaba desactivado.' : 'Servicio desactivado.';
  responderOk(res, servicio, { mensaje });
});

// EXT-MS-R01 (extensión, no está en el ERS; D-018).
rutasAdmin.patch('/:id/reactivar', async (req, res) => {
  const { servicio, yaEstaba } = await logica.reactivar(idDeRuta(req.params.id));
  const mensaje = yaEstaba ? 'El servicio ya estaba activo.' : 'Servicio reactivado.';
  responderOk(res, servicio, { mensaje });
});
