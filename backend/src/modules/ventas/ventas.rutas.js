// Módulo Ventas — dueño: Persona B (Ignacio). Requerimientos: MV-01 a MV-03 y la extensión EXT-MV-U01.
//
//   GET    /api/admin/ventas             MV-02 listar (?codigo=&desde=&hasta=&cliente=&metodoPago=&estado=)
//   GET    /api/admin/ventas/:id         MV-02 detalle de una venta
//   POST   /api/admin/ventas             MV-01 registrar venta (transacción con el stock)
//   PATCH  /api/admin/ventas/:id/anular  MV-03 anular venta y reintegrar el stock
//
// Pendiente (paso 9):
//   PUT    /api/admin/ventas/:id         EXT-MV-U01 actualizar venta (extensión, no está en el ERS)
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// ventas.logica.js y el SQL en ventas.datos.js (D-017).
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './ventas.logica.js';

// Montado en /api/admin/ventas: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

rutasAdmin.get('/', async (req, res) => {
  const { codigo, desde, hasta, cliente, metodoPago, estado } = req.query;
  responderOk(res, await logica.listar({ codigo, desde, hasta, cliente, metodoPago, estado }));
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.detalle(idDeRuta(req.params.id)));
});

rutasAdmin.post('/', async (req, res) => {
  const venta = await logica.registrar(req.body);
  responderCreado(res, venta, `Venta ${venta.codigo} registrada.`);
});

rutasAdmin.patch('/:id/anular', async (req, res) => {
  const venta = await logica.anular(idDeRuta(req.params.id), req.body);
  responderOk(res, venta, { mensaje: `Venta ${venta.codigo} anulada. El stock de sus productos se repuso.` });
});
