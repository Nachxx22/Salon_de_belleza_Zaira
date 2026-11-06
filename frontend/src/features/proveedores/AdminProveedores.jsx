// MPV-01 a MPV-04 y EXT-MPV-R01 (extensión, no está en el ERS) — responsable: Persona B (Ignacio).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const VACIO = { nombre: '', telefono: '', correoElectronico: '' };
const verTelefono = (t) => t.replace(/^(\d{4})(\d{4})$/, '$1-$2');

export default function AdminProveedores() {
  const [proveedores, setProveedores] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [buscado, setBuscado] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar(texto = buscado) {
    try {
      setProveedores(await api.get(`/admin/proveedores${texto ? `?buscar=${encodeURIComponent(texto)}` : ''}`));
      setBuscado(texto);
    } catch (e) {
      setProveedores(null);
      setError(e.message || 'No se pudo consultar los proveedores.');
    }
  }

  useEffect(() => {
    cargar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarAvisos() {
    setError('');
    setExito('');
  }

  async function abrirDetalle(id) {
    limpiarAvisos();
    setConfirmar(false);
    try {
      setDetalle(await api.get(`/admin/proveedores/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  function abrirFormulario(proveedor = null) {
    limpiarAvisos();
    setEditandoId(proveedor?.id ?? null);
    setFormulario(proveedor
      ? { nombre: proveedor.nombre, telefono: verTelefono(proveedor.telefono), correoElectronico: proveedor.correoElectronico }
      : { ...VACIO });
  }

  async function guardar(evento) {
    evento.preventDefault();
    limpiarAvisos();
    const faltan = [['nombre', 'nombre'], ['telefono', 'teléfono'], ['correoElectronico', 'correo electrónico']]
      .filter(([campo]) => !formulario[campo].trim()).map(([, etiqueta]) => etiqueta);
    if (faltan.length) {
      setError(`Faltan datos obligatorios: ${faltan.join(', ')}.`);
      return;
    }
    setEnviando(true);
    try {
      const guardado = editandoId === null
        ? await api.post('/admin/proveedores', formulario)
        : await api.put(`/admin/proveedores/${editandoId}`, formulario);
      setExito(editandoId === null ? 'Proveedor registrado en estado Activo.' : 'Proveedor actualizado.');
      setFormulario(null);
      setEditandoId(null);
      if (detalle) setDetalle(guardado);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  // MPV-04 Desactivar / EXT-MPV-R01 Reactivar, con confirmación.
  async function cambiarEstado() {
    limpiarAvisos();
    const reactivar = detalle.estado === 'Desactivado';
    try {
      const actualizado = await api.patch(`/admin/proveedores/${detalle.id}/${reactivar ? 'reactivar' : 'desactivar'}`);
      setDetalle(actualizado);
      setConfirmar(false);
      setExito(reactivar
        ? 'Proveedor reactivado. Ya se puede asociar a productos.'
        : 'Proveedor desactivado. Sus productos conservan la asociación, pero no se le pueden asociar productos nuevos.');
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const avisos = (
    <>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
    </>
  );

  if (formulario) {
    return (
      <section className="tarjeta">
        <h2>{editandoId === null ? 'Registrar proveedor' : 'Actualizar proveedor'}</h2>
        {avisos}
        <form onSubmit={guardar} noValidate>
          <Campo etiqueta="Nombre" name="nombre" obligatorio maxLength={150} value={formulario.nombre}
            onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} />
          <Campo etiqueta="Teléfono" name="telefono" obligatorio inputMode="numeric" ayuda="8 dígitos, por ejemplo 2222-0001."
            value={formulario.telefono} onChange={(e) => setFormulario({ ...formulario, telefono: e.target.value })} />
          <Campo etiqueta="Correo electrónico" name="correo" type="email" obligatorio maxLength={254}
            value={formulario.correoElectronico} onChange={(e) => setFormulario({ ...formulario, correoElectronico: e.target.value })} />
          <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>{' '}
          <Boton variante="secundario" disabled={enviando} onClick={() => { setFormulario(null); setError(''); }}>Cancelar</Boton>
        </form>
      </section>
    );
  }

  if (detalle) {
    const activo = detalle.estado === 'Activo';
    return (
      <section className="tarjeta">
        <h2>{detalle.nombre}</h2>
        {avisos}
        <p>
          <strong>Teléfono:</strong> {verTelefono(detalle.telefono)}<br />
          <strong>Correo electrónico:</strong> {detalle.correoElectronico}<br />
          <strong>Estado:</strong> <span className="etiqueta">{detalle.estado}</span>
        </p>
        <h3>Productos asociados</h3>
        {detalle.productos.length === 0
          ? <p className="texto-suave">Este proveedor no tiene productos asociados actualmente.</p>
          : (
            <ul>
              {detalle.productos.map((p) => (
                <li key={p.id}>{p.nombre} ({p.marca}): stock {p.stock}, {p.disponibilidad}{p.estado === 'Desactivado' ? ', desactivado' : ''}</li>
              ))}
            </ul>
          )}
        {confirmar ? (
          <p>
            {activo ? '¿Desactivar este proveedor?' : '¿Reactivar este proveedor?'}{' '}
            <Boton variante={activo ? 'peligro' : 'primario'} onClick={cambiarEstado}>{activo ? 'Sí, desactivar' : 'Sí, reactivar'}</Boton>{' '}
            <Boton variante="secundario" onClick={() => setConfirmar(false)}>No</Boton>
          </p>
        ) : (
          <p>
            <Boton variante="secundario" onClick={() => abrirFormulario(detalle)}>Actualizar</Boton>{' '}
            <Boton variante={activo ? 'peligro' : 'primario'} onClick={() => { limpiarAvisos(); setConfirmar(true); }}>
              {activo ? 'Desactivar' : 'Reactivar'}
            </Boton>{' '}
            <Boton variante="secundario" onClick={() => { setDetalle(null); limpiarAvisos(); }}>Volver al listado</Boton>
          </p>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Proveedores</h1>
        <Boton onClick={() => abrirFormulario()}>Registrar proveedor</Boton>
      </div>
      {avisos}
      <form className="tarjeta" onSubmit={(e) => { e.preventDefault(); limpiarAvisos(); cargar(buscar.trim()); }}>
        <Campo etiqueta="Buscar" ayuda="Nombre, teléfono o correo electrónico." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <Boton type="submit">Buscar</Boton>{' '}
        <Boton variante="secundario" onClick={() => { setBuscar(''); cargar(''); }}>Ver todos</Boton>
      </form>

      {proveedores && proveedores.length === 0 && (
        <p>{buscado ? 'No se encontraron proveedores con ese criterio.' : 'Todavía no existen proveedores registrados.'}</p>
      )}
      {proveedores && proveedores.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Correo electrónico</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{verTelefono(p.telefono)}</td>
                <td>{p.correoElectronico}</td>
                <td><span className="etiqueta">{p.estado}</span></td>
                <td><Boton variante="secundario" onClick={() => abrirDetalle(p.id)}>Ver detalle</Boton></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
