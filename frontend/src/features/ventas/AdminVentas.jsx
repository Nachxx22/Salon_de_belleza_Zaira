// MV-01 Registrar venta, MV-02 Consultar venta y MV-03 Anular venta — responsable: Persona B (Ignacio).
// Incluye la extensión EXT-MV-U01 Corregir venta, que NO está en el ERS (D-008, D-022).
// El total, los precios de productos y el stock los vuelve a calcular y validar el servidor.
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const METODOS = ['Efectivo', 'SINPE', 'Transferencia'];
const FILTROS_VACIOS = { codigo: '', desde: '', hasta: '', cliente: '', metodoPago: '', estado: '' };
const colones = (n) => `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function Selector({ id, etiqueta, valor, alCambiar, opciones, vacio }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value)}>
        <option value="">{vacio}</option>
        {opciones.map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
      </select>
    </div>
  );
}

// MV-01 Registrar venta y EXT-MV-U01 Corregir venta (extensión, no está en el ERS).
// Elegir un producto o servicio lo agrega de una vez a la venta:
// - Producto: precio del catálogo (fijo); se edita solo la cantidad, sin pasar del stock.
// - Servicio: se escribe el precio final cobrado, en colones enteros; el precio
//   aproximado guardado se muestra solo como referencia.
// Al corregir, los productos que ya estaban conservan su precio original y pueden
// usar las unidades que la venta tenía apartadas.
// El total se ve mientras se arma la venta; el oficial lo calcula el servidor.
const soloDigitos = (texto) => texto.replace(/\D/g, '');
// Colones enteros: lo que esté después de un punto o coma decimal se descarta (40000.09 → 40000).
const enteroDe = (texto) => soloDigitos(texto.split(/[.,]/)[0]);
// En los campos de números enteros no se pueden escribir decimales ni signos.
const bloquearNoEnteros = (e) => {
  if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
};

function FormularioVenta({ original = null, alTerminar, alCancelar }) {
  const corrigiendo = original !== null;
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [referencia, setReferencia] = useState(original?.referenciaCliente ?? '');
  const [lineasProducto, setLineasProducto] = useState(
    original ? original.productos.map((p) => ({ id: p.id, cantidad: String(p.cantidad) })) : [],
  );
  const [lineasServicio, setLineasServicio] = useState(
    original ? original.servicios.map((s) => ({ id: s.id, precioFinal: String(Math.round(s.precioFinal)) })) : [],
  );
  const [metodoPago, setMetodoPago] = useState(original?.metodoPago ?? '');
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/productos'), api.get('/admin/servicios')])
      .then(([listaProductos, listaServicios]) => {
        const enVentaP = new Map((original?.productos ?? []).map((p) => [p.id, p]));
        const enVentaS = new Set((original?.servicios ?? []).map((s) => s.id));
        setProductos(listaProductos
          .filter((p) => p.estado === 'Activo' || enVentaP.has(p.id))
          // Lo que ya estaba en la venta: su precio original y sus unidades apartadas cuentan como disponibles.
          .map((p) => (enVentaP.has(p.id)
            ? { ...p, precio: enVentaP.get(p.id).precioAplicado, stock: p.stock + enVentaP.get(p.id).cantidad }
            : p)));
        setServicios(listaServicios.filter((s) => s.estado === 'Activo' || enVentaS.has(s.id)));
      })
      .catch((e) => setError(e.message));
  }, [original]);

  const producto = (id) => productos.find((p) => p.id === id);
  const servicio = (id) => servicios.find((s) => s.id === id);

  // Cualquier cambio borra los mensajes anteriores.
  function cambio(accion) {
    setError('');
    setAviso('');
    accion();
  }

  function elegirProducto(valor) {
    const id = Number(valor);
    if (!id) return;
    cambio(() => {
      const ya = lineasProducto.find((l) => l.id === id);
      // Elegir otra vez el mismo producto suma una unidad, sin pasar del stock.
      if (ya) cambiarCantidad(id, String(Number(ya.cantidad || 0) + 1));
      else setLineasProducto([...lineasProducto, { id, cantidad: '1' }]);
    });
  }

  function cambiarCantidad(id, texto) {
    const stock = producto(id).stock;
    let valor = enteroDe(texto);
    if (valor !== '' && Number(valor) > stock) {
      valor = String(stock);
      setAviso(`Solo hay ${stock} unidades de «${producto(id).nombre}» disponibles.`);
    }
    setLineasProducto((actual) => actual.map((l) => (l.id === id ? { ...l, cantidad: valor } : l)));
  }

  function elegirServicio(valor) {
    const id = Number(valor);
    if (!id || lineasServicio.some((l) => l.id === id)) return;
    cambio(() => setLineasServicio([...lineasServicio, { id, precioFinal: '' }]));
  }

  const subtotalProducto = (l) => (producto(l.id)?.precio ?? 0) * (Number(l.cantidad) || 0);
  const total =
    lineasProducto.reduce((suma, l) => suma + subtotalProducto(l), 0) +
    lineasServicio.reduce((suma, l) => suma + (Number(l.precioFinal) || 0), 0);

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    setAviso('');
    if (lineasProducto.length + lineasServicio.length === 0) {
      setError('Elija al menos un producto o servicio para la venta.');
      return;
    }
    const sinCantidad = lineasProducto.find((l) => !(Number(l.cantidad) > 0));
    if (sinCantidad) {
      setError(`Indique una cantidad mayor que cero para «${producto(sinCantidad.id).nombre}».`);
      return;
    }
    const sinPrecio = lineasServicio.find((l) => !(Number(l.precioFinal) > 0));
    if (sinPrecio) {
      setError(`Escriba el precio final cobrado de «${servicio(sinPrecio.id).nombre}».`);
      return;
    }
    if (!metodoPago) {
      setError('Seleccione el método de pago.');
      return;
    }
    if (corrigiendo && !motivo.trim()) {
      setError('Indique el motivo de la corrección.');
      return;
    }
    if (!pagoConfirmado) {
      setError(corrigiendo
        ? 'Confirme que el pago corresponde al nuevo total.'
        : 'Confirme que recibió el pago antes de registrar la venta.');
      return;
    }
    const cuerpo = {
      referenciaCliente: referencia,
      productos: lineasProducto.map((l) => ({ id: l.id, cantidad: Number(l.cantidad) })),
      servicios: lineasServicio.map((l) => ({ id: l.id, precioFinal: Number(l.precioFinal) })),
      metodoPago,
      pagoConfirmado,
    };
    setEnviando(true);
    try {
      const venta = corrigiendo
        ? await api.put(`/admin/ventas/${original.id}`, { ...cuerpo, motivo })
        : await api.post('/admin/ventas', cuerpo);
      alTerminar(venta);
    } catch (e) {
      const d = e.detalles;
      setError(e.codigo === 'CANTIDAD_INSUFICIENTE' && d
        ? `${e.message}: «${d.producto}» tiene ${d.disponible} en stock y se pidieron ${d.solicitado}.`
        : e.message);
    } finally {
      setEnviando(false);
    }
  }

  const productosParaElegir = productos.filter((p) => !lineasProducto.some((l) => l.id === p.id));
  const serviciosParaElegir = servicios.filter((s) => !lineasServicio.some((l) => l.id === s.id));

  return (
    <section className="tarjeta">
      <h2>{corrigiendo ? `Corregir venta ${original.codigo}` : 'Registrar venta'}</h2>
      {corrigiendo && (
        <p className="texto-suave">
          Extensión EXT-MV-U01 (no está en el ERS). Se guarda cómo estaba la venta antes del cambio; el código y la fecha no cambian.
        </p>
      )}
      <Mensaje tipo="error">{error}</Mensaje>
      <Mensaje tipo="aviso">{aviso}</Mensaje>
      <form onSubmit={guardar} noValidate>
        <Campo etiqueta="Cliente (opcional)" maxLength={150} ayuda="Nombre o referencia. Puede quedar vacío."
          value={referencia} onChange={(e) => setReferencia(e.target.value)} />

        <fieldset>
          <legend>Productos</legend>
          <div className="campo">
            <label htmlFor="agregar-producto">Agregar producto</label>
            <select id="agregar-producto" value="" onChange={(e) => elegirProducto(e.target.value)}>
              <option value="">Seleccione un producto para agregarlo</option>
              {productosParaElegir.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock === 0}>
                  {p.nombre} · {colones(p.precio)} · {p.stock === 0 ? 'Agotado' : `stock ${p.stock}`}
                </option>
              ))}
            </select>
          </div>
          {lineasProducto.length > 0 && (
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
              <thead>
                <tr><th scope="col">Producto</th><th scope="col">Precio</th><th scope="col">Cantidad</th><th scope="col">Subtotal</th><th scope="col"><span className="texto-suave">Quitar</span></th></tr>
              </thead>
              <tbody>
                {lineasProducto.map((l) => {
                  const p = producto(l.id);
                  if (!p) return null;
                  return (
                    <tr key={l.id}>
                      <td>{p.nombre}<br /><span className="texto-suave">Disponible: {p.stock}</span></td>
                      <td>{colones(p.precio)}</td>
                      <td>
                        <input type="number" inputMode="numeric" min="1" max={p.stock} step="1" style={{ width: '6em' }}
                          aria-label={`Cantidad de ${p.nombre}`} value={l.cantidad} onKeyDown={bloquearNoEnteros}
                          onChange={(e) => cambio(() => cambiarCantidad(l.id, e.target.value))} />
                      </td>
                      <td>{colones(subtotalProducto(l))}</td>
                      <td>
                        <Boton variante="secundario" onClick={() => cambio(() => setLineasProducto(lineasProducto.filter((x) => x.id !== l.id)))}>
                          Quitar
                        </Boton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </fieldset>

        <fieldset>
          <legend>Servicios</legend>
          <div className="campo">
            <label htmlFor="agregar-servicio">Agregar servicio</label>
            <select id="agregar-servicio" value="" onChange={(e) => elegirServicio(e.target.value)}>
              <option value="">Seleccione un servicio para agregarlo</option>
              {serviciosParaElegir.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} · precio aproximado {colones(s.precioAproximado)}</option>
              ))}
            </select>
          </div>
          {lineasServicio.length > 0 && (
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
              <thead>
                <tr><th scope="col">Servicio</th><th scope="col">Precio aproximado</th><th scope="col">Precio final cobrado (₡)</th><th scope="col"><span className="texto-suave">Quitar</span></th></tr>
              </thead>
              <tbody>
                {lineasServicio.map((l) => {
                  const s = servicio(l.id);
                  if (!s) return null;
                  return (
                    <tr key={l.id}>
                      <td>{s.nombre}</td>
                      <td className="texto-suave">{colones(s.precioAproximado)}</td>
                      <td>
                        <input type="text" inputMode="numeric" placeholder={`Ej. ${Math.round(s.precioAproximado)}`} style={{ width: '9em' }}
                          aria-label={`Precio final de ${s.nombre}`} value={l.precioFinal} onKeyDown={bloquearNoEnteros}
                          onChange={(e) => cambio(() => setLineasServicio(lineasServicio.map((x) =>
                            (x.id === l.id ? { ...x, precioFinal: enteroDe(e.target.value) } : x))))} />
                      </td>
                      <td>
                        <Boton variante="secundario" onClick={() => cambio(() => setLineasServicio(lineasServicio.filter((x) => x.id !== l.id)))}>
                          Quitar
                        </Boton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </fieldset>

        <p>
          <strong>Total: {colones(Math.round(total * 100) / 100)}</strong>
          {corrigiendo && <span className="texto-suave"> (antes {colones(original.total)})</span>}
        </p>
        <Selector id="metodo-pago" etiqueta="Método de pago *" valor={metodoPago} alCambiar={(v) => cambio(() => setMetodoPago(v))} vacio="Seleccione"
          opciones={METODOS.map((m) => [m, m])} />
        {corrigiendo && (
          <div className="campo">
            <label htmlFor="motivo-correccion">Motivo de la corrección <span className="obligatorio" aria-hidden="true">*</span></label>
            <textarea id="motivo-correccion" rows={2} maxLength={500} value={motivo} onChange={(e) => cambio(() => setMotivo(e.target.value))} />
          </div>
        )}
        <div className="campo">
          <label>
            <input type="checkbox" checked={pagoConfirmado} onChange={(e) => cambio(() => setPagoConfirmado(e.target.checked))} />{' '}
            {corrigiendo
              ? 'Confirmo que el pago corresponde al nuevo total (el sistema no procesa pagos)'
              : 'Confirmo que recibí el pago (el sistema no procesa pagos)'}
          </label>
        </div>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : corrigiendo ? 'Guardar corrección' : 'Registrar venta'}
        </Boton>{' '}
        <Boton variante="secundario" onClick={alCancelar} disabled={enviando}>Cancelar</Boton>
      </form>
    </section>
  );
}

// MV-02 detalle y MV-03 Anular venta.
function DetalleVenta({ venta, alCambiar, alCorregir, alVolver, mensajeInicial = '' }) {
  const [paso, setPaso] = useState('ver'); // ver → motivo → confirmar
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState(mensajeInicial);

  async function anular() {
    setError('');
    try {
      const anulada = await api.patch(`/admin/ventas/${venta.id}/anular`, { motivo });
      setPaso('ver');
      setExito(`Venta ${anulada.codigo} anulada.${anulada.productos.length ? ' El stock de sus productos se repuso.' : ''}`);
      alCambiar(anulada);
    } catch (e) {
      setError(e.message);
      setPaso('motivo');
    }
  }

  return (
    <section className="tarjeta">
      <h2>Venta {venta.codigo}</h2>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>
      <p>
        <strong>Fecha y hora:</strong> {venta.fechaHora}<br />
        {venta.referenciaCliente && <><strong>Cliente:</strong> {venta.referenciaCliente}<br /></>}
        <strong>Método de pago:</strong> {venta.metodoPago}<br />
        <strong>Estado:</strong> <span className="etiqueta">{venta.estado}</span><br />
        {venta.motivoAnulacion && <><strong>Motivo de anulación:</strong> {venta.motivoAnulacion}<br /></>}
        <strong>Total:</strong> {colones(venta.total)}
      </p>
      <h3>Productos</h3>
      {venta.productos.length === 0 ? <p className="texto-suave">Sin productos.</p> : (
        <ul>{venta.productos.map((p) => <li key={p.id}>{p.nombre}: {p.cantidad} × {colones(p.precioAplicado)} = {colones(p.cantidad * p.precioAplicado)}</li>)}</ul>
      )}
      <h3>Servicios</h3>
      {venta.servicios.length === 0 ? <p className="texto-suave">Sin servicios.</p> : (
        <ul>{venta.servicios.map((s) => <li key={s.id}>{s.nombre}: {colones(s.precioFinal)}</li>)}</ul>
      )}

      {venta.revisiones.length > 0 && (
        <>
          <h3>Correcciones (EXT-MV-U01)</h3>
          <ul>
            {venta.revisiones.map((r) => (
              <li key={r.id}>
                {r.fechaHora}: {r.motivo} <span className="texto-suave">(antes: total {colones(r.datosAnteriores.total)}, {r.datosAnteriores.metodoPago})</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {venta.estado === 'Registrada' && paso === 'ver' && (
        <p>
          <Boton variante="secundario" onClick={alCorregir}>Corregir venta</Boton>{' '}
          <Boton variante="peligro" onClick={() => { setExito(''); setPaso('motivo'); }}>Anular venta</Boton>
        </p>
      )}
      {paso === 'motivo' && (
        <div>
          <div className="campo">
            <label htmlFor="motivo">Motivo de anulación <span className="obligatorio" aria-hidden="true">*</span></label>
            <textarea id="motivo" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <Boton variante="peligro" onClick={() => {
            if (!motivo.trim()) { setError('El motivo de anulación es obligatorio.'); return; }
            setError('');
            setPaso('confirmar');
          }}>Continuar</Boton>{' '}
          <Boton variante="secundario" onClick={() => { setPaso('ver'); setError(''); }}>Cancelar</Boton>
        </div>
      )}
      {paso === 'confirmar' && (
        <p>
          ¿Anular la venta {venta.codigo}? {venta.productos.length > 0 && 'Las cantidades vendidas volverán al stock. '}
          <Boton variante="peligro" onClick={anular}>Sí, anular</Boton>{' '}
          <Boton variante="secundario" onClick={() => setPaso('ver')}>No</Boton>
        </p>
      )}
      <p><Boton variante="secundario" onClick={alVolver}>Volver al listado</Boton></p>
    </section>
  );
}

export default function AdminVentas() {
  const [ventas, setVentas] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [hayFiltros, setHayFiltros] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [mensajeDetalle, setMensajeDetalle] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar(conFiltros = filtros) {
    setError('');
    const parametros = new URLSearchParams(Object.entries(conFiltros).filter(([, v]) => v.trim() !== ''));
    try {
      setVentas(await api.get(`/admin/ventas${parametros.size ? `?${parametros}` : ''}`));
      setHayFiltros(parametros.size > 0);
    } catch (e) {
      setVentas(null);
      setError(e.message || 'No se pudo consultar las ventas.');
    }
  }

  useEffect(() => {
    cargar(FILTROS_VACIOS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verDetalle(id) {
    setExito('');
    setMensajeDetalle('');
    try {
      setDetalle(await api.get(`/admin/ventas/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  if (registrando) {
    return (
      <FormularioVenta
        alCancelar={() => setRegistrando(false)}
        alTerminar={(venta) => {
          setRegistrando(false);
          setExito(`Venta ${venta.codigo} registrada por ${colones(venta.total)}.`);
          cargar();
        }}
      />
    );
  }

  if (detalle && corrigiendo) {
    return (
      <FormularioVenta
        original={detalle}
        alCancelar={() => setCorrigiendo(false)}
        alTerminar={(venta) => {
          setCorrigiendo(false);
          setDetalle(venta);
          setMensajeDetalle(`Venta ${venta.codigo} corregida. Se guardó cómo estaba antes.`);
          cargar();
        }}
      />
    );
  }

  if (detalle) {
    return (
      <DetalleVenta
        key={`${detalle.id}-${detalle.revisiones.length}`}
        venta={detalle}
        mensajeInicial={mensajeDetalle}
        alCambiar={(v) => { setDetalle(v); cargar(); }}
        alCorregir={() => { setMensajeDetalle(''); setCorrigiendo(true); }}
        alVolver={() => { setDetalle(null); setMensajeDetalle(''); }}
      />
    );
  }

  const filtro = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Ventas</h1>
        <Boton onClick={() => { setExito(''); setRegistrando(true); }}>Registrar venta</Boton>
      </div>
      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>

      <form className="tarjeta" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
        <Campo etiqueta="Código" ayuda="Por ejemplo V-000012." value={filtros.codigo} onChange={filtro('codigo')} />
        <Campo etiqueta="Desde" type="date" value={filtros.desde} onChange={filtro('desde')} />
        <Campo etiqueta="Hasta" type="date" value={filtros.hasta} onChange={filtro('hasta')} />
        <Campo etiqueta="Cliente" value={filtros.cliente} onChange={filtro('cliente')} />
        <Selector id="filtro-metodo" etiqueta="Método de pago" valor={filtros.metodoPago} vacio="Todos"
          alCambiar={(v) => setFiltros({ ...filtros, metodoPago: v })} opciones={METODOS.map((m) => [m, m])} />
        <Selector id="filtro-estado" etiqueta="Estado" valor={filtros.estado} vacio="Todos"
          alCambiar={(v) => setFiltros({ ...filtros, estado: v })} opciones={[['Registrada', 'Registrada'], ['Anulada', 'Anulada']]} />
        <Boton type="submit">Buscar</Boton>{' '}
        <Boton variante="secundario" onClick={() => { setFiltros(FILTROS_VACIOS); cargar(FILTROS_VACIOS); }}>Quitar filtros</Boton>
      </form>

      {ventas && ventas.length === 0 && (
        <p>{hayFiltros ? 'No se encontraron ventas con esos filtros.' : 'Todavía no existen ventas para consultar.'}</p>
      )}
      {ventas && ventas.length > 0 && (
        <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table className="tabla">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Cliente</th>
              <th scope="col">Método de pago</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td>{v.codigo}</td>
                <td>{v.fechaHora}</td>
                <td>{v.referenciaCliente ?? '—'}</td>
                <td>{v.metodoPago}</td>
                <td>{colones(v.total)}</td>
                <td><span className="etiqueta">{v.estado}</span></td>
                <td><Boton variante="secundario" onClick={() => verDetalle(v.id)}>Ver detalle</Boton></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
