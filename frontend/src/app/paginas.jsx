// Páginas generales que no pertenecen a un módulo.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../shared/api/cliente.js';
import { Mensaje } from '../shared/ui/componentes.jsx';

export function PaginaInicio() {
  return (
    <section className="tarjeta">
      <h1>Bienvenida al Salón de Belleza Zaira</h1>
      <p>Consulte nuestros servicios y productos, y solicite su cita en línea sin necesidad de crear una cuenta.</p>
      <p>
        <Link to="/citas/solicitar" className="boton boton--primario">Solicitar una cita</Link>{' '}
        <Link to="/servicios" className="boton boton--secundario">Ver servicios</Link>
      </p>
    </section>
  );
}

const MODULOS = [
  { ruta: '/admin/servicios', titulo: 'Servicios', detalle: 'Catálogo, precios y duración' },
  { ruta: '/admin/proveedores', titulo: 'Proveedores', detalle: 'Contactos de los proveedores' },
  { ruta: '/admin/productos', titulo: 'Productos', detalle: 'Inventario y catálogo' },
  { ruta: '/admin/ventas', titulo: 'Ventas', detalle: 'Registro y consulta de ventas' },
  { ruta: '/admin/citas', titulo: 'Citas', detalle: 'Agenda de citas del salón' },
  { ruta: '/admin/agenda', titulo: 'Agenda', detalle: 'Horario regular y bloqueos' },
  { ruta: '/admin/solicitudes', titulo: 'Solicitudes', detalle: 'Solicitudes pendientes de clientes' },
  { ruta: '/admin/salud', titulo: 'Salud del sistema', detalle: 'API, base de datos y endpoints de los CRUD' },
];

export function PanelInicio() {
  return (
    <>
      <h1>Panel administrativo</h1>
      <div className="rejilla">
        {MODULOS.map((modulo) => (
          <Link key={modulo.ruta} to={modulo.ruta} className="tarjeta" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2>{modulo.titulo}</h2>
            <p className="texto-suave">{modulo.detalle}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

// /estado: comprueba que React llega al API y el API a SQL Server.
// Sirve para verificar la instalación en cada computadora (plan, primer hito).
// Es pública, por eso no muestra la base ni el servidor: el diagnóstico completo
// está en el panel, en Salud del sistema (/admin/salud, D-025).
export function PaginaEstado() {
  const [estado, setEstado] = useState({ cargando: true });

  useEffect(() => {
    api.get('/salud')
      .then((datos) => setEstado({ cargando: false, datos }))
      .catch((error) => setEstado({ cargando: false, error: error.message }));
  }, []);

  if (estado.cargando) return <p>Revisando la conexión…</p>;
  if (estado.error) return <Mensaje tipo="error">React no pudo comunicarse con el API: {estado.error}</Mensaje>;

  const { baseDatos } = estado.datos;
  return (
    <section className="tarjeta">
      <h1>Estado del sistema</h1>
      <Mensaje tipo="exito">React → API: conectado.</Mensaje>
      {baseDatos.conectada ? (
        <Mensaje tipo="exito">API → SQL Server: conectado.</Mensaje>
      ) : (
        <Mensaje tipo="error">API → SQL Server: sin conexión ({baseDatos.mensaje}). Revise backend/.env.</Mensaje>
      )}
      <p className="texto-suave">El detalle de cada módulo está en el panel administrativo, en Salud del sistema.</p>
    </section>
  );
}

export function PaginaNoEncontrada() {
  return (
    <section className="tarjeta">
      <h1>Página no encontrada</h1>
      <p><Link to="/">Volver al inicio</Link></p>
    </section>
  );
}
