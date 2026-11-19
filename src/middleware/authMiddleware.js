
const verificarSesion = (req, res, next) => {
  if (!req.session || !req.session.usuario) {
    return res.status(403).json({
      mensaje: 'Acceso denegado. Debe iniciar sesión.'
    });
  }

  next();
};

const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.status(403).json({
        mensaje: 'Acceso denegado. Debe iniciar sesión.'
      });
    }

    const rolUsuario = req.session.usuario.rol_id;

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        mensaje: 'No tiene permisos para realizar esta acción.'
      });
    }

    next();
  };
};

module.exports = {
  verificarSesion,
  permitirRoles
};
