
const pool = require('../config/db');
const { TIPOS } = require('../services/auditoriaService');

const LIMITE_PREDETERMINADO = 100;
const LIMITE_MAXIMO = 500;

// =====================================
// CONSULTAR REGISTROS DE AUDITORÍA
// Filtros opcionales por query string: tipo, limite y pagina
// =====================================
const listarAuditoria = async (req, res) => {
  try {
    const { tipo } = req.query;

    if (tipo !== undefined && !Object.values(TIPOS).includes(tipo)) {
      return res.status(400).json({
        mensaje: 'Tipo de evento no válido'
      });
    }

    const limite = req.query.limite === undefined
      ? LIMITE_PREDETERMINADO
      : Number(req.query.limite);

    const pagina = req.query.pagina === undefined
      ? 1
      : Number(req.query.pagina);

    if (
      !Number.isInteger(limite) ||
      limite < 1 ||
      limite > LIMITE_MAXIMO ||
      !Number.isInteger(pagina) ||
      pagina < 1
    ) {
      return res.status(400).json({
        mensaje: 'Parámetros de paginación no válidos'
      });
    }

    const parametros = [];
    let filtro = '';

    if (tipo !== undefined) {
      parametros.push(tipo);
      filtro = `WHERE a.tipo_evento = $${parametros.length}`;
    }

    const total = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.auditoria a ${filtro}`,
      parametros
    );

    parametros.push(limite, (pagina - 1) * limite);

    const resultado = await pool.query(
      `SELECT a.id, a.fecha_hora, a.tipo_evento,
              a.usuario_id, a.usuario_ref, a.ip,
              a.metodo, a.ruta, a.detalle
       FROM public.auditoria a
       ${filtro}
       ORDER BY a.fecha_hora DESC, a.id DESC
       LIMIT $${parametros.length - 1}
       OFFSET $${parametros.length}`,
      parametros
    );

    return res.status(200).json({
      mensaje: 'Registros de auditoría obtenidos correctamente',
      total: total.rows[0].total,
      pagina,
      limite,
      registros: resultado.rows
    });

  } catch (error) {
    console.error(
      'Error al consultar auditoría:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'Error interno al consultar la auditoría'
    });
  }
};

module.exports = {
  listarAuditoria
};
