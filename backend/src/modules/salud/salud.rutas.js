// Módulo Salud del sistema — dueño: Persona B (Ignacio). EXT-SAL-01 (herramienta
// interna del equipo, no es un requerimiento del ERS; D-025).
//
//   GET   /api/admin/salud                    revisión completa: API, SQL Server, migraciones,
//                                             tablas, permisos y cada endpoint de los CRUD
//   POST  /api/admin/salud/escritura/:modulo  prueba INSERT/UPDATE/DELETE reales de un CRUD
//                                             dentro de una transacción que siempre se revierte
//
// Solo para la administradora: se monta en el router /api/admin (exige sesión, AC-01).
// La ruta pública /api/salud sigue respondiendo solo si el API y la base están conectados.
import { Router } from 'express';
import { responderOk } from '../../shared/respuesta.js';
import * as logica from './salud.logica.js';

export const rutasAdmin = Router();

rutasAdmin.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  responderOk(res, await logica.diagnosticar());
});

rutasAdmin.post('/escritura/:modulo', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  responderOk(res, await logica.probarEscritura(req.params.modulo), { mensaje: 'Prueba terminada: los cambios se revirtieron.' });
});
