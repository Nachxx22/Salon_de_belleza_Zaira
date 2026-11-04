// Configuración del servidor a partir de variables de entorno.
// Lee backend/.env si existe (Node lo soporta sin dependencias extra).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const archivoEnv = path.join(raizBackend, '.env');
if (existsSync(archivoEnv)) {
  process.loadEnvFile(archivoEnv);
}

const env = process.env;
const enProduccion = env.NODE_ENV === 'production';

function booleano(valor, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  return ['1', 'true', 'si', 'sí', 'yes'].includes(String(valor).toLowerCase());
}

function entero(valor, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number.parseInt(valor, 10);
  return Number.isNaN(n) ? porDefecto : n;
}

export const config = {
  raizBackend,
  enProduccion,
  puerto: entero(env.PUERTO, 3000),
  sessionSecret: env.SESSION_SECRET || '',
  // Duración de la sesión administrativa: 8 horas de inactividad.
  duracionSesionMs: 8 * 60 * 60 * 1000,
  // Ruta del frontend compilado (npm run build) para servirlo desde Express en la demo.
  frontendDist: path.resolve(raizBackend, '..', 'frontend', 'dist'),
  db: {
    server: env.DB_SERVER || 'localhost',
    port: entero(env.DB_PORT, undefined),
    instanceName: env.DB_INSTANCE || undefined,
    database: env.DB_NAME || 'ZairaDev',
    user: env.DB_USER || '',
    password: env.DB_PASSWORD || '',
    encrypt: booleano(env.DB_ENCRYPT, true),
    trustServerCertificate: booleano(env.DB_TRUST_SERVER_CERTIFICATE, true),
  },
};

// Revisa lo mínimo para arrancar y devuelve una lista de problemas legibles.
export function problemasDeConfiguracion() {
  const problemas = [];
  if (!config.sessionSecret || config.sessionSecret.startsWith('cambia-esta-frase')) {
    problemas.push('SESSION_SECRET no está definido en backend/.env (usa una frase larga propia).');
  }
  if (!config.db.user) problemas.push('DB_USER no está definido en backend/.env.');
  if (!config.db.password) problemas.push('DB_PASSWORD no está definido en backend/.env.');
  return problemas;
}
