// Capa de datos del módulo Ventas (dueño: Persona B).
// Única capa con SQL (D-017): recibe y devuelve objetos en camelCase.
// Venta + inventario van siempre en una sola transacción (AGENTS.md regla 5):
// si algo falla, no queda venta parcial ni stock descontado (MV-01 y MV-03, excepciones).
import { consulta, enTransaccion, sql } from '../../shared/db.js';
import { fechaHoraDeSql } from '../../shared/fechas.js';

// Detiene la transacción (se revierte todo) y entrega un resultado a la lógica,
// que decide el error y el mensaje (D-017).
class SinGuardar extends Error {
  constructor(resultado) {
    super('Operación revertida');
    this.resultado = resultado;
  }
}

async function transaccion(trabajo) {
  try {
    return await enTransaccion(trabajo);
  } catch (error) {
    if (error instanceof SinGuardar) return error.resultado;
    throw error;
  }
}

// Descuenta el stock de cada línea con la condición Stock >= cantidad (D-016) y
// toma el precio. `previos` (solo al corregir, EXT-MV-U01) son los productos que
// ya estaban en la venta: conservan su precio original y se aceptan aunque hoy
// estén desactivados. Si algo no alcanza, revierte toda la transacción.
async function descontarProductos(tx, lineas, previos = new Map()) {
  const productos = [];
  for (const { id, cantidad } of lineas) {
    const yaEstaba = previos.has(id);
    const { filas } = await tx.consulta(
      `UPDATE dbo.Producto SET Stock = Stock - @cantidad
       OUTPUT INSERTED.Nombre, INSERTED.Precio
       WHERE Id = @id AND (Estado = N'Activo' OR @yaEstaba = 1) AND Stock >= @cantidad`,
      { id, cantidad, yaEstaba },
    );
    if (filas.length === 0) {
      const { filas: actual } = await tx.consulta('SELECT Nombre, Stock, Estado FROM dbo.Producto WHERE Id = @id', { id });
      const p = actual[0];
      if (!p || (p.Estado !== 'Activo' && !yaEstaba)) throw new SinGuardar({ problema: { tipo: 'producto', id, nombre: p?.Nombre ?? null } });
      throw new SinGuardar({ problema: { tipo: 'stock', id, nombre: p.Nombre, disponible: p.Stock, pedido: cantidad } });
    }
    const precio = yaEstaba ? previos.get(id) : Number(filas[0].Precio);
    productos.push({ id, nombre: filas[0].Nombre, cantidad, precio });
  }
  return productos;
}

// Servicios activos (o que ya estaban en la venta, al corregir).
async function revisarServicios(tx, lineas, previos = new Set()) {
  const servicios = [];
  for (const { id, precioFinal } of lineas) {
    const { filas } = await tx.consulta('SELECT Nombre, Estado FROM dbo.Servicio WHERE Id = @id', { id });
    if (!filas[0] || (filas[0].Estado !== 'Activo' && !previos.has(id))) {
      throw new SinGuardar({ problema: { tipo: 'servicio', id, nombre: filas[0]?.Nombre ?? null } });
    }
    servicios.push({ id, nombre: filas[0].Nombre, precioFinal });
  }
  return servicios;
}

async function insertarDetalle(tx, ventaId, productos, servicios) {
  for (const p of productos) {
    await tx.consulta(
      `INSERT INTO dbo.VentaProducto (VentaId, ProductoId, Cantidad, PrecioAplicado)
       VALUES (@ventaId, @productoId, @cantidad, @precio)`,
      { ventaId, productoId: p.id, cantidad: p.cantidad, precio: [sql.Decimal(10, 2), p.precio] },
    );
  }
  for (const s of servicios) {
    await tx.consulta(
      `INSERT INTO dbo.VentaServicio (VentaId, ServicioId, PrecioFinal)
       VALUES (@ventaId, @servicioId, @precioFinal)`,
      { ventaId, servicioId: s.id, precioFinal: [sql.Decimal(10, 2), s.precioFinal] },
    );
  }
}

// MV-01: descuenta el stock, toma el precio del catálogo en ese momento y
// registra venta, productos y servicios. `calcularTotal` es la regla de ventas.logica.js.
// Devuelve { id } o { problema: { tipo, ... } } sin guardar nada.
export async function registrarVentaConStock(venta, calcularTotal) {
  return transaccion(async (tx) => {
    const productos = await descontarProductos(tx, venta.productos);
    const servicios = await revisarServicios(tx, venta.servicios);
    const total = calcularTotal({ productos, servicios });
    const { filas } = await tx.consulta(
      `INSERT INTO dbo.Venta (ReferenciaCliente, MetodoPago, Total)
       OUTPUT INSERTED.Id
       VALUES (@referencia, @metodoPago, @total)`,
      { referencia: venta.referenciaCliente, metodoPago: venta.metodoPago, total: [sql.Decimal(12, 2), total] },
    );
    await insertarDetalle(tx, filas[0].Id, productos, servicios);
    return { id: filas[0].Id };
  });
}

