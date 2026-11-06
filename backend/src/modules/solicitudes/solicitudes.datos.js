// Capa de datos del módulo Solicitudes de cita (dueño: Persona A). MCA-05 y MCA-06.
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
import { consulta, enTransaccion } from '../../shared/db.js';
import { fechaDeSql, fechaHoraDeSql, horaDeSql } from '../../shared/fechas.js';
import { tomarBloqueoAgenda } from '../agenda/agenda.datos.js';
import { leerAgendaDelDia } from '../citas/citas.datos.js';

class SinGuardar extends Error {
  constructor(resultado) {
    super('Operación revertida');
    this.resultado = resultado;
  }
}

const SELECT_SOLICITUD = `
  SELECT s.Id, s.Tipo, s.Estado, s.FechaSolicitud, s.FechaPropuesta, s.HoraPropuesta,
         c.Id AS CitaId, c.Codigo, c.Fecha, c.Hora, c.Estado AS EstadoCita, c.EsDomicilio, c.Direccion, c.Observaciones,
         cl.Nombre, cl.Telefono, cl.CorreoElectronico,
         (SELECT SUM(cs.DuracionAplicadaMinutos) FROM dbo.CitaServicio cs WHERE cs.CitaId = c.Id) AS Duracion,
         (SELECT STRING_AGG(sv.Nombre, N', ') FROM dbo.CitaServicio cs
            JOIN dbo.Servicio sv ON sv.Id = cs.ServicioId WHERE cs.CitaId = c.Id) AS Servicios
  FROM dbo.SolicitudCita s
  JOIN dbo.Cita c ON c.Id = s.CitaId
  JOIN dbo.Cliente cl ON cl.Id = c.ClienteId`;

function aSolicitud(f) {
  return {
    id: f.Id,
    tipo: f.Tipo,
    estado: f.Estado,
    fechaSolicitud: fechaHoraDeSql(f.FechaSolicitud),
    propuesta: f.FechaPropuesta ? { fecha: fechaDeSql(f.FechaPropuesta), hora: horaDeSql(f.HoraPropuesta) } : null,
    cita: {
      id: f.CitaId,
      codigo: f.Codigo,
      fecha: fechaDeSql(f.Fecha),
      hora: horaDeSql(f.Hora),
      estado: f.EstadoCita,
      duracionMinutos: f.Duracion ?? 0,
      servicios: f.Servicios ?? '',
      esDomicilio: Boolean(f.EsDomicilio),
      direccion: f.Direccion,
      observaciones: f.Observaciones,
    },
    cliente: { nombre: f.Nombre, telefono: f.Telefono, correoElectronico: f.CorreoElectronico },
  };
}

// MCA-05: solo las Pendientes, de la más antigua a la más reciente.
export async function listarPendientes() {
  const { filas } = await consulta(`${SELECT_SOLICITUD} WHERE s.Estado = N'Pendiente' ORDER BY s.FechaSolicitud, s.Id`);
  return filas.map(aSolicitud);
}

// Aviso interno (MCA-05, criterio 12): cuántas hay y cuál es la más reciente.
export async function resumenPendientes() {
  const { filas } = await consulta(
    "SELECT COUNT(*) AS Total, MAX(Id) AS Ultima FROM dbo.SolicitudCita WHERE Estado = N'Pendiente'",
  );
  return { pendientes: filas[0].Total, ultimaId: filas[0].Ultima };
}

export async function obtener(id) {
  const { filas } = await consulta(`${SELECT_SOLICITUD} WHERE s.Id = @id`, { id });
  return filas[0] ? aSolicitud(filas[0]) : null;
}

const diaSemanaDe = (fecha) => {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
};

// MCA-06: aplica la decisión en una sola transacción con el bloqueo 'agenda'.
// `reglas.estadoCitaEsperado(tipo)` y `reglas.estaDisponible(agenda, hora, duracion)`
// son de solicitudes.logica.js. Devuelve { ok }, { noExiste }, { yaProcesada },
// { inconsistente } o { conflicto } sin guardar nada.
export async function procesar(id, aprobar, reglas) {
  try {
    return await enTransaccion(async (tx) => {
      await tomarBloqueoAgenda(tx);
      const { filas } = await tx.consulta(
        `SELECT s.Tipo, s.Estado, s.CitaId, s.FechaPropuesta, s.HoraPropuesta, c.Estado AS EstadoCita, c.Fecha, c.Hora,
                (SELECT SUM(cs.DuracionAplicadaMinutos) FROM dbo.CitaServicio cs WHERE cs.CitaId = c.Id) AS Duracion
         FROM dbo.SolicitudCita s WITH (UPDLOCK, ROWLOCK)
         JOIN dbo.Cita c WITH (UPDLOCK, ROWLOCK) ON c.Id = s.CitaId
         WHERE s.Id = @id`,
        { id },
      );
      const s = filas[0];
      if (!s) throw new SinGuardar({ noExiste: true });
      if (s.Estado !== 'Pendiente') throw new SinGuardar({ yaProcesada: s.Estado });
      if (s.EstadoCita !== reglas.estadoCitaEsperado(s.Tipo)) throw new SinGuardar({ inconsistente: s.EstadoCita });

      const citaId = s.CitaId;
      // Creación o reprogramación aprobadas: el período que quedará ocupado debe seguir siendo válido.
      if (aprobar && s.Tipo !== 'Cancelacion') {
        const fecha = fechaDeSql(s.Tipo === 'Reprogramacion' ? s.FechaPropuesta : s.Fecha);
        const hora = horaDeSql(s.Tipo === 'Reprogramacion' ? s.HoraPropuesta : s.Hora);
        const agenda = await leerAgendaDelDia(fecha, diaSemanaDe(fecha), tx, citaId);
        if (!reglas.estaDisponible(agenda, hora, s.Duracion ?? 0)) throw new SinGuardar({ conflicto: { fecha, hora } });
      }

      await tx.consulta('UPDATE dbo.SolicitudCita SET Estado = @estado WHERE Id = @id', { id, estado: aprobar ? 'Aprobada' : 'Rechazada' });

      // Tabla «Resultado según el tipo de solicitud» de CU-MCA-06.
      if (s.Tipo === 'Creacion') {
        await tx.consulta('UPDATE dbo.Cita SET Estado = @estado WHERE Id = @citaId', { citaId, estado: aprobar ? 'Confirmada' : 'Cancelada' });
      } else if (s.Tipo === 'Reprogramacion') {
        if (aprobar) {
          await tx.consulta(
            "UPDATE dbo.Cita SET Fecha = CAST(@fecha AS DATE), Hora = CAST(@hora AS TIME(0)), Estado = N'Confirmada' WHERE Id = @citaId",
            { citaId, fecha: fechaDeSql(s.FechaPropuesta), hora: horaDeSql(s.HoraPropuesta) },
          );
        } else {
          await tx.consulta("UPDATE dbo.Cita SET Estado = N'Confirmada' WHERE Id = @citaId", { citaId });
        }
      } else if (aprobar) {
        // Cancelación aprobada: sin motivo, porque no la decidió la administradora (MCA-14).
        await tx.consulta("UPDATE dbo.Cita SET Estado = N'Cancelada' WHERE Id = @citaId", { citaId });
      }
      return { ok: true, tipo: s.Tipo };
    });
  } catch (error) {
    if (error instanceof SinGuardar) return error.resultado;
    throw error;
  }
}
