// npm run db:verificar
// Comprueba en SQL Server que la base cumple lo acordado (DECISIONES.md, D-013
// a D-016): las 14 tablas, llaves, CHECK, índices únicos, código de venta, hora
// de Costa Rica y la cuenta de la administradora. Todo ocurre dentro de una
// transacción que al final se deshace, así que no deja datos de prueba.
import assert from 'node:assert/strict';
import { revisarConfiguracion, conectar, mostrarErrorSql, sql, config } from './lib-sql.js';
import { ahoraCostaRica } from '../src/shared/fechas.js';

revisarConfiguracion();

const TABLAS = [
  'Administradora', 'Cliente', 'Servicio', 'Proveedor', 'Producto', 'Horario', 'BloqueoAgenda',
  'Cita', 'CitaServicio', 'SolicitudCita', 'Venta', 'VentaProducto', 'VentaServicio', 'RevisionVenta',
];

let revisiones = 0;
let fallas = 0;

async function revisar(descripcion, prueba) {
  revisiones += 1;
  try {
    await prueba();
    console.log(`  ok  ${descripcion}`);
  } catch (error) {
    fallas += 1;
    console.error(`  X   ${descripcion}\n      ${error.message}`);
  }
}

// La base debe rechazar la instrucción con uno de estos errores de SQL Server:
// 547 = CHECK o FK, 2627 = UNIQUE o PK, 2601 = índice único.
async function rechaza(tx, instruccion, errores = [547]) {
  try {
    await new sql.Request(tx).batch(instruccion);
  } catch (error) {
    assert.ok(errores.includes(error.number), `SQL Server respondió el error ${error.number}: ${error.message}`);
    return;
  }
  assert.fail(`la base aceptó algo que debía rechazar: ${instruccion.trim()}`);
}

async function fila(tx, instruccion) {
  const { recordset } = await new sql.Request(tx).query(instruccion);
  return recordset[0];
}

// Minutos de diferencia entre dos textos 'YYYY-MM-DD HH:mm:ss'.
function minutosEntre(a, b) {
  const valor = (texto) => Date.parse(`${texto.replace(' ', 'T')}Z`);
  return Math.abs(valor(a) - valor(b)) / 60000;
}

