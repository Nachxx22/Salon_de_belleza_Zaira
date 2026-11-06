// Capa de datos del módulo Agenda (dueño: Persona A). MCA-08 a MCA-11.
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
// Toda escritura toma el bloqueo de aplicación 'agenda' (D-016) para no chocar
// con una cita que se esté registrando o reprogramando al mismo tiempo.
import { consulta, enTransaccion } from '../../shared/db.js';
import { fechaDeSql, horaDeSql } from '../../shared/fechas.js';

const DIA_SEMANA_SQL = '((DATEDIFF(DAY, \'19000101\', {col}) % 7) + 1)'; // 1900-01-01 fue lunes → 1 lunes … 7 domingo

class SinGuardar extends Error {
  constructor(resultado) {
    super('Operación revertida');
    this.resultado = resultado;
  }
}

// Transacción con el bloqueo 'agenda'. Un trabajo puede terminar sin guardar
// lanzando SinGuardar: se revierte todo y su resultado vuelve a la lógica.
async function transaccionAgenda(trabajo) {
  try {
    return await enTransaccion(async (tx) => {
      await tomarBloqueoAgenda(tx);
      return trabajo(tx);
    });
  } catch (error) {
    if (error instanceof SinGuardar) return error.resultado;
    throw error;
  }
}

export async function tomarBloqueoAgenda(tx) {
  await tx.consulta(
    `DECLARE @resultado INT;
     EXEC @resultado = sp_getapplock @Resource = N'agenda', @LockMode = N'Exclusive',
          @LockOwner = N'Transaction', @LockTimeout = 10000;
     IF @resultado < 0 THROW 51000, N'La agenda está ocupada en este momento. Intente de nuevo.', 1;`,
  );
}

const aHorario = (f) => ({ id: f.Id, diaSemana: f.DiaSemana, horaInicio: horaDeSql(f.HoraInicio), horaFin: horaDeSql(f.HoraFin) });
const aBloqueo = (f) => ({ id: f.Id, fecha: fechaDeSql(f.Fecha), horaInicio: horaDeSql(f.HoraInicio), horaFin: horaDeSql(f.HoraFin) });

const ejecutar = (tx) => (tx ? tx.consulta : consulta);

// MCA-09
export async function listarHorarios(tx) {
  const { filas } = await ejecutar(tx)('SELECT Id, DiaSemana, HoraInicio, HoraFin FROM dbo.Horario ORDER BY DiaSemana, HoraInicio');
  return filas.map(aHorario);
}

export async function listarBloqueos(tx) {
  const { filas } = await ejecutar(tx)('SELECT Id, Fecha, HoraInicio, HoraFin FROM dbo.BloqueoAgenda ORDER BY Fecha, HoraInicio');
  return filas.map(aBloqueo);
}

export async function obtenerHorario(id, tx) {
  const { filas } = await ejecutar(tx)('SELECT Id, DiaSemana, HoraInicio, HoraFin FROM dbo.Horario WHERE Id = @id', { id });
  return filas[0] ? aHorario(filas[0]) : null;
}

export async function obtenerBloqueo(id, tx) {
  const { filas } = await ejecutar(tx)('SELECT Id, Fecha, HoraInicio, HoraFin FROM dbo.BloqueoAgenda WHERE Id = @id', { id });
  return filas[0] ? aBloqueo(filas[0]) : null;
}

async function horariosDelDia(diaSemana, tx) {
  const { filas } = await ejecutar(tx)(
    'SELECT Id, DiaSemana, HoraInicio, HoraFin FROM dbo.Horario WHERE DiaSemana = @diaSemana ORDER BY HoraInicio',
    { diaSemana },
  );
  return filas.map(aHorario);
}

async function bloqueosDeFecha(fecha, tx) {
  const { filas } = await ejecutar(tx)(
    'SELECT Id, Fecha, HoraInicio, HoraFin FROM dbo.BloqueoAgenda WHERE Fecha = CAST(@fecha AS DATE) ORDER BY HoraInicio',
    { fecha },
  );
  return filas.map(aBloqueo);
}

