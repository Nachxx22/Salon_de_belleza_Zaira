// Pruebas del esqueleto del API que no necesitan SQL Server.
// Ejecutar con: npm test (desde la raíz o desde backend/).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET ??= 'secreto-de-pruebas-automaticas';

const { crearApp } = await import('../src/app/app.js');

let servidor;
let base;

before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(() => servidor.close());

test('las rutas administrativas exigen sesión (MA-01, AC-01)', async () => {
  for (const modulo of ['servicios', 'proveedores', 'productos', 'ventas', 'citas', 'agenda', 'solicitudes']) {
    const respuesta = await fetch(`${base}/admin/${modulo}`);
    assert.equal(respuesta.status, 401, `/api/admin/${modulo} debe responder 401 sin sesión`);
    const cuerpo = await respuesta.json();
    assert.equal(cuerpo.ok, false);
    assert.equal(cuerpo.codigo, 'NO_AUTENTICADO');
  }
});

test('sin sesión, /api/auth/sesion indica que no hay sesión activa', async () => {
  const respuesta = await fetch(`${base}/auth/sesion`);
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { ok: true, data: { autenticada: false } });
});

test('el login exige usuario y contraseña (MA-01, restricción 1)', async () => {
  const respuesta = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: '', contrasena: '' }),
  });
  assert.equal(respuesta.status, 400);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.codigo, 'DATOS_INVALIDOS');
});

test('un JSON mal formado responde con el formato de error común', async () => {
  const respuesta = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ no es json',
  });
  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).codigo, 'JSON_INVALIDO');
});

test('una ruta inexistente responde 404 con el formato de error común', async () => {
  const respuesta = await fetch(`${base}/no-existe`);
  assert.equal(respuesta.status, 404);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.ok, false);
  assert.equal(cuerpo.codigo, 'RUTA_NO_ENCONTRADA');
});