// EXT-MV-U01 Actualizar venta (extensión, no está en el ERS; D-008 y D-022).
// En una sola transacción: bloquea la venta, guarda cómo estaba en RevisionVenta,
// devuelve al stock lo de la versión anterior, aplica la nueva y cambia
// referencia, método de pago y total. El código y la fecha no cambian.
// Devuelve { id }, { noExiste }, { noEditable } o { problema } sin guardar nada.
export async function actualizarVentaConStock(id, venta, motivo, calcularTotal) {
  return transaccion(async (tx) => {
    const { filas: ventas } = await tx.consulta(
      `SELECT ReferenciaCliente, MetodoPago, Total, Estado
       FROM dbo.Venta WITH (UPDLOCK, ROWLOCK) WHERE Id = @id`,
      { id },
    );
    const actual = ventas[0];
    if (!actual) throw new SinGuardar({ noExiste: true });
    if (actual.Estado !== 'Registrada') throw new SinGuardar({ noEditable: true });

    const { filas: productosAntes } = await tx.consulta(
      'SELECT ProductoId, Cantidad, PrecioAplicado FROM dbo.VentaProducto WHERE VentaId = @id',
      { id },
    );
    const { filas: serviciosAntes } = await tx.consulta(
      'SELECT ServicioId, PrecioFinal FROM dbo.VentaServicio WHERE VentaId = @id',
      { id },
    );
    const datosAnteriores = {
      referenciaCliente: actual.ReferenciaCliente,
      metodoPago: actual.MetodoPago,
      total: Number(actual.Total),
      productos: productosAntes.map((f) => ({ id: f.ProductoId, cantidad: f.Cantidad, precioAplicado: Number(f.PrecioAplicado) })),
      servicios: serviciosAntes.map((f) => ({ id: f.ServicioId, precioFinal: Number(f.PrecioFinal) })),
    };
    await tx.consulta(
      'INSERT INTO dbo.RevisionVenta (VentaId, Motivo, DatosAnteriores) VALUES (@id, @motivo, @datos)',
      { id, motivo, datos: JSON.stringify(datosAnteriores) },
    );

    // Se revierte la versión anterior y se reemplaza el detalle; queda guardada en RevisionVenta.
    await tx.consulta(
      `UPDATE p SET p.Stock = p.Stock + vp.Cantidad
       FROM dbo.Producto p JOIN dbo.VentaProducto vp ON vp.ProductoId = p.Id
       WHERE vp.VentaId = @id`,
      { id },
    );
    await tx.consulta('DELETE FROM dbo.VentaProducto WHERE VentaId = @id', { id });
    await tx.consulta('DELETE FROM dbo.VentaServicio WHERE VentaId = @id', { id });

    const preciosPrevios = new Map(datosAnteriores.productos.map((p) => [p.id, p.precioAplicado]));
    const productos = await descontarProductos(tx, venta.productos, preciosPrevios);
    const servicios = await revisarServicios(tx, venta.servicios, new Set(datosAnteriores.servicios.map((s) => s.id)));
    await insertarDetalle(tx, id, productos, servicios);

    const total = calcularTotal({ productos, servicios });
    await tx.consulta(
      'UPDATE dbo.Venta SET ReferenciaCliente = @referencia, MetodoPago = @metodoPago, Total = @total WHERE Id = @id',
      { id, referencia: venta.referenciaCliente, metodoPago: venta.metodoPago, total: [sql.Decimal(12, 2), total] },
    );
    return { id };
  });
}

// EXT-MV-U01: correcciones de una venta, de la más reciente a la más antigua.
export async function revisiones(ventaId) {
  const { filas } = await consulta(
    `SELECT Id, FechaHora, Motivo, DatosAnteriores FROM dbo.RevisionVenta
     WHERE VentaId = @ventaId ORDER BY FechaHora DESC, Id DESC`,
    { ventaId },
  );
  return filas.map((f) => ({
    id: f.Id,
    fechaHora: fechaHoraDeSql(f.FechaHora),
    motivo: f.Motivo,
    datosAnteriores: JSON.parse(f.DatosAnteriores),
  }));
}

