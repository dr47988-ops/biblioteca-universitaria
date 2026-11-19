
const express = require('express');
const router = express.Router();

const {
  listarUsuarios,
  actualizarUsuario,
  eliminarUsuario
} = require('../controllers/usuariosController');

const {
  verificarSesion,
  permitirRoles
} = require('../middleware/authMiddleware');

const {
  csrfSynchronisedProtection
} = require('../middleware/csrfMiddleware');

// =====================================
// CONSULTAR USUARIOS
// =====================================
router.get(
  '/',
  verificarSesion,
  permitirRoles(1, 2, 3),
  listarUsuarios
);

// =====================================
// EDITAR USUARIOS - SOLO SUPERADMIN
// =====================================
router.put(
  '/:id',
  verificarSesion,
  permitirRoles(1),
  csrfSynchronisedProtection,
  actualizarUsuario
);

// =====================================
// ELIMINAR USUARIOS - SOLO SUPERADMIN
// =====================================
router.delete(
  '/:id',
  verificarSesion,
  permitirRoles(1),
  csrfSynchronisedProtection,
  eliminarUsuario
);

module.exports = router;
