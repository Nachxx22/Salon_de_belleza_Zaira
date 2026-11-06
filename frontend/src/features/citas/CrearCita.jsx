// MCA-12 Crear cita (Administrador) — responsable: Persona A.
// La disponibilidad la calcula el servidor; esta pantalla solo muestra las horas que devuelve.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

export default function CrearCita({ alTerminar, alCancelar }) {
  const [servicios, setServicios] = useState([]);
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState(null); // { existe, nombre, correoElectronico }
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [esDomicilio, setEsDomicilio] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fecha, setFecha] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [hora, setHora] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Solo servicios activos (MCA-12, restricción 6).
  useEffect(() => {
    api.get('/publico/servicios').then(setServicios).catch((e) => setError(e.message));
  }, []);

  const elegidos = servicios.filter((s) => seleccionados.includes(s.id));
  const duracionTotal = elegidos.reduce((total, s) => total + s.duracionMinutos, 0);
  const todosPermitenDomicilio = elegidos.length > 0 && elegidos.every((s) => s.permiteDomicilio);

  // Si cambian servicios o fecha, las horas mostradas ya no sirven.
  useEffect(() => {
    setDisponibilidad(null);
    setHora('');
  }, [fecha, seleccionados]);

  useEffect(() => {
    if (!todosPermitenDomicilio) setEsDomicilio(false);
  }, [todosPermitenDomicilio]);

  async function buscarCliente() {
    setError('');
    try {
      const encontrado = await api.get(`/admin/citas/clientes?telefono=${encodeURIComponent(telefono)}`);
      if (encontrado) {
        setCliente({ existe: true, ...encontrado });
        setNombre(encontrado.nombre);
        setCorreo(encontrado.correoElectronico ?? '');
      } else {
        setCliente({ existe: false });
        setNombre('');
        setCorreo('');
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function alternarServicio(id) {
    setSeleccionados((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
  }

  async function verHorarios() {
    setError('');
    if (seleccionados.length === 0) {
      setError('Debe seleccionar al menos un servicio.');
      return;
    }
    if (!fecha) {
      setError('Seleccione una fecha.');
      return;
    }
    try {
      setDisponibilidad(await api.get(`/admin/citas/disponibilidad?fecha=${fecha}&servicios=${seleccionados.join(',')}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setError('');
    if (!cliente) {
      setError('Busque primero al cliente por su número de teléfono.');
      return;
    }
    if (esDomicilio && !direccion.trim()) {
      setError('Ingrese la dirección para la cita a domicilio.');
      return;
    }
    if (!hora) {
      setError('Seleccione un horario disponible.');
      return;
    }
    setEnviando(true);
    try {
      const cita = await api.post('/admin/citas', {
        cliente: { telefono, nombre, correoElectronico: correo },
        servicios: seleccionados,
        fecha,
        hora,
        esDomicilio,
        direccion: esDomicilio ? direccion : null,
        observaciones: esDomicilio ? observaciones : null,
      });
      alTerminar(cita);
    } catch (e) {
      setError(e.message);
      // Si otra persona tomó el horario, se vuelven a pedir las horas (flujo alterno).
      if (e.codigo === 'HORARIO_OCUPADO') await verHorarios();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta">
      <h2>Crear cita</h2>
      <p className="texto-suave">La cita queda Confirmada y no genera una solicitud.</p>
      <Mensaje tipo="error">{error}</Mensaje>

      <form onSubmit={confirmar} noValidate>
        <fieldset>
          <legend>Cliente</legend>
          <Campo
            etiqueta="Teléfono"
            name="telefono"
            inputMode="numeric"
            obligatorio
            ayuda="8 dígitos, por ejemplo 8888-7777."
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value);
              setCliente(null);
            }}
          />
          <Boton variante="secundario" onClick={buscarCliente} disabled={!telefono.trim()}>Buscar cliente</Boton>
          {cliente?.existe && <p>Cliente registrado: <strong>{cliente.nombre}</strong></p>}
          {cliente && !cliente.existe && (
            <>
              <p className="texto-suave">No hay un cliente con ese teléfono: se registrará al confirmar la cita.</p>
              <Campo etiqueta="Nombre" name="nombre" obligatorio maxLength={150} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Campo etiqueta="Correo electrónico (opcional)" name="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Servicios</legend>
          {servicios.length === 0 && <p className="texto-suave">No hay servicios activos.</p>}
          {servicios.map((s) => (
            <div className="campo" key={s.id}>
              <label>
                <input type="checkbox" checked={seleccionados.includes(s.id)} onChange={() => alternarServicio(s.id)} />{' '}
                {s.nombre} ({s.duracionMinutos} min{s.permiteDomicilio ? ', a domicilio' : ''})
              </label>
            </div>
          ))}
          {elegidos.length > 0 && <p>Duración total: <strong>{duracionTotal} minutos</strong></p>}
        </fieldset>

        <fieldset>
          <legend>Modalidad</legend>
          <div className="campo">
            <label>
              <input type="checkbox" checked={esDomicilio} disabled={!todosPermitenDomicilio} onChange={(e) => setEsDomicilio(e.target.checked)} />{' '}
              Servicio a domicilio
            </label>
            {elegidos.length > 0 && !todosPermitenDomicilio && (
              <span className="campo__ayuda">No disponible: algún servicio seleccionado no se ofrece a domicilio.</span>
            )}
          </div>
          {esDomicilio && (
            <>
              <Campo etiqueta="Dirección" name="direccion" obligatorio maxLength={300} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={500} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Fecha y hora</legend>
          <Campo etiqueta="Fecha" name="fecha" type="date" obligatorio value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Boton variante="secundario" onClick={verHorarios}>Ver horarios disponibles</Boton>
          {disponibilidad && disponibilidad.horarios.length === 0 && (
            <p>No hay horarios disponibles para esa fecha. Seleccione otra fecha.</p>
          )}
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

        <Boton type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Confirmar cita'}</Boton>{' '}
        <Boton variante="secundario" onClick={alCancelar} disabled={enviando}>Cancelar</Boton>
      </form>
    </section>
  );
}
