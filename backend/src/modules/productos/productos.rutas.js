// Módulo Productos — dueño: Persona B (Ignacio). Requerimientos: MPD-01 a MPD-06.
//
//   GET    /api/admin/productos                 MPD-03 listar productos (activos y desactivados)
//   GET    /api/admin/productos/inventario      MPD-04 consultar stock
//   GET    /api/admin/productos/:id             MPD-03 detalle de un producto
//   POST   /api/admin/productos                 MPD-01 registrar producto
//   PUT    /api/admin/productos/:id             MPD-05 actualizar producto (no cambia el stock)
//   PATCH  /api/admin/productos/:id/stock       MPD-06 actualizar stock manualmente
//   PATCH  /api/admin/productos/:id/desactivar  MPD-02 desactivar producto (baja lógica)
//   PATCH  /api/admin/productos/:id/reactivar   EXT-MPD-R01 reactivar (extensión, no está en el ERS)
//   GET    /api/publico/productos               MPD-03 catálogo informativo (Disponible / Agotado)
//
// Capas: este archivo recibe la solicitud y responde; las reglas están en
// productos.logica.js y el SQL en productos.datos.js (D-017).
import { Router } from 'express';
import { responderCreado, responderOk } from '../../shared/respuesta.js';
import { idDeRuta } from '../../shared/validacion.js';
import * as logica from './productos.logica.js';

// Montado en /api/admin/productos: ya exige sesión administrativa (app/rutas.js).
export const rutasAdmin = Router();

// Montado en /api/publico/productos: sin sesión; solo información pública.
export const rutasPublicas = Router();

rutasPublicas.get('/', async (req, res) => {
  responderOk(res, await logica.listarPublicos());
});

// Las rutas fijas van antes de /:id.
rutasAdmin.get('/inventario', async (req, res) => {
  responderOk(res, await logica.inventario());
});

rutasAdmin.get('/', async (req, res) => {
  responderOk(res, await logica.listarAdmin());
});

rutasAdmin.get('/:id', async (req, res) => {
  responderOk(res, await logica.detalle(idDeRuta(req.params.id)));
});

rutasAdmin.post('/', async (req, res) => {
  responderCreado(res, await logica.registrar(req.body), 'Producto registrado en estado Activo.');
});

rutasAdmin.put('/:id', async (req, res) => {
  responderOk(res, await logica.actualizar(idDeRuta(req.params.id), req.body), { mensaje: 'Producto actualizado. El stock no cambió.' });
});

rutasAdmin.patch('/:id/stock', async (req, res) => {
  const producto = await logica.actualizarStock(idDeRuta(req.params.id), req.body);
  responderOk(res, producto, { mensaje: `Stock actualizado: ${producto.stock} (${producto.disponibilidad}).` });
});

rutasAdmin.patch('/:id/desactivar', async (req, res) => {
  const { producto, yaEstaba } = await logica.desactivar(idDeRuta(req.params.id));
  responderOk(res, producto, { mensaje: yaEstaba ? 'El producto ya estaba desactivado.' : 'Producto desactivado.' });
});

// EXT-MPD-R01 (extensión, no está en el ERS; D-020).
rutasAdmin.patch('/:id/reactivar', async (req, res) => {
  const { producto, yaEstaba } = await logica.reactivar(idDeRuta(req.params.id));
  responderOk(res, producto, { mensaje: yaEstaba ? 'El producto ya estaba activo.' : 'Producto reactivado.' });
});