// Lo que ocupa la agenda: citas Pendientes o Confirmadas y períodos reservados por
// solicitudes de reprogramación Pendientes (MCA-08 a MCA-11).
// `filtroCita` y `filtroSolicitud` son fragmentos fijos de este archivo; los valores van como parámetros.
async function ocupaciones(filtroCita, filtroSolicitud, parametros, tx) {
  const { filas } = await ejecutar(tx)(
    `SELECT N'cita' AS Origen, c.Codigo, c.Estado, c.Fecha, c.Hora AS Inicio, SUM(cs.DuracionAplicadaMinutos) AS Duracion
     FROM dbo.Cita c JOIN dbo.CitaServicio cs ON cs.CitaId = c.Id
     WHERE c.Estado IN (N'Pendiente', N'Confirmada') AND ${filtroCita}
     GROUP BY c.Id, c.Codigo, c.Estado, c.Fecha, c.Hora
     UNION ALL
     SELECT N'solicitud', c.Codigo, s.Estado, s.FechaPropuesta, s.HoraPropuesta, SUM(cs.DuracionAplicadaMinutos)
     FROM dbo.SolicitudCita s
     JOIN dbo.Cita c ON c.Id = s.CitaId
     JOIN dbo.CitaServicio cs ON cs.CitaId = s.CitaId
     WHERE s.Estado = N'Pendiente' AND s.Tipo = N'Reprogramacion' AND ${filtroSolicitud}
     GROUP BY s.Id, c.Codigo, s.Estado, s.FechaPropuesta, s.HoraPropuesta`,
    parametros,
  );
  return filas.map((f) => ({
    origen: f.Origen, // 'cita' o 'solicitud'
    codigo: f.Codigo,
    estado: f.Estado, // de la cita (Pendiente o Confirmada) o de la solicitud (Pendiente)
    fecha: fechaDeSql(f.Fecha),
    inicio: horaDeSql(f.Inicio),
    duracionMinutos: f.Duracion,
  }));
}

// Ocupaciones de una fecha (para bloqueos).
export async function ocupacionesDeFecha(fecha, tx) {
  return ocupaciones(
    'c.Fecha = CAST(@fecha AS DATE)',
    's.FechaPropuesta = CAST(@fecha AS DATE)',
    { fecha },
    tx,
  );
}

// Ocupaciones futuras de un día de la semana (para horarios regulares): desde
// `hoy` a la hora `ahora` en adelante, en hora de Costa Rica.
export async function ocupacionesFuturasDelDia(diaSemana, { hoy, ahora }, tx) {
  const futura = (fecha, hora) =>
    `${DIA_SEMANA_SQL.replace('{col}', fecha)} = @diaSemana
     AND (${fecha} > CAST(@hoy AS DATE) OR (${fecha} = CAST(@hoy AS DATE) AND ${hora} >= CAST(@ahora AS TIME(0))))`;
  return ocupaciones(futura('c.Fecha', 'c.Hora'), futura('s.FechaPropuesta', 's.HoraPropuesta'), { diaSemana, hoy, ahora }, tx);
}

async function insertarHorario({ diaSemana, horaInicio, horaFin }, tx) {
  const { filas } = await tx.consulta(
    `INSERT INTO dbo.Horario (DiaSemana, HoraInicio, HoraFin) OUTPUT INSERTED.Id
     VALUES (@diaSemana, CAST(@horaInicio AS TIME(0)), CAST(@horaFin AS TIME(0)))`,
    { diaSemana, horaInicio, horaFin },
  );
  return filas[0].Id;
}

async function insertarBloqueo({ fecha, horaInicio, horaFin }, tx) {
  const { filas } = await tx.consulta(
    `INSERT INTO dbo.BloqueoAgenda (Fecha, HoraInicio, HoraFin) OUTPUT INSERTED.Id
     VALUES (CAST(@fecha AS DATE), CAST(@horaInicio AS TIME(0)), CAST(@horaFin AS TIME(0)))`,
    { fecha, horaInicio, horaFin },
  );
  return filas[0].Id;
}

