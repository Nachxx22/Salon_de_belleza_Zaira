// Ayudas de validación en el servidor. React también valida, pero la regla
// que protege los datos es esta (plan, sección 3.3).
import { errores } from './errores.js';

export function textoRequerido(valor, campo, { max = 255 } = {}) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw errores.datosInvalidos(`El campo ${campo} es obligatorio.`, { campo });
  }
  const limpio = valor.trim();
  if (limpio.length > max) {
    throw errores.datosInvalidos(`El campo ${campo} admite como máximo ${max} caracteres.`, { campo });
  }
  return limpio;
}

export function textoOpcional(valor, campo, { max = 255 } = {}) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) return null;
  return textoRequerido(valor, campo, { max });
}

export function enteroPositivo(valor, campo, { permitirCero = false } = {}) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero < 0 || (!permitirCero && numero === 0)) {
    const regla = permitirCero ? 'un número entero mayor o igual a cero' : 'un número entero mayor que cero';
    throw errores.datosInvalidos(`El campo ${campo} debe ser ${regla}.`, { campo });
  }
  return numero;
}

export function montoNoNegativo(valor, campo) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero) || numero < 0) {
    throw errores.datosInvalidos(`El campo ${campo} debe ser un monto numérico no negativo.`, { campo });
  }
  // Redondeo a 2 decimales sin errores de coma flotante (1500.555 -> 1500.56).
  return Number(`${Math.round(Number(`${numero}e2`))}e-2`);
}

export function montoPositivo(valor, campo) {
  const numero = montoNoNegativo(valor, campo);
  if (numero === 0) throw errores.datosInvalidos(`El campo ${campo} debe ser mayor que cero.`, { campo });
  return numero;
}

// Teléfono: exactamente 8 dígitos, sin código de país (D-016). Se aceptan
// espacios o guiones al escribirlo y se guardan solo los 8 dígitos seguidos,
// para que la restricción de teléfono único compare siempre lo mismo.
export function telefono(valor, campo = 'teléfono') {
  const texto = textoRequerido(valor, campo, { max: 20 });
  const digitos = texto.replace(/[\s-]/g, '');
  if (!/^\d{8}$/.test(digitos)) {
    throw errores.datosInvalidos(`El ${campo} debe tener 8 dígitos.`, { campo });
  }
  return digitos;
}

export function correo(valor, campo = 'correo electrónico') {
  const texto = textoRequerido(valor, campo, { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) {
    throw errores.datosInvalidos(`El ${campo} no tiene un formato válido.`, { campo });
  }
  return texto;
}

export function idDeRuta(valor, campo = 'id') {
  return enteroPositivo(valor, campo);
}
