const express = require('express');
const router = express.Router();

const {
  listarUsuarios,
  actualizarUsuario,
  eliminarUsuario
} = require('../controllers/usuariosController');

const {
  usuarioAutenticado,
  soloSuperAdmin
} = require('../middleware/authMiddleware');

const {
  csrfSynchronisedProtection
} = require('../middleware/csrfMiddleware');

// =====================================
// CONSULTAR USUARIOS
// SuperAdmin, Auditor y Bibliotecario tienen lectura (UTN-06)
// =====================================
router.get(
  '/',
  usuarioAutenticado,
  listarUsuarios
);

// =====================================
// EDITAR USUARIOS - SOLO SUPERADMIN
// =====================================
router.put(
  '/:id',
  soloSuperAdmin,
  csrfSynchronisedProtection,
  actualizarUsuario
);

// =====================================
// ELIMINAR USUARIOS - SOLO SUPERADMIN
// =====================================
router.delete(
  '/:id',
  soloSuperAdmin,
  csrfSynchronisedProtection,
  eliminarUsuario
);

module.exports = router;
