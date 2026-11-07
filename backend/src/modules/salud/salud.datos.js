// Módulo Salud del sistema — dueño: Persona B (Ignacio). Capa de datos (D-017).
// Es el único archivo del módulo con SQL. Los nombres de tablas salen de la lista
// fija TABLAS (nunca de la solicitud) y todos los valores van como @parámetros.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from '../../app/config.js';
import { consulta, enTransaccion } from '../../shared/db.js';

export const TABLAS = [
  'Administradora', 'Cliente', 'Servicio', 'Proveedor', 'Producto', 'Horario', 'BloqueoAgenda',
  'Cita', 'CitaServicio', 'SolicitudCita', 'Venta', 'VentaProducto', 'VentaServicio', 'RevisionVenta',
];
const PERMISOS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

// Permisos que necesita cada operación de cada módulo, sacados de las consultas de
// su archivo .datos.js. D (borrar) es casi siempre UPDATE porque el sistema no borra
// historial: desactiva, cancela o anula. Solo Agenda borra filas (horarios y bloqueos).
const NECESITA = {
  acceso: {
    R: { Administradora: ['SELECT'] },
  },
  servicios: {
    C: { Servicio: ['INSERT', 'SELECT'] },
    R: { Servicio: ['SELECT'] },
    U: { Servicio: ['UPDATE', 'SELECT'] },
    D: { Servicio: ['UPDATE', 'SELECT'] },
  },
  proveedores: {
    C: { Proveedor: ['INSERT', 'SELECT'] },
    R: { Proveedor: ['SELECT'], Producto: ['SELECT'] },
    U: { Proveedor: ['UPDATE', 'SELECT'] },
    D: { Proveedor: ['UPDATE', 'SELECT'] },
  },
  productos: {
    C: { Producto: ['INSERT', 'SELECT'], Proveedor: ['SELECT'] },
    R: { Producto: ['SELECT'], Proveedor: ['SELECT'] },
    U: { Producto: ['UPDATE', 'SELECT'], Proveedor: ['SELECT'] },
    D: { Producto: ['UPDATE', 'SELECT'] },
  },
  ventas: {
    C: { Venta: ['INSERT', 'SELECT'], VentaProducto: ['INSERT'], VentaServicio: ['INSERT'], Producto: ['SELECT', 'UPDATE'], Servicio: ['SELECT'] },
    R: { Venta: ['SELECT'], VentaProducto: ['SELECT'], VentaServicio: ['SELECT'], Producto: ['SELECT'], Servicio: ['SELECT'], RevisionVenta: ['SELECT'] },
    U: {
      Venta: ['UPDATE', 'SELECT'], VentaProducto: ['SELECT', 'INSERT', 'DELETE'], VentaServicio: ['SELECT', 'INSERT', 'DELETE'],
      RevisionVenta: ['INSERT'], Producto: ['SELECT', 'UPDATE'], Servicio: ['SELECT'],
    },
    D: { Venta: ['UPDATE', 'SELECT'], VentaProducto: ['SELECT'], Producto: ['UPDATE'] },
  },
  agenda: {
    C: { Horario: ['INSERT', 'SELECT'], BloqueoAgenda: ['INSERT', 'SELECT'], Cita: ['SELECT'], CitaServicio: ['SELECT'], SolicitudCita: ['SELECT'] },
    R: { Horario: ['SELECT'], BloqueoAgenda: ['SELECT'] },
    U: { Horario: ['UPDATE', 'SELECT'], BloqueoAgenda: ['UPDATE', 'SELECT'], Cita: ['SELECT'], CitaServicio: ['SELECT'], SolicitudCita: ['SELECT'] },
    D: { Horario: ['DELETE', 'SELECT'], BloqueoAgenda: ['DELETE', 'SELECT'], Cita: ['SELECT'], CitaServicio: ['SELECT'], SolicitudCita: ['SELECT'] },
  },
  citas: {
    C: {
      Cita: ['INSERT', 'SELECT'], CitaServicio: ['INSERT', 'SELECT'], Cliente: ['INSERT', 'SELECT'], SolicitudCita: ['INSERT', 'SELECT'],
      Servicio: ['SELECT'], Horario: ['SELECT'], BloqueoAgenda: ['SELECT'],
    },
    R: { Cita: ['SELECT'], CitaServicio: ['SELECT'], Cliente: ['SELECT'], Servicio: ['SELECT'], SolicitudCita: ['SELECT'] },
    U: { Cita: ['UPDATE', 'SELECT'], SolicitudCita: ['INSERT', 'SELECT'], Horario: ['SELECT'], BloqueoAgenda: ['SELECT'] },
    D: { Cita: ['UPDATE', 'SELECT'], SolicitudCita: ['INSERT', 'SELECT'] },
  },
  solicitudes: {
    R: { SolicitudCita: ['SELECT'], Cita: ['SELECT'], CitaServicio: ['SELECT'], Cliente: ['SELECT'], Servicio: ['SELECT'] },
    U: { SolicitudCita: ['UPDATE', 'SELECT'], Cita: ['UPDATE', 'SELECT'], Horario: ['SELECT'], BloqueoAgenda: ['SELECT'] },
  },
};

