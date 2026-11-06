// Capa de datos del módulo Citas (dueño: Persona A).
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
// Las reglas (disponibilidad, validaciones) están en citas.logica.js.
import { consulta, enTransaccion } from '../../shared/db.js';
import { fechaDeSql, horaDeSql } from '../../shared/fechas.js';
import * as clientes from '../clientes/clientes.datos.js';

function ejecutar(tx) {
  return tx ? tx.consulta : consulta;
}

// Todo lo que ocupa o limita la agenda de un día (MCA-12, restricción 11):
// horarios regulares, bloqueos, citas Pendientes o Confirmadas y los períodos
// reservados por solicitudes de reprogramación Pendientes.
// Las horas se devuelven como 'HH:mm'.
export async function leerAgendaDelDia(fecha, diaSemana, tx) {
  const correr = ejecutar(tx);
  const horarios = await correr(
    'SELECT HoraInicio, HoraFin FROM dbo.Horario WHERE DiaSemana = @diaSemana ORDER BY HoraInicio',
    { diaSemana },
  );
  const bloqueos = await correr(
    'SELECT HoraInicio, HoraFin FROM dbo.BloqueoAgenda WHERE Fecha = CAST(@fecha AS DATE)',
    { fecha },
  );
  const ocupados = await correr(
    `SELECT c.Hora AS Inicio, SUM(cs.DuracionAplicadaMinutos) AS Duracion
     FROM dbo.Cita c
     JOIN dbo.CitaServicio cs ON cs.CitaId = c.Id
     WHERE c.Fecha = CAST(@fecha AS DATE) AND c.Estado IN (N'Pendiente', N'Confirmada')
     GROUP BY c.Id, c.Hora
     UNION ALL
     SELECT s.HoraPropuesta, SUM(cs.DuracionAplicadaMinutos)
     FROM dbo.SolicitudCita s
     JOIN dbo.CitaServicio cs ON cs.CitaId = s.CitaId
     WHERE s.Estado = N'Pendiente' AND s.Tipo = N'Reprogramacion' AND s.FechaPropuesta = CAST(@fecha AS DATE)
     GROUP BY s.Id, s.HoraPropuesta`,
    { fecha },
  );
  const tramo = (f) => ({ inicio: horaDeSql(f.HoraInicio), fin: horaDeSql(f.HoraFin) });
  return {
    horarios: horarios.filas.map(tramo),
    bloqueos: bloqueos.filas.map(tramo),
    ocupados: ocupados.filas.map((f) => ({ inicio: horaDeSql(f.Inicio), duracionMinutos: f.Duracion })),
  };
}

// MCA-12: registra cliente (si no existe), cita Confirmada y sus servicios en una
// sola transacción. Toma el bloqueo de aplicación 'agenda' (D-016) y vuelve a
// leer la agenda; `estaDisponible(agenda)` es la regla de citas.logica.js.
// Devuelve { conflicto: true } si el horario ya no está libre.
export async function registrarCita(cita, estaDisponible) {
  return enTransaccion(async (tx) => {
    await tx.consulta(
      `DECLARE @resultado INT;
       EXEC @resultado = sp_getapplock @Resource = N'agenda', @LockMode = N'Exclusive',
            @LockOwner = N'Transaction', @LockTimeout = 10000;
       IF @resultado < 0 THROW 51000, N'La agenda está ocupada en este momento. Intente de nuevo.', 1;`,
    );

    const agenda = await leerAgendaDelDia(cita.fecha, cita.diaSemana, tx);
    if (!estaDisponible(agenda)) return { conflicto: true };

    let cliente = await clientes.buscarPorTelefono(cita.cliente.telefono, tx);
    const clienteNuevo = !cliente;
    if (!cliente) cliente = await clientes.crear(cita.cliente, tx);

    const { filas } = await tx.consulta(
      `INSERT INTO dbo.Cita (Codigo, ClienteId, Fecha, Hora, Estado, EsDomicilio, Direccion, Observaciones)
       OUTPUT INSERTED.Id
       VALUES (@codigo, @clienteId, CAST(@fecha AS DATE), CAST(@hora AS TIME(0)), @estado,
               @esDomicilio, @direccion, @observaciones)`,
      {
        codigo: cita.codigo,
        clienteId: cliente.id,
        fecha: cita.fecha,
        hora: cita.hora,
        estado: cita.estado,
        esDomicilio: cita.esDomicilio,
        direccion: cita.direccion,
        observaciones: cita.observaciones,
      },
    );
    const id = filas[0].Id;

    // La duración se copia del servicio: un cambio posterior no altera la cita (MS-03).
    for (const servicio of cita.servicios) {
      await tx.consulta(
        `INSERT INTO dbo.CitaServicio (CitaId, ServicioId, DuracionAplicadaMinutos)
         VALUES (@citaId, @servicioId, @duracion)`,
        { citaId: id, servicioId: servicio.id, duracion: servicio.duracionMinutos },
      );
    }
    return { conflicto: false, id, clienteNuevo };
  });
}

