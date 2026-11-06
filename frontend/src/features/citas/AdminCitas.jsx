// MCA-04 Consultar citas y MCA-12 Crear cita (Administrador) — responsable: Persona A.
// Pendientes en esta pantalla: MCA-07 completar, MCA-13 reprogramar y MCA-14 cancelar.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';
import CrearCita from './CrearCita.jsx';

const ESTADOS = ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'];
const FILTROS_VACIOS = { fecha: '', estado: '', cliente: '' };

function DetalleCita({ cita, alCerrar }) {
  return (
    <section className="tarjeta">
      <h2>Cita {cita.codigo}</h2>
      <p>
        <strong>Estado:</strong> <span className="etiqueta">{cita.estado}</span>
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
      <Boton variante="secundario" onClick={alCerrar}>Volver al listado</Boton>
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

  if (detalle) return <DetalleCita cita={detalle} alCerrar={() => setDetalle(null)} />;

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
