// Módulo Proveedores — dueño: Persona B (Ignacio). Requerimientos: MPV-01 a MPV-04.
//
//   GET    /api/admin/proveedores                 MPV-02 listar (?buscar=nombre, teléfono o correo)
//   GET    /api/admin/proveedores/:id             MPV-02 detalle con sus productos asociados
//   POST   /api/admin/proveedores                 MPV-01 registrar proveedor
//   PUT    /api/admin/proveedores/:id             MPV-03 actualizar proveedor
//   PATCH  /api/admin/proveedores/:id/desactivar  MPV-04 desactivar proveedor (baja lógica)
//   PATCH  /api/admin/proveedores/:id/reactivar   EXT-MPV-R01 reactivar (extensión, no está en el ERS)
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// proveedores.logica.js y el SQL en proveedores.datos.js (D-017).
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './proveedores.logica.js';

// Montado en /api/admin/proveedores: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

rutasAdmin.get('/', async (req, res) => {
  responderOk(res, await logica.listar({ buscar: req.query.buscar }));
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.detalle(idDeRuta(req.params.id)));
});

rutasAdmin.post('/', async (req, res) => {
  responderCreado(res, await logica.registrar(req.body), 'Proveedor registrado en estado Activo.');
});

rutasAdmin.put('/:id', async (req, res) => {
  responderOk(res, await logica.actualizar(idDeRuta(req.params.id), req.body), { mensaje: 'Proveedor actualizado.' });
});

rutasAdmin.patch('/:id/desactivar', async (req, res) => {
  const { proveedor, yaEstaba } = await logica.desactivar(idDeRuta(req.params.id));
  responderOk(res, proveedor, { mensaje: yaEstaba ? 'El proveedor ya está desactivado.' : 'Proveedor desactivado.' });
});

// EXT-MPV-R01 (extensión, no está en el ERS; D-020).
rutasAdmin.patch('/:id/reactivar', async (req, res) => {
  const { proveedor, yaEstaba } = await logica.reactivar(idDeRuta(req.params.id));
  responderOk(res, proveedor, { mensaje: yaEstaba ? 'El proveedor ya estaba activo.' : 'Proveedor reactivado.' });
});
