// Aviso interno de solicitudes nuevas (MCA-05, criterios 12 y 13) — responsable: Persona A.
// Mientras hay sesión administrativa, revisa cada 20 segundos si llegó una solicitud
// nueva y muestra un aviso. No usa WhatsApp ni correo (MCA-05, restricción 8).
// La solicitud sigue en «Solicitudes» aunque se cierre el aviso.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../shared/api/cliente.js';
import { Boton } from '../../shared/ui/componentes.jsx';

const INTERVALO_MS = 20000;

export default function AvisoSolicitudes() {
  const [aviso, setAviso] = useState(null); // { pendientes }
  const ultimaVista = useRef(undefined);

  useEffect(() => {
    let activo = true;
    async function revisar() {
      try {
        const { pendientes, ultimaId } = await api.get('/admin/solicitudes/resumen');
        if (!activo) return;
        // La primera lectura solo fija el punto de partida; después avisa si llega una más nueva.
        if (ultimaVista.current !== undefined && ultimaId && ultimaId !== ultimaVista.current && pendientes > 0) {
          setAviso({ pendientes });
        }
        if (ultimaVista.current === undefined && pendientes > 0) setAviso({ pendientes, alEntrar: true });
        ultimaVista.current = ultimaId ?? null;
      } catch {
        // Sin conexión no se muestra nada; se reintenta en el siguiente ciclo.
      }
    }
    revisar();
    const temporizador = setInterval(revisar, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(temporizador);
    };
  }, []);

  if (!aviso) return null;
  return (
    <div className="mensaje mensaje--aviso" role="status" aria-live="polite">
      {aviso.alEntrar
        ? `Hay ${aviso.pendientes} solicitud${aviso.pendientes === 1 ? '' : 'es'} pendiente${aviso.pendientes === 1 ? '' : 's'} de clientes. `
        : `Llegó una nueva solicitud de un cliente (${aviso.pendientes} pendiente${aviso.pendientes === 1 ? '' : 's'}). `}
      <Link to="/admin/solicitudes" onClick={() => setAviso(null)}>Ver solicitudes</Link>{' '}
      <Boton variante="secundario" onClick={() => setAviso(null)}>Cerrar</Boton>
    </div>
  );
}
