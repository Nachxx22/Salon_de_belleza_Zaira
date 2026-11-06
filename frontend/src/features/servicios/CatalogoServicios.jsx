// MS-02 Consultar servicio (Cliente) — responsable: Persona B (Ignacio).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Mensaje } from '../../shared/ui/componentes.jsx';

const formatoMonto = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });

export default function CatalogoServicios() {
  const [servicios, setServicios] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/publico/servicios')
      .then(setServicios)
      .catch((e) => setError(e.message || 'Los servicios no pudieron cargarse correctamente.'));
  }, []);

  return (
    <section>
      <h1>Nuestros servicios</h1>
      <Mensaje tipo="aviso">
        Los precios son aproximados: el precio final puede variar según el tipo y el largo del cabello.
      </Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>

      {!error && servicios === null && <p className="texto-suave">Cargando servicios…</p>}

      {servicios && servicios.length === 0 && (
        <p className="texto-suave">Por el momento no hay servicios disponibles para consultar.</p>
      )}

      {servicios && servicios.length > 0 && (
        <div className="rejilla">
          {servicios.map((servicio) => (
            <article key={servicio.id} className="tarjeta">
              <h2>{servicio.nombre}</h2>
              <p>{servicio.descripcion}</p>
              <ul className="lista-datos">
                <li>
                  <strong>Precio aproximado:</strong> {formatoMonto.format(servicio.precioAproximado)}
                </li>
                <li>
                  <strong>Duración estimada:</strong> {servicio.duracionMinutos} minutos
                </li>
                <li>
                  <strong>A domicilio:</strong> {servicio.permiteDomicilio ? 'Sí' : 'No'}
                </li>
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
