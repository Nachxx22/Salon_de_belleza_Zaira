// Protección de rutas administrativas (MA-01, restricción 6; AC-01).
// Se aplica una sola vez a todo /api/admin en app/rutas.js, así ninguna ruta
// administrativa queda sin proteger por olvido.
import { errores } from './errores.js';

export function requiereAdministradora(req, res, next) {
  if (req.session?.administradora) return next();
  return next(errores.noAutenticado());
}

export function administradoraActual(req) {
  return req.session?.administradora ?? null;
}
