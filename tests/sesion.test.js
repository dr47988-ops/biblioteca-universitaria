// UTN-07c: la sesión se invalida tras 60 segundos de inactividad.
// Esta prueba espera 61 segundos reales, por eso va en su propio archivo.

const request = require('supertest');

const app = require('../server');
const pool = require('../src/config/db');

const {
  crearUsuario,
  esperar,
  marcarInicioAuditoria,
  limpiar
} = require('./helpers/entorno');

let usuario;
let inicioAuditoria;

beforeAll(async () => {
  inicioAuditoria = await marcarInicioAuditoria();
  usuario = await crearUsuario('Bibliotecario', 'sesion');
});

afterAll(async () => {
  await limpiar(inicioAuditoria);
  await pool.end();
});

test('TC-24 la sesión se cierra tras 61 segundos sin actividad', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ correo: usuario.correo, contrasena: usuario.clave });

  expect(login.status).toBe(200);

  // Se reenvía la cookie a mano para comprobar que expira en el servidor
  // y no solo en el navegador.
  const cookie = login.headers['set-cookie'][0].split(';')[0];

  const antes = await request(app)
    .get('/api/auth/mi-sesion')
    .set('Cookie', cookie);
  expect(antes.status).toBe(200);

  await esperar(61 * 1000);

  const despues = await request(app)
    .get('/api/auth/mi-sesion')
    .set('Cookie', cookie);
  expect(despues.status).toBe(403);

  const protegida = await request(app)
    .get('/api/usuarios')
    .set('Cookie', cookie);
  expect(protegida.status).toBe(403);
}, 90000);
