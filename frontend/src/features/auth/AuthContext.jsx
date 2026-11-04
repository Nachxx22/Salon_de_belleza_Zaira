// Estado de la sesión administrativa en React (dueño: Persona B).
// La protección real está en el servidor (/api/admin exige sesión); esto solo
// decide qué pantalla mostrar.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api/cliente.js';

const AuthContexto = createContext(null);

export function AuthProvider({ children }) {
  const [estado, setEstado] = useState({ cargando: true, autenticada: false, usuario: null });

  const revisarSesion = useCallback(async () => {
    try {
      const sesion = await api.get('/auth/sesion');
      setEstado({ cargando: false, autenticada: sesion.autenticada, usuario: sesion.usuario ?? null });
    } catch {
      setEstado({ cargando: false, autenticada: false, usuario: null });
    }
  }, []);

  useEffect(() => {
    revisarSesion();
  }, [revisarSesion]);

  const iniciarSesion = useCallback(async (usuario, contrasena) => {
    const datos = await api.post('/auth/login', { usuario, contrasena });
    setEstado({ cargando: false, autenticada: true, usuario: datos.usuario });
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setEstado({ cargando: false, autenticada: false, usuario: null });
    }
  }, []);

  const valor = useMemo(
    () => ({ ...estado, iniciarSesion, cerrarSesion, revisarSesion }),
    [estado, iniciarSesion, cerrarSesion, revisarSesion],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContexto);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
