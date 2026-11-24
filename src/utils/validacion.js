// =====================================
// VALIDACIÓN Y SANEAMIENTO DE ENTRADAS
// =====================================
// Defensa en profundidad contra XSS e inyección: además de
// escapar al mostrar (textContent) y parametrizar en SQL, se
// rechazan entradas con formato inválido antes de guardarlas.

class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.status = 400;
  }
}

// Caracteres de control (excepto salto de línea y tabulador)
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Caracteres usados para construir etiquetas HTML
const ETIQUETAS = /[<>]/;

/**
 * Valida un texto obligatorio u opcional.
 * Devuelve el texto recortado o null si es opcional y viene vacío.
 */
function texto(valor, campo, { min = 1, max = 255, opcional = false, patron } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (opcional) return null;
    throw new ErrorValidacion(`${campo} es obligatorio.`);
  }

  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`${campo} debe ser texto.`);
  }

  const limpio = valor.trim();

  if (limpio.length < min || limpio.length > max) {
    throw new ErrorValidacion(
      `${campo} debe tener entre ${min} y ${max} caracteres.`
    );
  }

  if (CONTROL.test(limpio) || ETIQUETAS.test(limpio)) {
    throw new ErrorValidacion(`${campo} contiene caracteres no permitidos.`);
  }

  if (patron && !patron.test(limpio)) {
    throw new ErrorValidacion(`${campo} tiene un formato inválido.`);
  }

  return limpio;
}

/**
 * Valida un identificador numérico positivo (parámetros de ruta).
 */
function id(valor, campo = 'ID') {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor)
    ? Number(valor)
    : valor;

  if (!Number.isSafeInteger(numero) || numero <= 0 || numero > 2147483647) {
    throw new ErrorValidacion(`${campo} inválido.`);
  }

  return numero;
}

/**
 * Valida una lista de identificadores sin repetidos.
 */
function listaIds(valor, campo) {
  if (!Array.isArray(valor) || valor.length > 50) {
    throw new ErrorValidacion(`${campo} debe ser una lista válida.`);
  }

  const ids = valor.map((elemento) => id(elemento, campo));

  return [...new Set(ids)];
}

module.exports = {
  ErrorValidacion,
  texto,
  id,
  listaIds
};
