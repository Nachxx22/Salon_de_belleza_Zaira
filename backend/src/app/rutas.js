// Registro central de rutas de la API (dueño: Persona B).
// Todos los módulos ya están montados; normalmente nadie necesita editar este
// archivo: cada persona agrega rutas dentro del archivo .rutas.js de su módulo.
//
//   /api/salud               estado del API y de la conexión con SQL Server
//   /api/auth                iniciar y cerrar sesión (MA-01, MA-02)
//   /api/publico/<modulo>    funciones públicas, sin sesión
//   /api/admin/<modulo>      funciones administrativas, exigen sesión (AC-01)
import { Router } from 'express';
import { requiereAdministradora } from '../shared/auth.js';
import { responderOk } from '../shared/respuesta.js';
import { probarConexion } from '../shared/db.js';
import { rutasAuth } from '../modules/auth/auth.rutas.js';
import * as servicios from '../modules/servicios/servicios.rutas.js';
import * as proveedores from '../modules/proveedores/proveedores.rutas.js';
import * as productos from '../modules/productos/productos.rutas.js';
import * as ventas from '../modules/ventas/ventas.rutas.js';
import * as citas from '../modules/citas/citas.rutas.js';
import * as agenda from '../modules/agenda/agenda.rutas.js';
import * as solicitudes from '../modules/solicitudes/solicitudes.rutas.js';

export const rutasApi = Router();

rutasApi.get('/salud', async (req, res) => {
  let baseDatos;
  try {
    const info = await probarConexion();
    baseDatos = { conectada: true, nombre: info.baseDatos };
  } catch (error) {
    baseDatos = { conectada: false, mensaje: error.message };
  }
  responderOk(res, { api: 'activa', baseDatos });
});

rutasApi.use('/auth', rutasAuth);

// Rutas públicas (Persona B: servicios y productos; Persona A: citas).
const publico = Router();
publico.use('/servicios', servicios.rutasPublicas);
publico.use('/productos', productos.rutasPublicas);
publico.use('/citas', citas.rutasPublicas);
rutasApi.use('/publico', publico);

// Rutas administrativas: la sesión se exige aquí una sola vez para todas.
const admin = Router();
admin.use(requiereAdministradora);
admin.use('/servicios', servicios.rutasAdmin);
admin.use('/proveedores', proveedores.rutasAdmin);
admin.use('/productos', productos.rutasAdmin);
admin.use('/ventas', ventas.rutasAdmin);
admin.use('/citas', citas.rutasAdmin);
admin.use('/agenda', agenda.rutasAdmin);
admin.use('/solicitudes', solicitudes.rutasAdmin);
rutasApi.use('/admin', admin);
