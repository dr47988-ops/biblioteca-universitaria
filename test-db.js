
const pool = require('./src/config/db');

async function probarConexion() {
  try {
    const resultado = await pool.query(
      'SELECT NOW() AS fecha_servidor'
    );

    console.log('Conexión exitosa con Supabase');
    console.log(resultado.rows[0]);
  } catch (error) {
    console.error('Código:', error.code);
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

probarConexion();
