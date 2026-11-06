// MCA-04 Consultar citas y MCA-12 Crear cita (Administrador) — responsable: Persona A.
// También MCA-13 Reprogramar y MCA-14 Cancelar (Administrador). Pendiente: MCA-07 completar.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';
import CrearCita from './CrearCita.jsx';

const ESTADOS = ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'];
const FILTROS_VACIOS = { fecha: '', estado: '', cliente: '' };

// MCA-04 detalle, MCA-13 Reprogramar y MCA-14 Cancelar (Administrador).
// Solo citas Confirmadas sin una solicitud pendiente; si la hay, primero se procesa (MCA-06).
function DetalleCita({ cita, alCambiar, alCerrar }) {
  const [accion, setAccion] = useState(null); // null | 'reprogramar' | 'cancelar' | 'confirmarCancelacion'
  const [fecha, setFecha] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiable = cita.estado === 'Confirmada' && !cita.tieneSolicitudPendiente;

  function cerrarAccion() {
    setAccion(null);
    setDisponibilidad(null);
    setHora('');
    setFecha('');
    setMotivo('');
    setError('');
  }

  async function verHorarios() {
    setError('');
    setHora('');
    if (!fecha) {
      setError('Seleccione la nueva fecha.');
      return;
    }
    try {
      setDisponibilidad(await api.get(`/admin/citas/${cita.id}/disponibilidad?fecha=${fecha}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function reprogramar() {
    setError('');
    if (!hora) {
      setError('Seleccione un horario disponible.');
      return;
    }
    setEnviando(true);
    try {
      const actualizada = await api.patch(`/admin/citas/${cita.id}/reprogramar`, { fecha, hora });
      cerrarAccion();
      setExito(`Cita reprogramada para el ${actualizada.fecha} a las ${actualizada.hora}. Sigue Confirmada.`);
      alCambiar(actualizada);
    } catch (e) {
      setError(e.message);
      if (e.codigo === 'HORARIO_OCUPADO') await verHorarios();
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setError('');
    setEnviando(true);
    try {
      const actualizada = await api.patch(`/admin/citas/${cita.id}/cancelar`, { motivo });
      cerrarAccion();
      setExito('Cita cancelada. El período quedó libre; la cita sigue en el historial.');
      alCambiar(actualizada);
    } catch (e) {
      setError(e.message);
      setAccion('cancelar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta">
      <h2>Cita {cita.codigo}</h2>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
      <p>
        <strong>Estado:</strong> <span className="etiqueta">{cita.estado}</span>
        {cita.tieneSolicitudPendiente && <span className="texto-suave"> · tiene una solicitud pendiente</span>}
        <br />
        <strong>Fecha:</strong> {cita.fecha}, de {cita.hora} a {cita.horaFin} ({cita.duracionMinutos} min)
        <br />
        <strong>Cliente:</strong> {cita.cliente.nombre}, {cita.cliente.telefono.replace(/^(\d{4})(\d{4})$/, '$1-$2')}
        {cita.cliente.correoElectronico && `, ${cita.cliente.correoElectronico}`}
      </p>
      <p><strong>Servicios:</strong></p>
      <ul>
        {cita.servicios.map((s) => (
          <li key={s.id}>
            {s.nombre}: {s.duracionAplicadaMinutos} min{s.estado === 'Desactivado' ? ' (servicio desactivado)' : ''}
          </li>
        ))}
      </ul>
      {cita.esDomicilio && (
        <p>
          <strong>A domicilio:</strong> {cita.direccion}
          {cita.observaciones && <><br /><strong>Observaciones:</strong> {cita.observaciones}</>}
        </p>
      )}
      {cita.motivoCancelacion && <p><strong>Motivo de cancelación:</strong> {cita.motivoCancelacion}</p>}

      {cita.estado === 'Confirmada' && cita.tieneSolicitudPendiente && accion === null && (
        <p className="texto-suave">Para reprogramar o cancelar, primero procese la solicitud pendiente de esta cita.</p>
      )}

      {cambiable && accion === null && (
        <p>
          <Boton variante="secundario" onClick={() => { setExito(''); setAccion('reprogramar'); }}>Reprogramar</Boton>{' '}
          <Boton variante="peligro" onClick={() => { setExito(''); setAccion('cancelar'); }}>Cancelar cita</Boton>
        </p>
      )}

      {accion === 'reprogramar' && (
        <fieldset>
          <legend>Reprogramar (los servicios no cambian)</legend>
          <Campo etiqueta="Nueva fecha" type="date" obligatorio value={fecha}
            onChange={(e) => { setFecha(e.target.value); setDisponibilidad(null); setHora(''); }} />
          <Boton variante="secundario" onClick={verHorarios}>Ver horarios disponibles</Boton>
          {disponibilidad && disponibilidad.horarios.length === 0 && (
            <p>No hay espacios disponibles para esa fecha. Seleccione otra fecha.</p>
          )}
          {disponibilidad && disponibilidad.horarios.length > 0 && (
            <div className="campo" role="radiogroup" aria-label="Horarios disponibles">
              {disponibilidad.horarios.map((h) => (
                <label key={h} style={{ marginRight: 'var(--espacio)' }}>
                  <input type="radio" name="hora-nueva" value={h} checked={hora === h} onChange={() => setHora(h)} /> {h}
                </label>
              ))}
            </div>
          )}
          <p>
            <Boton onClick={reprogramar} disabled={enviando || !hora}>{enviando ? 'Guardando…' : 'Confirmar reprogramación'}</Boton>{' '}
            <Boton variante="secundario" onClick={cerrarAccion} disabled={enviando}>Volver</Boton>
          </p>
        </fieldset>
      )}

      {accion === 'cancelar' && (
        <div>
          <div className="campo">
            <label htmlFor="motivo-cancelacion">Motivo de la cancelación <span className="obligatorio" aria-hidden="true">*</span></label>
            <textarea id="motivo-cancelacion" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <Boton variante="peligro" onClick={() => {
            if (!motivo.trim()) { setError('El motivo de cancelación es obligatorio.'); return; }
            setError('');
            setAccion('confirmarCancelacion');
          }}>Continuar</Boton>{' '}
          <Boton variante="secundario" onClick={cerrarAccion}>Volver</Boton>
        </div>
      )}

      {accion === 'confirmarCancelacion' && (
        <p>
          ¿Cancelar la cita {cita.codigo}? El período quedará libre.{' '}
          <Boton variante="peligro" onClick={cancelar} disabled={enviando}>Sí, cancelar cita</Boton>{' '}
          <Boton variante="secundario" onClick={() => setAccion('cancelar')} disabled={enviando}>No</Boton>
        </p>
      )}

      <p><Boton variante="secundario" onClick={alCerrar}>Volver al listado</Boton></p>
    </section>
  );
}

export default function AdminCitas() {
  const [citas, setCitas] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [hayFiltros, setHayFiltros] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar(conFiltros = filtros) {
    setError('');
    const parametros = new URLSearchParams(Object.entries(conFiltros).filter(([, v]) => v.trim() !== ''));
    try {
      setCitas(await api.get(`/admin/citas${parametros.size ? `?${parametros}` : ''}`));
      setHayFiltros(parametros.size > 0);
    } catch (e) {
      setCitas(null);
      setError(e.message || 'No se pudo consultar las citas.');
    }
  }

  useEffect(() => {
    cargar(FILTROS_VACIOS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verDetalle(id) {
    setError('');
    try {
      setDetalle(await api.get(`/admin/citas/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    cargar(FILTROS_VACIOS);
  }

  if (creando) {
    return (
      <CrearCita
        alCancelar={() => setCreando(false)}
        alTerminar={(cita) => {
          setCreando(false);
          setExito(`Cita ${cita.codigo} registrada como Confirmada para el ${cita.fecha} a las ${cita.hora}.`);
          cargar();
        }}
      />
    );
  }

  if (detalle) {
    return <DetalleCita cita={detalle} alCambiar={(c) => { setDetalle(c); cargar(); }} alCerrar={() => setDetalle(null)} />;
  }

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Citas</h1>
        <Boton onClick={() => { setExito(''); setCreando(true); }}>Crear cita</Boton>
      </div>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>

      <form
        className="tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          cargar();
        }}
      >
        <Campo etiqueta="Fecha" type="date" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} />
        <div className="campo">
          <label htmlFor="filtro-estado">Estado</label>
          <select id="filtro-estado" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
          </select>
        </div>
        <Campo
          etiqueta="Cliente"
          ayuda="Nombre o teléfono."
          value={filtros.cliente}
          onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
        />
        <Boton type="submit">Buscar</Boton>{' '}
        <Boton variante="secundario" onClick={limpiarFiltros}>Quitar filtros</Boton>
      </form>

      {citas && citas.length === 0 && (
        <p>{hayFiltros ? 'No se encontraron citas con esos filtros.' : 'Todavía no existen citas registradas.'}</p>
      )}

      {citas && citas.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Fecha</th>
              <th scope="col">Hora</th>
              <th scope="col">Cliente</th>
              <th scope="col">Servicios</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id}>
                <td>{c.codigo}</td>
                <td>{c.fecha}</td>
                <td>{c.hora} – {c.horaFin}</td>
                <td>{c.cliente.nombre}</td>
                <td>{c.servicios}{c.esDomicilio ? ' (a domicilio)' : ''}</td>
                <td><span className="etiqueta">{c.estado}</span></td>
                <td><Boton variante="secundario" onClick={() => verDetalle(c.id)}>Ver detalle</Boton></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
