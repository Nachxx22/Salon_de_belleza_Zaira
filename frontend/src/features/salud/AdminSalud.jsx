// Salud del sistema — EXT-SAL-01 (herramienta interna, no está en el ERS; D-025).
// Responsable: Persona B (Ignacio). Solo en el panel administrativo: el API exige sesión.
//
// Muestra si el API, SQL Server, las migraciones y cada endpoint de los 5 CRUD
// funcionan, y si no, por qué: sin conexión, login rechazado, sin permiso, falta
// una tabla u otro error. La prueba de escritura hace INSERT/UPDATE/DELETE reales
// dentro de una transacción que el API siempre revierte.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Mensaje } from '../../shared/ui/componentes.jsx';
import './salud.css';

const ESTADOS = {
  OK: { texto: 'Funciona', tono: 'bien', icono: '✓' },
  SIN_CONEXION: { texto: 'Sin conexión', tono: 'mal', icono: '✕' },
  LOGIN: { texto: 'Login rechazado', tono: 'mal', icono: '✕' },
  BASE_NO_EXISTE: { texto: 'Base no disponible', tono: 'mal', icono: '✕' },
  SIN_PERMISO: { texto: 'Sin permiso', tono: 'aviso', icono: '!' },
  FALTA_TABLA: { texto: 'Falta tabla', tono: 'aviso', icono: '!' },
  RESTRICCION: { texto: 'Regla de la base', tono: 'aviso', icono: '!' },
  ERROR: { texto: 'Error', tono: 'mal', icono: '✕' },
  CON_PROBLEMAS: { texto: 'Con problemas', tono: 'aviso', icono: '!' },
  PENDIENTES: { texto: 'Migraciones pendientes', tono: 'aviso', icono: '!' },
  MODIFICADAS: { texto: 'Migración modificada', tono: 'aviso', icono: '!' },
  SIN_REGISTRO: { texto: 'Sin migrar', tono: 'aviso', icono: '!' },
  OMITIDA: { texto: 'Omitida', tono: 'neutro', icono: '–' },
  NO_PROBADA: { texto: 'No probada', tono: 'neutro', icono: '–' },
};

const LEYENDA = [
  ['OK', 'tablas y permisos completos; en las lecturas, la consulta real respondió'],
  ['SIN_CONEXION', 'SQL Server no responde'],
  ['LOGIN', 'usuario o contraseña de SQL Server incorrectos'],
  ['SIN_PERMISO', 'el login no puede hacer esa operación en una tabla'],
  ['FALTA_TABLA', 'falta una migración'],
  ['ERROR', 'cualquier otro error'],
];

const OPERACIONES = [['C', 'Crear'], ['R', 'Leer'], ['U', 'Actualizar'], ['D', 'Borrar']];

function Estado({ valor }) {
  const e = ESTADOS[valor] ?? { texto: valor, tono: 'neutro', icono: '?' };
  return (
    <span className={`salud-estado${e.tono === 'neutro' ? '' : ` salud-estado--${e.tono}`}`}>
      <span aria-hidden="true">{e.icono}</span> {e.texto}
    </span>
  );
}

