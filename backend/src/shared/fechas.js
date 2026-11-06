// Fecha y hora de Costa Rica para el API (dueño: Persona B).
// No dependen de la zona horaria configurada en la computadora (D-015):
// se calculan con la zona America/Costa_Rica (UTC-6 todo el año).

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partes(instante) {
  const p = {};
  for (const { type, value } of formato.formatToParts(instante)) p[type] = value;
  return p;
}

// Fecha actual en Costa Rica: 'YYYY-MM-DD'. Sirve para reglas como «el
// cliente reserva desde el día siguiente».
export function hoyCostaRica(instante = new Date()) {
  const p = partes(instante);
  return `${p.year}-${p.month}-${p.day}`;
}

// Fecha y hora actuales en Costa Rica: 'YYYY-MM-DD HH:mm:ss'.
export function ahoraCostaRica(instante = new Date()) {
  const p = partes(instante);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// mssql entrega DATE, TIME y DATETIME2 como objetos Date en UTC con los
// valores tal como están guardados. Estas funciones los pasan al formato del
// JSON (docs/CONTRATOS_API.md) sin moverlos de zona horaria.
const dos = (n) => String(n).padStart(2, '0');

export function fechaDeSql(valor) {
  if (valor == null) return null;
  return `${valor.getUTCFullYear()}-${dos(valor.getUTCMonth() + 1)}-${dos(valor.getUTCDate())}`;
}

export function horaDeSql(valor) {
  if (valor == null) return null;
  return `${dos(valor.getUTCHours())}:${dos(valor.getUTCMinutes())}`;
}

export function fechaHoraDeSql(valor) {
  if (valor == null) return null;
  return `${fechaDeSql(valor)} ${horaDeSql(valor)}`;
}
