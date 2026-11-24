// Utilidades compartidas por las pruebas de seguridad.
// Las pruebas crean sus propios usuarios (correo @test.biblioteca.local,
// identificación TEST-...) y los borran al terminar, junto con los
// registros de auditoría que generaron.

const request = require('supertest');
const bcrypt = require('bcrypt');
const pool = require('../../src/config/db');

const CLAVE = 'PruebaSegura#2026';
const DOMINIO = '@test.biblioteca.local';

// Las pruebas siempre llegan desde la propia máquina
const IPS_LOCALES = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];

let hashClave = null;
let contador = 0;
let ultimoIdAuditoria = 0;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Un solo hash (costo 12) para todos los usuarios de prueba
async function obtenerHash() {
  if (!hashClave) {
    hashClave = await bcrypt.hash(CLAVE, 12);
  }
  return hashClave;
}

function sufijoUnico() {
  contador += 1;
  return `${Date.now().toString(36)}${contador}`;
}

// Crea un usuario con el rol indicado (SuperAdmin, Auditor, Bibliotecario)
async function crearUsuario(nombreRol, etiqueta = 'u') {
  const sufijo = sufijoUnico();
  const correo = `${etiqueta}.${sufijo}${DOMINIO}`;

  const rol = await pool.query(
    'SELECT id FROM public.roles WHERE nombre = $1',
    [nombreRol]
  );

  const resultado = await pool.query(
    `INSERT INTO public.usuarios
     (identificacion, nombre, username, correo, password_hash, rol_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre, username, correo, rol_id`,
    [
      `TEST-${sufijo}`,
      `Usuario Prueba ${nombreRol}`,
      `test_${etiqueta}_${sufijo}`,
      correo,
      await obtenerHash(),
      rol.rows[0].id
    ]
  );

  return { ...resultado.rows[0], clave: CLAVE };
}

// Inicia sesión y devuelve un agente que guarda la cookie
async function iniciarSesion(app, usuario) {
  const agente = request.agent(app);

  const respuesta = await agente
    .post('/api/auth/login')
    .send({ correo: usuario.correo, contrasena: usuario.clave });

  if (respuesta.status !== 200) {
    throw new Error(
      `No se pudo iniciar sesión con ${usuario.correo}: ${respuesta.status}`
    );
  }

  return agente;
}

async function obtenerTokenCsrf(agente) {
  const respuesta = await agente.get('/api/auth/csrf-token');
  return respuesta.body.csrfToken;
}

// Guarda el último id de auditoría para saber qué filas son de la prueba
async function marcarInicioAuditoria() {
  const resultado = await pool.query(
    'SELECT COALESCE(MAX(id), 0)::bigint AS ultimo FROM public.auditoria'
  );
  ultimoIdAuditoria = Number(resultado.rows[0].ultimo);
  return ultimoIdAuditoria;
}

// Espera (hasta unos 6 segundos) a que aparezca un evento nuevo.
// La auditoría de los 403 se guarda justo después de responder.
async function esperarEvento(filtros, desdeId = ultimoIdAuditoria) {
  const condiciones = ['id > $1'];
  const parametros = [desdeId];

  const agregar = (columna, valor, operador = '=') => {
    parametros.push(valor);
    condiciones.push(`${columna} ${operador} $${parametros.length}`);
  };

  if (filtros.tipo) agregar('tipo_evento', filtros.tipo);
  if (filtros.usuarioId !== undefined) {
    if (filtros.usuarioId === null) {
      condiciones.push('usuario_id IS NULL');
    } else {
      agregar('usuario_id', filtros.usuarioId);
    }
  }
  if (filtros.ref) agregar('usuario_ref', filtros.ref);
  if (filtros.ruta) agregar('ruta', filtros.ruta);
  if (filtros.metodo) agregar('metodo', filtros.metodo);
  if (filtros.detalleLike) agregar('detalle', filtros.detalleLike, 'ILIKE');

  for (let intento = 0; intento < 60; intento += 1) {
    const resultado = await pool.query(
      `SELECT * FROM public.auditoria
       WHERE ${condiciones.join(' AND ')}
       ORDER BY id DESC LIMIT 1`,
      parametros
    );

    if (resultado.rows.length > 0) {
      return resultado.rows[0];
    }

    await esperar(100);
  }

  return null;
}

// Borra los usuarios y los registros de auditoría creados por las pruebas
async function limpiar(desdeId = ultimoIdAuditoria) {
  await esperar(300); // dejar terminar auditorías pendientes

  await pool.query(
    `DELETE FROM public.auditoria
     WHERE id > $1 AND ip = ANY($2::text[])`,
    [desdeId, IPS_LOCALES]
  );

  await pool.query(
    `DELETE FROM public.usuarios
     WHERE identificacion LIKE 'TEST-%'
       AND correo LIKE $1`,
    [`%${DOMINIO}`]
  );
}

module.exports = {
  CLAVE,
  DOMINIO,
  esperar,
  crearUsuario,
  iniciarSesion,
  obtenerTokenCsrf,
  marcarInicioAuditoria,
  esperarEvento,
  limpiar
};
