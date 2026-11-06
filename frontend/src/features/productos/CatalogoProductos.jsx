// MPD-03 Consultar producto (catálogo informativo) — responsable: Persona B (Ignacio).
// Solo informa: no hay compra, pago ni apartado (MPD-03, restricción 2).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Mensaje } from '../../shared/ui/componentes.jsx';

const formatoMonto = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });

export default function CatalogoProductos() {
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/publico/productos')
      .then(setProductos)
      .catch((e) => setError(e.message || 'El catálogo no pudo cargarse correctamente.'));
  }, []);

  return (
    <section>
      <h1>Nuestros productos</h1>
      <Mensaje tipo="aviso">Catálogo informativo: los productos se adquieren directamente en el salón.</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
      {!error && productos === null && <p className="texto-suave">Cargando productos…</p>}
      {productos && productos.length === 0 && <p className="texto-suave">Por el momento no hay productos disponibles.</p>}
      {productos && productos.length > 0 && (
        <div className="rejilla">
          {productos.map((p) => (
            <article key={p.id} className="tarjeta">
              <h2>{p.nombre}</h2>
              <p className="texto-suave">{p.marca} · {p.categoria}</p>
              <p>{p.descripcion}</p>
              <p>
                <strong>{formatoMonto.format(p.precio)}</strong>{' '}
                <span className="etiqueta">{p.disponibilidad}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
