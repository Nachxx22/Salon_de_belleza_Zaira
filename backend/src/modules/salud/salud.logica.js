// Módulo Salud del sistema — dueño: Persona B (Ignacio). Herramienta interna del
// equipo, no es un requerimiento del ERS (EXT-SAL-01, D-025).
//
// Revisa el API, la conexión con SQL Server, las migraciones y, para cada endpoint
// de los 5 CRUD (y de los módulos de apoyo), si los permisos y tablas que necesita
// están bien. Las lecturas (R) se prueban llamando a la función real del módulo.
// El SQL está en salud.datos.js (D-017).
import { performance } from 'node:perf_hooks';
import { config, problemasDeConfiguracion } from '../../app/config.js';
import { errores, ErrorApp } from '../../shared/errores.js';
import * as datos from './salud.datos.js';
import * as servicios from '../servicios/servicios.logica.js';
import * as proveedores from '../proveedores/proveedores.logica.js';
import * as productos from '../productos/productos.logica.js';
import * as ventas from '../ventas/ventas.logica.js';
import * as agenda from '../agenda/agenda.logica.js';
import * as citas from '../citas/citas.logica.js';
import * as solicitudes from '../solicitudes/solicitudes.logica.js';

const ep = (metodo, ruta, operacion, rf, accion) => ({ metodo, ruta, operacion, rf, accion });

