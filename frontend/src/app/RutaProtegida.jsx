// Muestra el panel solo con sesión activa; si no, envía al inicio de sesión (MA-01, 6).
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function RutaProtegida() {
  const { cargando, autenticada } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <p className="contenedor principal">Verificando la sesión…</p>;
  if (!autenticada) return <Navigate to="/admin/login" replace state={{ desde: ubicacion.pathname }} />;
  return <Outlet />;
}
