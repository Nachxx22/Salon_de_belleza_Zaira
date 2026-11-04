// Módulo Clientes — dueño: Persona A. No tiene rutas propias.
// El cliente no tiene cuenta: se identifica por su teléfono (ERS 3.4.4 y 3.5.2).
// Aquí van las funciones que usan Citas para buscar o registrar automáticamente
// al cliente al crear una cita (MCA-01 y MCA-12), por ejemplo:
//   buscarPorTelefono(telefono, tx)
//   buscarOCrear({ nombre, telefono, correo }, tx)
// Usar el `tx` de enTransaccion para que se registre en la misma transacción que la cita.
export {};
