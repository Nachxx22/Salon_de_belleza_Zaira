// Reglas de MA-01 (Iniciar sesión) y MA-02 (Cerrar sesión). Dueño: Persona B.
import bcrypt from 'bcryptjs';
import { ErrorApp } from '../../shared/errores.js';
import { buscarPorUsuario } from './auth.datos.js';

// Mensaje exacto del ERS (MA-01, restricción 5).
export const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos';

// Hash de relleno: si el usuario no existe se compara igual, para que la
// respuesta tarde lo mismo y no revele qué usuarios existen.
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-no-es-una-contrasena', 10);

// Valida usuario y contraseña juntos. No hay límite de intentos (MA-01, restricción 4).
export async function validarCredenciales(usuario, contrasena) {
  if (typeof usuario !== 'string' || usuario.trim() === '' || typeof contrasena !== 'string' || contrasena === '') {
    throw new ErrorApp(400, 'DATOS_INVALIDOS', 'El usuario y la contraseña son obligatorios.');
  }
  const cuenta = await buscarPorUsuario(usuario.trim());
  const coincide = await bcrypt.compare(contrasena, cuenta?.Contrasena ?? HASH_DE_RELLENO);
  const valida = Boolean(cuenta) && coincide;
  if (!valida) throw new ErrorApp(401, 'CREDENCIALES_INVALIDAS', MENSAJE_CREDENCIALES);
  return { idAdmin: cuenta.IdAdmin, usuario: cuenta.Usuario };
}
