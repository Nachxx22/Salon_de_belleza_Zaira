// Conexión central a SQL Server (dueño: Persona B).
// Todos los módulos usan `consulta` o `enTransaccion`; nadie crea conexiones propias.
import sql from 'mssql';
import { config } from '../app/config.js';

export { sql };

// Arma la configuración del driver. El puerto y el nombre de instancia no se
// pueden usar juntos: si hay puerto se usa el puerto (recomendado).
export function configuracionDriver(baseDatos = config.db.database) {
  const opciones = {
    encrypt: config.db.encrypt,
    trustServerCertificate: config.db.trustServerCertificate,
  };
  const conexion = {
    server: config.db.server,
    database: baseDatos,
    user: config.db.user,
    password: config.db.password,
    options: opciones,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
  if (config.db.port) conexion.port = config.db.port;
  else if (config.db.instanceName) opciones.instanceName = config.db.instanceName;
  return conexion;
}

let poolPromesa = null;

export function obtenerPool() {
  if (!poolPromesa) {
    const pool = new sql.ConnectionPool(configuracionDriver());
    poolPromesa = pool.connect().catch((error) => {
      poolPromesa = null; // permite reintentar en la siguiente solicitud
      throw error;
    });
  }
  return poolPromesa;
}

export async function cerrarPool() {
  if (poolPromesa) {
    const pool = await poolPromesa.catch(() => null);
    poolPromesa = null;
    if (pool) await pool.close();
  }
}

// Agrega parámetros a una solicitud. Cada valor puede ser:
//   - un valor simple: { nombre: 'Corte' }  (el driver deduce el tipo)
//   - un par [tipo, valor]: { precio: [sql.Decimal(10, 2), 5000] }
function agregarParametros(solicitud, parametros) {
  for (const [nombre, valor] of Object.entries(parametros)) {
    if (Array.isArray(valor)) solicitud.input(nombre, valor[0], valor[1]);
    else solicitud.input(nombre, valor);
  }
  return solicitud;
}

// Ejecuta una consulta parametrizada y devuelve { filas, filasAfectadas }.
// Nunca concatenes datos del usuario en el texto SQL: usa @parametros.
export async function consulta(textoSql, parametros = {}) {
  const pool = await obtenerPool();
  const resultado = await agregarParametros(pool.request(), parametros).query(textoSql);
  return { filas: resultado.recordset ?? [], filasAfectadas: resultado.rowsAffected?.[0] ?? 0 };
}

// Ejecuta varias operaciones como una sola unidad: si algo falla, se revierte todo.
// Uso:
//   await enTransaccion(async (tx) => {
//     await tx.consulta('UPDATE dbo.Producto SET Stock = Stock - @c WHERE Id = @id AND Stock >= @c', { c, id });
//     ...
//   });
// Para evitar vender más de lo disponible, descuenta con una condición
// (Stock >= @cantidad) y revisa filasAfectadas en la misma transacción.
export async function enTransaccion(trabajo, nivelAislamiento = sql.ISOLATION_LEVEL.READ_COMMITTED) {
  const pool = await obtenerPool();
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin(nivelAislamiento);
  const tx = {
    async consulta(textoSql, parametros = {}) {
      const solicitud = agregarParametros(new sql.Request(transaccion), parametros);
      const resultado = await solicitud.query(textoSql);
      return { filas: resultado.recordset ?? [], filasAfectadas: resultado.rowsAffected?.[0] ?? 0 };
    },
  };
  try {
    const resultado = await trabajo(tx);
    await transaccion.commit();
    return resultado;
  } catch (error) {
    try {
      await transaccion.rollback();
    } catch {
      // la transacción pudo haberse cancelado sola; el error original es el importante
    }
    throw error;
  }
}

// Prueba de conexión para /api/salud.
export async function probarConexion() {
  const { filas } = await consulta('SELECT DB_NAME() AS baseDatos, @@VERSION AS version');
  return filas[0];
}
