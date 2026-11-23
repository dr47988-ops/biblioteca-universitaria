
const pool = require('../config/db');

// Tipos de evento permitidos (deben coincidir con el CHECK de la tabla)
const TIPOS = {
  LOGIN_EXITOSO: 'LOGIN_EXITOSO',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  CAMBIO_ROL: 'CAMBIO_ROL',
  CAMBIO_PERMISOS: 'CAMBIO_PERMISOS',
  ACCESO_DENEGADO: 'ACCESO_DENEGADO'
};

// Corta los textos largos para que nadie llene la tabla con basura
function recortar(texto, largo) {
  if (texto === undefined || texto === null) {
    return null;
  }

  return String(texto).slice(0, largo);
}

// Obtiene la IP del cliente (con trust proxy activo en producción)
function obtenerIp(req) {
  return recortar(req.ip || req.socket?.remoteAddress, 64);
}

// =====================================
// REGISTRAR UN EVENTO
// Nunca lanza error: si la auditoría falla, la aplicación sigue
// funcionando y el problema queda en la consola del servidor.
// =====================================
async function registrar(req, datos) {
  try {
    await pool.query(
      `INSERT INTO public.auditoria
       (tipo_evento, usuario_id, usuario_ref, ip,
        metodo, ruta, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        datos.tipo,
        datos.usuarioId ?? null,
        recortar(datos.usuarioRef, 150),
        obtenerIp(req),
        recortar(req.method, 10),
        recortar(req.originalUrl, 300),
        recortar(datos.detalle, 500)
      ]
    );
  } catch (error) {
    console.error('Error al registrar auditoría:', error.message);
  }
}

// =====================================
// INICIOS DE SESIÓN
// =====================================
function registrarLoginExitoso(req, usuario) {
  return registrar(req, {
    tipo: TIPOS.LOGIN_EXITOSO,
    usuarioId: usuario.id,
    usuarioRef: usuario.correo,
    detalle: 'Inicio de sesión exitoso'
  });
}

// El usuarioId solo se guarda si el correo existe; la contraseña
// que se escribió nunca se guarda.
function registrarLoginFallido(req, correo, usuarioId, motivo) {
  return registrar(req, {
    tipo: TIPOS.LOGIN_FALLIDO,
    usuarioId: usuarioId || null,
    usuarioRef: typeof correo === 'string' ? correo : '(dato no válido)',
    detalle: motivo
  });
}

// =====================================
// ACCESOS DENEGADOS (HTTP 403)
// =====================================
function registrarAccesoDenegado(req, motivo) {
  const usuario = req.session && req.session.usuario;

  return registrar(req, {
    tipo: TIPOS.ACCESO_DENEGADO,
    usuarioId: usuario ? usuario.id : null,
    usuarioRef: usuario ? usuario.correo : 'anónimo',
    detalle: motivo || 'Acceso denegado (403)'
  });
}

// =====================================
// CAMBIOS DE ROL
// "Quién" es el usuario de la sesión; "a quién" va en el detalle.
// =====================================
async function registrarCambioRol(req, objetivo, rolAnteriorId, rolNuevoId) {
  let anterior = String(rolAnteriorId);
  let nuevo = String(rolNuevoId);

  try {
    const roles = await pool.query(
      'SELECT id, nombre FROM public.roles WHERE id = ANY($1::int[])',
      [[rolAnteriorId, rolNuevoId]]
    );

    roles.rows.forEach((rol) => {
      if (rol.id === rolAnteriorId) anterior = rol.nombre;
      if (rol.id === rolNuevoId) nuevo = rol.nombre;
    });
  } catch (error) {
    console.error('Error al buscar nombres de rol:', error.message);
  }

  const autor = req.session && req.session.usuario;

  return registrar(req, {
    tipo: TIPOS.CAMBIO_ROL,
    usuarioId: autor ? autor.id : null,
    usuarioRef: autor ? autor.correo : null,
    detalle:
      `Usuario #${objetivo.id} (${objetivo.correo}): ` +
      `rol cambiado de ${anterior} a ${nuevo}`
  });
}

// =====================================
// CAMBIOS DE PERMISOS DE UN ROL
// Pensada para que el módulo de roles la llame al asignar o quitar
// permisos. Recibe los nombres de permisos antes y después del cambio.
// =====================================
function registrarCambioPermisos(req, rolNombre, antes, despues) {
  const autor = req.session && req.session.usuario;

  return registrar(req, {
    tipo: TIPOS.CAMBIO_PERMISOS,
    usuarioId: autor ? autor.id : null,
    usuarioRef: autor ? autor.correo : null,
    detalle:
      `Rol ${rolNombre}: permisos [${antes.join(', ')}] ` +
      `cambiados a [${despues.join(', ')}]`
  });
}

module.exports = {
  TIPOS,
  registrar,
  registrarLoginExitoso,
  registrarLoginFallido,
  registrarAccesoDenegado,
  registrarCambioRol,
  registrarCambioPermisos
};