// MCA-08 y MCA-10 (horario regular). `verificar` es la regla de agenda.logica.js:
// recibe los demás horarios del día nuevo y, al modificar, cómo queda el día
// anterior y lo que tiene ocupado; devuelve un problema o null.
// Devuelve { id }, { noExiste } o { problema } (sin guardar nada).
export async function guardarHorario(id, horario, desde, verificar) {
  return transaccionAgenda(async (tx) => {
    const anterior = id ? await obtenerHorario(id, tx) : null;
    if (id && !anterior) throw new SinGuardar({ noExiste: true });
    const otros = (await horariosDelDia(horario.diaSemana, tx)).filter((h) => h.id !== id);
    const contexto = { otros, anterior: null };
    if (anterior) {
      contexto.anterior = {
        diaSemana: anterior.diaSemana,
        restantes: (await horariosDelDia(anterior.diaSemana, tx)).filter((h) => h.id !== id),
        ocupaciones: await ocupacionesFuturasDelDia(anterior.diaSemana, desde, tx),
      };
    }
    const problema = verificar(contexto);
    if (problema) throw new SinGuardar({ problema });
    if (anterior) {
      await tx.consulta(
        `UPDATE dbo.Horario SET DiaSemana = @diaSemana, HoraInicio = CAST(@horaInicio AS TIME(0)),
                HoraFin = CAST(@horaFin AS TIME(0))
         WHERE Id = @id`,
        { id, ...horario },
      );
      return { id };
    }
    return { id: await insertarHorario(horario, tx) };
  });
}

// MCA-11 (horario regular). Una configuración de agenda no es historial: se elimina el registro.
export async function eliminarHorario(id, desde, verificar) {
  return transaccionAgenda(async (tx) => {
    const actual = await obtenerHorario(id, tx);
    if (!actual) throw new SinGuardar({ noExiste: true });
    const problema = verificar({
      restantes: (await horariosDelDia(actual.diaSemana, tx)).filter((h) => h.id !== id),
      ocupaciones: await ocupacionesFuturasDelDia(actual.diaSemana, desde, tx),
    });
    if (problema) throw new SinGuardar({ problema });
    await tx.consulta('DELETE FROM dbo.Horario WHERE Id = @id', { id });
    return { eliminado: actual };
  });
}

// MCA-08 y MCA-10 (bloqueo). `verificar` recibe los demás bloqueos de la fecha y
// lo que la ocupa ese día.
export async function guardarBloqueo(id, bloqueo, verificar) {
  return transaccionAgenda(async (tx) => {
    if (id && !(await obtenerBloqueo(id, tx))) throw new SinGuardar({ noExiste: true });
    const problema = verificar({
      otros: (await bloqueosDeFecha(bloqueo.fecha, tx)).filter((b) => b.id !== id),
      ocupaciones: await ocupacionesDeFecha(bloqueo.fecha, tx),
    });
    if (problema) throw new SinGuardar({ problema });
    if (id) {
      await tx.consulta(
        `UPDATE dbo.BloqueoAgenda SET Fecha = CAST(@fecha AS DATE), HoraInicio = CAST(@horaInicio AS TIME(0)),
                HoraFin = CAST(@horaFin AS TIME(0))
         WHERE Id = @id`,
        { id, ...bloqueo },
      );
      return { id };
    }
    return { id: await insertarBloqueo(bloqueo, tx) };
  });
}

// MCA-11 (bloqueo): solo retira la restricción.
export async function eliminarBloqueo(id) {
  return transaccionAgenda(async (tx) => {
    const actual = await obtenerBloqueo(id, tx);
    if (!actual) throw new SinGuardar({ noExiste: true });
    await tx.consulta('DELETE FROM dbo.BloqueoAgenda WHERE Id = @id', { id });
    return { eliminado: actual };
  });
}
