
require('dotenv').config();

const express = require('express');
const path = require('path');

const { middlewareSesion } = require('./src/config/sesion');

const authRoutes = require('./src/routes/authRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');
const rolesRoutes = require('./src/routes/rolesRoutes');
const bibliotecaRoutes = require('./src/routes/bibliotecaRoutes');
const auditoriaRoutes = require('./src/routes/auditoriaRoutes');

const auditar403 = require('./src/middleware/auditoria403');

const {
  encabezadosSeguridad,
  sinCache,
  PAGINAS_PROTEGIDAS,
  protegerPaginas
} = require('./src/middleware/seguridadMiddleware');

const {
  errorCSRF,
  errorSolicitud,
  rutaNoEncontrada,
  errorInterno
} = require('./src/middleware/erroresMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURACIÓN DE SEGURIDAD
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(encabezadosSeguridad);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// SESIONES ALMACENADAS EN POSTGRESQL
app.use(middlewareSesion);

// AUDITORÍA DE ACCESOS DENEGADOS
app.use(auditar403);

// PÁGINAS PROTEGIDAS Y ARCHIVOS ESTÁTICOS
app.get(PAGINAS_PROTEGIDAS, protegerPaginas);
app.use(express.static(path.join(__dirname, 'public')));

// RUTAS DE LA API
app.use('/api', sinCache);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/biblioteca', bibliotecaRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// COMPROBAR ESTADO DEL SERVIDOR
app.get('/api/estado', (req, res) => {
  return res.status(200).json({
    mensaje: 'Biblioteca Universitaria funcionando'
  });
});

// MANEJO DE ERRORES
app.use(errorCSRF);
app.use(errorSolicitud);
app.use(rutaNoEncontrada);
app.use(errorInterno);

// INICIAR SERVIDOR
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Servidor funcionando en http://localhost:${PORT}`
    );
  });
}

// EXPORTAR APP PARA PRUEBAS AUTOMATIZADAS
module.exports = app;