async function verificar(tx) {
  await revisar('existen las 14 tablas (13 de 0001 y RevisionVenta de 0002)', async () => {
    const { recordset } = await new sql.Request(tx).query("SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo')");
    const existentes = new Set(recordset.map((f) => f.name));
    assert.deepEqual(TABLAS.filter((t) => !existentes.has(t)), [], 'faltan tablas');
  });

  let d;
  await revisar('acepta datos válidos en las 14 tablas', async () => {
    d = await fila(tx, `
      DECLARE @prov INT, @prod INT, @serv INT, @cli INT, @cita INT, @venta INT;
      INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
        VALUES (N'Proveedor de verificación', N'00000001', N'verificacion@zaira.example');
      SET @prov = SCOPE_IDENTITY();
      INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
        VALUES (@prov, N'Producto de verificación', N'Marca', N'Categoría', N'Descripción', 1000, 0);
      SET @prod = SCOPE_IDENTITY();
      INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos, PermiteDomicilio)
        VALUES (N'Servicio de verificación', N'Descripción', 5000, 45, 1);
      SET @serv = SCOPE_IDENTITY();
      INSERT INTO dbo.Cliente (Nombre, Telefono) VALUES (N'Cliente de verificación', N'00000002');
      SET @cli = SCOPE_IDENTITY();
      INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado)
        VALUES (N'VERIFICACION-1', @cli, '2030-01-15', '10:30', N'Pendiente');
      SET @cita = SCOPE_IDENTITY();
      INSERT INTO dbo.CitaServicio (CitaId, ServicioId, DuracionAplicadaMinutos) VALUES (@cita, @serv, 45);
      INSERT INTO dbo.SolicitudCita (CitaId, Tipo) VALUES (@cita, N'Creacion');
      INSERT INTO dbo.Horario (DiaSemana, HoraInicio, HoraFin) VALUES (7, '09:00', '12:00');
      INSERT INTO dbo.BloqueoAgenda (Fecha, HoraInicio, HoraFin) VALUES ('2030-01-15', '13:00', '14:00');
      INSERT INTO dbo.Venta (MetodoPago, Total) VALUES (N'SINPE', 6000);
      SET @venta = SCOPE_IDENTITY();
      INSERT INTO dbo.VentaProducto (VentaId, ProductoId, Cantidad, PrecioAplicado) VALUES (@venta, @prod, 1, 1000);
      INSERT INTO dbo.VentaServicio (VentaId, ServicioId, PrecioFinal) VALUES (@venta, @serv, 5000);
      INSERT INTO dbo.RevisionVenta (VentaId, Motivo, DatosAnteriores) VALUES (@venta, N'Verificación', N'{"total":6000}');
      SELECT @prov AS prov, @prod AS prod, @serv AS serv, @cli AS cli, @cita AS cita, @venta AS venta;`);
  });
  if (!d) return; // sin datos base no tiene sentido seguir

  await revisar('valores por defecto: Activo, Pendiente y Registrada', async () => {
    const f = await fila(tx, `SELECT
      (SELECT Estado FROM dbo.Servicio WHERE Id = ${d.serv}) AS servicio,
      (SELECT Estado FROM dbo.SolicitudCita WHERE CitaId = ${d.cita}) AS solicitud,
      (SELECT Estado FROM dbo.Venta WHERE Id = ${d.venta}) AS venta`);
    assert.deepEqual({ ...f }, { servicio: 'Activo', solicitud: 'Pendiente', venta: 'Registrada' });
  });

  await revisar('el código de venta se calcula como V-000000 a partir del Id', async () => {
    const f = await fila(tx, `SELECT Id, Codigo FROM dbo.Venta WHERE Id = ${d.venta}`);
    assert.equal(f.Codigo, `V-${String(f.Id).padStart(6, '0')}`);
  });

  await revisar('la hora de registro es la de Costa Rica, no la de la computadora (D-015)', async () => {
    const f = await fila(tx, `SELECT
      CONVERT(CHAR(19), (SELECT FechaHora FROM dbo.Venta WHERE Id = ${d.venta}), 120) AS venta,
      CONVERT(CHAR(19), (SELECT FechaSolicitud FROM dbo.SolicitudCita WHERE CitaId = ${d.cita}), 120) AS solicitud,
      CONVERT(CHAR(19), (SELECT FechaHora FROM dbo.RevisionVenta WHERE VentaId = ${d.venta}), 120) AS revision`);
    const ahora = ahoraCostaRica();
    for (const [columna, valor] of Object.entries(f)) {
      assert.ok(minutosEntre(valor, ahora) <= 2, `${columna} guardó ${valor} y en Costa Rica son las ${ahora}`);
    }
  });

  await revisar('Disponibilidad se calcula con el stock (Agotado y Disponible)', async () => {
    assert.equal((await fila(tx, `SELECT Disponibilidad FROM dbo.Producto WHERE Id = ${d.prod}`)).Disponibilidad, 'Agotado');
    await new sql.Request(tx).batch(`UPDATE dbo.Producto SET Stock = 3 WHERE Id = ${d.prod}`);
    assert.equal((await fila(tx, `SELECT Disponibilidad FROM dbo.Producto WHERE Id = ${d.prod}`)).Disponibilidad, 'Disponible');
  });

  await revisar('teléfonos: solo 8 dígitos seguidos, sin guion ni +506 (D-016)', async () => {
    await rechaza(tx, `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico) VALUES (N'X', N'8888-000', N'x1@zaira.example')`);
    await rechaza(tx, `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico) VALUES (N'X', N'+5068888000', N'x2@zaira.example')`);
    await rechaza(tx, `INSERT INTO dbo.Cliente (Nombre, Telefono) VALUES (N'X', N'8888 000')`);
  });

  await revisar('teléfono y correo de proveedor y teléfono de cliente no se repiten', async () => {
    await rechaza(tx, `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico) VALUES (N'X', N'00000001', N'otro@zaira.example')`, [2627]);
    await rechaza(tx, `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico) VALUES (N'X', N'00000009', N'verificacion@zaira.example')`, [2627]);
    await rechaza(tx, `INSERT INTO dbo.Cliente (Nombre, Telefono) VALUES (N'X', N'00000002')`, [2627]);
    await rechaza(tx, `INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico) VALUES (N'X', N'00000008', N'sin-arroba')`);
  });

  await revisar('hora de cita con minutos 00 o 30 y segundos 00', async () => {
    await rechaza(tx, `INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado) VALUES (N'V-2', ${d.cli}, '2030-01-15', '10:15', N'Pendiente')`);
    await rechaza(tx, `INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado) VALUES (N'V-3', ${d.cli}, '2030-01-15', '10:30:20', N'Pendiente')`);
  });

  await revisar('HoraPropuesta: solo en reprogramación, en intervalos de 30 minutos y nula en lo demás', async () => {
    const base = `INSERT INTO dbo.SolicitudCita (CitaId, Tipo, Estado, FechaPropuesta, HoraPropuesta) VALUES (${d.cita},`;
    await rechaza(tx, `${base} N'Reprogramacion', N'Rechazada', '2030-01-16', '11:15')`);
    await rechaza(tx, `${base} N'Reprogramacion', N'Rechazada', NULL, NULL)`);
    await rechaza(tx, `${base} N'Cancelacion', N'Rechazada', '2030-01-16', '11:00')`);
    await new sql.Request(tx).batch(`${base} N'Reprogramacion', N'Rechazada', '2030-01-16', '11:30')`);
  });

  await revisar('una sola solicitud Pendiente por cita', async () => {
    await rechaza(tx, `INSERT INTO dbo.SolicitudCita (CitaId, Tipo) VALUES (${d.cita}, N'Cancelacion')`, [2601]);
  });

  await revisar('MotivoCancelacion solo en citas Canceladas; puede quedar nulo', async () => {
    await rechaza(tx, `UPDATE dbo.Cita SET MotivoCancelacion = N'Motivo' WHERE Id = ${d.cita}`);
    await new sql.Request(tx).batch(`INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado) VALUES (N'V-4', ${d.cli}, '2030-01-15', '11:00', N'Cancelada')`);
  });

  await revisar('cita a domicilio exige dirección', async () => {
    await rechaza(tx, `INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado, EsDomicilio) VALUES (N'V-5', ${d.cli}, '2030-01-15', '12:00', N'Pendiente', 1)`);
  });

  await revisar('estados y métodos de pago solo con los valores acordados', async () => {
    await rechaza(tx, `INSERT INTO dbo.SolicitudCita (CitaId, Tipo, Estado) VALUES (${d.cita}, N'Modificacion', N'Rechazada')`);
    await rechaza(tx, `UPDATE dbo.Cita SET Estado = N'Aprobada' WHERE Id = ${d.cita}`);
    await rechaza(tx, `UPDATE dbo.Servicio SET Estado = N'Inactivo' WHERE Id = ${d.serv}`);
    await rechaza(tx, `UPDATE dbo.Venta SET MetodoPago = N'Tarjeta' WHERE Id = ${d.venta}`);
  });

  await revisar('montos, duraciones y cantidades válidos', async () => {
    await rechaza(tx, `UPDATE dbo.Servicio SET PrecioAproximado = -1 WHERE Id = ${d.serv}`);
    await rechaza(tx, `UPDATE dbo.Servicio SET DuracionMinutos = 0 WHERE Id = ${d.serv}`);
    await rechaza(tx, `UPDATE dbo.Producto SET Stock = -1 WHERE Id = ${d.prod}`);
    await rechaza(tx, `UPDATE dbo.VentaProducto SET Cantidad = 0 WHERE VentaId = ${d.venta}`);
    await rechaza(tx, `UPDATE dbo.VentaServicio SET PrecioFinal = 0 WHERE VentaId = ${d.venta}`);
  });

  await revisar('anular una venta exige motivo; una venta Registrada no lleva motivo', async () => {
    await rechaza(tx, `UPDATE dbo.Venta SET Estado = N'Anulada' WHERE Id = ${d.venta}`);
    await rechaza(tx, `UPDATE dbo.Venta SET Estado = N'Anulada', MotivoAnulacion = N'   ' WHERE Id = ${d.venta}`);
    await rechaza(tx, `UPDATE dbo.Venta SET MotivoAnulacion = N'Motivo' WHERE Id = ${d.venta}`);
    await new sql.Request(tx).batch(`UPDATE dbo.Venta SET Estado = N'Anulada', MotivoAnulacion = N'Error de cobro' WHERE Id = ${d.venta}`);
  });

  await revisar('RevisionVenta solo guarda JSON válido', async () => {
    await rechaza(tx, `INSERT INTO dbo.RevisionVenta (VentaId, Motivo, DatosAnteriores) VALUES (${d.venta}, N'X', N'no es json')`);
  });

  await revisar('nada se borra en cascada: un servicio o proveedor usado no se puede borrar', async () => {
    await rechaza(tx, `DELETE FROM dbo.Servicio WHERE Id = ${d.serv}`);
    await rechaza(tx, `DELETE FROM dbo.Proveedor WHERE Id = ${d.prov}`);
  });
}

