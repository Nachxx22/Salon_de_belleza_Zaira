// Utilidades compartidas por los scripts de base de datos.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config, problemasDeConfiguracion } from '../src/app/config.js';
import { sql, configuracionDriver } from '../src/shared/db.js';

export { sql, config };

export const carpetaDatabase = path.resolve(config.raizBackend, '..', 'database');

export function revisarConfiguracion() {
  const problemas = problemasDeConfiguracion().filter((p) => !p.startsWith('SESSION_SECRET'));
  if (problemas.length > 0) {
    console.error('Revisa backend/.env antes de continuar:');
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_]+$/.test(config.db.database)) {
    console.error(`DB_NAME "${config.db.database}" solo puede tener letras, números y guiones bajos.`);
    process.exit(1);
  }
}

export async function conectar(baseDatos = config.db.database) {
  return new sql.ConnectionPool(configuracionDriver(baseDatos)).connect();
}

// Archivos .sql de una carpeta, en orden por nombre: 0001_..., 0002_..., y luego
// las migraciones nuevas con fecha, hora e inicial (20261105_1700_B_...).
export function archivosSql(subcarpeta) {
  const carpeta = path.join(carpetaDatabase, subcarpeta);
  return readdirSync(carpeta)
    .filter((nombre) => /^\d{4,}_.+\.sql$/.test(nombre))
    .sort()
    .map((nombre) => {
      const contenido = readFileSync(path.join(carpeta, nombre), 'utf8').replace(/^\uFEFF/, '');
      // El hash ignora los saltos de línea de Windows/Linux para que no cambie entre computadoras.
      const hash = createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex');
      return { nombre, contenido, hash };
    });
}

// Separa un script en lotes usando las líneas GO (como SSMS); el driver no entiende GO.
export function dividirEnLotes(contenido) {
  return contenido
    .split(/^\s*GO\s*(?:--.*)?$/gim)
    .map((lote) => lote.trim())
    .filter((lote) => lote.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim() !== '');
}

export function mostrarErrorSql(error) {
  console.error(`  ${error.message}`);
  if (error.code === 'ELOGIN') console.error('  Revisa DB_USER y DB_PASSWORD en backend/.env.');
  if (['ESOCKET', 'ETIMEOUT', 'EINSTLOOKUP'].includes(error.code)) {
    console.error('  Revisa que SQL Server esté encendido, con TCP habilitado, y el puerto o instancia en backend/.env.');
  }
}
