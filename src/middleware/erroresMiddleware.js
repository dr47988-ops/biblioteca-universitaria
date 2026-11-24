const { denegarAcceso } = require('./authMiddleware');

// =====================================
// MANEJO DE ERRORES SIN EXPONER DATOS NI TRAZAS (UTN-06)
// =====================================

// Token CSRF ausente o inválido (UTN-07d)
const errorCSRF = (err, req, res, next) => {
  if (
    err.code === 'EBADCSRFTOKEN' ||
    (err.status === 403 && err.message === 'invalid csrf token')
  ) {
    return denegarAcceso(req, res, 'Token CSRF inválido o ausente');
  }

  next(err);
};

// Cuerpo JSON malformado o demasiado grande
const errorSolicitud = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      mensaje: 'El cuerpo de la solicitud no es válido'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      mensaje: 'La solicitud es demasiado grande'
    });
  }

  next(err);
};

// Ruta inexistente
const rutaNoEncontrada = (req, res) => {
  return res.status(404).json({
    mensaje: 'Ruta no encontrada'
  });
};

// Cualquier otro error: mensaje genérico, detalle solo en el servidor
// eslint-disable-next-line no-unused-vars
const errorInterno = (err, req, res, next) => {
  console.error('Error interno:', err.message);

  if (res.headersSent) {
    return;
  }

  return res.status(500).json({
    mensaje: 'Error interno del servidor'
  });
};

module.exports = {
  errorCSRF,
  errorSolicitud,
  rutaNoEncontrada,
  errorInterno
};
