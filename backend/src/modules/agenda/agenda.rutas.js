// Módulo Agenda — dueño: Persona A. Requerimientos: MCA-08 a MCA-11.
//
//   GET    /api/admin/agenda               MCA-09 consultar horarios regulares y bloqueos
//   POST   /api/admin/agenda/horarios      MCA-08 registrar horario regular
//   PUT    /api/admin/agenda/horarios/:id  MCA-10 modificar horario regular
//   DELETE /api/admin/agenda/horarios/:id  MCA-11 eliminar horario regular
//   POST   /api/admin/agenda/bloqueos      MCA-08 registrar bloqueo de agenda
//   PUT    /api/admin/agenda/bloqueos/:id  MCA-10 modificar bloqueo de agenda
//   DELETE /api/admin/agenda/bloqueos/:id  MCA-11 eliminar bloqueo de agenda
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// agenda.logica.js y el SQL en agenda.datos.js (D-017).
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './agenda.logica.js';

// Montado en /api/admin/agenda: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

rutasAdmin.get('/', async (req, res) => {
  responderOk(res, await logica.consultar());
});

rutasAdmin.post('/horarios', async (req, res) => {
  responderCreado(res, await logica.registrarHorario(req.body), 'Horario regular registrado.');
});

rutasAdmin.put('/horarios/:id', async (req, res) => {
  responderOk(res, await logica.modificarHorario(idDeRuta(req.params.id), req.body), { mensaje: 'Horario regular actualizado.' });
});

rutasAdmin.delete('/horarios/:id', async (req, res) => {
  responderOk(res, await logica.eliminarHorario(idDeRuta(req.params.id)), { mensaje: 'Horario regular eliminado.' });
});

rutasAdmin.post('/bloqueos', async (req, res) => {
  responderCreado(res, await logica.registrarBloqueo(req.body), 'Bloqueo de agenda registrado.');
});

rutasAdmin.put('/bloqueos/:id', async (req, res) => {
  responderOk(res, await logica.modificarBloqueo(idDeRuta(req.params.id), req.body), { mensaje: 'Bloqueo de agenda actualizado.' });
});

rutasAdmin.delete('/bloqueos/:id', async (req, res) => {
  responderOk(res, await logica.eliminarBloqueo(idDeRuta(req.params.id)), { mensaje: 'Bloqueo de agenda eliminado.' });
});