// Traduce un error del driver o de SQL Server a un tipo que la pantalla entiende.
export function clasificarError(error) {
  const numero = error?.number ?? error?.originalError?.info?.number ?? null;
  const codigo = error?.code ?? null;
  const tecnico = { codigo, numero, mensaje: error?.message ?? String(error) };
  if (numero === 4060) return { tipo: 'BASE_NO_EXISTE', ...tecnico };
  if (codigo === 'ELOGIN' || numero === 18456) return { tipo: 'LOGIN', ...tecnico };
  if (['ESOCKET', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP', 'ECONNRESET', 'ENOTFOUND'].includes(codigo)) {
    return { tipo: 'SIN_CONEXION', ...tecnico };
  }
  if ([229, 230, 262, 297, 300, 916].includes(numero)) return { tipo: 'SIN_PERMISO', ...tecnico };
  if ([207, 208].includes(numero)) return { tipo: 'FALTA_TABLA', ...tecnico };
  if ([515, 547, 2601, 2627].includes(numero)) return { tipo: 'RESTRICCION', ...tecnico };
  return { tipo: 'ERROR', ...tecnico };
}

async function medido(trabajo) {
  const inicio = performance.now();
  try {
    const valor = await trabajo();
    return { ok: true, ms: Math.round(performance.now() - inicio), valor };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - inicio), error: clasificarError(error) };
  }
}

// Conexión: datos del servidor, del login y de sus roles en la base.
export async function probarConexion() {
  const r = await medido(async () => (await consulta(`
    SELECT DB_NAME() AS baseDatos, @@SERVERNAME AS servidor, SUSER_SNAME() AS login, USER_NAME() AS usuario,
           CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50)) AS version,
           CAST(SERVERPROPERTY('Edition') AS NVARCHAR(100)) AS edicion,
           IS_ROLEMEMBER('db_owner') AS dbOwner, IS_ROLEMEMBER('db_datareader') AS lector,
           IS_ROLEMEMBER('db_datawriter') AS escritor`)).filas[0]);
  if (!r.ok) return r;
  const f = r.valor;
  const roles = [f.dbOwner && 'db_owner', f.lector && 'db_datareader', f.escritor && 'db_datawriter'].filter(Boolean);
  return {
    ok: true,
    ms: r.ms,
    info: {
      baseDatos: f.baseDatos, servidor: f.servidor, login: f.login, usuario: f.usuario,
      version: f.version, edicion: f.edicion, roles,
    },
  };
}

// Tablas: existencia, permisos efectivos del login y una lectura real (COUNT) de cada una.
export async function revisarTablas() {
  const permisos = await consulta(`
    SELECT t.value AS nombre,
           CASE WHEN OBJECT_ID(N'dbo.' + t.value, N'U') IS NULL THEN 0 ELSE 1 END AS existe,
           HAS_PERMS_BY_NAME(N'dbo.' + t.value, N'OBJECT', N'SELECT') AS puedeSelect,
           HAS_PERMS_BY_NAME(N'dbo.' + t.value, N'OBJECT', N'INSERT') AS puedeInsert,
           HAS_PERMS_BY_NAME(N'dbo.' + t.value, N'OBJECT', N'UPDATE') AS puedeUpdate,
           HAS_PERMS_BY_NAME(N'dbo.' + t.value, N'OBJECT', N'DELETE') AS puedeDelete
    FROM STRING_SPLIT(@tablas, N',') AS t`, { tablas: TABLAS.join(',') });
  const porNombre = new Map(permisos.filas.map((f) => [f.nombre, f]));

  return Promise.all(TABLAS.map(async (nombre) => {
    const f = porNombre.get(nombre);
    const existe = f?.existe === 1;
    const tabla = {
      nombre,
      existe,
      permisos: {
        SELECT: f?.puedeSelect === 1, INSERT: f?.puedeInsert === 1, UPDATE: f?.puedeUpdate === 1, DELETE: f?.puedeDelete === 1,
      },
      filas: null,
      ms: null,
      error: null,
    };
    if (!existe) return tabla;
    // El nombre viene de la lista fija TABLAS, no de la solicitud.
    const lectura = await medido(async () => (await consulta(`SELECT COUNT_BIG(*) AS filas FROM dbo.[${nombre}]`)).filas[0].filas);
    tabla.ms = lectura.ms;
    if (lectura.ok) tabla.filas = Number(lectura.valor);
    else tabla.error = lectura.error;
    return tabla;
  }));
}

