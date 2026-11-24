const express = require('express');
const pool = require('../config/db');
const {
  PERMISOS,
  requierePermiso,
  usuarioAutenticado
} = require('../middleware/authMiddleware');
const { csrfSynchronisedProtection } = require('../middleware/csrfMiddleware');

const router = express.Router();
const fechaLocal = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Costa_Rica')::date";
const vencimientoLocal = "(p.fecha_vencimiento AT TIME ZONE 'America/Costa_Rica')::date";
const diasAtraso = `GREATEST(0, ${fechaLocal} - ${vencimientoLocal})`;

function errorHttp(status, mensaje) {
  return Object.assign(new Error(mensaje), { estadoBiblioteca: status });
}

function texto(valor, maximo, campo) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
    throw errorHttp(400, `${campo} debe contener entre 1 y ${maximo} caracteres.`);
  }
  return valor.trim();
}

function entero(valor, minimo, campo) {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero < minimo || numero > 2147483647) {
    throw errorHttp(400, `${campo} debe ser un número entero válido.`);
  }
  return numero;
}

function datosLibro(body) {
  return [
    texto(body.isbn, 20, 'ISBN'),
    texto(body.titulo, 200, 'Título'),
    texto(body.autor, 150, 'Autor'),
    texto(body.categoria, 100, 'Categoría'),
    entero(body.cantidad_disponible, 0, 'Cantidad disponible'),
    texto(body.ubicacion, 100, 'Ubicación')
  ];
}

// Control de acceso compartido (UTN-05): sin sesión o sin permiso
// responde 403 desde authMiddleware, igual que el resto del sistema.
const { CREAR, EDITAR, BORRAR, VER_REPORTES } = PERMISOS;
const permitir = requierePermiso;

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

router.use(usuarioAutenticado);
router.get('/permisos', (req, res) => {
  res.json(req.acceso.permisos);
});

const consultar = permitir(CREAR, EDITAR, BORRAR, VER_REPORTES);
router.get('/libros', consultar, async (req, res) => {
  const q = req.query.q === undefined || req.query.q === '' ? '' : texto(req.query.q, 200, 'Búsqueda');
  const { rows } = await pool.query(
    `SELECT id, isbn, titulo, autor, categoria, cantidad_disponible, ubicacion
     FROM public.libros
     WHERE strpos(lower(titulo), lower($1)) > 0
        OR strpos(lower(autor), lower($1)) > 0
        OR strpos(lower(categoria), lower($1)) > 0
     ORDER BY titulo, id`, [q]
  );
  res.json(rows);
});

router.post('/libros', permitir(CREAR), csrfSynchronisedProtection, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO public.libros (isbn, titulo, autor, categoria, cantidad_disponible, ubicacion)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, datosLibro(req.body ?? {})
  );
  res.status(201).json(rows[0]);
});

router.put('/libros/:id', permitir(EDITAR), csrfSynchronisedProtection, async (req, res) => {
  const id = entero(req.params.id, 1, 'Libro');
  const datos = datosLibro(req.body ?? {});
  const cantidadAnterior = entero(req.body.cantidad_anterior, 0, 'Cantidad anterior');
  const { rowCount } = await pool.query(
    `UPDATE public.libros SET isbn=$1, titulo=$2, autor=$3, categoria=$4,
       cantidad_disponible=$5, ubicacion=$6 WHERE id=$7 AND cantidad_disponible=$8`,
    [...datos, id, cantidadAnterior]
  );
  if (!rowCount) throw errorHttp(409, 'El libro cambió o fue eliminado. Actualice el catálogo.');
  res.json({ mensaje: 'Libro actualizado.' });
});

router.delete('/libros/:id', permitir(BORRAR), csrfSynchronisedProtection, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM public.libros WHERE id=$1', [
    entero(req.params.id, 1, 'Libro')
  ]);
  if (!rowCount) throw errorHttp(404, 'Libro no encontrado.');
  res.status(204).end();
});

router.get('/socios', permitir(CREAR), async (req, res) => {
  const { rows } = await pool.query('SELECT id, carne, nombre FROM public.socios ORDER BY nombre, id');
  res.json(rows);
});

