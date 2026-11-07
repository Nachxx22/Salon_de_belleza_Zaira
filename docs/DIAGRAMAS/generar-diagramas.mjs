// Genera los diagramas que salen de la base de datos, para que coincidan siempre
// con database/migrations:
//   entidades.mmd  ERS 3.4    Diagrama de entidades (tablas, columnas, llaves)
//   clases.mmd     ERS 3.7.2  Diagrama de clases (entidades del dominio y operaciones)
// Uso: npm run docs:diagramas   (después, docs/DIAGRAMAS/README.md explica cómo pasarlos a PNG)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = path.dirname(fileURLToPath(import.meta.url));
const migraciones = path.resolve(carpeta, '..', '..', 'database', 'migrations');

// ---------------------------------------------------------------------------
// Lectura de las tablas desde los CREATE TABLE
// ---------------------------------------------------------------------------
const texto = readdirSync(migraciones)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(path.join(migraciones, f), 'utf8'))
  .join('\n');

const tablas = [];
for (const [, nombre, cuerpo] of texto.matchAll(/CREATE TABLE dbo\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
  const columnas = [];
  let pkCompuesta = [];
  for (const linea of cuerpo.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const pk = linea.match(/^CONSTRAINT \w+ PRIMARY KEY \(([^)]+)\)/);
    if (pk) pkCompuesta = pk[1].split(',').map((c) => c.trim());
    if (linea.startsWith('CONSTRAINT')) continue;
    // Solo líneas de columna: nombre seguido de un tipo de SQL Server (o AS para las calculadas).
    // Así no se confunden con la continuación de un CHECK escrito en varias líneas.
    const m = linea.match(/^(\w+)\s+(AS\s*\(|(?:TINYINT|SMALLINT|BIGINT|INT|BIT|DECIMAL|NVARCHAR|VARCHAR|DATETIME2|DATE|TIME)(?:\([^)]*\))?)(.*)$/);
    if (!m) continue;
    const [, columna, tipo, resto] = m;
    columnas.push({
      nombre: columna,
      tipo: tipo.startsWith('AS') ? 'CALCULADA' : tipo,
      nula: /\bNULL\b/.test(resto) && !/NOT NULL/.test(resto),
      pk: /PRIMARY KEY/.test(resto),
      unica: /UNIQUE/.test(resto) || (tipo.startsWith('AS') && /UNIQUE/.test(cuerpo.match(new RegExp(`${columna}[^\\n]*`))[0])),
      referencia: resto.match(/REFERENCES dbo\.(\w+)/)?.[1] ?? null,
    });
  }
  for (const c of columnas) if (pkCompuesta.includes(c.nombre)) c.pk = true;
  tablas.push({ nombre, columnas });
}
if (tablas.length !== 14) throw new Error(`Se esperaban 14 tablas y se leyeron ${tablas.length}.`);

// ---------------------------------------------------------------------------
// ERS 3.4: diagrama de entidades (Mermaid erDiagram)
// ---------------------------------------------------------------------------
const tipoEr = (t) => t.replace(/\((\d+),(\d+)\)/, '($1_$2)'); // Mermaid no admite comas en el tipo
const verbo = {
  'Cliente-Cita': 'solicita',
  'Cita-CitaServicio': 'incluye',
  'Servicio-CitaServicio': 'se agenda en',
  'Cita-SolicitudCita': 'recibe',
  'Proveedor-Producto': 'suministra',
  'Venta-VentaProducto': 'contiene',
  'Producto-VentaProducto': 'se vende en',
  'Venta-VentaServicio': 'contiene',
  'Servicio-VentaServicio': 'se cobra en',
  'Venta-RevisionVenta': 'conserva',
};
// Una cita tiene al menos un servicio (lo exige el API); lo demás puede no tener hijos.
const alMenosUno = new Set(['Cita-CitaServicio']);

const er = ['%% ERS 3.4 Diagrama de entidades. Generado por generar-diagramas.mjs desde database/migrations: no editar a mano.', 'erDiagram'];
for (const t of tablas) {
  er.push(`    ${t.nombre} {`);
  for (const c of t.columnas) {
    const llaves = [c.pk && 'PK', c.referencia && 'FK', c.unica && !c.pk && 'UK'].filter(Boolean).join(', ');
    const notas = [c.nula && 'opcional', c.tipo === 'CALCULADA' && 'calculada'].filter(Boolean).join(', ');
    er.push(`        ${tipoEr(c.tipo === 'CALCULADA' ? 'NVARCHAR' : c.tipo)} ${c.nombre}${llaves ? ` ${llaves}` : ''}${notas ? ` "${notas}"` : ''}`);
  }
  er.push('    }');
}
for (const t of tablas) {
  for (const c of t.columnas.filter((x) => x.referencia)) {
    const clave = `${c.referencia}-${t.nombre}`;
    const hijo = alMenosUno.has(clave) ? '|{' : 'o{';
    er.push(`    ${c.referencia} ||--${hijo} ${t.nombre} : "${verbo[clave] ?? 'tiene'}"`);
  }
}
writeFileSync(path.join(carpeta, 'entidades.mmd'), `${er.join('\n')}\n`);