// Para cada módulo y operación (C, R, U, D): qué se necesita, qué permisos faltan y qué tablas no existen.
export function revisarOperaciones(tablas) {
  const porNombre = new Map(tablas.map((t) => [t.nombre, t]));
  const resultado = {};
  for (const [modulo, operaciones] of Object.entries(NECESITA)) {
    resultado[modulo] = {};
    for (const [operacion, necesidades] of Object.entries(operaciones)) {
      const necesita = [];
      const faltan = [];
      const faltanTablas = [];
      for (const [tabla, permisos] of Object.entries(necesidades)) {
        const t = porNombre.get(tabla);
        if (!t?.existe) faltanTablas.push(tabla);
        for (const permiso of permisos) {
          necesita.push(`${permiso} en ${tabla}`);
          if (t?.existe && !t.permisos[permiso]) faltan.push(`${permiso} en ${tabla}`);
        }
      }
      resultado[modulo][operacion] = { necesita, faltan, faltanTablas };
    }
  }
  return resultado;
}

// Migraciones: compara database/migrations con lo registrado en dbo.SchemaMigrations
// (mismo hash que usa npm run db:migrar).
export async function revisarMigraciones() {
  const carpeta = path.resolve(config.raizBackend, '..', 'database', 'migrations');
  const archivos = existsSync(carpeta)
    ? readdirSync(carpeta).filter((n) => /^\d{4,}_.+\.sql$/.test(n)).sort().map((nombre) => {
      const contenido = readFileSync(path.join(carpeta, nombre), 'utf8').replace(/^﻿/, '');
      return { nombre, hash: createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex') };
    })
    : null;
  const existe = (await consulta("SELECT CASE WHEN OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL THEN 0 ELSE 1 END AS existe")).filas[0].existe === 1;
  const aplicadas = existe
    ? (await consulta('SELECT Nombre AS nombre, Hash AS hash, AplicadaEn AS aplicadaEn FROM dbo.SchemaMigrations ORDER BY Nombre')).filas
    : [];
  return { archivos, registroExiste: existe, aplicadas };
}

// ---------------------------------------------------------------------------
// Prueba de escritura: ejecuta INSERT/UPDATE/DELETE reales dentro de una
// transacción y la revierte siempre (ROLLBACK). No deja datos.
// ---------------------------------------------------------------------------
class Revertir extends Error {
  constructor(pasos) {
    super('revertir');
    this.pasos = pasos;
  }
}

const aleatorio = (digitos) => String(Math.floor(Math.random() * 10 ** digitos)).padStart(digitos, '0');
const mananaMasUnAnio = () => {
  const fecha = new Date();
  fecha.setUTCFullYear(fecha.getUTCFullYear() + 1);
  return fecha.toISOString().slice(0, 10);
};

const ESCRITURAS = {
  servicios: async (paso) => {
    const id = await paso('C', 'Registrar (INSERT en Servicio)', async (tx) => (await tx.consulta(`
      INSERT INTO dbo.Servicio (Nombre, Descripcion, PrecioAproximado, DuracionMinutos)
      OUTPUT INSERTED.Id AS id VALUES (@nombre, @descripcion, 1000, 30)`,
    { nombre: 'Prueba de salud', descripcion: 'Fila temporal: se revierte al terminar.' })).filas[0].id);
    await paso('R', 'Consultar (SELECT en Servicio)', (tx) => tx.consulta('SELECT Id FROM dbo.Servicio WHERE Id = @id', { id }));
    await paso('U', 'Actualizar (UPDATE en Servicio)', (tx) => tx.consulta('UPDATE dbo.Servicio SET Nombre = @nombre WHERE Id = @id', { id, nombre: 'Prueba de salud (editada)' }));
    await paso('D', 'Desactivar (UPDATE Estado en Servicio)', (tx) => tx.consulta("UPDATE dbo.Servicio SET Estado = N'Desactivado' WHERE Id = @id", { id }));
  },
  proveedores: async (paso) => {
    const id = await paso('C', 'Registrar (INSERT en Proveedor)', async (tx) => (await tx.consulta(`
      INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
      OUTPUT INSERTED.Id AS id VALUES (@nombre, @telefono, @correo)`,
    { nombre: 'Prueba de salud', telefono: `9${aleatorio(7)}`, correo: `salud-${aleatorio(8)}@prueba.invalid` })).filas[0].id);
    await paso('R', 'Consultar (SELECT en Proveedor y Producto)', (tx) => tx.consulta(
      'SELECT p.Id, COUNT(pr.Id) AS productos FROM dbo.Proveedor p LEFT JOIN dbo.Producto pr ON pr.ProveedorId = p.Id WHERE p.Id = @id GROUP BY p.Id', { id },
    ));
    await paso('U', 'Actualizar (UPDATE en Proveedor)', (tx) => tx.consulta('UPDATE dbo.Proveedor SET Nombre = @nombre WHERE Id = @id', { id, nombre: 'Prueba de salud (editada)' }));
    await paso('D', 'Desactivar (UPDATE Estado en Proveedor)', (tx) => tx.consulta("UPDATE dbo.Proveedor SET Estado = N'Desactivado' WHERE Id = @id", { id }));
  },
  productos: async (paso) => {
    const id = await paso('C', 'Registrar (INSERT en Proveedor temporal y en Producto)', async (tx) => {
      const proveedorId = (await tx.consulta(`
        INSERT INTO dbo.Proveedor (Nombre, Telefono, CorreoElectronico)
        OUTPUT INSERTED.Id AS id VALUES (@nombre, @telefono, @correo)`,
      { nombre: 'Prueba de salud', telefono: `9${aleatorio(7)}`, correo: `salud-${aleatorio(8)}@prueba.invalid` })).filas[0].id;
      return (await tx.consulta(`
        INSERT INTO dbo.Producto (ProveedorId, Nombre, Marca, Categoria, Descripcion, Precio, Stock)
        OUTPUT INSERTED.Id AS id VALUES (@proveedorId, @nombre, @marca, @categoria, @descripcion, 1000, 5)`,
      { proveedorId, nombre: 'Prueba de salud', marca: 'Prueba', categoria: 'Prueba', descripcion: 'Fila temporal: se revierte al terminar.' })).filas[0].id;
    });
    await paso('R', 'Consultar (SELECT en Producto con su proveedor)', (tx) => tx.consulta(
      'SELECT p.Id, p.Disponibilidad, pv.Nombre FROM dbo.Producto p JOIN dbo.Proveedor pv ON pv.Id = p.ProveedorId WHERE p.Id = @id', { id },
    ));
    await paso('U', 'Actualizar stock (UPDATE en Producto)', (tx) => tx.consulta('UPDATE dbo.Producto SET Stock = Stock + 1 WHERE Id = @id', { id }));
    await paso('D', 'Desactivar (UPDATE Estado en Producto)', (tx) => tx.consulta("UPDATE dbo.Producto SET Estado = N'Desactivado' WHERE Id = @id", { id }));
  },
  // Ventas no inserta una venta de prueba: el código V-000001 sale del Id y SQL Server
  // no devuelve un Id usado aunque se revierta, así que quedaría un salto en los códigos.
  // El registro (C) se revisa por permisos; aquí se prueban las tablas de detalle y la
  // corrección y anulación sobre una venta Registrada que ya exista.
  ventas: async (paso, omitir) => {
    const venta = await paso('R', 'Consultar (SELECT en Venta y su detalle)', async (tx) => (await tx.consulta(`
      SELECT TOP (1) v.Id AS id, (SELECT COUNT(*) FROM dbo.VentaProducto vp WHERE vp.VentaId = v.Id) AS productos,
             (SELECT COUNT(*) FROM dbo.VentaServicio vs WHERE vs.VentaId = v.Id) AS servicios
      FROM dbo.Venta v WHERE v.Estado = N'Registrada' ORDER BY v.Id DESC`)).filas[0] ?? null);
    omitir('C', 'Registrar venta: no se inserta para no dejar un salto en los códigos V-…; se revisa por permisos.');
    if (!venta) {
      omitir('U', 'Corregir venta: no hay ventas Registradas para probar.');
      omitir('D', 'Anular venta: no hay ventas Registradas para probar.');
      return;
    }
    await paso('U', 'Corregir (INSERT en RevisionVenta, UPDATE en Venta y Producto)', async (tx) => {
      await tx.consulta('INSERT INTO dbo.RevisionVenta (VentaId, Motivo, DatosAnteriores) VALUES (@id, @motivo, @datos)',
        { id: venta.id, motivo: 'Prueba de salud: se revierte al terminar.', datos: '{"prueba":true}' });
      await tx.consulta('UPDATE dbo.Venta SET Total = Total WHERE Id = @id', { id: venta.id });
      await tx.consulta('UPDATE p SET Stock = p.Stock FROM dbo.Producto p JOIN dbo.VentaProducto vp ON vp.ProductoId = p.Id WHERE vp.VentaId = @id', { id: venta.id });
    });
    await paso('D', 'Anular (UPDATE Estado y motivo en Venta)', (tx) => tx.consulta(
      "UPDATE dbo.Venta SET Estado = N'Anulada', MotivoAnulacion = @motivo WHERE Id = @id",
      { id: venta.id, motivo: 'Prueba de salud: se revierte al terminar.' },
    ));
  },
  agenda: async (paso) => {
    const ids = await paso('C', 'Registrar (INSERT en Horario y BloqueoAgenda)', async (tx) => ({
      horario: (await tx.consulta("INSERT INTO dbo.Horario (DiaSemana, HoraInicio, HoraFin) OUTPUT INSERTED.Id AS id VALUES (1, CAST('05:00' AS TIME(0)), CAST('05:30' AS TIME(0)))")).filas[0].id,
      bloqueo: (await tx.consulta(`INSERT INTO dbo.BloqueoAgenda (Fecha, HoraInicio, HoraFin) OUTPUT INSERTED.Id AS id
        VALUES (CAST(@fecha AS DATE), CAST('05:00' AS TIME(0)), CAST('05:30' AS TIME(0)))`, { fecha: mananaMasUnAnio() })).filas[0].id,
    }));
    await paso('R', 'Consultar (SELECT en Horario y BloqueoAgenda)', (tx) => tx.consulta(
      'SELECT (SELECT COUNT(*) FROM dbo.Horario) AS horarios, (SELECT COUNT(*) FROM dbo.BloqueoAgenda) AS bloqueos',
    ));
    await paso('U', 'Modificar (UPDATE en Horario y BloqueoAgenda)', async (tx) => {
      await tx.consulta("UPDATE dbo.Horario SET HoraFin = CAST('06:00' AS TIME(0)) WHERE Id = @id", { id: ids.horario });
      await tx.consulta("UPDATE dbo.BloqueoAgenda SET HoraFin = CAST('06:00' AS TIME(0)) WHERE Id = @id", { id: ids.bloqueo });
    });
    await paso('D', 'Eliminar (DELETE en Horario y BloqueoAgenda)', async (tx) => {
      await tx.consulta('DELETE FROM dbo.Horario WHERE Id = @id', { id: ids.horario });
      await tx.consulta('DELETE FROM dbo.BloqueoAgenda WHERE Id = @id', { id: ids.bloqueo });
    });
  },
};

export const MODULOS_CON_ESCRITURA = Object.keys(ESCRITURAS);

// Devuelve [{ operacion, descripcion, estado: 'OK'|'ERROR'|'OMITIDA'|'NO_PROBADA', ms, error, nota }].
// Se detiene en el primer error y siempre revierte la transacción.
export async function probarEscritura(modulo) {
  const pasos = [];
  try {
    await enTransaccion(async (tx) => {
      const paso = async (operacion, descripcion, trabajo) => {
        const r = await medido(() => trabajo(tx));
        pasos.push({ operacion, descripcion, estado: r.ok ? 'OK' : 'ERROR', ms: r.ms, error: r.ok ? null : r.error });
        if (!r.ok) throw new Revertir(pasos); // los pasos siguientes quedan sin probar
        return r.valor;
      };
      const omitir = (operacion, nota) => pasos.push({ operacion, descripcion: nota, estado: 'OMITIDA', ms: null, error: null });
      await ESCRITURAS[modulo](paso, omitir);
      throw new Revertir(pasos); // siempre ROLLBACK, aunque todo saliera bien
    });
  } catch (error) {
    if (!(error instanceof Revertir)) {
      pasos.push({ operacion: '-', descripcion: 'Abrir o revertir la transacción', estado: 'ERROR', ms: null, error: clasificarError(error) });
    }
  }
  return pasos;
}