// Catálogo de endpoints (debe coincidir con los .rutas.js; lo revisa backend/test/salud.test.js).
// operacion: C crear, R leer, U actualizar, D borrar (baja lógica), null = no usa la base.
export const MODULOS = [
  {
    clave: 'servicios', nombre: 'Servicios', crud: true, requerimientos: 'MS-01 a MS-05 y EXT-MS-R01',
    leer: () => servicios.listarAdmin(),
    endpoints: [
      ep('POST', '/api/admin/servicios', 'C', 'MS-01', 'Registrar servicio'),
      ep('GET', '/api/admin/servicios', 'R', 'MS-05', 'Listar servicios'),
      ep('GET', '/api/admin/servicios/:id', 'R', 'MS-05', 'Detalle de un servicio'),
      ep('GET', '/api/publico/servicios', 'R', 'MS-02', 'Catálogo público'),
      ep('PUT', '/api/admin/servicios/:id', 'U', 'MS-03', 'Actualizar servicio'),
      ep('PATCH', '/api/admin/servicios/:id/reactivar', 'U', 'EXT-MS-R01', 'Reactivar servicio'),
      ep('PATCH', '/api/admin/servicios/:id/desactivar', 'D', 'MS-04', 'Desactivar servicio'),
    ],
  },
  {
    clave: 'proveedores', nombre: 'Proveedores', crud: true, requerimientos: 'MPV-01 a MPV-04 y EXT-MPV-R01',
    leer: () => proveedores.listar(),
    endpoints: [
      ep('POST', '/api/admin/proveedores', 'C', 'MPV-01', 'Registrar proveedor'),
      ep('GET', '/api/admin/proveedores', 'R', 'MPV-02', 'Listar y buscar proveedores'),
      ep('GET', '/api/admin/proveedores/:id', 'R', 'MPV-02', 'Detalle con productos asociados'),
      ep('PUT', '/api/admin/proveedores/:id', 'U', 'MPV-03', 'Actualizar proveedor'),
      ep('PATCH', '/api/admin/proveedores/:id/reactivar', 'U', 'EXT-MPV-R01', 'Reactivar proveedor'),
      ep('PATCH', '/api/admin/proveedores/:id/desactivar', 'D', 'MPV-04', 'Desactivar proveedor'),
    ],
  },
  {
    clave: 'productos', nombre: 'Productos', crud: true, requerimientos: 'MPD-01 a MPD-06 y EXT-MPD-R01',
    leer: () => productos.listarAdmin(),
    endpoints: [
      ep('POST', '/api/admin/productos', 'C', 'MPD-01', 'Registrar producto'),
      ep('GET', '/api/admin/productos', 'R', 'MPD-03', 'Listar productos'),
      ep('GET', '/api/admin/productos/inventario', 'R', 'MPD-04', 'Consultar stock'),
      ep('GET', '/api/admin/productos/:id', 'R', 'MPD-03', 'Detalle de un producto'),
      ep('GET', '/api/publico/productos', 'R', 'MPD-03', 'Catálogo público'),
      ep('PUT', '/api/admin/productos/:id', 'U', 'MPD-05', 'Actualizar producto'),
      ep('PATCH', '/api/admin/productos/:id/stock', 'U', 'MPD-06', 'Actualizar stock'),
      ep('PATCH', '/api/admin/productos/:id/reactivar', 'U', 'EXT-MPD-R01', 'Reactivar producto'),
      ep('PATCH', '/api/admin/productos/:id/desactivar', 'D', 'MPD-02', 'Desactivar producto'),
    ],
  },
  {
    clave: 'ventas', nombre: 'Ventas', crud: true, requerimientos: 'MV-01 a MV-03 y EXT-MV-U01',
    leer: () => ventas.listar(),
    endpoints: [
      ep('POST', '/api/admin/ventas', 'C', 'MV-01', 'Registrar venta con stock'),
      ep('GET', '/api/admin/ventas', 'R', 'MV-02', 'Listar y filtrar ventas'),
      ep('GET', '/api/admin/ventas/:id', 'R', 'MV-02', 'Detalle de una venta'),
      ep('PUT', '/api/admin/ventas/:id', 'U', 'EXT-MV-U01', 'Corregir venta'),
      ep('PATCH', '/api/admin/ventas/:id/anular', 'D', 'MV-03', 'Anular venta y reintegrar stock'),
    ],
  },
  {
    clave: 'agenda', nombre: 'Configuración de agenda', crud: true, requerimientos: 'MCA-08 a MCA-11',
    leer: () => agenda.consultar(),
    endpoints: [
      ep('POST', '/api/admin/agenda/horarios', 'C', 'MCA-08', 'Registrar horario regular'),
      ep('POST', '/api/admin/agenda/bloqueos', 'C', 'MCA-08', 'Registrar bloqueo'),
      ep('GET', '/api/admin/agenda', 'R', 'MCA-09', 'Consultar horarios y bloqueos'),
      ep('PUT', '/api/admin/agenda/horarios/:id', 'U', 'MCA-10', 'Modificar horario regular'),
      ep('PUT', '/api/admin/agenda/bloqueos/:id', 'U', 'MCA-10', 'Modificar bloqueo'),
      ep('DELETE', '/api/admin/agenda/horarios/:id', 'D', 'MCA-11', 'Eliminar horario regular'),
      ep('DELETE', '/api/admin/agenda/bloqueos/:id', 'D', 'MCA-11', 'Eliminar bloqueo'),
    ],
  },
  {
    clave: 'acceso', nombre: 'Acceso', crud: false, requerimientos: 'MA-01 y MA-02',
    leer: null,
    endpoints: [
      ep('POST', '/api/auth/login', 'R', 'MA-01', 'Iniciar sesión'),
      ep('POST', '/api/auth/logout', null, 'MA-02', 'Cerrar sesión'),
      ep('GET', '/api/auth/sesion', null, '-', 'Consultar sesión activa'),
    ],
  },
  {
    clave: 'citas', nombre: 'Citas', crud: false, requerimientos: 'MCA-01 a MCA-04, MCA-07, MCA-12 a MCA-14',
    leer: () => citas.listar(),
    endpoints: [
      ep('POST', '/api/admin/citas', 'C', 'MCA-12', 'Crear cita (administradora)'),
      ep('POST', '/api/publico/citas', 'C', 'MCA-01', 'Solicitar cita (cliente)'),
      ep('GET', '/api/admin/citas', 'R', 'MCA-04', 'Consultar citas'),
      ep('GET', '/api/admin/citas/:id', 'R', 'MCA-04', 'Detalle de una cita'),
      ep('GET', '/api/admin/citas/disponibilidad', 'R', 'MCA-12', 'Horas libres'),
      ep('GET', '/api/admin/citas/clientes', 'R', 'MCA-12', 'Buscar cliente por teléfono'),
      ep('GET', '/api/admin/citas/:id/disponibilidad', 'R', 'MCA-13', 'Horas libres para reprogramar'),
      ep('GET', '/api/publico/citas/disponibilidad', 'R', 'MCA-01', 'Horas libres (cliente)'),
      ep('POST', '/api/publico/citas/consulta', 'R', 'MCA-02', 'Ver cita con código y teléfono'),
      ep('POST', '/api/publico/citas/reprogramacion/horarios', 'R', 'MCA-02', 'Horas libres para reprogramar (cliente)'),
      ep('PATCH', '/api/admin/citas/:id/reprogramar', 'U', 'MCA-13', 'Reprogramar cita'),
      ep('PATCH', '/api/admin/citas/:id/completar', 'U', 'MCA-07', 'Marcar como completada'),
      ep('POST', '/api/publico/citas/reprogramacion', 'U', 'MCA-02', 'Solicitar reprogramación'),
      ep('PATCH', '/api/admin/citas/:id/cancelar', 'D', 'MCA-14', 'Cancelar cita'),
      ep('POST', '/api/publico/citas/cancelacion', 'D', 'MCA-03', 'Solicitar cancelación'),
    ],
  },
  {
    clave: 'solicitudes', nombre: 'Solicitudes', crud: false, requerimientos: 'MCA-05 y MCA-06',
    leer: () => solicitudes.listarPendientes(),
    endpoints: [
      ep('GET', '/api/admin/solicitudes', 'R', 'MCA-05', 'Solicitudes pendientes'),
      ep('GET', '/api/admin/solicitudes/resumen', 'R', 'MCA-05', 'Aviso interno'),
      ep('GET', '/api/admin/solicitudes/:id', 'R', 'MCA-05', 'Detalle de una solicitud'),
      ep('PATCH', '/api/admin/solicitudes/:id/aprobar', 'U', 'MCA-06', 'Aprobar solicitud'),
      ep('PATCH', '/api/admin/solicitudes/:id/rechazar', 'U', 'MCA-06', 'Rechazar solicitud'),
    ],
  },
];

