
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const path = require('path');

const pool = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const rolesRoutes = require('./src/routes/rolesRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================
// CONFIGURACIÓN DE SEGURIDAD
// =====================================
app.use(helmet());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================
// ARCHIVOS HTML, CSS Y JAVASCRIPT
// =====================================
app.use(express.static(path.join(__dirname, 'public')));

// =====================================
// SESIONES ALMACENADAS EN POSTGRESQL
// =====================================
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 1000
  }
}));

// =====================================
// RUTAS DE AUTENTICACIÓN
// =====================================
app.use('/api/auth', authRoutes);

// =====================================
// RUTAS DE USUARIOS
// =====================================
app.use('/api/usuarios', usuariosRoutes);

// =====================================
// RUTAS DE ROLES Y PERMISOS
// =====================================
app.use('/api/roles', rolesRoutes);

// =====================================
// COMPROBAR ESTADO DEL SERVIDOR
// =====================================
app.get('/api/estado', (req, res) => {
  return res.status(200).json({
    mensaje: 'Biblioteca Universitaria funcionando'
  });
});

// =====================================
// MANEJAR ERRORES CSRF
// =====================================
app.use((err, req, res, next) => {
  if (
    err.code === 'EBADCSRFTOKEN' ||
    (err.status === 403 &&
      err.message === 'invalid csrf token')
  ) {
    return res.status(403).json({
      mensaje: 'Token CSRF inválido o ausente'
    });
  }

  next(err);
});

// =====================================
// MANEJAR RUTAS NO ENCONTRADAS
// =====================================
app.use((req, res) => {
  return res.status(404).json({
    mensaje: 'Ruta no encontrada'
  });
});

// =====================================
// MANEJAR ERRORES INTERNOS
// =====================================
app.use((err, req, res, next) => {
  console.error('Error interno:', err.message);

  return res.status(500).json({
    mensaje: 'Error interno del servidor'
  });
});

// =====================================
// INICIAR SERVIDOR
// =====================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Servidor funcionando en http://localhost:${PORT}`
    );
  });
}

// =====================================
// EXPORTAR APP PARA PRUEBAS AUTOMATIZADAS
// =====================================
module.exports = app;