router.post('/socios', permitir(CREAR), csrfSynchronisedProtection, async (req, res) => {
  const { carne, nombre, correo } = req.body ?? {};
  const email = texto(correo, 150, 'Correo').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw errorHttp(400, 'Ingrese un correo válido.');
  }
  const { rows } = await pool.query(
    'INSERT INTO public.socios (carne, nombre, correo) VALUES ($1, $2, $3) RETURNING id',
    [texto(carne, 30, 'Carné'), texto(nombre, 150, 'Nombre'), email]
  );
  res.status(201).json(rows[0]);
});

router.post('/prestamos', permitir(CREAR), csrfSynchronisedProtection, async (req, res) => {
  const libro = entero(req.body?.libro_id, 1, 'Libro');
  const socio = entero(req.body?.socio_id, 1, 'Socio');
  const prestamo = await transaccion(async cliente => {
    const socioEncontrado = await cliente.query('SELECT id FROM public.socios WHERE id=$1 FOR UPDATE', [socio]);
    if (!socioEncontrado.rowCount) throw errorHttp(404, 'Socio no encontrado.');

    const { rows: [activos] } = await cliente.query(
      'SELECT count(*)::int AS cantidad FROM public.prestamos WHERE socio_id=$1 AND fecha_devolucion IS NULL',
      [socio]
    );
    if (activos.cantidad >= 3) throw errorHttp(409, 'El socio ya tiene tres préstamos activos.');

    const existencia = await cliente.query(
      `UPDATE public.libros SET cantidad_disponible=cantidad_disponible-1
       WHERE id=$1 AND cantidad_disponible > 0`, [libro]
    );
    if (!existencia.rowCount) throw errorHttp(409, 'El libro no existe o no tiene ejemplares disponibles.');

    const { rows: [nuevo] } = await cliente.query(
      `INSERT INTO public.prestamos (libro_id, socio_id, fecha_vencimiento)
       VALUES ($1, $2, ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Costa_Rica') + INTERVAL '7 days')
       AT TIME ZONE 'America/Costa_Rica')
       RETURNING id, fecha_vencimiento`, [libro, socio]
    );
    return nuevo;
  });
  res.status(201).json(prestamo);
});

const resumenPrestamos = `SELECT p.id, l.titulo, s.nombre, s.carne, p.fecha_vencimiento,
    ${diasAtraso} AS dias_atraso
    FROM public.prestamos p JOIN public.libros l ON l.id=p.libro_id
    JOIN public.socios s ON s.id=p.socio_id
    WHERE p.fecha_devolucion IS NULL`;

router.get('/prestamos', permitir(EDITAR), async (req, res) => {
  const { rows } = await pool.query(`${resumenPrestamos} ORDER BY p.fecha_vencimiento, p.id`);
  res.json(rows);
});

router.get('/prestamos/vencidos', permitir(VER_REPORTES), async (req, res) => {
  const { rows } = await pool.query(
    `${resumenPrestamos} AND ${vencimientoLocal} < ${fechaLocal} ORDER BY p.fecha_vencimiento, p.id`
  );
  res.json(rows);
});

router.post('/prestamos/:id/devolucion', permitir(EDITAR), csrfSynchronisedProtection, async (req, res) => {
  const id = entero(req.params.id, 1, 'Préstamo');
  const devolucion = await transaccion(async cliente => {
    const { rows: [prestamo] } = await cliente.query(
      `UPDATE public.prestamos p SET fecha_devolucion=CURRENT_TIMESTAMP, multa=${diasAtraso} * 100
       WHERE p.id=$1 AND p.fecha_devolucion IS NULL
       RETURNING p.libro_id, p.multa, ${diasAtraso} AS dias_atraso`, [id]
    );
    if (!prestamo) throw errorHttp(409, 'El préstamo no existe o ya fue devuelto.');

    await cliente.query(
      'UPDATE public.libros SET cantidad_disponible=cantidad_disponible+1 WHERE id=$1',
      [prestamo.libro_id]
    );
    return { multa: prestamo.multa, dias_atraso: prestamo.dias_atraso };
  });
  res.json(devolucion);
});

router.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ mensaje: 'El ISBN, carné o correo ya está registrado.' });
  if (error.code === '23503') return res.status(409).json({ mensaje: 'El libro tiene un historial de préstamos.' });
  if (error.estadoBiblioteca) {
    return res.status(error.estadoBiblioteca).json({ mensaje: error.message });
  }
  next(error);
});

module.exports = router;
