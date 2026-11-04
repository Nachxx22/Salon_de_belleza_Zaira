// Construcción de la aplicación Express (dueño: Persona B).
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { rutasApi } from './rutas.js';
import { manejarErrores, rutaNoEncontrada } from '../shared/errores.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
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
        secure: false, // la demo es local por HTTP; en un despliegue real debe ir sobre HTTPS (AC-02)
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
