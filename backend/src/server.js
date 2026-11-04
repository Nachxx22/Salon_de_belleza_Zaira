// Punto de entrada del API: `npm run dev` (con recarga) o `npm start`.
import { config, problemasDeConfiguracion } from './app/config.js';
import { crearApp } from './app/app.js';
import { cerrarPool } from './shared/db.js';

const problemas = problemasDeConfiguracion();
if (problemas.length > 0) {
  console.error('No se puede iniciar el API. Revisa backend/.env:');
  for (const problema of problemas) console.error(`  - ${problema}`);
  console.error('Guía: copia backend/.env.example como backend/.env y completa los valores.');
  process.exit(1);
}

const versionMayor = Number(process.versions.node.split('.')[0]);
if (versionMayor < 26) {
  console.warn(`Aviso: el proyecto usa Node.js 26 LTS y estás usando ${process.version}.`);
}

const servidor = crearApp().listen(config.puerto, () => {
  console.log(`API del Salón de Belleza Zaira en http://localhost:${config.puerto}/api`);
  console.log(`Base de datos: ${config.db.database} en ${config.db.server}${config.db.port ? `:${config.db.port}` : ''}`);
});

async function apagar() {
  servidor.close();
  await cerrarPool();
  process.exit(0);
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
