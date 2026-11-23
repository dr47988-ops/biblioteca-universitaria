// Pruebas automatizadas de seguridad - Biblioteca Universitaria (UTN-10)
// Cubren: SQL Injection, XSS, CSRF, control de acceso (403),
// sesión/cookies y encabezados HTTP.

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../server');
const pool = require('../src/config/db');

const {
  DOMINIO,
  crearUsuario,
  iniciarSesion,
  obtenerTokenCsrf,
  marcarInicioAuditoria,
  limpiar
} = require('./helpers/entorno');

let superAdmin;
let auditor;
let bibliotecario;
let inicioAuditoria;

beforeAll(async () => {
  inicioAuditoria = await marcarInicioAuditoria();

  superAdmin = await crearUsuario('SuperAdmin', 'admin');
  auditor = await crearUsuario('Auditor', 'auditor');
  bibliotecario = await crearUsuario('Bibliotecario', 'biblio');
});

afterAll(async () => {
  await limpiar(inicioAuditoria);
  await pool.end();
});

// ---------------------------------------------------------------
describe('Estado del servidor', () => {
  test('TC-00 GET /api/estado responde 200', async () => {
    const respuesta = await request(app).get('/api/estado');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.mensaje).toBe(
      'Biblioteca Universitaria funcionando'
    );
  });
});

