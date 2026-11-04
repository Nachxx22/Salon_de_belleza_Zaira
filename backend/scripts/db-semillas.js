// npm run db:semillas
// Carga los datos de prueba de database/seeds. Los archivos deben poder
// ejecutarse varias veces sin duplicar datos (usar IF NOT EXISTS).
import { revisarConfiguracion, conectar, archivosSql, dividirEnLotes, mostrarErrorSql, sql, config } from './lib-sql.js';

revisarConfiguracion();

try {
  const pool = await conectar();
  try {
    for (const semilla of archivosSql('seeds')) {
      const transaccion = new sql.Transaction(pool);
      await transaccion.begin();
      try {
        for (const lote of dividirEnLotes(semilla.contenido)) {
          await new sql.Request(transaccion).batch(lote);
        }
        await transaccion.commit();
        console.log(`Cargada ${semilla.nombre}`);
      } catch (error) {
        await transaccion.rollback().catch(() => {});
        console.error(`Falló ${semilla.nombre}; no se guardó nada de ese archivo.`);
        throw error;
      }
    }
    console.log(`Datos de prueba listos en ${config.db.database}.`);
  } finally {
    await pool.close();
  }
} catch (error) {
  mostrarErrorSql(error);
  process.exitCode = 1;
}
