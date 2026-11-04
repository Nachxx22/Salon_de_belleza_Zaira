// Rutas de acceso administrativo: /api/auth (dueño: Persona B).
//   POST /api/auth/login    MA-01
//   POST /api/auth/logout   MA-02
//   GET  /api/auth/sesion   indica si hay una sesión administrativa activa
import { Router } from 'express';
import { responderOk } from '../../shared/respuesta.js';
import { validarCredenciales } from './auth.logica.js';

export const rutasAuth = Router();

rutasAuth.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body ?? {};
  const administradora = await validarCredenciales(usuario, contrasena);

  // Se regenera la sesión para evitar fijación de sesión.
  await new Promise((resolver, rechazar) => req.session.regenerate((e) => (e ? rechazar(e) : resolver())));
  req.session.administradora = administradora;
  await new Promise((resolver, rechazar) => req.session.save((e) => (e ? rechazar(e) : resolver())));

  responderOk(res, { usuario: administradora.usuario }, { mensaje: 'Sesión iniciada.' });
});

rutasAuth.post('/logout', async (req, res) => {
  if (req.session) {
    await new Promise((resolver, rechazar) => req.session.destroy((e) => (e ? rechazar(e) : resolver())));
  }
  res.clearCookie('zaira.sid');
  responderOk(res, null, { mensaje: 'Sesión cerrada.' });
});

rutasAuth.get('/sesion', (req, res) => {
  const administradora = req.session?.administradora;
  responderOk(res, administradora ? { autenticada: true, usuario: administradora.usuario } : { autenticada: false });
});
