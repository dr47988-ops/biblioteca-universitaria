
const express = require('express');
const router = express.Router();

const {
  listarAuditoria
} = require('../controllers/auditoriaController');

const {
  verificarSesion,
  permitirRoles
} = require('../middleware/authMiddleware');

// =====================================
// CONSULTAR AUDITORÍA - SOLO SUPERADMIN
// =====================================
router.get(
  '/',
  verificarSesion,
  permitirRoles(1),
  listarAuditoria
);

module.exports = router;
