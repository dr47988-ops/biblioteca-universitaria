const request = require('supertest');
const app = require('../server');
const pool = require('../src/config/db');

// =====================================
// SEGURIDAD DEL MÓDULO DE BIBLIOTECA
// =====================================
// Dato sensible del dominio: historial de lectura y datos de
// contacto de los socios. Las pruebas con usuarios usan las
// variables TEST_* de .env; si no existen, se omiten.

const credenciales = (prefijo) => {
  const correo = process.env[`TEST_${prefijo}_CORREO`];
  const contrasena = process.env[`TEST_${prefijo}_CONTRASENA`];
  return correo && contrasena ? { correo, contrasena } : null;
};

const AUDITOR = credenciales('AUDITOR');
const BIBLIOTECARIO = credenciales('BIBLIOTECARIO');

const siHay = (cuenta) => (cuenta ? test : test.skip);

async function iniciarSesion(cuenta) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send(cuenta);

  expect(respuesta.status).toBe(200);
  return agente;
}

async function tokenCSRF(agente) {
  const respuesta = await agente.get('/api/auth/csrf-token');
  expect(respuesta.status).toBe(200);
  return respuesta.body.csrfToken;
}

describe('Biblioteca sin sesión', () => {
  test.each([
    ['get', '/api/biblioteca/permisos'],
    ['get', '/api/biblioteca/libros'],
    ['post', '/api/biblioteca/libros'],
    ['put', '/api/biblioteca/libros/1'],
    ['delete', '/api/biblioteca/libros/1'],
    ['get', '/api/biblioteca/socios'],
    ['post', '/api/biblioteca/socios'],
    ['get', '/api/biblioteca/prestamos'],
    ['post', '/api/biblioteca/prestamos'],
    ['get', '/api/biblioteca/prestamos/vencidos'],
    ['post', '/api/biblioteca/prestamos/1/devolucion']
  ])('%s %s responde 403', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);

    expect(respuesta.status).toBe(403);
    expect(Object.keys(respuesta.body)).toEqual(['mensaje']);
  });

  test('la página de biblioteca redirige al login', async () => {
    const respuesta = await request(app).get('/biblioteca.html');

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toBe('/?sesion=expirada');
  });
});

describe('Auditor: solo lectura del catálogo', () => {
  siHay(AUDITOR)('puede consultar el catálogo', async () => {
    const agente = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/biblioteca/libros');

    expect(respuesta.status).toBe(200);
  });

  siHay(AUDITOR)('no accede a los datos de socios (dato sensible)', async () => {
    const agente = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/biblioteca/socios');

    expect(respuesta.status).toBe(403);
  });

  siHay(AUDITOR)('no accede a los préstamos activos (historial)', async () => {
    const agente = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/biblioteca/prestamos');

    expect(respuesta.status).toBe(403);
  });

  siHay(AUDITOR)('no puede crear libros aunque envíe token CSRF', async () => {
    const agente = await iniciarSesion(AUDITOR);

    const respuesta = await agente
      .post('/api/biblioteca/libros')
      .set('X-CSRF-Token', await tokenCSRF(agente))
      .send({
        isbn: 'AUD-0001',
        titulo: 'No autorizado',
        autor: 'Auditor',
        categoria: 'Prueba',
        cantidad_disponible: 1,
        ubicacion: 'Z9'
      });

    expect(respuesta.status).toBe(403);
  });

  siHay(AUDITOR)('el reporte de vencidos no expone correos de socios', async () => {
    const agente = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/biblioteca/prestamos/vencidos');

    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/correo|@/i);
  });
});

describe('Bibliotecario: CRUD con datos mínimos', () => {
  siHay(BIBLIOTECARIO)('la lista de socios no incluye correos', async () => {
    const agente = await iniciarSesion(BIBLIOTECARIO);

    const respuesta = await agente.get('/api/biblioteca/socios');

    expect(respuesta.status).toBe(200);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/correo|@/i);
  });

  siHay(BIBLIOTECARIO)('tiene permiso borrar (404 si el libro no existe)', async () => {
    const agente = await iniciarSesion(BIBLIOTECARIO);

    const respuesta = await agente
      .delete('/api/biblioteca/libros/2147483647')
      .set('X-CSRF-Token', await tokenCSRF(agente));

    expect(respuesta.status).toBe(404);
  });

  siHay(BIBLIOTECARIO)('crear libro sin token CSRF es rechazado', async () => {
    const agente = await iniciarSesion(BIBLIOTECARIO);

    const respuesta = await agente
      .post('/api/biblioteca/libros')
      .send({ isbn: 'CSRF-0001' });

    expect(respuesta.status).toBe(403);
  });

  siHay(BIBLIOTECARIO)('TC-02: búsqueda con UNION SELECT no expone datos', async () => {
    const agente = await iniciarSesion(BIBLIOTECARIO);
    const ataque = "' UNION SELECT id, correo, password_hash, nombre, username, 1, 'x' FROM usuarios --";

    const respuesta = await agente
      .get('/api/biblioteca/libros')
      .query({ q: ataque });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/\$2[aby]\$/);
  });

  siHay(BIBLIOTECARIO)('TC-03: script en la búsqueda se devuelve como JSON, no HTML', async () => {
    const agente = await iniciarSesion(BIBLIOTECARIO);

    const respuesta = await agente
      .get('/api/biblioteca/libros')
      .query({ q: '<script>alert(1)</script>' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/application\/json/);
    expect(respuesta.text).not.toContain('<script>');
  });
});

afterAll(async () => {
  await pool.end();
});
