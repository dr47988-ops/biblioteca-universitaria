
const express = require('express');
const { rateLimit } = require('express-rate-limit');
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

const {
  NOMBRE_COOKIE_SESION
} = require('../config/sesion');

// =====================================
// LÍMITE DE INTENTOS DE INICIO DE SESIÓN
// =====================================
// Frena ataques de fuerza bruta: 10 intentos fallidos
// por IP cada 15 minutos. Los inicios exitosos no cuentan.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    mensaje: 'Demasiados intentos de inicio de sesión. Intente más tarde.'
  }
});

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
router.post('/login', limiteLogin, login);

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

      res.clearCookie(NOMBRE_COOKIE_SESION, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return res.status(200).json({
        mensaje: 'Sesión cerrada correctamente'
      });
    });
  }
);

module.exports = router;
