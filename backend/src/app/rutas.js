// Registro central de rutas de la API (dueño: Persona B).
// Todos los módulos ya están montados; normalmente nadie necesita editar este
// archivo: cada persona agrega rutas dentro del archivo .rutas.js de su módulo.
//
//   /api/salud               público: solo si el API y SQL Server están conectados
//   /api/admin/salud         administrativo: diagnóstico completo (módulo salud, D-025)
//   /api/auth                iniciar y cerrar sesión (MA-01, MA-02)
//   /api/publico/<modulo>    funciones públicas, sin sesión
//   /api/admin/<modulo>      funciones administrativas, exigen sesión (AC-01)
import { Router } from 'express';
import { config } from './config.js';
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
import * as salud from '../modules/salud/salud.rutas.js';

export const rutasApi = Router();

// Público: solo dice si hay conexión. El detalle (base, servidor, permisos, endpoints)
// está en /api/admin/salud, que exige sesión (AC-03: no mostrar datos técnicos al público).
rutasApi.get('/salud', async (req, res) => {
  let baseDatos;
  try {
    await probarConexion();
    baseDatos = { conectada: true };
  } catch (error) {
    // En desarrollo se muestra el motivo para ayudar a instalar el proyecto en cada computadora.
    baseDatos = { conectada: false, mensaje: config.enProduccion ? 'Base de datos no disponible.' : error.message };
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
admin.use('/salud', salud.rutasAdmin);
rutasApi.use('/admin', admin);
