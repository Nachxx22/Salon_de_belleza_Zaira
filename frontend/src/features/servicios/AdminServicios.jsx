// MS-05 Consultar servicios (Administrador), con MS-01 Registrar, MS-03 Actualizar
// y MS-04 Desactivar — responsable: Persona B (Ignacio).
import { useEffect, useState } from 'react';
import { api } from '../../shared/api/cliente.js';
import { Boton, Campo, Mensaje } from '../../shared/ui/componentes.jsx';

const FORMULARIO_VACIO = {
  nombre: '',
  descripcion: '',
  precioAproximado: '',
  duracionMinutos: '',
  permiteDomicilio: false,
};

export default function AdminServicios() {
  const [servicios, setServicios] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  // Formulario de MS-01 (nuevo) o MS-03 (edición): null si está cerrado.
  const [formulario, setFormulario] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarId, setConfirmarId] = useState(null);

  async function cargar() {
    try {
      setServicios(await api.get('/admin/servicios'));
      setError('');
    } catch (e) {
      setError(e.message || 'No se pudo consultar la lista de servicios.');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirNuevo() {
    setExito('');
    setError('');
    setEditandoId(null);
    setFormulario({ ...FORMULARIO_VACIO });
  }

  function abrirEdicion(servicio) {
    setExito('');
    setError('');
    setEditandoId(servicio.id);
    setFormulario({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      precioAproximado: String(servicio.precioAproximado),
      duracionMinutos: String(servicio.duracionMinutos),
      permiteDomicilio: servicio.permiteDomicilio,
    });
  }

  function cerrarFormulario() {
    setFormulario(null);
    setEditandoId(null);
    setError('');
  }

  function cambiar(campo) {
    return (evento) => {
      const valor = evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value;
      setFormulario((actual) => ({ ...actual, [campo]: valor }));
    };
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    setExito('');

    // Validación rápida en pantalla; el servidor vuelve a validar todo (AC-04).
    const faltan = [];
    if (!formulario.nombre.trim()) faltan.push('nombre');
    if (!formulario.descripcion.trim()) faltan.push('descripción');
    if (formulario.precioAproximado === '') faltan.push('precio aproximado');
    if (formulario.duracionMinutos === '') faltan.push('duración en minutos');
    if (faltan.length > 0) {
      setError(`Faltan datos obligatorios: ${faltan.join(', ')}.`);
      return;
    }

    const datos = {
      nombre: formulario.nombre,
      descripcion: formulario.descripcion,
      precioAproximado: formulario.precioAproximado,
      duracionMinutos: formulario.duracionMinutos,
      permiteDomicilio: formulario.permiteDomicilio,
    };

    setEnviando(true);
    try {
      if (editandoId === null) {
        await api.post('/admin/servicios', datos);
        setExito('Servicio registrado en estado Activo.');
      } else {
        await api.put(`/admin/servicios/${editandoId}`, datos);
        setExito('Servicio actualizado. Las citas existentes conservan la duración que tenían.');
      }
      setFormulario(null);
      setEditandoId(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function desactivar(servicio) {
    setExito('');
    setError('');
    try {
      await api.patch(`/admin/servicios/${servicio.id}/desactivar`);
      setExito(`"${servicio.nombre}" se desactivó. Ya no se ofrece para citas nuevas; el historial se conserva.`);
      setConfirmarId(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <div className="encabezado__fila">
        <h1>Servicios</h1>
        {formulario === null && <Boton onClick={abrirNuevo}>Registrar servicio</Boton>}
      </div>

      <Mensaje tipo="exito">{exito}</Mensaje>
      <Mensaje tipo="error">{error}</Mensaje>

      {formulario !== null && (
        <section className="tarjeta">
          <h2>{editandoId === null ? 'Registrar servicio' : 'Actualizar servicio'}</h2>
          <form onSubmit={guardar} noValidate>
            <Campo etiqueta="Nombre" name="nombre" maxLength={100} obligatorio value={formulario.nombre} onChange={cambiar('nombre')} />

            <div className="campo">
              <label htmlFor="servicio-descripcion">
                Descripción <span className="obligatorio" aria-hidden="true">*</span>
              </label>
              <textarea
                id="servicio-descripcion"
                name="descripcion"
                rows={3}
                maxLength={500}
                required
                value={formulario.descripcion}
                onChange={cambiar('descripcion')}
              />
            </div>

            <Campo
              etiqueta="Precio aproximado (₡)"
              name="precioAproximado"
              type="number"
              min="0"
              step="0.01"
              obligatorio
              ayuda="Un monto aproximado. El precio final puede variar según el largo del cabello."
              value={formulario.precioAproximado}
              onChange={cambiar('precioAproximado')}
            />
            <Campo
              etiqueta="Duración en minutos"
              name="duracionMinutos"
              type="number"
              min="1"
              step="1"
              obligatorio
              ayuda="Se usa para calcular los horarios disponibles al agendar."
              value={formulario.duracionMinutos}
              onChange={cambiar('duracionMinutos')}
            />

            <div className="campo">
              <label>
                <input type="checkbox" name="permiteDomicilio" checked={formulario.permiteDomicilio} onChange={cambiar('permiteDomicilio')} />{' '}
                Se puede realizar a domicilio
              </label>
            </div>

            <div className="encabezado__fila">
              <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>
              <Boton variante="secundario" onClick={cerrarFormulario} disabled={enviando}>Cancelar</Boton>
            </div>
          </form>
        </section>
      )}

      {servicios === null && !error && <p className="texto-suave">Cargando servicios…</p>}

      {servicios && servicios.length === 0 && (
        <section className="tarjeta">
          <p>No hay servicios registrados todavía.</p>
          <Boton onClick={abrirNuevo}>Registrar servicio</Boton>
        </section>
      )}

      {servicios && servicios.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <caption className="texto-suave">Servicios activos y desactivados</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Precio aprox.</th>
                <th scope="col">Duración</th>
                <th scope="col">Domicilio</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((servicio) => (
                <tr key={servicio.id}>
                  <td>{servicio.nombre}</td>
                  <td>{servicio.precioAproximado.toLocaleString('es-CR')}</td>
                  <td>{servicio.duracionMinutos} min</td>
                  <td>{servicio.permiteDomicilio ? 'Sí' : 'No'}</td>
                  <td>
                    <span className="etiqueta">{servicio.estado}</span>
                  </td>
                  <td>
                    {confirmarId === servicio.id ? (
                      <span>
                        ¿Desactivar este servicio? <Boton variante="peligro" onClick={() => desactivar(servicio)}>Sí, desactivar</Boton>{' '}
                        <Boton variante="secundario" onClick={() => setConfirmarId(null)}>No</Boton>
                      </span>
                    ) : (
                      <span>
                        <Boton variante="secundario" onClick={() => abrirEdicion(servicio)}>Actualizar</Boton>{' '}
                        {servicio.estado === 'Activo' && (
                          <Boton variante="peligro" onClick={() => setConfirmarId(servicio.id)}>Desactivar</Boton>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
