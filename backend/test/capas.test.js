// Regla de capas (AGENTS.md regla 4, D-017): el SQL solo vive en <modulo>.datos.js.
// Revisa todos los archivos de backend/src/modules que no son de datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const carpetaModulos = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules');

function archivosJs(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) return archivosJs(ruta);
    return entrada.name.endsWith('.js') ? [ruta] : [];
  });
}

// Quita los comentarios para no confundir la documentación con código
// (por ejemplo, "DELETE /api/admin/..." describe una ruta HTTP, no SQL).
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const PROHIBIDO = [
  [/from\s+['"][^'"]*shared\/db(\.js)?['"]/, 'importa shared/db.js'],
  [/from\s+['"]mssql['"]/, 'importa mssql'],
  [/\bSELECT\b[\s\S]{0,200}?\bFROM\b/, 'contiene un SELECT'],
  [/\bINSERT\s+INTO\b/, 'contiene un INSERT'],
  [/\bUPDATE\s+[\w.[\]]+\s+SET\b/, 'contiene un UPDATE'],
  [/\bDELETE\s+FROM\b/, 'contiene un DELETE'],
  [/\b(MERGE\s+INTO|EXEC(UTE)?\s+\w)/, 'contiene MERGE o EXEC'],
  [/\bdbo\.\w+/, 'usa un nombre de tabla (dbo.)'],
];

test('no hay SQL ni acceso directo a la base fuera de los archivos .datos.js (D-017)', () => {
  const revisados = archivosJs(carpetaModulos).filter((ruta) => !ruta.endsWith('.datos.js'));
  assert.ok(revisados.some((r) => r.endsWith('servicios.logica.js')), 'la prueba debe revisar los archivos de lógica');

  const problemas = [];
  for (const ruta of revisados) {
    const codigo = sinComentarios(readFileSync(ruta, 'utf8'));
    for (const [patron, motivo] of PROHIBIDO) {
      if (patron.test(codigo)) problemas.push(`${path.relative(carpetaModulos, ruta)} ${motivo}`);
    }
  }
  assert.deepEqual(problemas, [], `El SQL va en <modulo>.datos.js:\n${problemas.join('\n')}`);
});
