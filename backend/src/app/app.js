// Construcción de la aplicación Express (dueño: Persona B).
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { rutasApi } from './rutas.js';
import { manejarErrores, rutaNoEncontrada } from '../shared/errores.js';

// Cabeceras de seguridad básicas (AC-02, AC-03). En producción, además, se exige
// HTTPS: el navegador recuerda usarlo (HSTS) y las peticiones HTTP se redirigen.
function seguridad(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "frame-ancestors 'none'",
  });
  if (config.enProduccion) {
    if (!req.secure) return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    res.set('Strict-Transport-Security', 'max-age=31536000');
  }
  return next();
}

export function crearApp() {
  // En producción no se acepta la clave de sesión de prueba (AC-01, AC-02).
  if (config.enProduccion && !config.sessionSecret) {
    throw new Error('Falta SESSION_SECRET: es obligatoria en producción.');
  }
  const app = express();
  app.disable('x-powered-by');
  // En producción el HTTPS lo atiende el proxy del alojamiento; Express confía en él
  // para saber si la petición original llegó por HTTPS.
  if (config.enProduccion) app.set('trust proxy', 1);
  app.use(seguridad);
  app.use(express.json({ limit: '100kb' }));

  // Sesión administrativa en una cookie httpOnly (MA-01, MA-02, AC-01).
  // Las sesiones viven en memoria: al reiniciar el servidor hay que iniciar sesión de nuevo.
  app.use(
    session({
      name: 'zaira.sid',
      secret: config.sessionSecret || 'solo-para-pruebas-locales',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        // Solo viaja por HTTPS en producción (AC-02); la demo local usa HTTP.
        secure: config.enProduccion,
        maxAge: config.duracionSesionMs,
      },
    }),
  );

  app.use('/api', rutasApi);
  app.use('/api', rutaNoEncontrada);

  // En la demostración, Express también sirve el frontend compilado (npm run build).
  const indexHtml = path.join(config.frontendDist, 'index.html');
  if (existsSync(indexHtml)) {
    app.use(express.static(config.frontendDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(indexHtml);
    });
  }

  app.use(manejarErrores);
  return app;
}
