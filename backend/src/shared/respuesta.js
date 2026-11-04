// Formato único de respuestas exitosas: { "ok": true, "data": ..., "mensaje"?: "..." }
export function responderOk(res, data, { estado = 200, mensaje } = {}) {
  const cuerpo = { ok: true, data };
  if (mensaje) cuerpo.mensaje = mensaje;
  return res.status(estado).json(cuerpo);
}

export function responderCreado(res, data, mensaje) {
  return responderOk(res, data, { estado: 201, mensaje });
}
