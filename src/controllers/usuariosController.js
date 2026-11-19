
const pool = require('../config/db');

// =====================================
// OBTENER LA LISTA DE USUARIOS
// =====================================
const listarUsuarios = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        u.id,
        u.identificacion,
        u.nombre,
        u.username,
        u.correo,
        u.rol_id,
        r.nombre AS rol, COALESCE((SELECT array_agg(p.nombre ORDER BY p.id) FROM public.rol_permiso rp JOIN public.permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=u.rol_id), ARRAY[]::varchar[]) AS permisos, u.ultimo_inicio_sesion,
        u.creado_en
      FROM public.usuarios u
      INNER JOIN public.roles r
        ON u.rol_id = r.id
      ORDER BY u.id ASC
    `);

    return res.status(200).json({
      mensaje: 'Usuarios obtenidos correctamente',
      usuarios: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al consultar usuarios:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'Error interno al consultar usuarios'
    });
  }
};

// =====================================
// ACTUALIZAR USUARIO
// =====================================
const actualizarUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      identificacion,
      nombre,
      username,
      correo,
      rol_id
    } = req.body;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'ID de usuario inválido'
      });
    }

    if (
      typeof identificacion !== 'string' ||
      typeof nombre !== 'string' ||
      typeof username !== 'string' ||
      typeof correo !== 'string' ||
      !identificacion.trim() ||
      !nombre.trim() ||
      !username.trim() ||
      !correo.trim() ||
      !Number.isInteger(rol_id)
    ) {
      return res.status(400).json({
        mensaje: 'Debe proporcionar datos válidos'
      });
    }

    // Evitar que el administrador cambie su propio rol
    if (
      id === req.session.usuario.id &&
      rol_id !== req.session.usuario.rol_id
    ) {
      return res.status(403).json({
        mensaje: 'No puede cambiar su propio rol'
      });
    }

    const resultado = await pool.query(
      `UPDATE public.usuarios
       SET identificacion = $1,
           nombre = $2,
           username = $3,
           correo = $4,
           rol_id = $5
       WHERE id = $6
       RETURNING
         id,
         identificacion,
         nombre,
         username,
         correo,
         rol_id`,
      [
        identificacion.trim(),
        nombre.trim(),
        username.trim(),
        correo.trim(),
        rol_id,
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      mensaje: 'Usuario actualizado correctamente',
      usuario: resultado.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'Identificación, usuario o correo duplicado'
      });
    }

    if (error.code === '23503') {
      return res.status(400).json({
        mensaje: 'El rol indicado no existe'
      });
    }

    console.error(
      'Error al actualizar usuario:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'Error interno al actualizar usuario'
    });
  }
};

// =====================================
// ELIMINAR USUARIO
// =====================================
const eliminarUsuario = async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Validar ID
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'ID de usuario inválido'
      });
    }

    // Impedir que el SuperAdmin elimine su cuenta
    if (id === req.session.usuario.id) {
      return res.status(403).json({
        mensaje: 'No puede eliminar su propia cuenta'
      });
    }

    // Eliminar usuario
    const resultado = await pool.query(
      `DELETE FROM public.usuarios
       WHERE id = $1
       RETURNING id, nombre, correo`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      mensaje: 'Usuario eliminado correctamente',
      usuario: resultado.rows[0]
    });

  } catch (error) {
    // El usuario tiene registros relacionados
    if (error.code === '23503') {
      return res.status(409).json({
        mensaje:
          'No se puede eliminar el usuario porque tiene registros relacionados'
      });
    }

    console.error(
      'Error al eliminar usuario:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'Error interno al eliminar usuario'
    });
  }
};

// =====================================
// EXPORTAR FUNCIONES
// =====================================
module.exports = {
  listarUsuarios,
  actualizarUsuario,
  eliminarUsuario
};
