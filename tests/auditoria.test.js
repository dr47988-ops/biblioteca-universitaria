// Pruebas del registro de auditoría (UTN-09)

const request = require('supertest');

const app = require('../server');
const pool = require('../src/config/db');
const { registrarCambioPermisos } = require('../src/services/auditoriaService');

const {
  DOMINIO,
  esperar,
  crearUsuario,
  iniciarSesion,
  obtenerTokenCsrf,
  marcarInicioAuditoria,
  esperarEvento,
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
describe('Inicios de sesión', () => {
  test('TC-25 un inicio de sesión fallido queda registrado con fecha, hora e IP', async () => {
    const desde = await marcarInicioAuditoria();

    await request(app)
      .post('/api/auth/login')
      .send({ correo: bibliotecario.correo, contrasena: 'ClaveIncorrecta2026!' });

    const evento = await esperarEvento(
      { tipo: 'LOGIN_FALLIDO', usuarioId: bibliotecario.id },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.usuario_ref).toBe(bibliotecario.correo);
    expect(evento.ip).toBeTruthy();
    expect(evento.detalle).toBe('Contraseña incorrecta');
    expect(Math.abs(Date.now() - new Date(evento.fecha_hora))).toBeLessThan(60000);
  });

  test('TC-26 un intento con un correo que no existe también se registra', async () => {
    const desde = await marcarInicioAuditoria();
    const correo = `fantasma${DOMINIO}`;

    await request(app)
      .post('/api/auth/login')
      .send({ correo, contrasena: 'ClaveIncorrecta2026!' });

    const evento = await esperarEvento(
      { tipo: 'LOGIN_FALLIDO', ref: correo, usuarioId: null },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.ip).toBeTruthy();
  });

  test('TC-27 un inicio de sesión exitoso queda registrado con el usuario y la IP', async () => {
    const desde = await marcarInicioAuditoria();

    await iniciarSesion(app, auditor);

    const evento = await esperarEvento(
      { tipo: 'LOGIN_EXITOSO', usuarioId: auditor.id },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.usuario_ref).toBe(auditor.correo);
    expect(evento.ip).toBeTruthy();
    expect(evento.ruta).toBe('/api/auth/login');

    const ultimo = await pool.query(
      'SELECT ultimo_inicio_sesion FROM public.usuarios WHERE id = $1',
      [auditor.id]
    );
    expect(ultimo.rows[0].ultimo_inicio_sesion).not.toBeNull();
  });

  test('TC-28 la contraseña escrita nunca se guarda en la auditoría', async () => {
    const desde = await marcarInicioAuditoria();
    const secreto = 'ClaveSecreta-NoGuardar-987';

    await request(app)
      .post('/api/auth/login')
      .send({ correo: bibliotecario.correo, contrasena: secreto });

    await esperarEvento({ tipo: 'LOGIN_FALLIDO', usuarioId: bibliotecario.id }, desde);

    const filas = await pool.query(
      `SELECT id FROM public.auditoria
       WHERE usuario_ref LIKE $1 OR ruta LIKE $1 OR detalle LIKE $1`,
      [`%${secreto}%`]
    );
    expect(filas.rows).toHaveLength(0);
  });

  test("TC-29 un correo con SQL ('); DROP TABLE...) se guarda como texto y no se ejecuta", async () => {
    const desde = await marcarInicioAuditoria();
    const malicioso = "x'); DROP TABLE auditoria; --";

    await request(app)
      .post('/api/auth/login')
      .send({ correo: malicioso, contrasena: 'x' });

    const evento = await esperarEvento(
      { tipo: 'LOGIN_FALLIDO', ref: malicioso },
      desde
    );

    expect(evento).not.toBeNull();

    const existe = await pool.query("SELECT to_regclass('public.auditoria') AS tabla");
    expect(existe.rows[0].tabla).not.toBeNull();
  });
});

// ---------------------------------------------------------------
describe('Accesos denegados 403', () => {
  test('TC-30 un 403 sin sesión registra la ruta, el método y que fue anónimo', async () => {
    const desde = await marcarInicioAuditoria();

    await request(app).get('/api/usuarios');

    const evento = await esperarEvento(
      { tipo: 'ACCESO_DENEGADO', ref: 'anónimo', ruta: '/api/usuarios', metodo: 'GET' },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.usuario_id).toBeNull();
    expect(evento.ip).toBeTruthy();
    expect(evento.fecha_hora).toBeTruthy();
  });

  test('TC-31 un 403 con usuario registra quién fue y la ruta que intentó', async () => {
    const desde = await marcarInicioAuditoria();
    const agente = await iniciarSesion(app, bibliotecario);
    const ruta = '/api/usuarios/999999';

    const respuesta = await agente.delete(ruta);
    expect(respuesta.status).toBe(403);

    const evento = await esperarEvento(
      { tipo: 'ACCESO_DENEGADO', usuarioId: bibliotecario.id, ruta, metodo: 'DELETE' },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.usuario_ref).toBe(bibliotecario.correo);
    expect(evento.detalle).toMatch(/permisos/i);
  });

  test('TC-32 un 403 por token CSRF inválido también queda registrado', async () => {
    const desde = await marcarInicioAuditoria();
    const agente = await iniciarSesion(app, superAdmin);

    const respuesta = await agente
      .post('/api/auth/registro')
      .set('X-CSRF-Token', 'falso')
      .send({});
    expect(respuesta.status).toBe(403);

    const evento = await esperarEvento(
      {
        tipo: 'ACCESO_DENEGADO',
        usuarioId: superAdmin.id,
        ruta: '/api/auth/registro',
        detalleLike: '%CSRF%'
      },
      desde
    );

    expect(evento).not.toBeNull();
  });
});

// ---------------------------------------------------------------
describe('Cambios de rol y permisos', () => {
  test('TC-33 cambiar el rol de un usuario registra quién lo hizo y el rol anterior y nuevo', async () => {
    const objetivo = await crearUsuario('Bibliotecario', 'cambiorol');
    const agente = await iniciarSesion(app, superAdmin);
    const token = await obtenerTokenCsrf(agente);
    const desde = await marcarInicioAuditoria();

    const rolAuditor = await pool.query(
      "SELECT id FROM public.roles WHERE nombre = 'Auditor'"
    );

    const respuesta = await agente
      .put(`/api/usuarios/${objetivo.id}`)
      .set('X-CSRF-Token', token)
      .send({
        identificacion: `TEST-rol-${objetivo.id}`,
        nombre: objetivo.nombre,
        username: objetivo.username,
        correo: objetivo.correo,
        rol_id: rolAuditor.rows[0].id
      });
    expect(respuesta.status).toBe(200);

    const evento = await esperarEvento(
      { tipo: 'CAMBIO_ROL', usuarioId: superAdmin.id },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.usuario_ref).toBe(superAdmin.correo);
    expect(evento.detalle).toContain(objetivo.correo);
    expect(evento.detalle).toContain('de Bibliotecario a Auditor');
    expect(evento.fecha_hora).toBeTruthy();
  });

  test('TC-34 editar un usuario sin cambiar su rol no genera un cambio de rol', async () => {
    const objetivo = await crearUsuario('Bibliotecario', 'mismorol');
    const agente = await iniciarSesion(app, superAdmin);
    const token = await obtenerTokenCsrf(agente);
    const desde = await marcarInicioAuditoria();

    const respuesta = await agente
      .put(`/api/usuarios/${objetivo.id}`)
      .set('X-CSRF-Token', token)
      .send({
        identificacion: `TEST-igual-${objetivo.id}`,
        nombre: 'Solo cambia el nombre',
        username: objetivo.username,
        correo: objetivo.correo,
        rol_id: objetivo.rol_id
      });
    expect(respuesta.status).toBe(200);

    await esperar(500);

    const filas = await pool.query(
      `SELECT id FROM public.auditoria
       WHERE id > $1 AND tipo_evento = 'CAMBIO_ROL'`,
      [desde]
    );
    expect(filas.rows).toHaveLength(0);
  });

  test('TC-35 el cambio de permisos de un rol se registra con los permisos antes y después', async () => {
    const desde = await marcarInicioAuditoria();

    await registrarCambioPermisos(
      {
        method: 'PUT',
        originalUrl: '/api/roles/3/permisos',
        ip: '127.0.0.1',
        session: { usuario: { id: superAdmin.id, correo: superAdmin.correo } }
      },
      'Bibliotecario',
      ['crear', 'editar'],
      ['crear', 'editar', 'borrar']
    );

    const evento = await esperarEvento(
      { tipo: 'CAMBIO_PERMISOS', usuarioId: superAdmin.id },
      desde
    );

    expect(evento).not.toBeNull();
    expect(evento.detalle).toContain('Rol Bibliotecario');
    expect(evento.detalle).toContain('[crear, editar, borrar]');
  });
});

// ---------------------------------------------------------------
describe('Consulta de la auditoría (solo SuperAdmin)', () => {
  test('TC-36 el SuperAdmin consulta los registros, del más reciente al más antiguo', async () => {
    const agente = await iniciarSesion(app, superAdmin);

    const respuesta = await agente.get('/api/auditoria');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
    expect(Array.isArray(respuesta.body.registros)).toBe(true);

    const primero = respuesta.body.registros[0];
    ['id', 'fecha_hora', 'tipo_evento', 'ip', 'ruta'].forEach((campo) => {
      expect(primero).toHaveProperty(campo);
    });

    const fechas = respuesta.body.registros.map((r) => new Date(r.fecha_hora).getTime());
    const ordenadas = [...fechas].sort((a, b) => b - a);
    expect(fechas).toEqual(ordenadas);
  });

  test('TC-37 el filtro por tipo solo devuelve ese tipo', async () => {
    const agente = await iniciarSesion(app, superAdmin);

    const respuesta = await agente
      .get('/api/auditoria')
      .query({ tipo: 'LOGIN_EXITOSO', limite: 20 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.registros.length).toBeGreaterThan(0);
    respuesta.body.registros.forEach((registro) => {
      expect(registro.tipo_evento).toBe('LOGIN_EXITOSO');
    });
  });

  test('TC-38 los filtros inválidos o con SQL se rechazan con 400', async () => {
    const agente = await iniciarSesion(app, superAdmin);

    const intentos = [
      { tipo: "' OR 1=1 --" },
      { tipo: 'LOGIN_EXITOSO; DROP TABLE auditoria' },
      { limite: '0' },
      { limite: '100000' },
      { limite: '5 OR 1=1' },
      { pagina: '-3' }
    ];

    for (const consulta of intentos) {
      const respuesta = await agente.get('/api/auditoria').query(consulta);
      expect([consulta, respuesta.status]).toEqual([consulta, 400]);
    }
  });

  test('TC-39 el Auditor, el Bibliotecario y quien no inició sesión reciben 403', async () => {
    const comoAuditor = await iniciarSesion(app, auditor);
    const comoBibliotecario = await iniciarSesion(app, bibliotecario);

    const respuestas = [
      await comoAuditor.get('/api/auditoria'),
      await comoBibliotecario.get('/api/auditoria'),
      await request(app).get('/api/auditoria')
    ];

    respuestas.forEach((respuesta) => {
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.registros).toBeUndefined();
    });
  });
});
