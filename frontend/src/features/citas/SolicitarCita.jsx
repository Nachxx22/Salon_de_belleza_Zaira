// MCA-01 Crear cita (Cliente) — responsable: Persona A.
// Sin cuenta: el cliente elige servicios, fecha (desde mañana) y hora libre, y deja
// sus datos. La cita queda Pendiente hasta que la administradora la apruebe.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

// Fecha de mañana en hora de Costa Rica (el servidor lo vuelve a validar).
function manana() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date());
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function SolicitarCita() {
  const [servicios, setServicios] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [esDomicilio, setEsDomicilio] = useState(false);
  const [fecha, setFecha] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [hora, setHora] = useState('');
  const [datos, setDatos] = useState({ nombre: '', telefono: '', correoElectronico: '', direccion: '', observaciones: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [registrada, setRegistrada] = useState(null);

  useEffect(() => {
    api.get('/publico/servicios').then(setServicios).catch((e) => setError(e.message || 'Los servicios no pudieron cargarse.'));
  }, []);

  const elegidos = servicios.filter((s) => seleccionados.includes(s.id));
  const duracion = elegidos.reduce((total, s) => total + s.duracionMinutos, 0);
  const permiteDomicilio = elegidos.length > 0 && elegidos.every((s) => s.permiteDomicilio);

  useEffect(() => {
    setDisponibilidad(null);
    setHora('');
  }, [fecha, seleccionados]);

  useEffect(() => {
    if (!permiteDomicilio) setEsDomicilio(false);
  }, [permiteDomicilio]);

  function alternar(id) {
    setError('');
    setSeleccionados((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
  }

  async function verHorarios() {
    setError('');
    if (seleccionados.length === 0) return setError('Seleccione al menos un servicio.');
    if (!fecha) return setError('Seleccione una fecha.');
    try {
      setDisponibilidad(await api.get(`/publico/citas/disponibilidad?fecha=${fecha}&servicios=${seleccionados.join(',')}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setError('');
    if (seleccionados.length === 0) return setError('Seleccione al menos un servicio.');
    if (!hora) return setError('Seleccione un horario disponible.');
    if (!datos.nombre.trim() || !datos.telefono.trim()) return setError('Ingrese su nombre y su número de teléfono.');
    if (esDomicilio && !datos.direccion.trim()) return setError('Ingrese la dirección para el servicio a domicilio.');
    setEnviando(true);
    try {
      const cita = await api.post('/publico/citas', {
        cliente: { nombre: datos.nombre, telefono: datos.telefono, correoElectronico: datos.correoElectronico },
        servicios: seleccionados,
        fecha,
        hora,
        esDomicilio,
        direccion: esDomicilio ? datos.direccion : null,
        observaciones: esDomicilio ? datos.observaciones : null,
      });
      setRegistrada(cita);
    } catch (e) {
      setError(e.message);
      if (e.codigo === 'HORARIO_OCUPADO') await verHorarios();
    } finally {
      setEnviando(false);
    }
  }

  if (registrada) {
    return (
      <section className="tarjeta">
        <h1>Solicitud registrada</h1>
        <Mensaje tipo="exito">Su cita quedó pendiente de aprobación por el salón.</Mensaje>
        <p>Código de su cita: <strong style={{ fontSize: '1.4em' }}>{registrada.codigo}</strong></p>
        <p>
          {registrada.fecha}, de {registrada.hora} a {registrada.horaFin} · {registrada.servicios.map((s) => s.nombre).join(', ')}
        </p>
        <p className="texto-suave">
          Guarde este código: con él y su teléfono puede consultar, reprogramar o cancelar su cita en «Mi cita».
        </p>
        <Link to="/citas/gestionar">Ir a Mi cita</Link>
      </section>
    );
  }

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  return (
    <section>
      <h1>Solicitar una cita</h1>
      <p className="texto-suave">No necesita una cuenta. La cita queda pendiente hasta que el salón la apruebe.</p>
      <Mensaje tipo="error">{error}</Mensaje>
      <form className="tarjeta" onSubmit={confirmar} noValidate>
        <fieldset>
          <legend>1. Servicios</legend>
          {servicios.length === 0 && <p className="texto-suave">No hay servicios disponibles por el momento.</p>}
          {servicios.map((s) => (
            <div className="campo" key={s.id}>
              <label>
                <input type="checkbox" checked={seleccionados.includes(s.id)} onChange={() => alternar(s.id)} />{' '}
                {s.nombre} · {s.duracionMinutos} min{s.permiteDomicilio ? ' · a domicilio' : ''}
              </label>
            </div>
          ))}
          {elegidos.length > 0 && <p>Duración total: <strong>{duracion} minutos</strong></p>}
          <div className="campo">
            <label>
              <input type="checkbox" checked={esDomicilio} disabled={!permiteDomicilio} onChange={(e) => setEsDomicilio(e.target.checked)} />{' '}
              Quiero el servicio a domicilio
            </label>
            {elegidos.length > 0 && !permiteDomicilio && (
              <span className="campo__ayuda">No disponible: algún servicio elegido no se ofrece a domicilio.</span>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>2. Fecha y hora</legend>
          <Campo etiqueta="Fecha" type="date" min={manana()} obligatorio ayuda="Las citas se solicitan con al menos un día de anticipación."
            value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Boton variante="secundario" onClick={verHorarios}>Ver horarios disponibles</Boton>
          {disponibilidad && disponibilidad.horarios.length === 0 && <p>No hay espacios disponibles para esa fecha. Elija otra fecha.</p>}
          {disponibilidad && disponibilidad.horarios.length > 0 && (
            <div className="campo" role="radiogroup" aria-label="Horarios disponibles">
              {disponibilidad.horarios.map((h) => (
                <label key={h} style={{ marginRight: 'var(--espacio)' }}>
                  <input type="radio" name="hora" value={h} checked={hora === h} onChange={() => setHora(h)} /> {h}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>3. Sus datos</legend>
          <Campo etiqueta="Nombre" obligatorio maxLength={150} value={datos.nombre} onChange={cambiar('nombre')} />
          <Campo etiqueta="Teléfono" obligatorio inputMode="numeric" ayuda="8 dígitos, por ejemplo 8888-7777." value={datos.telefono} onChange={cambiar('telefono')} />
          <Campo etiqueta="Correo electrónico (opcional)" type="email" maxLength={254} value={datos.correoElectronico} onChange={cambiar('correoElectronico')} />
          {esDomicilio && (
            <>
              <Campo etiqueta="Dirección" obligatorio maxLength={300} value={datos.direccion} onChange={cambiar('direccion')} />
              <Campo etiqueta="Observaciones (opcional)" maxLength={500} value={datos.observaciones} onChange={cambiar('observaciones')} />
            </>
          )}
        </fieldset>

        <Boton type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar cita'}</Boton>
      </form>
    </section>
  );
}
