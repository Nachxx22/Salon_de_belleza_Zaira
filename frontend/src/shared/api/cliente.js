// Cliente HTTP central (dueño: Persona B). Todos los módulos llaman al API por aquí;
// no se construyen URLs ni se usa fetch directamente en los componentes.
//
//   import { api } from '../../shared/api/cliente.js';
//   const servicios = await api.get('/publico/servicios');
//   await api.post('/admin/servicios', datos);
//
// Las rutas son relativas a /api: en desarrollo Vite las reenvía al backend y en
// la demostración Express sirve el frontend y el API desde el mismo puerto.

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

async function solicitar(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revise que el API esté encendido.');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos?.codigo ?? 'ERROR_DESCONOCIDO',
      datos?.mensaje ?? 'Ocurrió un error inesperado.',
      datos?.detalles,
    );
  }
  return datos.data;
}

export const api = {
  get: (ruta) => solicitar('GET', ruta),
  post: (ruta, cuerpo = {}) => solicitar('POST', ruta, cuerpo),
  put: (ruta, cuerpo = {}) => solicitar('PUT', ruta, cuerpo),
  patch: (ruta, cuerpo = {}) => solicitar('PATCH', ruta, cuerpo),
  delete: (ruta) => solicitar('DELETE', ruta),
};