// ---------------------------------------------------------------
describe('SQL Injection (UTN-07a)', () => {
  test("TC-01 login con ' OR '1'='1 no da acceso", async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: "' OR '1'='1", contrasena: "' OR '1'='1" });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.mensaje).toBe('Credenciales incorrectas');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  test('TC-02 login con comentario SQL y DROP TABLE no altera la base', async () => {
    const antes = await pool.query(
      'SELECT COUNT(*)::int AS total FROM public.usuarios'
    );

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({
        correo: `${superAdmin.correo}' --`,
        contrasena: "x'; DROP TABLE usuarios; --"
      });

    expect(respuesta.status).toBe(401);

    const despues = await pool.query(
      'SELECT COUNT(*)::int AS total FROM public.usuarios'
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  test('TC-03 login con objetos o arreglos en lugar de texto se rechaza', async () => {
    const intentos = [
      { correo: { $ne: null }, contrasena: { $ne: null } },
      { correo: [superAdmin.correo], contrasena: ['x'] },
      { correo: 12345, contrasena: true }
    ];

    for (const cuerpo of intentos) {
      const respuesta = await request(app)
        .post('/api/auth/login')
        .send(cuerpo);

      expect(respuesta.status).toBe(400);
    }
  });

  test('TC-04 ID con SQL en la URL se rechaza antes de llegar a la base', async () => {
    const agente = await iniciarSesion(app, superAdmin);
    const token = await obtenerTokenCsrf(agente);

    const respuesta = await agente
      .put('/api/usuarios/' + encodeURIComponent('1 OR 1=1'))
      .set('X-CSRF-Token', token)
      .send({
        identificacion: 'X',
        nombre: 'X',
        username: 'x',
        correo: 'x@x.com',
        rol_id: 3
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.mensaje).toBe('ID de usuario inválido');
  });
});

// ---------------------------------------------------------------
describe('XSS (UTN-07b)', () => {
  const payload = '<img src=x onerror=alert(1)>';

  test('TC-05 XSS almacenado: el texto se guarda literal y sale como JSON, no como HTML', async () => {
    const agente = await iniciarSesion(app, superAdmin);
    const token = await obtenerTokenCsrf(agente);
    const sufijo = Date.now().toString(36);

    const registro = await agente
      .post('/api/auth/registro')
      .set('X-CSRF-Token', token)
      .send({
        identificacion: `TEST-xss-${sufijo}`,
        nombre: payload,
        username: `test_xss_${sufijo}`,
        correo: `xss.${sufijo}${DOMINIO}`,
        contrasena: 'PruebaSegura#2026'
      });

    expect(registro.status).toBe(201);

    const lista = await agente.get('/api/usuarios');

    expect(lista.status).toBe(200);
    expect(lista.headers['content-type']).toMatch(/application\/json/);
    expect(lista.headers['x-content-type-options']).toBe('nosniff');

    const guardado = lista.body.usuarios.find(
      (u) => u.username === `test_xss_${sufijo}`
    );
    expect(guardado.nombre).toBe(payload);
  });

  test('TC-06 XSS reflejado: la entrada de la URL no vuelve en la respuesta', async () => {
    const agente = await iniciarSesion(app, superAdmin);
    const script = '<script>alert(1)</script>';

    const conParametro = await agente
      .get('/api/usuarios')
      .query({ q: script });

    expect(conParametro.headers['content-type']).toMatch(/application\/json/);
    expect(conParametro.text).not.toContain('<script>');

    const enLaRuta = await request(app).get(`/${encodeURIComponent(script)}`);

    expect(enLaRuta.status).toBe(404);
    expect(enLaRuta.headers['content-type']).toMatch(/application\/json/);
    expect(enLaRuta.text).not.toContain('<script>');
  });

  test('TC-07 el código del navegador no usa innerHTML con datos ni scripts en línea', () => {
    const carpeta = path.join(__dirname, '..', 'public');
    const archivosJs = fs
      .readdirSync(path.join(carpeta, 'js'))
      .filter((nombre) => nombre.endsWith('.js'))
      .map((nombre) => path.join(carpeta, 'js', nombre));

    const problemas = [];

    archivosJs.forEach((archivo) => {
      const codigo = fs.readFileSync(archivo, 'utf8');
      const nombre = path.basename(archivo);

      if (/outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(codigo)) {
        problemas.push(`${nombre}: usa un método de inserción HTML peligroso`);
      }

      // innerHTML solo se permite con textos fijos (sin variables ni ${})
      const asignaciones = codigo.match(/\.innerHTML\s*=[^;]*;/g) || [];

      asignaciones.forEach((sentencia) => {
        const valor = sentencia.replace(/^\.innerHTML\s*=/, '');
        const sinTextos = valor
          .replace(/'[^'\n]*'/g, '')
          .replace(/"[^"\n]*"/g, '')
          .replace(/`[^`]*`/g, (plantilla) =>
            plantilla.includes('${') ? '${}' : ''
          );

        if (!/^[\s?:;]*(\w+)?[\s?:;]*$/.test(sinTextos)) {
          problemas.push(`${nombre}: innerHTML con datos -> ${sentencia}`);
        }
      });
    });

    const paginas = fs
      .readdirSync(carpeta)
      .filter((nombre) => nombre.endsWith('.html'));

    paginas.forEach((nombre) => {
      const html = fs.readFileSync(path.join(carpeta, nombre), 'utf8');

      if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
        problemas.push(`${nombre}: tiene un <script> en línea`);
      }
      if (/\son[a-z]+\s*=\s*["']/i.test(html)) {
        problemas.push(`${nombre}: tiene un manejador de evento en línea`);
      }
    });

    expect(problemas).toEqual([]);
  });
});

// ---------------------------------------------------------------
describe('CSRF (UTN-07d)', () => {
  test('TC-08 registrar usuario sin token CSRF se rechaza y no crea nada', async () => {
    const agente = await iniciarSesion(app, superAdmin);
    const sufijo = Date.now().toString(36);

    const respuesta = await agente
      .post('/api/auth/registro')
      .send({
        identificacion: `TEST-csrf-${sufijo}`,
        nombre: 'Sin token',
        username: `test_csrf_${sufijo}`,
        correo: `csrf.${sufijo}${DOMINIO}`,
        contrasena: 'PruebaSegura#2026'
      });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.mensaje).toMatch(/CSRF/i);

    const existe = await pool.query(
      'SELECT id FROM public.usuarios WHERE username = $1',
      [`test_csrf_${sufijo}`]
    );
    expect(existe.rows).toHaveLength(0);
  });

  test('TC-09 eliminar usuario con token falso se rechaza y el usuario sigue existiendo', async () => {
    const victima = await crearUsuario('Bibliotecario', 'victima');
    const agente = await iniciarSesion(app, superAdmin);

    const respuesta = await agente
      .delete(`/api/usuarios/${victima.id}`)
      .set('X-CSRF-Token', 'token-inventado-por-el-atacante');

    expect(respuesta.status).toBe(403);

    const existe = await pool.query(
      'SELECT id FROM public.usuarios WHERE id = $1',
      [victima.id]
    );
    expect(existe.rows).toHaveLength(1);
  });

  test('TC-10 con token válido la misma acción sí funciona', async () => {
    const objetivo = await crearUsuario('Bibliotecario', 'editable');
    const agente = await iniciarSesion(app, superAdmin);
    const token = await obtenerTokenCsrf(agente);

    const respuesta = await agente
      .put(`/api/usuarios/${objetivo.id}`)
      .set('X-CSRF-Token', token)
      .send({
        identificacion: `TEST-ed-${objetivo.id}`,
        nombre: 'Nombre editado',
        username: objetivo.username,
        correo: objetivo.correo,
        rol_id: objetivo.rol_id
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.nombre).toBe('Nombre editado');
  });

  test('TC-11 un token de otra sesión no sirve', async () => {
    const sesionA = await iniciarSesion(app, superAdmin);
    const sesionB = await iniciarSesion(app, superAdmin);
    const tokenDeA = await obtenerTokenCsrf(sesionA);

    const victima = await crearUsuario('Bibliotecario', 'cruzado');

    const respuesta = await sesionB
      .delete(`/api/usuarios/${victima.id}`)
      .set('X-CSRF-Token', tokenDeA);

    expect(respuesta.status).toBe(403);
  });

  test('TC-12 cerrar sesión sin token CSRF se rechaza y la sesión sigue activa', async () => {
    const agente = await iniciarSesion(app, auditor);

    const logout = await agente.post('/api/auth/logout');
    expect(logout.status).toBe(403);

    const sesion = await agente.get('/api/auth/mi-sesion');
    expect(sesion.status).toBe(200);
  });
});

// ---------------------------------------------------------------
describe('Control de acceso y RBAC - HTTP 403 (UTN-05, UTN-06)', () => {
  test('TC-13 sin sesión, ninguna ruta protegida responde datos', async () => {
    const rutas = [
      ['get', '/api/usuarios'],
      ['get', '/api/auditoria'],
      ['get', '/api/auth/csrf-token'],
      ['get', '/api/auth/mi-sesion'],
      ['put', '/api/usuarios/1'],
      ['delete', '/api/usuarios/1'],
      ['post', '/api/auth/registro'],
      ['post', '/api/auth/logout']
    ];

    for (const [metodo, ruta] of rutas) {
      const respuesta = await request(app)[metodo](ruta).send({});
      expect([metodo, ruta, respuesta.status]).toEqual([metodo, ruta, 403]);
    }
  });

  test.each([
    ['Auditor', () => auditor],
    ['Bibliotecario', () => bibliotecario]
  ])('TC-14 %s solo lee usuarios: editar, borrar y registrar dan 403', async (_nombre, obtener) => {
    const usuario = obtener();
    const objetivo = await crearUsuario('Bibliotecario', 'objetivo');
    const agente = await iniciarSesion(app, usuario);
    const token = await obtenerTokenCsrf(agente);

    const lectura = await agente.get('/api/usuarios');
    expect(lectura.status).toBe(200);

    const editar = await agente
      .put(`/api/usuarios/${objetivo.id}`)
      .set('X-CSRF-Token', token)
      .send({
        identificacion: 'X',
        nombre: 'Hackeado',
        username: 'x',
        correo: 'x@x.com',
        rol_id: 1
      });
    expect(editar.status).toBe(403);

    const borrar = await agente
      .delete(`/api/usuarios/${objetivo.id}`)
      .set('X-CSRF-Token', token);
    expect(borrar.status).toBe(403);

    const registrar = await agente
      .post('/api/auth/registro')
      .set('X-CSRF-Token', token)
      .send({});
    expect(registrar.status).toBe(403);

    const intacto = await pool.query(
      'SELECT nombre FROM public.usuarios WHERE id = $1',
      [objetivo.id]
    );
    expect(intacto.rows[0].nombre).not.toBe('Hackeado');
  });

  test('TC-15 la respuesta 403 no expone datos sensibles ni trazas', async () => {
    const agente = await iniciarSesion(app, auditor);

    const respuesta = await agente.delete('/api/usuarios/1');

    expect(respuesta.status).toBe(403);
    expect(Object.keys(respuesta.body)).toEqual(['mensaje']);
    expect(respuesta.text).not.toMatch(/stack|node_modules|\bat\s+\S+\s+\(|select\s|postgres|password/i);
  });
});

// ---------------------------------------------------------------
describe('Sesión y cookies (UTN-07c)', () => {
  test('TC-16 la cookie de sesión es HttpOnly, SameSite, dura 60 s y no lleva datos del usuario', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: bibliotecario.correo, contrasena: bibliotecario.clave });

    expect(respuesta.status).toBe(200);

    const cookies = respuesta.headers['set-cookie'];
    expect(cookies).toHaveLength(1);

    const cookie = cookies[0];
    expect(cookie).toMatch(/^connect\.sid=/);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);

    // La cookie vence 60 segundos después de la respuesta
    const vence = new Date(cookie.match(/Expires=([^;]+)/i)[1]).getTime();
    const segundos = (vence - new Date(respuesta.headers.date).getTime()) / 1000;
    expect(segundos).toBeGreaterThanOrEqual(58);
    expect(segundos).toBeLessThanOrEqual(61);

    const valor = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
    expect(valor).toMatch(/^s:[\w-]+\.[\w+/=]+$/);
    expect(valor).not.toContain(bibliotecario.correo);
    expect(valor).not.toContain(bibliotecario.nombre);
    expect(valor).not.toMatch(/rol|usuario|correo/i);
  });

  test('TC-17 en producción con HTTPS la cookie incluye Secure', async () => {
    const entornoAnterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let appProduccion;

    // Se carga otra copia del servidor en modo producción reutilizando
    // la misma conexión a la base de datos.
    jest.isolateModules(() => {
      jest.doMock('../src/config/db', () => pool);
      appProduccion = require('../server');
    });

    process.env.NODE_ENV = entornoAnterior;

    const respuesta = await request(appProduccion)
      .post('/api/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ correo: auditor.correo, contrasena: auditor.clave });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['set-cookie'][0]).toMatch(/;\s*Secure/i);
    expect(respuesta.headers['set-cookie'][0]).toMatch(/;\s*HttpOnly/i);
  });

  test('TC-18 cerrar sesión invalida la cookie en el servidor', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ correo: auditor.correo, contrasena: auditor.clave });

    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const tokenRespuesta = await request(app)
      .get('/api/auth/csrf-token')
      .set('Cookie', cookie);
    expect(tokenRespuesta.status).toBe(200);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', tokenRespuesta.body.csrfToken);
    expect(logout.status).toBe(200);

    const despues = await request(app)
      .get('/api/auth/mi-sesion')
      .set('Cookie', cookie);
    expect(despues.status).toBe(403);
  });
});

// ---------------------------------------------------------------
describe('Encabezados HTTP (UTN-08)', () => {
  const rutas = ['/api/estado', '/', '/admin.html', '/ruta-que-no-existe'];

  test.each(rutas)('TC-19 %s incluye CSP, X-Frame-Options, nosniff y HSTS', async (ruta) => {
    const respuesta = await request(app).get(ruta);
    const h = respuesta.headers;

    expect(h['content-security-policy']).toBeDefined();
    expect(h['x-frame-options']).toMatch(/^(DENY|SAMEORIGIN)$/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('TC-20 la CSP no permite scripts en línea ni eval', async () => {
    const respuesta = await request(app).get('/');
    const csp = respuesta.headers['content-security-policy'];

    const directiva = (nombre) =>
      csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${nombre} `));

    expect(directiva('default-src')).toMatch(/'self'/);
    expect(directiva('script-src')).toBe("script-src 'self'");
    expect(directiva('script-src-attr')).toBe("script-src-attr 'none'");
    expect(directiva('object-src')).toBe("object-src 'none'");
    expect(directiva('frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(csp).not.toMatch(/unsafe-eval/);
  });
});

// ---------------------------------------------------------------
describe('Autenticación (credenciales)', () => {
  test('TC-21 contraseña incorrecta devuelve 401 con mensaje genérico', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: superAdmin.correo, contrasena: 'ClaveIncorrecta2026!' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.mensaje).toBe('Credenciales incorrectas');
  });

  test('TC-22 correo inexistente da el mismo mensaje que contraseña incorrecta', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ correo: `no.existe${DOMINIO}`, contrasena: 'ClaveIncorrecta2026!' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.mensaje).toBe('Credenciales incorrectas');
  });

  test('TC-23 las contraseñas se guardan con bcrypt de costo 12 o más', async () => {
    const hashes = await pool.query(
      'SELECT password_hash FROM public.usuarios WHERE id = $1',
      [superAdmin.id]
    );

    const hash = hashes.rows[0].password_hash;
    const costo = Number(hash.split('$')[2]);

    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(costo).toBeGreaterThanOrEqual(12);
  });
});
