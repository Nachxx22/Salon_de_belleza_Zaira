// npm run db:migrar
// Crea la base de datos de DB_NAME si no existe y aplica, en orden, las
// migraciones de database/migrations que todavía no se hayan aplicado.
// Cada migración se aplica completa o no se aplica (transacción).
import { revisarConfiguracion, conectar, archivosSql, dividirEnLotes, mostrarErrorSql, sql, config } from './lib-sql.js';

revisarConfiguracion();
const nombreBd = config.db.database;

async function asegurarBaseDatos() {
  const master = await conectar('master');
  try {
    const { recordset } = await master.request().input('nombre', sql.NVarChar, nombreBd).query('SELECT DB_ID(@nombre) AS id');
    if (recordset[0].id !== null) return;
    try {
      await master.request().batch(`CREATE DATABASE [${nombreBd}]`);
      console.log(`Base de datos ${nombreBd} creada.`);
    } catch (error) {
      console.error(`La base ${nombreBd} no existe y el login no tiene permiso para crearla.`);
      console.error('Ejecuta una vez database/setup/00_crear_bd_y_permisos.sql en SSMS y vuelve a intentarlo.');
      throw error;
    }
  } finally {
    await master.close();
  }
}

async function aplicarMigraciones() {
  const pool = await conectar();
  try {
    await pool.request().batch(`
      IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
        CREATE TABLE dbo.SchemaMigrations (
          Nombre     NVARCHAR(255) NOT NULL CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
          Hash       CHAR(64)      NOT NULL,
          AplicadaEn DATETIME2(0)  NOT NULL CONSTRAINT DF_SchemaMigrations_AplicadaEn DEFAULT SYSDATETIME()
        );`);

    const { recordset } = await pool.request().query('SELECT Nombre, Hash FROM dbo.SchemaMigrations');
    const aplicadas = new Map(recordset.map((fila) => [fila.Nombre, fila.Hash]));

    let nuevas = 0;
    for (const migracion of archivosSql('migrations')) {
      const hashAplicado = aplicadas.get(migracion.nombre);
      if (hashAplicado) {
        if (hashAplicado !== migracion.hash) {
          console.error(`La migración ${migracion.nombre} cambió después de aplicarse.`);
          console.error('No se editan migraciones ya aplicadas: crea una migración nueva con el cambio.');
          process.exitCode = 1;
          return;
        }
        continue;
      }

      const transaccion = new sql.Transaction(pool);
      await transaccion.begin();
      try {
        for (const lote of dividirEnLotes(migracion.contenido)) {
          await new sql.Request(transaccion).batch(lote);
        }
        await new sql.Request(transaccion)
          .input('nombre', sql.NVarChar(255), migracion.nombre)
          .input('hash', sql.Char(64), migracion.hash)
          .query('INSERT INTO dbo.SchemaMigrations (Nombre, Hash) VALUES (@nombre, @hash)');
        await transaccion.commit();
        nuevas += 1;
        console.log(`Aplicada ${migracion.nombre}`);
      } catch (error) {
        await transaccion.rollback().catch(() => {});
        console.error(`Falló ${migracion.nombre}; no se aplicó ningún cambio de ese archivo.`);
        throw error;
      }
    }
    console.log(nuevas === 0 ? `La base ${nombreBd} ya estaba al día.` : `Listo: ${nuevas} migración(es) aplicada(s) en ${nombreBd}.`);
  } finally {
    await pool.close();
  }
}

try {
  await asegurarBaseDatos();
  await aplicarMigraciones();
} catch (error) {
  mostrarErrorSql(error);
  process.exitCode = 1;
}
