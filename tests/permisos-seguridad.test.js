const request = require('supertest');
const app = require('../server');
const pool = require('../src/config/db');

// =====================================
// PRUEBAS DE PERMISOS, SESIÓN, CSRF Y ENCABEZADOS (PERSONA 3)
// =====================================
// Las pruebas con usuarios reales se activan definiendo en .env:
//   TEST_ADMIN_CORREO, TEST_ADMIN_CONTRASENA
//   TEST_AUDITOR_CORREO, TEST_AUDITOR_CONTRASENA
//   TEST_BIBLIOTECARIO_CORREO, TEST_BIBLIOTECARIO_CONTRASENA
// Si no existen, esas pruebas se omiten (no fallan).

const credenciales = (prefijo) => {
  const correo = process.env[`TEST_${prefijo}_CORREO`];
  const contrasena = process.env[`TEST_${prefijo}_CONTRASENA`];
  return correo && contrasena ? { correo, contrasena } : null;
};

const ADMIN = credenciales('ADMIN');
const AUDITOR = credenciales('AUDITOR');
const BIBLIOTECARIO = credenciales('BIBLIOTECARIO');

const siHay = (cuenta) => (cuenta ? test : test.skip);

async function iniciarSesion(cuenta) {
  const agente = request.agent(app);
  const respuesta = await agente.post('/api/auth/login').send(cuenta);

  expect(respuesta.status).toBe(200);
  return { agente, respuesta };
}

async function tokenCSRF(agente) {
  const respuesta = await agente.get('/api/auth/csrf-token');
  expect(respuesta.status).toBe(200);
  return respuesta.body.csrfToken;
}

describe('Encabezados HTTP de seguridad (UTN-08)', () => {
  test('incluye CSP, X-Frame-Options, nosniff y HSTS', async () => {
    const respuesta = await request(app).get('/api/estado');

    expect(respuesta.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(respuesta.headers['content-security-policy']).toMatch(/script-src 'self'/);
    expect(respuesta.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  test('las respuestas de la API no se guardan en caché', async () => {
    const respuesta = await request(app).get('/api/estado');

    expect(respuesta.headers['cache-control']).toBe('no-store');
  });
});

describe('Control de acceso sin sesión (UTN-05, UTN-06, UTN-07c)', () => {
  test.each([
    ['get', '/api/roles'],
    ['get', '/api/roles/permisos'],
    ['post', '/api/roles'],
    ['put', '/api/roles/1'],
    ['delete', '/api/roles/1'],
    ['post', '/api/auth/registro'],
    ['get', '/api/auth/mi-sesion']
  ])('%s %s responde 403 sin exponer datos', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);

    expect(respuesta.status).toBe(403);
    expect(Object.keys(respuesta.body)).toEqual(['mensaje']);
  });

  test('el panel administrativo redirige al login sin sesión', async () => {
    const respuesta = await request(app).get('/admin.html');

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toBe('/?sesion=expirada');
  });
});

describe('Errores controlados', () => {
  test('JSON malformado responde 400 sin trazas', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"correo": ');

    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/at |SyntaxError|node_modules/);
  });

  test('ruta inexistente responde 404 genérico', async () => {
    const respuesta = await request(app).get('/api/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ mensaje: 'Ruta no encontrada' });
  });
});

describe('Sesión y cookies (UTN-07c)', () => {
  siHay(ADMIN)('la cookie de sesión es HttpOnly, SameSite y sin datos del usuario', async () => {
    const { respuesta } = await iniciarSesion(ADMIN);
    const cookie = respuesta.headers['set-cookie'].find((c) => c.startsWith('biblioteca.sid='));

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Max-Age=60/);
    expect(decodeURIComponent(cookie)).not.toContain(ADMIN.correo);
  });

  siHay(ADMIN)('la sesión se invalida en el servidor tras 60 s de inactividad', async () => {
    const { respuesta } = await iniciarSesion(ADMIN);
    const cookie = respuesta.headers['set-cookie']
      .find((c) => c.startsWith('biblioteca.sid='))
      .split(';')[0];

    await new Promise((resolver) => setTimeout(resolver, 61 * 1000));

    // Se envía la cookie a mano para comprobar el servidor, no el navegador
    const despues = await request(app).get('/api/auth/mi-sesion').set('Cookie', cookie);

    expect(despues.status).toBe(403);
  }, 75 * 1000);
});

