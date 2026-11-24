
const express = require('express');
const router = express.Router();

const {
  listarAuditoria
} = require('../controllers/auditoriaController');

const {
  soloSuperAdmin
} = require('../middleware/authMiddleware');

// =====================================
// CONSULTAR AUDITORÍA - SOLO SUPERADMIN
// =====================================
router.get(
  '/',
  soloSuperAdmin,
  listarAuditoria
);

module.exports = router;