// Qué revisar según el tipo de problema.
export const SUGERENCIAS = {
  SIN_CONEXION: 'SQL Server no responde. Revise que el servicio esté encendido y DB_SERVER, DB_PORT o DB_INSTANCE en backend/.env.',
  LOGIN: 'SQL Server rechazó el usuario o la contraseña. Revise DB_USER y DB_PASSWORD en backend/.env.',
  BASE_NO_EXISTE: 'El login no puede abrir la base de DB_NAME. Ejecute npm run db:migrar o database/setup/00_crear_bd_y_permisos.sql.',
  FALTA_TABLA: 'Falta una tabla o columna. Ejecute npm run db:migrar.',
  SIN_PERMISO: 'El login no tiene ese permiso. Ejecute database/setup/00_crear_bd_y_permisos.sql (da db_owner al login).',
  RESTRICCION: 'Una regla de la base (CHECK, llave o UNIQUE) rechazó los datos. Revise que las migraciones estén al día.',
  ERROR: 'Error inesperado. Lea el mensaje técnico.',
};

// Orden para escoger el problema principal de un módulo (el más grave primero).
const GRAVEDAD = ['SIN_CONEXION', 'LOGIN', 'BASE_NO_EXISTE', 'FALTA_TABLA', 'SIN_PERMISO', 'ERROR', 'RESTRICCION'];
const peor = (estados) => GRAVEDAD.find((g) => estados.includes(g)) ?? 'OK';

function aError(error) {
  if (error instanceof ErrorApp) return { tipo: 'ERROR', codigo: error.codigo, numero: null, mensaje: error.message };
  return datos.clasificarError(error);
}

async function medir(trabajo) {
  const inicio = performance.now();
  try {
    const valor = await trabajo();
    const registros = Array.isArray(valor) ? valor.length
      : Array.isArray(valor?.horarios) ? valor.horarios.length + (valor.bloqueos?.length ?? 0) : null;
    return { ok: true, ms: Math.round(performance.now() - inicio), registros };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - inicio), error: aError(error) };
  }
}

