require('dotenv').config();

const express = require('express');
const path = require('path');

const { middlewareSesion } = require('./src/config/sesion');
const authRoutes = require('./src/routes/authRoutes');
const usuariosRoutes = require('./src/routes/usuariosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Detrás del proxy del hosting (HTTPS) hace falta confiar en él para que
// la cookie Secure funcione y la auditoría guarde la IP real del cliente.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// =====================================
// CONFIGURACIÓN DE SEGURIDAD
// =====================================
// Detrás de un proxy HTTPS (hosting), confiar en el primer proxy
// para que la cookie Secure y la IP del cliente funcionen.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(encabezadosSeguridad);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

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
// PÁGINAS PROTEGIDAS Y ARCHIVOS ESTÁTICOS
// =====================================
app.get(PAGINAS_PROTEGIDAS, protegerPaginas);
app.use(express.static(path.join(__dirname, 'public')));

// =====================================
// RUTAS DE LA API (sin caché)
// =====================================
app.use('/api', sinCache);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

// =====================================
// COMPROBAR ESTADO DEL SERVIDOR
// =====================================
app.get('/api/estado', (req, res) => {
  return res.status(200).json({
    mensaje: 'Biblioteca Universitaria funcionando'
  });
});

// =====================================
// MANEJO DE ERRORES
// =====================================
app.use(errorCSRF);
app.use(errorSolicitud);
app.use(rutaNoEncontrada);
app.use(errorInterno);

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
