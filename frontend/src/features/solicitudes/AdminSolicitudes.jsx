// MCA-05 Consultar solicitudes pendientes y MCA-06 Procesar solicitud pendiente — responsable: Persona A.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Mensaje } from '../../shared/ui/componentes.jsx';

const TIPOS = { Creacion: 'Creación', Reprogramacion: 'Reprogramación', Cancelacion: 'Cancelación' };
// Qué pasa con la cita según la decisión (tabla de resultados de CU-MCA-06).
const EFECTO = {
  Creacion: { aprobar: 'la cita pasará a Confirmada', rechazar: 'la cita pasará a Cancelada y el horario se libera' },
  Reprogramacion: {
    aprobar: 'la cita tomará la nueva fecha y hora y quedará Confirmada; se libera el período original',
    rechazar: 'la cita vuelve a Confirmada con su fecha original; se libera el período propuesto',
  },
  Cancelacion: { aprobar: 'la cita pasará a Cancelada y se libera su período', rechazar: 'la cita sigue Confirmada' },
};
const verTelefono = (t) => t.replace(/^(\d{4})(\d{4})$/, '$1-$2');

function Periodo({ solicitud }) {
  const { cita, propuesta } = solicitud;
  if (solicitud.tipo === 'Reprogramacion') {
    return <>Original: {cita.fecha} {cita.hora} → <strong>Propuesta: {propuesta.fecha} {propuesta.hora}</strong></>;
  }
  return <>{cita.fecha} {cita.hora}</>;
}

export default function AdminSolicitudes() {
  const [solicitudes, setSolicitudes] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [decision, setDecision] = useState(null); // 'aprobar' | 'rechazar'
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar() {
    try {
      setSolicitudes(await api.get('/admin/solicitudes'));
    } catch (e) {
      setSolicitudes(null);
      setError(e.message || 'No fue posible consultar el listado de solicitudes.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function abrir(id) {
    setError('');
    setExito('');
    setDecision(null);
    try {
      setDetalle(await api.get(`/admin/solicitudes/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function procesar() {
    setError('');
    setEnviando(true);
    try {
      await api.patch(`/admin/solicitudes/${detalle.id}/${decision}`);
      setExito(`Solicitud de ${TIPOS[detalle.tipo].toLowerCase()} de la cita ${detalle.cita.codigo} ${decision === 'aprobar' ? 'aprobada' : 'rechazada'}.`);
      setDetalle(null);
      setDecision(null);
      await cargar();
    } catch (e) {
      setError(e.message);
      setDecision(null);
      // Si otra pestaña ya la procesó, se actualiza la información (flujo alterno de MCA-05).
      if (e.codigo === 'SOLICITUD_YA_PROCESADA') {
        setDetalle(null);
        await cargar();
      }
    } finally {
      setEnviando(false);
    }
  }

  if (detalle) {
    const { cita, cliente } = detalle;
    return (
      <section className="tarjeta">
        <h2>Solicitud de {TIPOS[detalle.tipo].toLowerCase()} · cita {cita.codigo}</h2>
        <Mensaje tipo="error">{error}</Mensaje>
        <p>
          <strong>Cliente:</strong> {cliente.nombre}, {verTelefono(cliente.telefono)}{cliente.correoElectronico && `, ${cliente.correoElectronico}`}<br />
          <strong>Solicitada:</strong> {detalle.fechaSolicitud}<br />
          <strong>Fecha y hora:</strong> <Periodo solicitud={detalle} /> ({cita.duracionMinutos} min)<br />
          <strong>Servicios:</strong> {cita.servicios}<br />
          <strong>Estado de la cita:</strong> <span className="etiqueta">{cita.estado}</span>
          {cita.esDomicilio && <><br /><strong>A domicilio:</strong> {cita.direccion}{cita.observaciones && ` · ${cita.observaciones}`}</>}
        </p>
        {decision ? (
          <p>
            ¿{decision === 'aprobar' ? 'Aprobar' : 'Rechazar'} la solicitud? Al confirmar, {EFECTO[detalle.tipo][decision]}.{' '}
            <Boton variante={decision === 'aprobar' ? 'primario' : 'peligro'} onClick={procesar} disabled={enviando}>
              {enviando ? 'Procesando…' : `Sí, ${decision}`}
            </Boton>{' '}
            <Boton variante="secundario" onClick={() => setDecision(null)} disabled={enviando}>No</Boton>
          </p>
        ) : (
          <p>
            <Boton onClick={() => setDecision('aprobar')}>Aprobar</Boton>{' '}
            <Boton variante="peligro" onClick={() => setDecision('rechazar')}>Rechazar</Boton>{' '}
            <Boton variante="secundario" onClick={() => setDetalle(null)}>Volver al listado</Boton>
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Solicitudes pendientes</h1>
        <Boton variante="secundario" onClick={() => { setExito(''); setError(''); cargar(); }}>Actualizar</Boton>
      </div>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
      {solicitudes && solicitudes.length === 0 && <p>No existen solicitudes pendientes por procesar.</p>}
      {solicitudes && solicitudes.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Cita</th>
              <th scope="col">Cliente</th>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Solicitada</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                <td><span className="etiqueta">{TIPOS[s.tipo]}</span></td>
                <td>{s.cita.codigo}</td>
                <td>{s.cliente.nombre}<br /><span className="texto-suave">{verTelefono(s.cliente.telefono)}</span></td>
                <td><Periodo solicitud={s} /></td>
                <td>{s.fechaSolicitud}</td>
                <td><Boton variante="secundario" onClick={() => abrir(s.id)}>Ver y procesar</Boton></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
