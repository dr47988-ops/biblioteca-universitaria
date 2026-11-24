const pool = require('../config/db');

// Nombre del rol con control total (UTN-06)
const ROL_SUPERADMIN = 'SuperAdmin';

// Permisos independientes del sistema (UTN-05)
const PERMISOS = Object.freeze({
  CREAR: 'crear',
  EDITAR: 'editar',
  BORRAR: 'borrar',
  VER_REPORTES: 'ver_reportes'
});

// =====================================
// RESPUESTA ÚNICA PARA ACCESOS DENEGADOS
// =====================================
// Todas las respuestas 403 pasan por aquí para que el mensaje
// nunca exponga datos internos y para que el registro de
// auditoría (UTN-09) pueda conectarse en un solo lugar.
const denegarAcceso = (
  req,
  res,
  mensaje = 'No tiene permisos para realizar esta acción.'
) => {
  return res.status(403).json({ mensaje });
};

// =====================================
// VERIFICAR SESIÓN ACTIVA
// =====================================
const verificarSesion = (req, res, next) => {
  if (!req.session || !req.session.usuario) {
    return denegarAcceso(
      req,
      res,
      'Acceso denegado. Debe iniciar sesión.'
    );
  }

  next();
};

// =====================================
// CARGAR ROL Y PERMISOS DESDE LA BASE DE DATOS
// =====================================
// Se consultan en cada solicitud para que un cambio de rol o de
// permisos tenga efecto inmediato, sin esperar un nuevo login.
const cargarAcceso = async (req, res, next) => {
  if (req.acceso) {
    return next();
  }

  const { rows } = await pool.query(
    `SELECT r.id AS rol_id,
            r.nombre AS rol,
            COALESCE(
              array_agg(p.nombre ORDER BY p.id)
                FILTER (WHERE p.nombre IS NOT NULL),
              ARRAY[]::varchar[]
            ) AS permisos
     FROM public.usuarios u
     INNER JOIN public.roles r ON r.id = u.rol_id
     LEFT JOIN public.rol_permiso rp ON rp.rol_id = r.id
     LEFT JOIN public.permisos p ON p.id = rp.permiso_id
     WHERE u.id = $1
     GROUP BY r.id, r.nombre`,
    [req.session.usuario.id]
  );

  // El usuario fue eliminado mientras tenía una sesión abierta
  if (rows.length === 0) {
    req.session.destroy(() => {});

    return denegarAcceso(
      req,
      res,
      'Acceso denegado. Debe iniciar sesión.'
    );
  }

  req.acceso = {
    rolId: rows[0].rol_id,
    rol: rows[0].rol,
    permisos: rows[0].permisos,
    esSuperAdmin: rows[0].rol === ROL_SUPERADMIN
  };

  // Mantener la sesión sincronizada con el rol actual
  req.session.usuario.rol_id = rows[0].rol_id;

  next();
};

// =====================================
// EXIGIR AL MENOS UNO DE LOS PERMISOS INDICADOS
// =====================================
const requierePermiso = (...permisosRequeridos) => {
  return [
    verificarSesion,
    cargarAcceso,
    (req, res, next) => {
      const autorizado = permisosRequeridos.some(
        (permiso) => req.acceso.permisos.includes(permiso)
      );

      if (!autorizado) {
        return denegarAcceso(req, res);
      }

      next();
    }
  ];
};

// =====================================
// EXIGIR ROL SUPERADMIN
// =====================================
// Usuarios, roles y asignación de permisos (UTN-06)
const soloSuperAdmin = [
  verificarSesion,
  cargarAcceso,
  (req, res, next) => {
    if (!req.acceso.esSuperAdmin) {
      return denegarAcceso(req, res);
    }

    next();
  }
];

// =====================================
// EXIGIR CUALQUIER SESIÓN VÁLIDA CON ROL VIGENTE
// =====================================
const usuarioAutenticado = [verificarSesion, cargarAcceso];

module.exports = {
  ROL_SUPERADMIN,
  PERMISOS,
  denegarAcceso,
  verificarSesion,
  cargarAcceso,
  requierePermiso,
  soloSuperAdmin,
  usuarioAutenticado
};
