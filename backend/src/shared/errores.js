// Formato único de errores de la API (docs/CONTRATOS_API.md):
//   { "ok": false, "codigo": "CODIGO_EN_MAYUSCULAS", "mensaje": "Texto para la persona usuaria" }

export class ErrorApp extends Error {
  constructor(estadoHttp, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

// Atajos para los casos más comunes.
export const errores = {
  datosInvalidos: (mensaje, detalles) => new ErrorApp(400, 'DATOS_INVALIDOS', mensaje, detalles),
  noAutenticado: (mensaje = 'Debe iniciar sesión para continuar.') => new ErrorApp(401, 'NO_AUTENTICADO', mensaje),
  noEncontrado: (mensaje = 'No se encontró el recurso solicitado.') => new ErrorApp(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (codigo, mensaje) => new ErrorApp(409, codigo, mensaje),
};

// Errores de SQL Server que conviene traducir a mensajes claros.
const ERROR_SQL_DUPLICADO = new Set([2627, 2601]); // UNIQUE / índice único
const ERROR_SQL_REFERENCIA = 547; // CHECK o FOREIGN KEY

export function rutaNoEncontrada(req, res) {
  res.status(404).json({ ok: false, codigo: 'RUTA_NO_ENCONTRADA', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.` });
}

// Manejador central: siempre responde JSON con el mismo formato.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  if (error instanceof ErrorApp) {
    const cuerpo = { ok: false, codigo: error.codigo, mensaje: error.message };
    if (error.detalles) cuerpo.detalles = error.detalles;
    return res.status(error.estadoHttp).json(cuerpo);
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la solicitud no es un JSON válido.' });
  }

  // Sin conexión con SQL Server (servicio apagado, puerto o credenciales incorrectas).
  if (error?.name === 'ConnectionError' || ['ESOCKET', 'ELOGIN', 'ETIMEOUT', 'EINSTLOOKUP'].includes(error?.code)) {
    console.error('[base de datos no disponible]', error.message);
    return res.status(503).json({ ok: false, codigo: 'BASE_DATOS_NO_DISPONIBLE', mensaje: 'No se pudo conectar con la base de datos.' });
  }

  const numeroSql = error?.number ?? error?.originalError?.info?.number;
  if (ERROR_SQL_DUPLICADO.has(numeroSql)) {
    return res.status(409).json({ ok: false, codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con esos datos.' });
  }
  if (numeroSql === ERROR_SQL_REFERENCIA) {
    return res.status(409).json({ ok: false, codigo: 'RESTRICCION_DE_DATOS', mensaje: 'La operación no cumple las reglas de los datos.' });
  }

  console.error('[error no controlado]', error);
  return res.status(500).json({ ok: false, codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intente de nuevo.' });
}