describe('CSRF (UTN-07d)', () => {
  siHay(ADMIN)('crear rol sin token CSRF es rechazado', async () => {
    const { agente } = await iniciarSesion(ADMIN);

    const respuesta = await agente
      .post('/api/roles')
      .send({ nombre: 'Rol Sin Token', permisos: [] });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.mensaje).toMatch(/CSRF/);
  });

  siHay(ADMIN)('token CSRF falso es rechazado', async () => {
    const { agente } = await iniciarSesion(ADMIN);

    const respuesta = await agente
      .put('/api/usuarios/1')
      .set('X-CSRF-Token', 'token-falso')
      .send({});

    expect(respuesta.status).toBe(403);
  });
});

describe('Permisos por rol (UTN-05, UTN-06)', () => {
  siHay(AUDITOR)('TC-06: Auditor no puede consultar roles', async () => {
    const { agente } = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/roles');

    expect(respuesta.status).toBe(403);
  });

  siHay(AUDITOR)('Auditor puede leer usuarios', async () => {
    const { agente } = await iniciarSesion(AUDITOR);

    const respuesta = await agente.get('/api/usuarios');

    expect(respuesta.status).toBe(200);
  });

  siHay(BIBLIOTECARIO)('TC-07: Bibliotecario no puede borrar usuarios por API', async () => {
    const { agente } = await iniciarSesion(BIBLIOTECARIO);
    const token = await tokenCSRF(agente);

    const respuesta = await agente
      .delete('/api/usuarios/1')
      .set('X-CSRF-Token', token);

    expect(respuesta.status).toBe(403);
  });

  siHay(BIBLIOTECARIO)('Bibliotecario no puede crear roles aunque envíe token', async () => {
    const { agente } = await iniciarSesion(BIBLIOTECARIO);
    const token = await tokenCSRF(agente);

    const respuesta = await agente
      .post('/api/roles')
      .set('X-CSRF-Token', token)
      .send({ nombre: 'Escalada', permisos: [1, 2, 3, 4] });

    expect(respuesta.status).toBe(403);
  });

  siHay(ADMIN)('SuperAdmin crea, edita y elimina un rol', async () => {
    const { agente } = await iniciarSesion(ADMIN);
    const nombre = `Prueba ${Date.now()}`;

    const permisos = (await agente.get('/api/roles/permisos')).body.permisos;
    const verReportes = permisos.find((p) => p.nombre === 'ver_reportes').id;

    const creado = await agente
      .post('/api/roles')
      .set('X-CSRF-Token', await tokenCSRF(agente))
      .send({ nombre, descripcion: 'Rol temporal', permisos: [verReportes] });

    expect(creado.status).toBe(201);
    expect(creado.body.rol.permisos).toEqual(['ver_reportes']);

    const editado = await agente
      .put(`/api/roles/${creado.body.rol.id}`)
      .set('X-CSRF-Token', await tokenCSRF(agente))
      .send({ nombre, descripcion: 'Rol temporal editado', permisos: [] });

    expect(editado.status).toBe(200);
    expect(editado.body.rol.permisos).toEqual([]);

    const eliminado = await agente
      .delete(`/api/roles/${creado.body.rol.id}`)
      .set('X-CSRF-Token', await tokenCSRF(agente));

    expect(eliminado.status).toBe(200);
  });

  siHay(ADMIN)('XSS almacenado: nombre de rol con etiquetas es rechazado', async () => {
    const { agente } = await iniciarSesion(ADMIN);

    const respuesta = await agente
      .post('/api/roles')
      .set('X-CSRF-Token', await tokenCSRF(agente))
      .send({ nombre: '<img src=x onerror=alert(1)>', permisos: [] });

    expect(respuesta.status).toBe(400);
  });

  siHay(ADMIN)('los roles base no se pueden eliminar', async () => {
    const { agente } = await iniciarSesion(ADMIN);
    const roles = (await agente.get('/api/roles')).body.roles;
    const superAdmin = roles.find((rol) => rol.nombre === 'SuperAdmin');

    const respuesta = await agente
      .delete(`/api/roles/${superAdmin.id}`)
      .set('X-CSRF-Token', await tokenCSRF(agente));

    expect(respuesta.status).toBe(400);
  });
});

afterAll(async () => {
  await pool.end();
});