function estadoApi() {
  const segundos = Math.round(process.uptime());
  return {
    estado: 'activa',
    entorno: config.enProduccion ? 'producción' : 'desarrollo',
    node: process.version,
    activaDesde: new Date(Date.now() - segundos * 1000).toISOString(),
    segundosActiva: segundos,
    memoriaMb: Math.round(process.memoryUsage().rss / 1048576),
    problemasConfiguracion: problemasDeConfiguracion(),
  };
}

// Lo que dice backend/.env (sin la contraseña), para comparar si no hay conexión.
function destinoConfigurado() {
  return {
    servidor: config.db.server,
    puerto: config.db.port || null,
    instancia: config.db.instanceName || null,
    baseDatos: config.db.database,
    usuario: config.db.user || null,
  };
}

function estadoEndpoint(endpoint, operaciones, lectura) {
  if (!endpoint.operacion) return { estado: 'OK', detalle: 'No usa la base de datos.', necesita: [] };
  const op = operaciones[endpoint.operacion];
  if (op.faltanTablas.length) {
    return { estado: 'FALTA_TABLA', detalle: `No existe la tabla ${op.faltanTablas.join(', ')}.`, necesita: op.necesita };
  }
  if (op.faltan.length) return { estado: 'SIN_PERMISO', detalle: `Falta permiso: ${op.faltan.join(', ')}.`, necesita: op.necesita };
  if (endpoint.operacion === 'R' && lectura && !lectura.ok) {
    return { estado: lectura.error.tipo, detalle: lectura.error.mensaje, necesita: op.necesita };
  }
  const detalle = endpoint.operacion === 'R' && lectura ? `Lectura real correcta (${lectura.ms} ms).` : 'Tablas y permisos completos.';
  return { estado: 'OK', detalle, necesita: op.necesita };
}

function resumirModulo(modulo, endpoints, lectura) {
  const operaciones = {};
  for (const letra of ['C', 'R', 'U', 'D']) {
    const deLaLetra = endpoints.filter((e) => e.operacion === letra);
    operaciones[letra] = deLaLetra.length ? peor(deLaLetra.map((e) => e.estado)) : null;
  }
  return {
    clave: modulo.clave,
    nombre: modulo.nombre,
    crud: modulo.crud,
    requerimientos: modulo.requerimientos,
    estado: peor(endpoints.map((e) => e.estado)),
    operaciones,
    lectura,
    pruebaEscritura: datos.MODULOS_CON_ESCRITURA.includes(modulo.clave),
    endpoints,
  };
}

function revisarMigraciones(r) {
  const aplicadas = new Map(r.aplicadas.map((a) => [a.nombre, a]));
  const archivos = r.archivos ?? [];
  const pendientes = archivos.filter((a) => !aplicadas.has(a.nombre)).map((a) => a.nombre);
  const modificadas = archivos.filter((a) => aplicadas.has(a.nombre) && aplicadas.get(a.nombre).hash !== a.hash).map((a) => a.nombre);
  const nombres = new Set(archivos.map((a) => a.nombre));
  const desconocidas = r.archivos ? r.aplicadas.filter((a) => !nombres.has(a.nombre)).map((a) => a.nombre) : [];
  let estado = 'OK';
  if (!r.registroExiste) estado = 'SIN_REGISTRO';
  else if (pendientes.length) estado = 'PENDIENTES';
  else if (modificadas.length) estado = 'MODIFICADAS';
  return {
    estado,
    archivosEncontrados: r.archivos !== null,
    archivos: archivos.length,
    aplicadas: r.aplicadas.map((a) => ({ nombre: a.nombre, aplicadaEn: a.aplicadaEn })),
    pendientes,
    modificadas,
    desconocidas,
  };
}

