// Estructura de las páginas públicas y del panel administrativo (dueña: Persona A).
import { NavLink, Outlet, Link, useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { Boton } from './componentes.jsx';
import AvisoSolicitudes from '../../features/solicitudes/AvisoSolicitudes.jsx';

export function LayoutPublico() {
  return (
    <>
      <a href="#contenido" className="saltar-contenido">Saltar al contenido</a>
      <header className="encabezado">
        <div className="contenedor encabezado__fila">
          <Link to="/" className="marca">Salón de Belleza Zaira</Link>
          <nav className="navegacion" aria-label="Navegación principal">
            <NavLink to="/" end>Inicio</NavLink>
            <NavLink to="/servicios">Servicios</NavLink>
            <NavLink to="/productos">Productos</NavLink>
            <NavLink to="/citas/solicitar">Solicitar cita</NavLink>
            <NavLink to="/citas/gestionar">Mi cita</NavLink>
          </nav>
        </div>
      </header>
      <main id="contenido" className="contenedor principal">
        <Outlet />
      </main>
      <footer className="pie">
        <div className="contenedor">
          Salón de Belleza Zaira · <Link to="/admin">Administración</Link>
        </div>
      </footer>
    </>
  );
}

const MENU_ADMIN = [
  { ruta: '/admin', texto: 'Inicio', exacta: true },
  { ruta: '/admin/servicios', texto: 'Servicios' },
  { ruta: '/admin/proveedores', texto: 'Proveedores' },
  { ruta: '/admin/productos', texto: 'Productos' },
  { ruta: '/admin/ventas', texto: 'Ventas' },
  { ruta: '/admin/citas', texto: 'Citas' },
  { ruta: '/admin/agenda', texto: 'Agenda' },
  { ruta: '/admin/solicitudes', texto: 'Solicitudes' },
];

export function LayoutAdmin() {
  const { usuario, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  async function salir() {
    await cerrarSesion();
    navegar('/admin/login', { replace: true });
  }

  return (
    <div className="panel">
      <a href="#contenido" className="saltar-contenido">Saltar al contenido</a>
      <aside className="panel__menu">
        <Link to="/admin" className="marca">Zaira · Panel</Link>
        <nav className="navegacion" aria-label="Menú administrativo">
          {MENU_ADMIN.map((opcion) => (
            <NavLink key={opcion.ruta} to={opcion.ruta} end={opcion.exacta}>
              {opcion.texto}
            </NavLink>
          ))}
        </nav>
        <div>
          <p className="texto-suave">Sesión: {usuario}</p>
          {/* MA-02: la opción Cerrar sesión está disponible mientras haya sesión activa. */}
          <Boton variante="secundario" onClick={salir}>Cerrar sesión</Boton>
        </div>
      </aside>
      <main id="contenido" className="panel__contenido">
        <AvisoSolicitudes />
        <Outlet />
      </main>
    </div>
  );
}
