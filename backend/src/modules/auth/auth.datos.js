// Capa de datos del acceso administrativo (dueño: Persona B).
import { consulta } from '../../shared/db.js';

// Devuelve la cuenta con su hash de contraseña (columna ContrasenaHash), o null.
export async function buscarPorUsuario(usuario) {
  const { filas } = await consulta(
    'SELECT Id, Usuario, ContrasenaHash FROM dbo.Administradora WHERE Usuario = @usuario',
    { usuario },
  );
  return filas[0] ?? null;
}