// Escapa los comodines de LIKE para buscar el texto tal como se escribió.
function patronContiene(texto) {
  return `%${texto.replace(/[\\%_[]/g, (c) => `\\${c}`)}%`;
}

// MCA-04: listado con filtros opcionales por fecha, estado y cliente (nombre o teléfono).
export async function listar({ fecha = null, estado = null, cliente = null } = {}) {
  const { filas } = await consulta(
    `SELECT c.Id, c.Codigo, c.Fecha, c.Hora, c.Estado, c.EsDomicilio,
            cl.Nombre AS ClienteNombre, cl.Telefono AS ClienteTelefono,
            (SELECT SUM(cs.DuracionAplicadaMinutos) FROM dbo.CitaServicio cs WHERE cs.CitaId = c.Id) AS Duracion,
            (SELECT STRING_AGG(s.Nombre, N', ') FROM dbo.CitaServicio cs
               JOIN dbo.Servicio s ON s.Id = cs.ServicioId WHERE cs.CitaId = c.Id) AS Servicios
     FROM dbo.Cita c
     JOIN dbo.Cliente cl ON cl.Id = c.ClienteId
     WHERE (@fecha IS NULL OR c.Fecha = CAST(@fecha AS DATE))
       AND (@estado IS NULL OR c.Estado = @estado)
       AND (@patron IS NULL OR cl.Nombre LIKE @patron ESCAPE N'\\' OR cl.Telefono LIKE @patron ESCAPE N'\\')
     ORDER BY c.Fecha, c.Hora`,
    { fecha, estado, patron: cliente ? patronContiene(cliente) : null },
  );
  return filas.map((f) => ({
    id: f.Id,
    codigo: f.Codigo,
    fecha: fechaDeSql(f.Fecha),
    hora: horaDeSql(f.Hora),
    duracionMinutos: f.Duracion ?? 0,
    estado: f.Estado,
    esDomicilio: Boolean(f.EsDomicilio),
    cliente: { nombre: f.ClienteNombre, telefono: f.ClienteTelefono },
    servicios: f.Servicios ?? '',
  }));
}

// MCA-04: detalle de una cita, o null si no existe.
export async function obtenerDetalle(id) {
  const { filas } = await consulta(
    `SELECT c.Id, c.Codigo, c.Fecha, c.Hora, c.Estado, c.EsDomicilio, c.Direccion, c.Observaciones,
            c.MotivoCancelacion, cl.Id AS ClienteId, cl.Nombre, cl.Telefono, cl.CorreoElectronico
     FROM dbo.Cita c
     JOIN dbo.Cliente cl ON cl.Id = c.ClienteId
     WHERE c.Id = @id`,
    { id },
  );
  const f = filas[0];
  if (!f) return null;
  const servicios = await consulta(
    `SELECT s.Id, s.Nombre, s.Estado, cs.DuracionAplicadaMinutos
     FROM dbo.CitaServicio cs
     JOIN dbo.Servicio s ON s.Id = cs.ServicioId
     WHERE cs.CitaId = @id
     ORDER BY s.Nombre`,
    { id },
  );
  return {
    id: f.Id,
    codigo: f.Codigo,
    fecha: fechaDeSql(f.Fecha),
    hora: horaDeSql(f.Hora),
    estado: f.Estado,
    esDomicilio: Boolean(f.EsDomicilio),
    direccion: f.Direccion,
    observaciones: f.Observaciones,
    motivoCancelacion: f.MotivoCancelacion,
    cliente: clientes.aCliente({ Id: f.ClienteId, Nombre: f.Nombre, Telefono: f.Telefono, CorreoElectronico: f.CorreoElectronico }),
    servicios: servicios.filas.map((s) => ({
      id: s.Id,
      nombre: s.Nombre,
      estado: s.Estado,
      duracionAplicadaMinutos: s.DuracionAplicadaMinutos,
    })),
  };
}