export async function diagnosticar() {
  const inicio = performance.now();
  const revisadoEn = new Date().toISOString();
  const api = estadoApi();
  const conexion = await datos.probarConexion();

  if (!conexion.ok) {
    const { error } = conexion;
    const sinBase = (m) => resumirModulo(m, m.endpoints.map((e) => ({
      ...e,
      ...(e.operacion ? { estado: error.tipo, detalle: 'No se pudo conectar con SQL Server.' } : { estado: 'OK', detalle: 'No usa la base de datos.' }),
      necesita: [],
    })), null);
    return {
      revisadoEn,
      duracionMs: Math.round(performance.now() - inicio),
      general: error.tipo,
      api,
      baseDatos: { conectada: false, ms: conexion.ms, configurado: destinoConfigurado(), error: { ...error, sugerencia: SUGERENCIAS[error.tipo] } },
      migraciones: null,
      tablas: [],
      modulos: MODULOS.map(sinBase),
      sugerencias: SUGERENCIAS,
    };
  }

  let tablas;
  try {
    tablas = await datos.revisarTablas();
  } catch (error) {
    // Sin la lista de permisos no se puede revisar nada más: se informa el motivo.
    const e = aError(error);
    tablas = datos.TABLAS.map((nombre) => ({ nombre, existe: false, permisos: {}, filas: null, ms: null, error: e }));
  }
  const operaciones = datos.revisarOperaciones(tablas);

  const [migraciones, lecturas] = await Promise.all([
    datos.revisarMigraciones().then(revisarMigraciones).catch((error) => ({ estado: 'ERROR', error: aError(error) })),
    Promise.all(MODULOS.map((m) => (m.leer ? medir(m.leer) : null))),
  ]);

  const modulos = MODULOS.map((modulo, i) => {
    const lectura = lecturas[i];
    const endpoints = modulo.endpoints.map((e) => ({ ...e, ...estadoEndpoint(e, operaciones[modulo.clave], lectura) }));
    return resumirModulo(modulo, endpoints, lectura);
  });

  const todoBien = modulos.every((m) => m.estado === 'OK') && migraciones.estado === 'OK'
    && api.problemasConfiguracion.length === 0 && tablas.every((t) => t.existe && !t.error);
  return {
    revisadoEn,
    duracionMs: Math.round(performance.now() - inicio),
    general: todoBien ? 'OK' : 'CON_PROBLEMAS',
    api,
    baseDatos: { conectada: true, ms: conexion.ms, configurado: destinoConfigurado(), ...conexion.info },
    migraciones,
    tablas,
    modulos,
    sugerencias: SUGERENCIAS,
  };
}

// Prueba de escritura de un CRUD: INSERT/UPDATE/DELETE reales que se revierten.
export async function probarEscritura(clave) {
  const modulo = MODULOS.find((m) => m.clave === clave);
  if (!modulo || !datos.MODULOS_CON_ESCRITURA.includes(clave)) {
    throw errores.datosInvalidos(`La prueba de escritura existe para: ${datos.MODULOS_CON_ESCRITURA.join(', ')}.`, { campo: 'modulo' });
  }
  const inicio = performance.now();
  const pasos = await datos.probarEscritura(clave);
  // Las operaciones que no llegaron a ejecutarse (por un error anterior) se marcan como no probadas.
  for (const letra of ['C', 'R', 'U', 'D']) {
    if (!pasos.some((p) => p.operacion === letra)) {
      pasos.push({ operacion: letra, descripcion: 'No se probó por el error anterior.', estado: 'NO_PROBADA', ms: null, error: null });
    }
  }
  const orden = ['-', 'C', 'R', 'U', 'D'];
  pasos.sort((a, b) => orden.indexOf(a.operacion) - orden.indexOf(b.operacion));
  const conError = pasos.filter((p) => p.estado === 'ERROR');
  return {
    modulo: clave,
    nombre: modulo.nombre,
    revertida: true,
    duracionMs: Math.round(performance.now() - inicio),
    estado: conError.length ? peor(conError.map((p) => p.error.tipo)) : 'OK',
    pasos: pasos.map((p) => (p.error ? { ...p, error: { ...p.error, sugerencia: SUGERENCIAS[p.error.tipo] } } : p)),
  };
}
