// Módulo Clientes — dueño: Persona A. No tiene rutas propias.
// El cliente no tiene cuenta: se identifica por su teléfono (ERS 3.4.4 y 3.5.2).
// Lo usa Citas para buscar o registrar automáticamente al cliente al crear una
// cita (MCA-01 y MCA-12). Si recibe `tx` (de enTransaccion), trabaja dentro de
// esa transacción, para que cliente y cita se guarden juntos o ninguno.
import { consulta } from '../../shared/db.js';

function ejecutar(tx) {
  return tx ? tx.consulta : consulta;
}

export function aCliente(fila) {
  return {
    id: fila.Id,
    nombre: fila.Nombre,
    telefono: fila.Telefono,
    correoElectronico: fila.CorreoElectronico,
  };
}

// telefono: 8 dígitos seguidos (validacion.telefono). Devuelve el cliente o null.
export async function buscarPorTelefono(telefono, tx) {
  const { filas } = await ejecutar(tx)(
    'SELECT Id, Nombre, Telefono, CorreoElectronico FROM dbo.Cliente WHERE Telefono = @telefono',
    { telefono },
  );
  return filas[0] ? aCliente(filas[0]) : null;
}

export async function crear({ nombre, telefono, correoElectronico }, tx) {
  const { filas } = await ejecutar(tx)(
    `INSERT INTO dbo.Cliente (Nombre, Telefono, CorreoElectronico)
     OUTPUT INSERTED.Id, INSERTED.Nombre, INSERTED.Telefono, INSERTED.CorreoElectronico
     VALUES (@nombre, @telefono, @correo)`,
    { nombre, telefono, correo: correoElectronico ?? null },
  );
  return aCliente(filas[0]);
}