// ---------------------------------------------------------------------------
// ERS 3.7.2: diagrama de clases (Mermaid classDiagram)
// Las clases son las entidades de 3.4; las llaves foráneas se dibujan como
// asociaciones y las operaciones son las de los casos de uso implementados.
// ---------------------------------------------------------------------------
const tipoClase = (t) => {
  if (t.startsWith('NVARCHAR')) return 'Texto';
  if (t.startsWith('DECIMAL')) return 'Decimal';
  if (t.startsWith('DATETIME')) return 'FechaHora';
  return { INT: 'Entero', TINYINT: 'Entero', DATE: 'Fecha', 'TIME(0)': 'Hora', BIT: 'Booleano', CALCULADA: 'Texto' }[t] ?? t;
};
const minuscula = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const operaciones = {
  Administradora: ['iniciarSesion() MA-01', 'cerrarSesion() MA-02'],
  Cliente: ['buscarPorTelefono()', 'registrarAlAgendar()'],
  Servicio: ['registrar() MS-01', 'consultar() MS-02 y MS-05', 'actualizar() MS-03', 'desactivar() MS-04', 'reactivar() EXT-MS-R01'],
  Proveedor: ['registrar() MPV-01', 'consultar() MPV-02', 'actualizar() MPV-03', 'desactivar() MPV-04', 'reactivar() EXT-MPV-R01'],
  Producto: ['registrar() MPD-01', 'desactivar() MPD-02', 'consultar() MPD-03', 'consultarStock() MPD-04', 'actualizar() MPD-05', 'actualizarStock() MPD-06', 'reactivar() EXT-MPD-R01'],
  Horario: ['registrar() MCA-08', 'consultar() MCA-09', 'modificar() MCA-10', 'eliminar() MCA-11'],
  BloqueoAgenda: ['registrar() MCA-08', 'consultar() MCA-09', 'modificar() MCA-10', 'eliminar() MCA-11'],
  Cita: ['crear() MCA-01 y MCA-12', 'consultar() MCA-04', 'reprogramar() MCA-13', 'cancelar() MCA-14', 'completar() MCA-07', 'duracionTotal() Entero'],
  CitaServicio: [],
  SolicitudCita: ['solicitarReprogramacion() MCA-02', 'solicitarCancelacion() MCA-03', 'consultarPendientes() MCA-05', 'aprobar() MCA-06', 'rechazar() MCA-06'],
  Venta: ['registrar() MV-01', 'consultar() MV-02', 'anular() MV-03', 'corregir() EXT-MV-U01'],
  VentaProducto: ['subtotal() Decimal'],
  VentaServicio: [],
  RevisionVenta: [],
};
const notasClase = {
  RevisionVenta: 'Extensión EXT-MV-U01 (no está en el ERS)',
};
const clases = ['%% ERS 3.7.2 Diagrama de clases. Generado por generar-diagramas.mjs desde database/migrations: no editar a mano.',
  '%% Junto a cada operación va el caso de uso que la implementa; EXT = extensión que no está en el ERS.', 'classDiagram'];
for (const t of tablas) {
  clases.push(`    class ${t.nombre} {`);
  for (const c of t.columnas) {
    if (c.referencia) continue; // se dibuja como asociación
    if (c.nombre === 'ContrasenaHash') { clases.push('        -Texto contrasenaHash'); continue; }
    const derivado = c.tipo === 'CALCULADA' ? '/' : '';
    clases.push(`        -${tipoClase(c.tipo)} ${derivado}${minuscula(c.nombre)}`);
  }
  for (const op of operaciones[t.nombre]) clases.push(`        +${op}`);
  clases.push('    }');
}
const multiplicidad = {
  'Cliente-Cita': ['"1"', '"0..*"'],
  'Cita-CitaServicio': ['"1"', '"1..*"'],
  'Servicio-CitaServicio': ['"1"', '"0..*"'],
  'Cita-SolicitudCita': ['"1"', '"0..*"'],
  'Proveedor-Producto': ['"1"', '"0..*"'],
  'Venta-VentaProducto': ['"1"', '"0..*"'],
  'Producto-VentaProducto': ['"1"', '"0..*"'],
  'Venta-VentaServicio': ['"1"', '"0..*"'],
  'Servicio-VentaServicio': ['"1"', '"0..*"'],
  'Venta-RevisionVenta': ['"1"', '"0..*"'],
};
const composicion = new Set(['Cita-CitaServicio', 'Venta-VentaProducto', 'Venta-VentaServicio', 'Venta-RevisionVenta']);
for (const t of tablas) {
  for (const c of t.columnas.filter((x) => x.referencia)) {
    const clave = `${c.referencia}-${t.nombre}`;
    const [a, b] = multiplicidad[clave] ?? ['"1"', '"0..*"'];
    const flecha = composicion.has(clave) ? '*--' : '--';
    clases.push(`    ${c.referencia} ${a} ${flecha} ${b} ${t.nombre} : ${verbo[clave] ?? 'tiene'}`);
  }
}
for (const [clase, nota] of Object.entries(notasClase)) clases.push(`    note for ${clase} "${nota}"`);
writeFileSync(path.join(carpeta, 'clases.mmd'), `${clases.join('\n')}\n`);

console.log(`Listo: entidades.mmd y clases.mmd con ${tablas.length} tablas.`);