const hora = (iso) => new Date(iso).toLocaleTimeString('es-CR', { timeZone: 'America/Costa_Rica' });
const fechaHora = (iso) => new Date(iso).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
function duracion(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${segundos % 60} s`;
}

function ErrorTecnico({ error }) {
  if (!error) return null;
  return (
    <>
      {error.sugerencia && <p>{error.sugerencia}</p>}
      <p className="salud-tecnico">
        {[error.codigo, error.numero && `SQL ${error.numero}`].filter(Boolean).join(' · ')}{error.codigo || error.numero ? ': ' : ''}{error.mensaje}
      </p>
    </>
  );
}

function PruebaEscritura({ modulo }) {
  const [estado, setEstado] = useState({ cargando: false });

  async function probar() {
    setEstado({ cargando: true });
    try {
      setEstado({ cargando: false, resultado: await api.post(`/admin/salud/escritura/${modulo.clave}`) });
    } catch (e) {
      setEstado({ cargando: false, error: e.message });
    }
  }

  const { resultado } = estado;
  return (
    <div>
      <p>
        <Boton variante="secundario" onClick={probar} disabled={estado.cargando}>
          {estado.cargando ? 'Probando…' : 'Probar escritura'}
        </Boton>{' '}
        <span className="texto-suave">Hace INSERT, UPDATE y DELETE reales y los revierte: no deja datos.</span>
      </p>
      <Mensaje tipo="error">{estado.error}</Mensaje>
      {resultado && (
        <div aria-live="polite">
          <p>
            Resultado: <Estado valor={resultado.estado} /> <span className="texto-suave">({resultado.duracionMs} ms, cambios revertidos)</span>
          </p>
          <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={`Prueba de escritura de ${modulo.nombre}`}>
            <table className="tabla">
              <thead>
                <tr><th scope="col">Operación</th><th scope="col">Qué se probó</th><th scope="col">Estado</th><th scope="col">Tiempo</th></tr>
              </thead>
              <tbody>
                {resultado.pasos.map((p, i) => (
                  <tr key={`${p.operacion}-${i}`}>
                    <td>{p.operacion}</td>
                    <td>{p.descripcion}{p.error && <ErrorTecnico error={p.error} />}</td>
                    <td><Estado valor={p.estado} /></td>
                    <td>{p.ms === null ? '—' : `${p.ms} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Modulo({ modulo, sugerencias }) {
  const conProblema = modulo.endpoints.filter((e) => e.estado !== 'OK');
  return (
    <section className="tarjeta salud-modulo" aria-labelledby={`salud-${modulo.clave}`}>
      <div className="salud-modulo__cabecera">
        <div>
          <h3 id={`salud-${modulo.clave}`}>{modulo.nombre}</h3>
          <span className="texto-suave">{modulo.requerimientos}</span>
        </div>
        <Estado valor={modulo.estado} />
      </div>

      <ul className="salud-crud" aria-label={`Operaciones de ${modulo.nombre}`}>
        {OPERACIONES.map(([letra, nombre]) => (
          <li key={letra}>
            <span className="salud-crud__letra">{letra} · {nombre}{letra === 'D' && modulo.clave !== 'agenda' ? ' (baja lógica)' : ''}</span>
            {modulo.operaciones[letra] ? <Estado valor={modulo.operaciones[letra]} /> : <span className="texto-suave">No aplica</span>}
          </li>
        ))}
      </ul>

      {modulo.lectura && (
        <p className="texto-suave">
          {modulo.lectura.ok
            ? `Lectura real: ${modulo.lectura.ms} ms${modulo.lectura.registros !== null ? ` · ${modulo.lectura.registros} registros` : ''}.`
            : `La lectura real falló (${modulo.lectura.ms} ms).`}
        </p>
      )}
      {conProblema.length > 0 && (
        <Mensaje tipo="aviso">
          {conProblema.length} endpoint{conProblema.length === 1 ? '' : 's'} con problema. {sugerencias[modulo.estado]}
        </Mensaje>
      )}

      <details open={conProblema.length > 0}>
        <summary>Endpoints ({modulo.endpoints.length})</summary>
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={`Endpoints de ${modulo.nombre}`}>
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Método</th><th scope="col">Ruta</th><th scope="col">Op.</th>
                <th scope="col">RF</th><th scope="col">Acción</th><th scope="col">Estado</th><th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {modulo.endpoints.map((e) => (
                <tr key={`${e.metodo} ${e.ruta}`}>
                  <td>{e.metodo}</td>
                  <td className="salud-ruta">{e.ruta}</td>
                  <td>{e.operacion ?? '—'}</td>
                  <td>{e.rf}</td>
                  <td>{e.accion}</td>
                  <td><Estado valor={e.estado} /></td>
                  <td>
                    {e.detalle}
                    {e.necesita.length > 0 && <><br /><span className="texto-suave">Necesita: {e.necesita.join(', ')}.</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {modulo.pruebaEscritura && <PruebaEscritura modulo={modulo} />}
    </section>
  );
}

function Migraciones({ migraciones }) {
  if (!migraciones) return <p className="texto-suave">No se pudo revisar: no hay conexión.</p>;
  if (migraciones.estado === 'ERROR') return <ErrorTecnico error={migraciones.error} />;
  return (
    <>
      <p><Estado valor={migraciones.estado} /></p>
      <dl className="salud-datos salud-datos--apilado">
        <dt>Archivos en database/migrations</dt>
        <dd>{migraciones.archivosEncontrados ? migraciones.archivos : 'No se encontró la carpeta'}</dd>
        <dt>Aplicadas en la base</dt>
        <dd>
          {migraciones.aplicadas.length ? (
            <ul className="salud-lista">
              {migraciones.aplicadas.map((a) => <li key={a.nombre}><span className="salud-tecnico">{a.nombre}</span> ({fechaHora(a.aplicadaEn)})</li>)}
            </ul>
          ) : 'Ninguna'}
        </dd>
        {migraciones.pendientes.length > 0 && <><dt>Pendientes</dt><dd>{migraciones.pendientes.join(', ')}. Ejecute npm run db:migrar.</dd></>}
        {migraciones.modificadas.length > 0 && <><dt>Modificadas después de aplicarse</dt><dd>{migraciones.modificadas.join(', ')}. Las migraciones aplicadas no se editan (AGENTS.md, regla 2).</dd></>}
        {migraciones.desconocidas.length > 0 && <><dt>En la base pero sin archivo</dt><dd>{migraciones.desconocidas.join(', ')}</dd></>}
      </dl>
    </>
  );
}

export default function AdminSalud() {
  const [estado, setEstado] = useState({ cargando: true });

  async function revisar() {
    setEstado((anterior) => ({ ...anterior, cargando: true, error: '' }));
    try {
      setEstado({ cargando: false, datos: await api.get('/admin/salud') });
    } catch (e) {
      // Si el API no responde, React no puede llegar a él: esa es la primera falla.
      setEstado({ cargando: false, error: e.estado === 0 ? `React no pudo comunicarse con el API. ${e.message}` : e.message });
    }
  }

  useEffect(() => {
    revisar();
  }, []);

  const { datos } = estado;
  const cruds = datos?.modulos.filter((m) => m.crud) ?? [];
  const otros = datos?.modulos.filter((m) => !m.crud) ?? [];
  const bd = datos?.baseDatos;

  return (
    <section className="salud">
      <h1>Salud del sistema</h1>
      <p className="texto-suave">
        Revisa el API, la conexión con SQL Server y cada endpoint de los 5 CRUD. Solo la administradora puede ver esta página.
      </p>
      <div className="salud-barra">
        <Boton onClick={revisar} disabled={estado.cargando}>{estado.cargando ? 'Revisando…' : 'Revisar ahora'}</Boton>
        {datos && <span className="texto-suave">Última revisión: {hora(datos.revisadoEn)} · tardó {datos.duracionMs} ms</span>}
      </div>
      <Mensaje tipo="error">{estado.error}</Mensaje>
      {!datos && estado.cargando && <p>Revisando el sistema…</p>}

      {datos && (
        <>
          {datos.general === 'OK'
            ? <Mensaje tipo="exito">Todo funciona: el API está activo, SQL Server responde y los {cruds.length} CRUD tienen sus tablas y permisos.</Mensaje>
            : bd.conectada
              ? <Mensaje tipo="aviso">Hay problemas. Revise los módulos marcados abajo.</Mensaje>
              : <Mensaje tipo="error">El API está activo, pero no hay conexión con SQL Server ({ESTADOS[datos.general]?.texto ?? datos.general}).</Mensaje>}

          <ul className="salud-leyenda" aria-label="Significado de los estados">
            {LEYENDA.map(([valor, texto]) => <li key={valor}><Estado valor={valor} /> {texto}</li>)}
          </ul>

          <div className="salud-columnas">
            <section className="tarjeta" aria-labelledby="salud-api">
              <h2 id="salud-api">API</h2>
              <p><Estado valor="OK" /> React → API conectado</p>
              <dl className="salud-datos">
                <dt>Entorno</dt><dd>{datos.api.entorno}</dd>
                <dt>Node.js</dt><dd>{datos.api.node}</dd>
                <dt>Activa desde</dt><dd>{fechaHora(datos.api.activaDesde)} ({duracion(datos.api.segundosActiva)})</dd>
                <dt>Memoria</dt><dd>{datos.api.memoriaMb} MB</dd>
              </dl>
              {datos.api.problemasConfiguracion.map((p) => <Mensaje key={p} tipo="aviso">{p}</Mensaje>)}
            </section>

            <section className="tarjeta" aria-labelledby="salud-bd">
              <h2 id="salud-bd">Base de datos</h2>
              <p>
                {bd.conectada ? <Estado valor="OK" /> : <Estado valor={bd.error.tipo} />}{' '}
                API → SQL Server {bd.conectada ? `conectado (${bd.ms} ms)` : `sin conexión (${bd.ms} ms)`}
              </p>
              {bd.conectada ? (
                <dl className="salud-datos">
                  <dt>Base</dt><dd>{bd.baseDatos}</dd>
                  <dt>Servidor</dt><dd>{bd.servidor}</dd>
                  <dt>SQL Server</dt><dd>{bd.version} · {bd.edicion}</dd>
                  <dt>Login</dt><dd>{bd.login} (usuario {bd.usuario})</dd>
                  <dt>Roles</dt><dd>{bd.roles.length ? bd.roles.join(', ') : 'Ninguno: solo permisos sueltos'}</dd>
                </dl>
              ) : (
                <>
                  <ErrorTecnico error={bd.error} />
                  <p>Configurado en backend/.env:</p>
                  <dl className="salud-datos">
                    <dt>Servidor</dt><dd>{bd.configurado.servidor}{bd.configurado.puerto ? `, puerto ${bd.configurado.puerto}` : ''}{bd.configurado.instancia ? `, instancia ${bd.configurado.instancia}` : ''}</dd>
                    <dt>Base</dt><dd>{bd.configurado.baseDatos}</dd>
                    <dt>Usuario</dt><dd>{bd.configurado.usuario ?? 'sin definir'}</dd>
                  </dl>
                </>
              )}
            </section>

            <section className="tarjeta" aria-labelledby="salud-migraciones">
              <h2 id="salud-migraciones">Migraciones</h2>
              <Migraciones migraciones={datos.migraciones} />
            </section>
          </div>

          <h2>Los 5 CRUD del proyecto</h2>
          {cruds.map((m) => <Modulo key={m.clave} modulo={m} sugerencias={datos.sugerencias} />)}

          <h2>Módulos de apoyo</h2>
          <p className="texto-suave">Acceso, citas y solicitudes también usan la base; se revisan igual, sin prueba de escritura.</p>
          {otros.map((m) => <Modulo key={m.clave} modulo={m} sugerencias={datos.sugerencias} />)}

          {datos.tablas.length > 0 && (
            <section className="tarjeta" aria-labelledby="salud-tablas">
              <h2 id="salud-tablas">Tablas y permisos del login</h2>
              <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tablas y permisos">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th scope="col">Tabla</th><th scope="col">Filas</th><th scope="col">Lectura</th>
                      {['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map((p) => <th key={p} scope="col">{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.tablas.map((t) => (
                      <tr key={t.nombre}>
                        <td>{t.nombre}</td>
                        <td>{t.existe ? (t.filas ?? '—') : <Estado valor="FALTA_TABLA" />}</td>
                        <td>{t.error ? <Estado valor={t.error.tipo} /> : t.ms !== null ? `${t.ms} ms` : '—'}</td>
                        {['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map((p) => (
                          <td key={p}>{t.existe ? (t.permisos[p] ? <span className="salud-estado salud-estado--bien"><span aria-hidden="true">✓</span> Sí</span> : <Estado valor="SIN_PERMISO" />) : '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
