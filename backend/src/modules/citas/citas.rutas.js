// Módulo Citas — dueño: Persona A. Requerimientos: MCA-01 a MCA-07 y MCA-12 a MCA-14.
//
// Implementadas (Integración 1):
//   GET    /api/admin/citas                    MCA-04 consultar citas (?fecha=&estado=&cliente=)
//   GET    /api/admin/citas/disponibilidad     MCA-12 horas de inicio libres (?fecha=&servicios=1,2)
//   GET    /api/admin/citas/clientes           MCA-12 buscar cliente por teléfono (?telefono=)
//   GET    /api/admin/citas/:id                MCA-04 detalle de una cita
//   POST   /api/admin/citas                    MCA-12 crear cita (administradora), queda Confirmada
//   GET    /api/admin/citas/:id/disponibilidad MCA-13 horas libres para reprogramar (?fecha=)
//   PATCH  /api/admin/citas/:id/reprogramar    MCA-13 reprogramar cita (administradora)
//   PATCH  /api/admin/citas/:id/cancelar       MCA-14 cancelar cita (administradora)
//
// Propuestas, pendientes (confirmarlas en docs/CONTRATOS_API.md antes de programarlas):
//   PATCH  /api/admin/citas/:id/completar     MCA-07 marcar cita como completada
//   GET    /api/publico/citas/disponibilidad  Horarios disponibles para el cliente (con anticipación mínima)
//   POST   /api/publico/citas                 MCA-01 crear cita (cliente), queda Pendiente
//   POST   /api/publico/citas/consulta        Buscar la cita con código y teléfono
//   POST   /api/publico/citas/reprogramacion  MCA-02 solicitar reprogramación (código y teléfono)
//   POST   /api/publico/citas/cancelacion     MCA-03 solicitar cancelación (código y teléfono)
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// citas.logica.js y el SQL en citas.datos.js (D-017).
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './citas.logica.js';

// Montado en /api/admin/citas: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/citas: sin sesión; devolver solo información pública.
export const rutasPublicas = Router();

// Las rutas fijas van antes de /:id.
rutasAdmin.get('/disponibilidad', async (req, res) => {
  responderOk(res, await logica.disponibilidadAdmin({ fecha: req.query.fecha, servicios: req.query.servicios }));
});

rutasAdmin.get('/clientes', async (req, res) => {
  responderOk(res, await logica.buscarCliente(req.query.telefono));
});

rutasAdmin.get('/', async (req, res) => {
  const { fecha, estado, cliente } = req.query;
  responderOk(res, await logica.listar({ fecha, estado, cliente }));
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.detalle(idDeRuta(req.params.id)));
});

rutasAdmin.post('/', async (req, res) => {
  const { cita, clienteNuevo } = await logica.crearCitaAdmin(req.body);
  const mensaje = `Cita ${cita.codigo} registrada como Confirmada.${clienteNuevo ? ' Se registró al cliente nuevo.' : ''}`;
  responderCreado(res, cita, mensaje);
});

rutasAdmin.get('/:id/disponibilidad', async (req, res) => {
  responderOk(res, await logica.disponibilidadReprogramar(idDeRuta(req.params.id), req.query.fecha));
});

rutasAdmin.patch('/:id/reprogramar', async (req, res) => {
  const cita = await logica.reprogramar(idDeRuta(req.params.id), req.body);
  responderOk(res, cita, { mensaje: `Cita ${cita.codigo} reprogramada para el ${cita.fecha} a las ${cita.hora}. Sigue Confirmada.` });
});

rutasAdmin.patch('/:id/cancelar', async (req, res) => {
  const cita = await logica.cancelar(idDeRuta(req.params.id), req.body);
  responderOk(res, cita, { mensaje: `Cita ${cita.codigo} cancelada. El período quedó libre.` });
});
