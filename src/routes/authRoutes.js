
const express = require('express');
const router = express.Router();

const {
  registrar,
  login
} = require('../controllers/authController');

const {
  verificarSesion,
  usuarioAutenticado,
  soloSuperAdmin
} = require('../middleware/authMiddleware');

const {
  generateToken,
  csrfSynchronisedProtection
} = require('../middleware/csrfMiddleware');

// =====================================
// OBTENER TOKEN CSRF
// =====================================
router.get(
  '/csrf-token',
  verificarSesion,
  (req, res) => {
    const token = generateToken(req);

    return res.status(200).json({
      csrfToken: token
    });
  }
);

// =====================================
// REGISTRAR USUARIOS - SOLO SUPERADMIN
// =====================================
router.post(
  '/registro',
  soloSuperAdmin,
  csrfSynchronisedProtection,
  registrar
);

// =====================================
// INICIAR SESIÓN
// =====================================
router.post('/login', login);

// =====================================
// CONSULTAR SESIÓN ACTUAL
// =====================================
router.get(
  '/mi-sesion',
  usuarioAutenticado,
  (req, res) => {
    return res.status(200).json({
      usuario: {
        ...req.session.usuario,
        rol: req.acceso.rol,
        permisos: req.acceso.permisos,
        esSuperAdmin: req.acceso.esSuperAdmin
      }
    });
  }
);

// =====================================
// CERRAR SESIÓN
// =====================================
router.post(
  '/logout',
  verificarSesion,
  csrfSynchronisedProtection,
  (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({
          mensaje: 'Error al cerrar sesión'
        });
      }

      res.clearCookie('connect.sid');

      return res.status(200).json({
        mensaje: 'Sesión cerrada correctamente'
      });
    });
  }
);

module.exports = router;
