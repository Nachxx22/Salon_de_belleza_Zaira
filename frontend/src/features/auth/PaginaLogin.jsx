// MA-01 Iniciar sesión (dueño: Persona B).
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';
import { useAuth } from './AuthContext.jsx';

export default function PaginaLogin() {
  const { autenticada, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (autenticada) return <Navigate to="/admin" replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    if (!usuario.trim() || !contrasena) {
      setError('El usuario y la contraseña son obligatorios.');
      return;
    }
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), contrasena);
      navegar(ubicacion.state?.desde ?? '/admin', { replace: true });
    } catch (e) {
      setError(e.message); // "Usuario o contraseña incorrectos" viene del servidor (MA-01, 5)
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta" style={{ maxWidth: 420, marginInline: 'auto' }}>
      <h1>Iniciar sesión</h1>
      <p className="texto-suave">Acceso al panel administrativo del salón.</p>
      <Mensaje tipo="error">{error}</Mensaje>
      <form onSubmit={enviar} noValidate>
        <Campo
          etiqueta="Usuario"
          name="usuario"
          autoComplete="username"
          obligatorio
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        {/* La contraseña se muestra oculta mientras se escribe (MA-01, 3). */}
        <Campo
          etiqueta="Contraseña"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          obligatorio
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
        <Boton type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</Boton>
      </form>
    </section>
  );
}