// MV-03: cambia el estado solo si sigue Registrada y devuelve al inventario las
// cantidades vendidas, todo junto. Los demás datos de la venta no cambian.
// Devuelve { anulada: true } o { anulada: false } si ya no estaba Registrada.
export async function anularVentaConStock(id, motivo) {
  return transaccion(async (tx) => {
    const { filasAfectadas } = await tx.consulta(
      `UPDATE dbo.Venta SET Estado = N'Anulada', MotivoAnulacion = @motivo
       WHERE Id = @id AND Estado = N'Registrada'`,
      { id, motivo },
    );
    if (filasAfectadas === 0) throw new SinGuardar({ anulada: false });
    await tx.consulta(
      `UPDATE p SET p.Stock = p.Stock + vp.Cantidad
       FROM dbo.Producto p
       JOIN dbo.VentaProducto vp ON vp.ProductoId = p.Id
       WHERE vp.VentaId = @id`,
      { id },
    );
    return { anulada: true };
  });
}

function patronContiene(texto) {
  return `%${texto.replace(/[\\%_[]/g, (c) => `\\${c}`)}%`;
}

// MV-02: listado con filtros opcionales (código, rango de fechas, cliente, método y estado).
export async function listar({ codigo = null, desde = null, hasta = null, cliente = null, metodoPago = null, estado = null } = {}) {
  const { filas } = await consulta(
    `SELECT Id, Codigo, FechaHora, ReferenciaCliente, MetodoPago, Total, Estado
     FROM dbo.Venta
     WHERE (@codigo IS NULL OR Codigo LIKE @codigo ESCAPE N'\\')
       AND (@desde IS NULL OR FechaHora >= CAST(@desde AS DATE))
       AND (@hasta IS NULL OR FechaHora < DATEADD(DAY, 1, CAST(@hasta AS DATE)))
       AND (@cliente IS NULL OR ReferenciaCliente LIKE @cliente ESCAPE N'\\')
       AND (@metodoPago IS NULL OR MetodoPago = @metodoPago)
       AND (@estado IS NULL OR Estado = @estado)
     ORDER BY FechaHora DESC, Id DESC`,
    {
      codigo: codigo ? patronContiene(codigo) : null,
      desde,
      hasta,
      cliente: cliente ? patronContiene(cliente) : null,
      metodoPago,
      estado,
    },
  );
  return filas.map((f) => ({
    id: f.Id,
    codigo: f.Codigo,
    fechaHora: fechaHoraDeSql(f.FechaHora),
    referenciaCliente: f.ReferenciaCliente,
    metodoPago: f.MetodoPago,
    total: Number(f.Total),
    estado: f.Estado,
  }));
}

// MV-02: detalle completo, o null si no existe.
export async function obtenerDetalle(id) {
  const { filas } = await consulta(
    `SELECT Id, Codigo, FechaHora, ReferenciaCliente, MetodoPago, Total, Estado, MotivoAnulacion
     FROM dbo.Venta WHERE Id = @id`,
    { id },
  );
  const v = filas[0];
  if (!v) return null;
  const productos = await consulta(
    `SELECT p.Id, p.Nombre, p.Marca, vp.Cantidad, vp.PrecioAplicado
     FROM dbo.VentaProducto vp JOIN dbo.Producto p ON p.Id = vp.ProductoId
     WHERE vp.VentaId = @id ORDER BY p.Nombre`,
    { id },
  );
  const servicios = await consulta(
    `SELECT s.Id, s.Nombre, vs.PrecioFinal
     FROM dbo.VentaServicio vs JOIN dbo.Servicio s ON s.Id = vs.ServicioId
     WHERE vs.VentaId = @id ORDER BY s.Nombre`,
    { id },
  );
  return {
    id: v.Id,
    codigo: v.Codigo,
    fechaHora: fechaHoraDeSql(v.FechaHora),
    referenciaCliente: v.ReferenciaCliente,
    metodoPago: v.MetodoPago,
    total: Number(v.Total),
    estado: v.Estado,
    motivoAnulacion: v.MotivoAnulacion,
    productos: productos.filas.map((p) => ({
      id: p.Id,
      nombre: p.Nombre,
      marca: p.Marca,
      cantidad: p.Cantidad,
      precioAplicado: Number(p.PrecioAplicado),
    })),
    servicios: servicios.filas.map((s) => ({ id: s.Id, nombre: s.Nombre, precioFinal: Number(s.PrecioFinal) })),
  };
}
