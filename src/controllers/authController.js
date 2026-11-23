
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const {
  registrarLoginExitoso,
  registrarLoginFallido
} = require('../services/auditoriaService');

// =====================================
// REGISTRAR USUARIO
// =====================================
const registrar = async (req, res) => {
  try {
    const {
      identificacion,
      nombre,
      username,
      correo,
      contrasena
    } = req.body;

    if (
      typeof identificacion !== 'string' ||
      typeof nombre !== 'string' ||
      typeof username !== 'string' ||
      typeof correo !== 'string' ||
      typeof contrasena !== 'string' ||
      !identificacion.trim() ||
      !nombre.trim() ||
      !username.trim() ||
      !correo.trim() ||
      !contrasena
    ) {
      return res.status(400).json({
        mensaje: 'Todos los campos son obligatorios'
      });
    }

    if (contrasena.length < 8) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    const existe = await pool.query(
      `SELECT id FROM usuarios
       WHERE correo = $1
          OR username = $2
          OR identificacion = $3`,
      [
        correo.trim(),
        username.trim(),
        identificacion.trim()
      ]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        mensaje: 'El usuario, correo o identificación ya existe'
      });
    }

    const rol = await pool.query(
      `SELECT id FROM roles
       WHERE nombre = $1`,
      ['Bibliotecario']
    );

    if (rol.rows.length === 0) {
      return res.status(500).json({
        mensaje: 'No se encontró el rol predeterminado'
      });
    }

    // Cifrar contraseña con bcrypt (12 rondas)
    const hash = await bcrypt.hash(contrasena, 12);

    const resultado = await pool.query(
      `INSERT INTO usuarios
       (identificacion, nombre, username,
        correo, password_hash, rol_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, identificacion, nombre,
                 username, correo, rol_id`,
      [
        identificacion.trim(),
        nombre.trim(),
        username.trim(),
        correo.trim(),
        hash,
        rol.rows[0].id
      ]
    );

    return res.status(201).json({
      mensaje: 'Usuario registrado correctamente',
      usuario: resultado.rows[0]
    });

  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'El usuario, correo o identificación ya existe'
      });
    }

    console.error('Error al registrar:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

// =====================================
// INICIAR SESIÓN
// =====================================
const login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (
      typeof correo !== 'string' ||
      typeof contrasena !== 'string' ||
      !correo.trim() ||
      !contrasena
    ) {
      await registrarLoginFallido(
        req, correo, null, 'Datos de inicio de sesión no válidos'
      );

      return res.status(400).json({
        mensaje: 'Correo y contraseña obligatorios'
      });
    }

    const resultado = await pool.query(
      `SELECT id, nombre, correo,
              password_hash, rol_id
       FROM usuarios
       WHERE correo = $1`,
      [correo.trim()]
    );

    if (resultado.rows.length === 0) {
      await registrarLoginFallido(
        req, correo.trim(), null, 'Correo no registrado'
      );

      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const usuario = resultado.rows[0];

    const valida = await bcrypt.compare(
      contrasena,
      usuario.password_hash
    );

    if (!valida) {
      await registrarLoginFallido(
        req, correo.trim(), usuario.id, 'Contraseña incorrecta'
      );

      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    if (!req.session) {
      return res.status(500).json({
        mensaje: 'Sesión no configurada'
      });
    }

    // Regenerar la sesión para evitar fijación de sesión
    req.session.regenerate(async (error) => {
      if (error) {
        console.error('Error al regenerar sesión:', error);

        return res.status(500).json({
          mensaje: 'No se pudo iniciar la sesión'
        });
      }

      // Guardar datos del usuario autenticado
      req.session.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol_id: usuario.rol_id
      };

      // Guardar la sesión antes de responder
      req.session.save(async (errorGuardado) => {
        if (errorGuardado) {
          console.error(
            'Error al guardar sesión:',
            errorGuardado
          );

          return res.status(500).json({
            mensaje: 'No se pudo guardar la sesión'
          });
        }

        // Registrar último inicio de sesión
        try {
          await pool.query(
            `UPDATE usuarios
             SET ultimo_inicio_sesion = NOW()
             WHERE id = $1`,
            [usuario.id]
          );
        } catch (errorActualizacion) {
          console.error(
            'Error al registrar último inicio:',
            errorActualizacion.message
          );
        }

        await registrarLoginExitoso(req, usuario);

        return res.status(200).json({
          mensaje: 'Inicio de sesión exitoso',
          usuario: req.session.usuario
        });
      });
    });

  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = {
  registrar,
  login
};
