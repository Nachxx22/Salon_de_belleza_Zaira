// Capa de datos del acceso administrativo (dueño: Persona B).
import { consulta } from '../../shared/db.js';

// Devuelve la cuenta con su hash de contraseña (columna Contrasena), o null.
export async function buscarPorUsuario(usuario) {
  const { filas } = await consulta(
    'SELECT IdAdmin, Usuario, Contrasena FROM dbo.Usuario_Admin WHERE Usuario = @usuario',
    { usuario },
  );
  return filas[0] ?? null;
}
