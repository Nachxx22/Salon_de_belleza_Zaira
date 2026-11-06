// MCA-08 a MCA-11 Configuración de agenda — responsable: Persona A.
// Horarios regulares y bloqueos de agenda, mostrados por separado (MCA-09).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const VACIO = { tipo: '', diaSemana: '', fecha: '', horaInicio: '', horaFin: '' };

export default function AdminAgenda() {
  const [agenda, setAgenda] = useState(null);
  const [formulario, setFormulario] = useState(null); // { tipo, id?, ... }
  const [confirmar, setConfirmar] = useState(null); // { tipo, registro }
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar() {
    try {
      setAgenda(await api.get('/admin/agenda'));
    } catch (e) {
      setAgenda(null);
      setError(e.message || 'No se pudo consultar la configuración de agenda.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function limpiar() {
    setError('');
    setExito('');
  }

  function abrir(tipo, registro = null) {
    limpiar();
    setConfirmar(null);
    setFormulario(registro
      ? { tipo, id: registro.id, diaSemana: String(registro.diaSemana ?? ''), fecha: registro.fecha ?? '', horaInicio: registro.horaInicio, horaFin: registro.horaFin }
      : { ...VACIO, tipo });
  }

  async function guardar(evento) {
    evento.preventDefault();
    limpiar();
    const f = formulario;
    if (!f.tipo) {
      setError('Seleccione el tipo de configuración: horario regular o bloqueo de agenda.');
      return;
    }
    const faltan = [
      f.tipo === 'horario' && !f.diaSemana && 'día de la semana',
      f.tipo === 'bloqueo' && !f.fecha && 'fecha',
      !f.horaInicio && 'hora de inicio',
      !f.horaFin && 'hora de finalización',
    ].filter(Boolean);
    if (faltan.length) {
      setError(`Faltan datos obligatorios: ${faltan.join(', ')}.`);
      return;
    }
    if (f.horaFin <= f.horaInicio) {
      setError('El rango horario no es válido: la hora de finalización debe ser posterior a la hora de inicio.');
      return;
    }
    const ruta = f.tipo === 'horario' ? '/admin/agenda/horarios' : '/admin/agenda/bloqueos';
    const cuerpo = f.tipo === 'horario'
      ? { diaSemana: Number(f.diaSemana), horaInicio: f.horaInicio, horaFin: f.horaFin }
      : { fecha: f.fecha, horaInicio: f.horaInicio, horaFin: f.horaFin };
    setEnviando(true);
    try {
      if (f.id) await api.put(`${ruta}/${f.id}`, cuerpo);
      else await api.post(ruta, cuerpo);
      const nombre = f.tipo === 'horario' ? 'Horario regular' : 'Bloqueo de agenda';
      setExito(`${nombre} ${f.id ? 'actualizado' : 'registrado'}. Las citas existentes no cambiaron.`);
      setFormulario(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  // MCA-11: con confirmación.
  async function eliminar() {
    limpiar();
    const { tipo, registro } = confirmar;
    try {
      await api.delete(`/admin/agenda/${tipo === 'horario' ? 'horarios' : 'bloqueos'}/${registro.id}`);
      setExito(tipo === 'horario'
        ? 'Horario regular eliminado. Las citas existentes no cambiaron.'
        : 'Bloqueo eliminado. El período vuelve a depender del horario regular y de las demás citas.');
      setConfirmar(null);
      await cargar();
    } catch (e) {
      setError(e.message);
      setConfirmar(null);
    }
  }

  const avisos = (
    <>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
    </>
  );

  if (formulario) {
    const f = formulario;
    const cambiar = (campo) => (e) => setFormulario({ ...f, [campo]: e.target.value });
    return (
      <section className="tarjeta">
        <h2>{f.id ? 'Modificar' : 'Registrar'} configuración de agenda</h2>
        {avisos}
        <form onSubmit={guardar} noValidate>
          {!f.id && (
            <fieldset>
              <legend>Tipo de configuración</legend>
              <label><input type="radio" name="tipo" checked={f.tipo === 'horario'} onChange={() => setFormulario({ ...f, tipo: 'horario' })} /> Horario regular</label>{' '}
              <label><input type="radio" name="tipo" checked={f.tipo === 'bloqueo'} onChange={() => setFormulario({ ...f, tipo: 'bloqueo' })} /> Bloqueo de agenda</label>
            </fieldset>
          )}
          {f.tipo === 'horario' && (
            <div className="campo">
              <label htmlFor="dia-semana">Día de la semana <span className="obligatorio" aria-hidden="true">*</span></label>
              <select id="dia-semana" value={f.diaSemana} onChange={cambiar('diaSemana')}>
                <option value="">Seleccione</option>
                {DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </div>
          )}
          {f.tipo === 'bloqueo' && <Campo etiqueta="Fecha" type="date" obligatorio value={f.fecha} onChange={cambiar('fecha')} />}
          {f.tipo && (
            <>
              <Campo etiqueta="Hora de inicio" type="time" obligatorio value={f.horaInicio} onChange={cambiar('horaInicio')} />
              <Campo etiqueta="Hora de finalización" type="time" obligatorio value={f.horaFin} onChange={cambiar('horaFin')} />
            </>
          )}
          <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>{' '}
          <Boton variante="secundario" disabled={enviando} onClick={() => { setFormulario(null); setError(''); }}>Cancelar</Boton>
        </form>
      </section>
    );
  }

  const acciones = (tipo, registro) => (confirmar?.registro.id === registro.id && confirmar.tipo === tipo ? (
    <span>
      ¿Eliminar? <Boton variante="peligro" onClick={eliminar}>Sí, eliminar</Boton>{' '}
      <Boton variante="secundario" onClick={() => setConfirmar(null)}>No</Boton>
    </span>
  ) : (
    <span>
      <Boton variante="secundario" onClick={() => abrir(tipo, registro)}>Modificar</Boton>{' '}
      <Boton variante="peligro" onClick={() => { limpiar(); setConfirmar({ tipo, registro }); }}>Eliminar</Boton>
    </span>
  ));

  const sinNada = agenda && agenda.horarios.length === 0 && agenda.bloqueos.length === 0;

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Configuración de agenda</h1>
        <Boton onClick={() => abrir('')}>Registrar configuración</Boton>
      </div>
      {avisos}
      {sinNada && <p>Todavía no existe una configuración de agenda registrada.</p>}

      {agenda && !sinNada && (
        <>
          <h2>Horarios regulares</h2>
          {agenda.horarios.length === 0 ? <p className="texto-suave">No existen horarios regulares registrados.</p> : (
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
              <thead><tr><th scope="col">Día</th><th scope="col">Inicio</th><th scope="col">Fin</th><th scope="col">Acciones</th></tr></thead>
              <tbody>
                {agenda.horarios.map((h) => (
                  <tr key={h.id}>
                    <td>{DIAS[h.diaSemana]}</td><td>{h.horaInicio}</td><td>{h.horaFin}</td>
                    <td>{acciones('horario', h)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          <h2>Bloqueos de agenda</h2>
          {agenda.bloqueos.length === 0 ? <p className="texto-suave">No existen bloqueos de agenda registrados.</p> : (
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Inicio</th><th scope="col">Fin</th><th scope="col">Acciones</th></tr></thead>
              <tbody>
                {agenda.bloqueos.map((b) => (
                  <tr key={b.id}>
                    <td>{b.fecha}</td><td>{b.horaInicio}</td><td>{b.horaFin}</td>
                    <td>{acciones('bloqueo', b)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </>
      )}
    </section>
  );
}
