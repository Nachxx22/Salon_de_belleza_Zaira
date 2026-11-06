// MCA-02 Reprogramar cita y MCA-03 Cancelar cita (Cliente), con código y teléfono — responsable: Persona A.
// El cliente solo puede solicitar cambios; la administradora los aprueba o rechaza (MCA-06).
import { useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const SOLICITUDES = {
  Creacion: 'Su cita está pendiente de aprobación por el salón.',
  Reprogramacion: 'Tiene una solicitud de reprogramación en proceso. Mientras tanto se conserva la fecha original.',
  Cancelacion: 'Tiene una solicitud de cancelación en proceso. Mientras tanto la cita sigue confirmada.',
};

function manana() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date());
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function GestionarCita() {
  const [acceso, setAcceso] = useState({ codigo: '', telefono: '' });
  const [cita, setCita] = useState(null);
  const [accion, setAccion] = useState(null); // null | 'reprogramar' | 'cancelar'
  const [fecha, setFecha] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [hora, setHora] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  // El teléfono va en el cuerpo de la solicitud, nunca en la URL.
  async function buscar(evento) {
    evento.preventDefault();
    setError('');
    setExito('');
    if (!acceso.codigo.trim() || !acceso.telefono.trim()) return setError('Ingrese el código de la cita y su teléfono.');
    try {
      setCita(await api.post('/publico/citas/consulta', acceso));
      setAccion(null);
    } catch (e) {
      setCita(null);
      setError(e.message);
    }
  }

  async function verHorarios() {
    setError('');
    setHora('');
    if (!fecha) return setError('Seleccione la nueva fecha.');
    try {
      setDisponibilidad(await api.post('/publico/citas/reprogramacion/horarios', { ...acceso, fecha }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function enviar(ruta, cuerpo, mensaje) {
    setError('');
    setEnviando(true);
    try {
      setCita(await api.post(ruta, { ...acceso, ...cuerpo }));
      setAccion(null);
      setDisponibilidad(null);
      setExito(mensaje);
    } catch (e) {
      setError(e.message);
      if (e.codigo === 'HORARIO_OCUPADO') await verHorarios();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h1>Mi cita</h1>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>

      <form className="tarjeta" onSubmit={buscar} noValidate>
        <Campo etiqueta="Código de la cita" obligatorio ayuda="Por ejemplo C-K7MQ2XPA." value={acceso.codigo}
          onChange={(e) => setAcceso({ ...acceso, codigo: e.target.value })} />
        <Campo etiqueta="Teléfono" obligatorio inputMode="numeric" value={acceso.telefono}
          onChange={(e) => setAcceso({ ...acceso, telefono: e.target.value })} />
        <Boton type="submit">Consultar mi cita</Boton>
      </form>

      {cita && (
        <section className="tarjeta">
          <h2>Cita {cita.codigo}</h2>
          <p>
            <strong>Estado:</strong> <span className="etiqueta">{cita.estado}</span><br />
            <strong>Fecha:</strong> {cita.fecha}, de {cita.hora} a {cita.horaFin}<br />
            <strong>Servicios:</strong> {cita.servicios.map((s) => s.nombre).join(', ')}
            {cita.esDomicilio && ' (a domicilio)'}
          </p>
          {cita.solicitudPendiente && <Mensaje tipo="aviso">{SOLICITUDES[cita.solicitudPendiente]}</Mensaje>}
          {!cita.puedeSolicitarCambios && !cita.solicitudPendiente && (
            <p className="texto-suave">Esta cita no admite cambios porque está {cita.estado}.</p>
          )}

          {cita.puedeSolicitarCambios && accion === null && (
            <p>
              <Boton variante="secundario" onClick={() => { setExito(''); setAccion('reprogramar'); }}>Solicitar reprogramación</Boton>{' '}
              <Boton variante="peligro" onClick={() => { setExito(''); setAccion('cancelar'); }}>Solicitar cancelación</Boton>
            </p>
          )}

          {accion === 'reprogramar' && (
            <fieldset>
              <legend>Nueva fecha y hora</legend>
              <p className="texto-suave">
                Los servicios no cambian. Si quiere otros servicios, solicite la cancelación y luego una cita nueva.
              </p>
              <Campo etiqueta="Nueva fecha" type="date" min={manana()} obligatorio value={fecha}
                onChange={(e) => { setFecha(e.target.value); setDisponibilidad(null); setHora(''); }} />
              <Boton variante="secundario" onClick={verHorarios}>Ver horarios disponibles</Boton>
              {disponibilidad && disponibilidad.horarios.length === 0 && <p>No hay espacios disponibles para esa fecha. Elija otra.</p>}
              {disponibilidad && disponibilidad.horarios.length > 0 && (
                <div className="campo" role="radiogroup" aria-label="Horarios disponibles">
                  {disponibilidad.horarios.map((h) => (
                    <label key={h} style={{ marginRight: 'var(--espacio)' }}>
                      <input type="radio" name="hora" value={h} checked={hora === h} onChange={() => setHora(h)} /> {h}
                    </label>
                  ))}
                </div>
              )}
              <p>
                <Boton disabled={enviando || !hora}
                  onClick={() => enviar('/publico/citas/reprogramacion', { fecha, hora },
                    'Su solicitud de reprogramación quedó pendiente de aprobación. Mientras tanto se conserva la fecha original.')}>
                  Enviar solicitud
                </Boton>{' '}
                <Boton variante="secundario" onClick={() => { setAccion(null); setDisponibilidad(null); setError(''); }}>Volver</Boton>
              </p>
            </fieldset>
          )}

          {accion === 'cancelar' && (
            <p>
              ¿Solicitar la cancelación de la cita {cita.codigo}? El salón debe aprobarla; mientras tanto la cita sigue confirmada.{' '}
              <Boton variante="peligro" disabled={enviando}
                onClick={() => enviar('/publico/citas/cancelacion', {}, 'Su solicitud de cancelación quedó pendiente de aprobación.')}>
                Sí, solicitar cancelación
              </Boton>{' '}
              <Boton variante="secundario" onClick={() => setAccion(null)}>No</Boton>
            </p>
          )}
        </section>
      )}
    </section>
  );
}
