
const { registrarAccesoDenegado } = require('../services/auditoriaService');

// =====================================
// REGISTRAR TODA RESPUESTA 403
// Se coloca una sola vez en server.js, después de la sesión. Así queda
// auditado cualquier 403 (permisos, rol, CSRF o sesión ausente), venga
// del módulo que venga, sin tener que acordarse de llamarlo en cada ruta.
// =====================================
const auditar403 = (req, res, next) => {
  const jsonOriginal = res.json.bind(res);

  // Guardar el mensaje que se le mostró al cliente como motivo
  res.json = (cuerpo) => {
    if (res.statusCode === 403 && cuerpo && cuerpo.mensaje) {
      res.locals.motivo403 = cuerpo.mensaje;
    }

    return jsonOriginal(cuerpo);
  };

  res.on('finish', () => {
    if (res.statusCode === 403) {
      registrarAccesoDenegado(req, res.locals.motivo403);
    }
  });

  next();
};

module.exports = auditar403;
