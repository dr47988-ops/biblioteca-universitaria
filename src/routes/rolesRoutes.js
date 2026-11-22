const express = require('express');
const router = express.Router();

const {
  listarRoles,
  listarPermisos,
  crearRol,
  actualizarRol,
  eliminarRol
} = require('../controllers/rolesController');

const {
  soloSuperAdmin
} = require('../middleware/authMiddleware');

const {
  csrfSynchronisedProtection
} = require('../middleware/csrfMiddleware');

// =====================================
// TODAS LAS RUTAS DE ROLES SON EXCLUSIVAS DEL SUPERADMIN
// Cualquier otro rol recibe HTTP 403 (UTN-05, UTN-06, TC-06)
// =====================================
router.use(soloSuperAdmin);

// Consultar roles y catálogo de permisos
router.get('/', listarRoles);
router.get('/permisos', listarPermisos);

// Crear, editar y eliminar roles (con token CSRF)
router.post('/', csrfSynchronisedProtection, crearRol);
router.put('/:id', csrfSynchronisedProtection, actualizarRol);
router.delete('/:id', csrfSynchronisedProtection, eliminarRol);

module.exports = router;
