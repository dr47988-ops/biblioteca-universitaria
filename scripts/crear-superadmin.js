
const bcrypt = require('bcrypt');
const readline = require('node:readline');
const pool = require('../src/config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function preguntar(texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

function preguntarContrasena() {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      return reject(
        new Error('Ejecuta este script en una terminal interactiva.')
      );
    }

    let contrasena = '';

    rl.pause();
    process.stdout.write('Contrasena (minimo 8 caracteres): ');

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function limpiar() {
      stdin.removeListener('data', recibir);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
    }

    function recibir(tecla) {
      if (tecla === '\r' || tecla === '\n') {
        limpiar();
        resolve(contrasena);
      } else if (tecla === '\u0003') {
        limpiar();
        reject(new Error('Operacion cancelada.'));
      } else if (tecla === '\u007f' || tecla === '\b') {
        contrasena = contrasena.slice(0, -1);
      } else if (!tecla.startsWith('\u001b')) {
        contrasena += tecla;
      }
    }

    stdin.on('data', recibir);
  });
}

async function crearSuperAdmin() {
  let cliente;

  try {
    cliente = await pool.connect();

    const rol = await cliente.query(
      'SELECT id FROM public.roles WHERE nombre = $1',
      ['SuperAdmin']
    );

    if (rol.rows.length === 0) {
      throw new Error('Primero ejecuta los scripts SQL.');
    }

    const rolId = rol.rows[0].id;

    // Comprobacion inicial sin modificar datos
    const existe = await cliente.query(
      'SELECT id FROM public.usuarios WHERE rol_id = $1 LIMIT 1',
      [rolId]
    );

    if (existe.rows.length > 0) {
      console.log('Ya existe un SuperAdmin. No se creara otro.');
      return;
    }

    console.log('\nConfiguracion del primer SuperAdmin');

    const identificacion = (await preguntar('Identificacion: ')).trim();
    const nombre = (await preguntar('Nombre: ')).trim();
    const username = (await preguntar('Usuario: ')).trim();
    const correo = (await preguntar('Correo: ')).trim();

    if (!identificacion || !nombre || !username || !correo) {
      throw new Error('Todos los campos son obligatorios.');
    }

    const contrasena = await preguntarContrasena();

    if (contrasena.length < 8) {
      throw new Error('La contrasena debe tener al menos 8 caracteres.');
    }

    const hash = await bcrypt.hash(contrasena, 12);

    await cliente.query('BEGIN');

    try {
      // Solo una ejecucion puede crear el administrador a la vez.
      await cliente.query(
        'SELECT pg_advisory_xact_lock(783421, 1001)'
      );

      // Volver a comprobar dentro de la transaccion.
      const verificacion = await cliente.query(
        'SELECT id FROM public.usuarios WHERE rol_id = $1 LIMIT 1',
        [rolId]
      );

      if (verificacion.rows.length > 0) {
        await cliente.query('ROLLBACK');
        console.log('Ya existe un SuperAdmin. No se creara otro.');
        return;
      }

      const resultado = await cliente.query(
        `INSERT INTO public.usuarios
         (identificacion, nombre, username, correo, password_hash, rol_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [identificacion, nombre, username, correo, hash, rolId]
      );

      if (resultado.rowCount !== 1) {
        throw new Error('No se pudo crear el SuperAdmin.');
      }

      await cliente.query('COMMIT');

      console.log('SuperAdmin creado correctamente.');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();

    if (cliente) {
      cliente.release();
    }

    await pool.end();
  }
}

crearSuperAdmin();
