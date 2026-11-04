// Mapa de pantallas de la aplicación. Todas las rutas de los módulos ya están
// registradas: cada persona trabaja dentro de las páginas de su módulo y
// normalmente no necesita editar este archivo.
import { createBrowserRouter } from 'react-router';
import { LayoutAdmin, LayoutPublico } from '../shared/ui/layouts.jsx';
import RutaProtegida from './RutaProtegida.jsx';
import { PaginaEstado, PaginaInicio, PaginaNoEncontrada, PanelInicio } from './paginas.jsx';
import PaginaLogin from '../features/auth/PaginaLogin.jsx';
// Persona B (Ignacio)
import CatalogoServicios from '../features/servicios/CatalogoServicios.jsx';
import AdminServicios from '../features/servicios/AdminServicios.jsx';
import CatalogoProductos from '../features/productos/CatalogoProductos.jsx';
import AdminProductos from '../features/productos/AdminProductos.jsx';
import AdminProveedores from '../features/proveedores/AdminProveedores.jsx';
import AdminVentas from '../features/ventas/AdminVentas.jsx';
// Persona A
import SolicitarCita from '../features/citas/SolicitarCita.jsx';
import GestionarCita from '../features/citas/GestionarCita.jsx';
import AdminCitas from '../features/citas/AdminCitas.jsx';
import AdminAgenda from '../features/agenda/AdminAgenda.jsx';
import AdminSolicitudes from '../features/solicitudes/AdminSolicitudes.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LayoutPublico />,
    children: [
      { index: true, element: <PaginaInicio /> },
      { path: 'servicios', element: <CatalogoServicios /> },
      { path: 'productos', element: <CatalogoProductos /> },
      { path: 'citas/solicitar', element: <SolicitarCita /> },
      { path: 'citas/gestionar', element: <GestionarCita /> },
      { path: 'estado', element: <PaginaEstado /> },
      { path: 'admin/login', element: <PaginaLogin /> },
      { path: '*', element: <PaginaNoEncontrada /> },
    ],
  },
  {
    path: '/admin',
    element: <RutaProtegida />,
    children: [
      {
        element: <LayoutAdmin />,
        children: [
          { index: true, element: <PanelInicio /> },
          { path: 'servicios', element: <AdminServicios /> },
          { path: 'proveedores', element: <AdminProveedores /> },
          { path: 'productos', element: <AdminProductos /> },
          { path: 'ventas', element: <AdminVentas /> },
          { path: 'citas', element: <AdminCitas /> },
          { path: 'agenda', element: <AdminAgenda /> },
          { path: 'solicitudes', element: <AdminSolicitudes /> },
        ],
      },
    ],
  },
]);
