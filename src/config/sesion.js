const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');

// =====================================
// CONFIGURACIÓN DE SESIÓN SEGURA (UTN-07c)
// =====================================

// Nombre propio de la cookie: no revela la tecnología usada
const NOMBRE_COOKIE_SESION = 'biblioteca.sid';

// La sesión expira tras 60 segundos sin solicitudes
const TIEMPO_INACTIVIDAD_MS = 60 * 1000;

const enProduccion = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  throw new Error('Falta SESSION_SECRET en el archivo .env');
}

const middlewareSesion = session({
  name: NOMBRE_COOKIE_SESION,
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    // Evitar temporizadores abiertos durante las pruebas
    pruneSessionInterval: process.env.JEST_WORKER_ID !== undefined ? false : 60
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // Cada solicitud renueva el plazo de 60 segundos
  rolling: true,
  // Al destruir la sesión también se elimina del almacén
  unset: 'destroy',
  cookie: {
    // JavaScript del navegador no puede leer la cookie
    httpOnly: true,
    // Solo se envía por HTTPS en producción
    secure: enProduccion,
    // No se envía en solicitudes iniciadas por otros sitios (CSRF)
    sameSite: 'strict',
    maxAge: TIEMPO_INACTIVIDAD_MS
  }
});

module.exports = {
  NOMBRE_COOKIE_SESION,
  TIEMPO_INACTIVIDAD_MS,
  middlewareSesion
};