// La cuenta de npm run db:admin inicia sesión con el mismo código del API.
async function verificarLogin() {
  const usuario = (process.env.ADMIN_USUARIO || '').trim();
  const contrasena = process.env.ADMIN_CONTRASENA || '';
  if (!usuario || !contrasena) {
    console.log('  --  login: define ADMIN_USUARIO y ADMIN_CONTRASENA en backend/.env para revisarlo');
    return;
  }
  const { validarCredenciales } = await import('../src/modules/auth/auth.logica.js');
  const { cerrarPool } = await import('../src/shared/db.js');
  try {
    await revisar('la administradora inicia sesión y una contraseña incorrecta se rechaza (MA-01)', async () => {
      assert.equal((await validarCredenciales(usuario, contrasena)).usuario, usuario);
      await assert.rejects(validarCredenciales(usuario, `${contrasena}-incorrecta`), { codigo: 'CREDENCIALES_INVALIDAS' });
    });
  } finally {
    await cerrarPool();
  }
}

try {
  const pool = await conectar();
  try {
    console.log(`Verificando la base ${config.db.database}:`);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await verificar(tx);
    } finally {
      await tx.rollback().catch(() => {});
    }
  } finally {
    await pool.close();
  }
  await verificarLogin();
  if (fallas > 0) {
    console.error(`\n${fallas} de ${revisiones} revisiones fallaron. No se guardó ningún dato de prueba.`);
    process.exitCode = 1;
  } else {
    console.log(`\nTodo bien: ${revisiones} revisiones. No se guardó ningún dato de prueba.`);
  }
} catch (error) {
  mostrarErrorSql(error);
  process.exitCode = 1;
}
