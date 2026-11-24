const pool = require('../config/db');
const validar = require('../utils/validacion');
const { ROL_SUPERADMIN } = require('../middleware/authMiddleware');

// Roles requeridos por el enunciado: no se pueden renombrar ni borrar
const ROLES_BASE = [ROL_SUPERADMIN, 'Auditor', 'Bibliotecario'];

// Letras (con tildes), números, espacios, guion y guion bajo
const PATRON_NOMBRE_ROL = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

// =====================================
// UTILIDADES INTERNAS
// =====================================
function errorHttp(status, mensaje) {
  return Object.assign(new Error(mensaje), { status, expuesto: true });
}

function datosRol(body) {
  return {
    nombre: validar.texto(body.nombre, 'Nombre del rol', {
      min: 3,
      max: 50,
      patron: PATRON_NOMBRE_ROL
    }),
    descripcion: validar.texto(body.descripcion, 'Descripción', {
      max: 200,
      opcional: true
    }),
    permisos: validar.listaIds(body.permisos ?? [], 'Permisos')
  };
}

async function transaccion(operacion) {
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await operacion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

async function asignarPermisos(cliente, rolId, permisos) {
  if (permisos.length > 0) {
    const existentes = await cliente.query(
      'SELECT id FROM public.permisos WHERE id = ANY($1::int[])',
      [permisos]
    );

    if (existentes.rowCount !== permisos.length) {
      throw errorHttp(400, 'Uno o más permisos no existen.');
    }
  }

  await cliente.query(
    'DELETE FROM public.rol_permiso WHERE rol_id = $1',
    [rolId]
  );

  if (permisos.length > 0) {
    await cliente.query(
      `INSERT INTO public.rol_permiso (rol_id, permiso_id)
       SELECT $1, UNNEST($2::int[])`,
      [rolId, permisos]
    );
  }
}

async function obtenerRol(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT r.id,
            r.nombre,
            r.descripcion,
            COALESCE(
              array_agg(p.nombre ORDER BY p.id)
                FILTER (WHERE p.id IS NOT NULL),
              ARRAY[]::varchar[]
            ) AS permisos,
            COALESCE(
              array_agg(p.id ORDER BY p.id)
                FILTER (WHERE p.id IS NOT NULL),
              ARRAY[]::int[]
            ) AS permisos_ids,
            (SELECT COUNT(*)::int
               FROM public.usuarios u
              WHERE u.rol_id = r.id) AS total_usuarios
     FROM public.roles r
     LEFT JOIN public.rol_permiso rp ON rp.rol_id = r.id
     LEFT JOIN public.permisos p ON p.id = rp.permiso_id
     WHERE ($1::int IS NULL OR r.id = $1)
     GROUP BY r.id
     ORDER BY r.id`,
    [id]
  );

  return rows.map((rol) => ({
    ...rol,
    es_base: ROLES_BASE.includes(rol.nombre)
  }));
}

function responderError(res, error, accion) {
  if (error instanceof validar.ErrorValidacion || error.expuesto) {
    return res.status(error.status).json({ mensaje: error.message });
  }

  if (error.code === '23505') {
    return res.status(409).json({ mensaje: 'Ya existe un rol con ese nombre.' });
  }

  console.error(`Error al ${accion}:`, error.message);

  return res.status(500).json({
    mensaje: `Error interno al ${accion}`
  });
}

// =====================================
// LISTAR ROLES CON SUS PERMISOS
// =====================================
const listarRoles = async (req, res) => {
  try {
    const roles = await obtenerRol(pool, null);

    return res.status(200).json({ roles });
  } catch (error) {
    return responderError(res, error, 'consultar roles');
  }
};

// =====================================
// LISTAR CATÁLOGO DE PERMISOS
// =====================================
const listarPermisos = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, descripcion FROM public.permisos ORDER BY id'
    );

    return res.status(200).json({ permisos: rows });
  } catch (error) {
    return responderError(res, error, 'consultar permisos');
  }
};

// =====================================
// CREAR ROL
// =====================================
const crearRol = async (req, res) => {
  try {
    const datos = datosRol(req.body);

    const rol = await transaccion(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO public.roles (nombre, descripcion)
         VALUES ($1, $2)
         RETURNING id`,
        [datos.nombre, datos.descripcion]
      );

      await asignarPermisos(cliente, rows[0].id, datos.permisos);

      return (await obtenerRol(cliente, rows[0].id))[0];
    });

    return res.status(201).json({
      mensaje: 'Rol creado correctamente',
      rol
    });
  } catch (error) {
    return responderError(res, error, 'crear el rol');
  }
};

// =====================================
// EDITAR ROL Y SUS PERMISOS
// =====================================
const actualizarRol = async (req, res) => {
  try {
    const id = validar.id(req.params.id, 'ID de rol');
    const datos = datosRol(req.body);

    const rol = await transaccion(async (cliente) => {
      const actual = await cliente.query(
        'SELECT nombre FROM public.roles WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (actual.rows.length === 0) {
        throw errorHttp(404, 'Rol no encontrado.');
      }

      const nombreActual = actual.rows[0].nombre;

      if (ROLES_BASE.includes(nombreActual) && datos.nombre !== nombreActual) {
        throw errorHttp(400, 'Los roles base no se pueden renombrar.');
      }

      await cliente.query(
        `UPDATE public.roles
         SET nombre = $1, descripcion = $2
         WHERE id = $3`,
        [datos.nombre, datos.descripcion, id]
      );

      // El SuperAdmin conserva siempre todos los permisos para que
      // nadie pueda quedarse sin acceso a la administración.
      if (nombreActual === ROL_SUPERADMIN) {
        await cliente.query(
          `INSERT INTO public.rol_permiso (rol_id, permiso_id)
           SELECT $1, id FROM public.permisos
           ON CONFLICT DO NOTHING`,
          [id]
        );
      } else {
        await asignarPermisos(cliente, id, datos.permisos);
      }

      return (await obtenerRol(cliente, id))[0];
    });

    return res.status(200).json({
      mensaje: 'Rol actualizado correctamente',
      rol
    });
  } catch (error) {
    return responderError(res, error, 'actualizar el rol');
  }
};

// =====================================
// ELIMINAR ROL
// =====================================
const eliminarRol = async (req, res) => {
  try {
    const id = validar.id(req.params.id, 'ID de rol');

    const rol = await transaccion(async (cliente) => {
      const actual = await cliente.query(
        'SELECT id, nombre FROM public.roles WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (actual.rows.length === 0) {
        throw errorHttp(404, 'Rol no encontrado.');
      }

      if (ROLES_BASE.includes(actual.rows[0].nombre)) {
        throw errorHttp(400, 'Los roles base no se pueden eliminar.');
      }

      const usuarios = await cliente.query(
        'SELECT 1 FROM public.usuarios WHERE rol_id = $1 LIMIT 1',
        [id]
      );

      if (usuarios.rows.length > 0) {
        throw errorHttp(
          409,
          'No se puede eliminar un rol que tiene usuarios asignados.'
        );
      }

      await cliente.query(
        'DELETE FROM public.rol_permiso WHERE rol_id = $1',
        [id]
      );

      await cliente.query(
        'DELETE FROM public.roles WHERE id = $1',
        [id]
      );

      return actual.rows[0];
    });

    return res.status(200).json({
      mensaje: 'Rol eliminado correctamente',
      rol
    });
  } catch (error) {
    return responderError(res, error, 'eliminar el rol');
  }
};

module.exports = {
  listarRoles,
  listarPermisos,
  crearRol,
  actualizarRol,
  eliminarRol
};
