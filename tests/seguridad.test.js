
const request = require('supertest');
const app = require('../server');
const pool = require('../src/config/db');

describe('Pruebas automatizadas - Biblioteca Universitaria', () => {

  test('GET /api/estado - servidor funcionando', async () => {
    const respuesta = await request(app)
      .get('/api/estado');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.mensaje).toBe(
      'Biblioteca Universitaria funcionando'
    );
  });

  test('GET /api/usuarios - acceso sin sesión', async () => {
    const respuesta = await request(app)
      .get('/api/usuarios');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.mensaje).toMatch(/iniciar sesión/i);
  });

  test('POST /api/auth/login - contraseña incorrecta', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({
        correo: 'admin@biblioteca.local',
        contrasena: 'ClaveIncorrecta2026!'
      });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.mensaje).toBe(
      'Credenciales incorrectas'
    );
  });

  test('POST /api/auth/login - intento de inyección SQL', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({
        correo: "' OR '1'='1",
        contrasena: 'PruebaSQL2026!'
      });

    expect(respuesta.status).toBe(401);
  });

  test('DELETE /api/usuarios/1 - acceso sin autorización', async () => {
    const respuesta = await request(app)
      .delete('/api/usuarios/1');

    expect(respuesta.status).toBe(403);
  });

  test('PUT /api/usuarios/1 - acceso sin autorización', async () => {
    const respuesta = await request(app)
      .put('/api/usuarios/1')
      .send({
        nombre: 'Cambio no autorizado'
      });

    expect(respuesta.status).toBe(403);
  });

});

afterAll(async () => {
  await pool.end();
});
