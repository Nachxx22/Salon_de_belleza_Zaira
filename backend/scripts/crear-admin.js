// npm run db:admin
// Crea o actualiza la única cuenta de la administradora con ADMIN_USUARIO y
// ADMIN_CONTRASENA de backend/.env. La contraseña se guarda con bcrypt.
// El ERS contempla una sola cuenta administrativa (3.5.2): si ya existe una,
// se actualiza en lugar de crear otra.
import bcrypt from 'bcryptjs';
import { revisarConfiguracion, conectar, mostrarErrorSql, sql, config } from './lib-sql.js';

revisarConfiguracion();

const usuario = (process.env.ADMIN_USUARIO || '').trim();
const contrasena = process.env.ADMIN_CONTRASENA || '';
if (!usuario || contrasena.length < 8) {
  console.error('Define ADMIN_USUARIO y ADMIN_CONTRASENA (mínimo 8 caracteres) en backend/.env.');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(contrasena, 10);
  const pool = await conectar();
  try {
    const { recordset } = await pool.request().query('SELECT TOP (1) IdAdmin FROM dbo.Usuario_Admin ORDER BY IdAdmin');
    if (recordset.length === 0) {
      await pool.request()
        .input('usuario', sql.NVarChar(50), usuario)
        .input('hash', sql.NVarChar(100), hash)
        .query('INSERT INTO dbo.Usuario_Admin (Usuario, Contrasena) VALUES (@usuario, @hash)');
      console.log(`Cuenta de administradora "${usuario}" creada en ${config.db.database}.`);
    } else {
      await pool.request()
        .input('id', sql.Int, recordset[0].IdAdmin)
        .input('usuario', sql.NVarChar(50), usuario)
        .input('hash', sql.NVarChar(100), hash)
        .query('UPDATE dbo.Usuario_Admin SET Usuario = @usuario, Contrasena = @hash WHERE IdAdmin = @id');
      console.log(`Cuenta de administradora actualizada: "${usuario}" en ${config.db.database}.`);
    }
  } finally {
    await pool.close();
  }
} catch (error) {
  mostrarErrorSql(error);
  process.exitCode = 1;
}
