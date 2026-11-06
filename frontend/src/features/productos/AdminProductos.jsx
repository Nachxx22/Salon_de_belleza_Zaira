// MPD-01 a MPD-06 y EXT-MPD-R01 (extensión, no está en el ERS) — responsable: Persona B (Ignacio).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const VACIO = { nombre: '', marca: '', categoria: '', descripcion: '', precio: '', stock: '', proveedorId: '' };
const ETIQUETAS = {
  nombre: 'nombre', marca: 'marca', categoria: 'categoría', descripcion: 'descripción',
  precio: 'precio', stock: 'stock', proveedorId: 'proveedor',
};
const colones = (n) => `₡${n.toLocaleString('es-CR')}`;

function Inventario({ alVolver }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/productos/inventario').then(setFilas).catch((e) => setError(e.message || 'No se pudo consultar el stock.'));
  }, []);
  return (
    <section>
      <div className="encabezado__fila">
        <h1>Stock de productos</h1>
        <Boton variante="secundario" onClick={alVolver}>Volver a productos</Boton>
      </div>
      <Mensaje tipo="error">{error}</Mensaje>
      {filas && filas.length === 0 && <p>No hay productos registrados para consultar.</p>}
      {filas && filas.length > 0 && (
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
          <thead>
            <tr><th scope="col">Producto</th><th scope="col">Marca</th><th scope="col">Stock</th><th scope="col">Disponibilidad</th><th scope="col">Estado</th></tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.marca}</td>
                <td>{p.stock}</td>
                <td><span className="etiqueta">{p.disponibilidad}</span></td>
                <td>{p.estado}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}

export default function AdminProductos() {
  const [productos, setProductos] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [vista, setVista] = useState('productos');
  const [formulario, setFormulario] = useState(null);
  const [editando, setEditando] = useState(null); // producto en edición (MPD-05)
  const [ajusteStock, setAjusteStock] = useState(null); // { id, valor } (MPD-06)
  const [confirmarId, setConfirmarId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar() {
    try {
      setProductos(await api.get('/admin/productos'));
    } catch (e) {
      setProductos(null);
      setError(e.message || 'No se pudo consultar los productos.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function limpiarAvisos() {
    setError('');
    setExito('');
  }

  async function abrirFormulario(producto = null) {
    limpiarAvisos();
    try {
      setProveedores(await api.get('/admin/proveedores'));
    } catch (e) {
      setError(e.message);
      return;
    }
    setEditando(producto);
    setFormulario(producto
      ? {
          nombre: producto.nombre, marca: producto.marca, categoria: producto.categoria, descripcion: producto.descripcion,
          precio: String(producto.precio), stock: '', proveedorId: String(producto.proveedor.id),
        }
      : { ...VACIO });
  }

  async function guardar(evento) {
    evento.preventDefault();
    limpiarAvisos();
    const campos = Object.keys(VACIO).filter((c) => !(editando && c === 'stock'));
    const faltan = campos.filter((c) => !String(formulario[c]).trim()).map((c) => ETIQUETAS[c]);
    if (faltan.length) {
      setError(`Faltan datos obligatorios: ${faltan.join(', ')}.`);
      return;
    }
    const { stock, ...sinStock } = formulario;
    setEnviando(true);
    try {
      if (editando) {
        await api.put(`/admin/productos/${editando.id}`, sinStock);
        setExito('Producto actualizado. El stock no cambió.');
      } else {
        await api.post('/admin/productos', { ...sinStock, stock });
        setExito('Producto registrado en estado Activo.');
      }
      setFormulario(null);
      setEditando(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function guardarStock(producto) {
    limpiarAvisos();
    if (String(ajusteStock.valor).trim() === '') {
      setError('Ingrese la nueva cantidad en stock.');
      return;
    }
    try {
      const actualizado = await api.patch(`/admin/productos/${producto.id}/stock`, { stock: ajusteStock.valor });
      setExito(`Stock de «${producto.nombre}» actualizado a ${actualizado.stock} (${actualizado.disponibilidad}).`);
      setAjusteStock(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  // MPD-02 Desactivar / EXT-MPD-R01 Reactivar, con confirmación.
  async function cambiarEstado(producto) {
    limpiarAvisos();
    const reactivar = producto.estado === 'Desactivado';
    try {
      await api.patch(`/admin/productos/${producto.id}/${reactivar ? 'reactivar' : 'desactivar'}`);
      setExito(reactivar
        ? `«${producto.nombre}» se reactivó y vuelve al catálogo público.`
        : `«${producto.nombre}» se desactivó: ya no aparece en el catálogo público. Las ventas anteriores no cambian.`);
      setConfirmarId(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  if (vista === 'inventario') return <Inventario alVolver={() => setVista('productos')} />;

  const avisos = (
    <>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
    </>
  );

  if (formulario) {
    // Solo proveedores activos; al editar se conserva el actual aunque esté desactivado.
    const opciones = proveedores.filter((p) => p.estado === 'Activo' || p.id === editando?.proveedor.id);
    const cambiar = (campo) => (e) => setFormulario({ ...formulario, [campo]: e.target.value });
    return (
      <section className="tarjeta">
        <h2>{editando ? 'Actualizar producto' : 'Registrar producto'}</h2>
        {avisos}
        <form onSubmit={guardar} noValidate>
          <Campo etiqueta="Nombre" obligatorio maxLength={150} value={formulario.nombre} onChange={cambiar('nombre')} />
          <Campo etiqueta="Marca" obligatorio maxLength={100} value={formulario.marca} onChange={cambiar('marca')} />
          <Campo etiqueta="Categoría" obligatorio maxLength={100} value={formulario.categoria} onChange={cambiar('categoria')} />
          <div className="campo">
            <label htmlFor="producto-descripcion">Descripción <span className="obligatorio" aria-hidden="true">*</span></label>
            <textarea id="producto-descripcion" rows={3} maxLength={500} value={formulario.descripcion} onChange={cambiar('descripcion')} />
          </div>
          <Campo etiqueta="Precio (₡)" type="number" min="0" step="0.01" obligatorio value={formulario.precio} onChange={cambiar('precio')} />
          {!editando && (
            <Campo etiqueta="Cantidad en stock" type="number" min="0" step="1" obligatorio
              ayuda="Con 0 el producto aparece como Agotado." value={formulario.stock} onChange={cambiar('stock')} />
          )}
          <div className="campo">
            <label htmlFor="producto-proveedor">Proveedor <span className="obligatorio" aria-hidden="true">*</span></label>
            <select id="producto-proveedor" value={formulario.proveedorId} onChange={cambiar('proveedorId')}>
              <option value="">Seleccione un proveedor</option>
              {opciones.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}{p.estado === 'Desactivado' ? ' (desactivado)' : ''}</option>
              ))}
            </select>
            {opciones.length === 0 && <span className="campo__ayuda">No hay proveedores activos: registre uno primero.</span>}
          </div>
          {editando && <p className="texto-suave">El stock se cambia con «Ajustar stock» en el listado.</p>}
          <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>{' '}
          <Boton variante="secundario" disabled={enviando} onClick={() => { setFormulario(null); setEditando(null); setError(''); }}>Cancelar</Boton>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Productos</h1>
        <span>
          <Boton variante="secundario" onClick={() => { limpiarAvisos(); setVista('inventario'); }}>Consultar stock</Boton>{' '}
          <Boton onClick={() => abrirFormulario()}>Registrar producto</Boton>
        </span>
      </div>
      {avisos}
      {productos && productos.length === 0 && <p>Todavía no existen productos registrados.</p>}
      {productos && productos.length > 0 && (
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Categoría</th>
              <th scope="col">Precio</th>
              <th scope="col">Stock</th>
              <th scope="col">Proveedor</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}<br /><span className="texto-suave">{p.marca}</span></td>
                <td>{p.categoria}</td>
                <td>{colones(p.precio)}</td>
                <td>
                  {ajusteStock?.id === p.id ? (
                    <span>
                      <input type="number" min="0" step="1" aria-label={`Nuevo stock de ${p.nombre}`} style={{ width: '6em' }}
                        value={ajusteStock.valor} onChange={(e) => setAjusteStock({ id: p.id, valor: e.target.value })} />{' '}
                      <Boton onClick={() => guardarStock(p)}>Guardar</Boton>{' '}
                      <Boton variante="secundario" onClick={() => setAjusteStock(null)}>Cancelar</Boton>
                    </span>
                  ) : (
                    <>{p.stock} <span className="etiqueta">{p.disponibilidad}</span></>
                  )}
                </td>
                <td>{p.proveedor.nombre}{p.proveedor.estado === 'Desactivado' ? ' (desactivado)' : ''}</td>
                <td><span className="etiqueta">{p.estado}</span></td>
                <td>
                  {confirmarId === p.id ? (
                    <span>
                      {p.estado === 'Activo' ? '¿Desactivar?' : '¿Reactivar?'}{' '}
                      <Boton variante={p.estado === 'Activo' ? 'peligro' : 'primario'} onClick={() => cambiarEstado(p)}>Sí</Boton>{' '}
                      <Boton variante="secundario" onClick={() => setConfirmarId(null)}>No</Boton>
                    </span>
                  ) : (
                    <span>
                      <Boton variante="secundario" onClick={() => abrirFormulario(p)}>Actualizar</Boton>{' '}
                      <Boton variante="secundario" onClick={() => { limpiarAvisos(); setAjusteStock({ id: p.id, valor: String(p.stock) }); }}>Ajustar stock</Boton>{' '}
                      <Boton variante={p.estado === 'Activo' ? 'peligro' : 'primario'} onClick={() => { limpiarAvisos(); setConfirmarId(p.id); }}>
                        {p.estado === 'Activo' ? 'Desactivar' : 'Reactivar'}
                      </Boton>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
