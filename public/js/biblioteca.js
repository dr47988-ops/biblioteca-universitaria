const elemento = id => document.getElementById(id);
const formularioLibro = elemento('libro');
const formularioPrestamo = elemento('prestamo');
const camposLibro = ['isbn', 'titulo', 'autor', 'categoria', 'cantidad_disponible', 'ubicacion'];
const fecha = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeZone: 'America/Costa_Rica' });
const colones = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' });
let permisos = [];
let libroEnEdicion;

function estado(mensaje, error = false) {
  elemento('estado').textContent = mensaje;
  elemento('estado').classList.toggle('error', error);
}

async function peticion(ruta, metodo = 'GET', datos) {
  const opciones = { method: metodo };
  if (metodo !== 'GET') {
    const { csrfToken } = await peticion('/api/auth/csrf-token');
    opciones.headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken };
    if (datos) opciones.body = JSON.stringify(datos);
  }
  const respuesta = await fetch(ruta, opciones);
  if (respuesta.status === 204) return;
  const resultado = await respuesta.json();
  // Sesión vencida o inexistente: volver al login (UTN-07c)
  if (respuesta.status === 403 && /iniciar sesión/i.test(resultado.mensaje || '')) {
    window.location.replace('/?sesion=expirada');
    throw new Error('La sesión ha expirado.');
  }
  if (!respuesta.ok) throw new Error(resultado.mensaje || 'No se pudo completar la operación.');
  return resultado;
}

const biblioteca = (ruta, metodo, datos) => peticion('/api/biblioteca' + ruta, metodo, datos);
const tiene = permiso => permisos.includes(permiso);
const datosFormulario = formulario => Object.fromEntries(new FormData(formulario));

async function ejecutar(accion, boton) {
  if (boton) boton.disabled = true;
  try {
    await accion();
  } catch (error) {
    estado(error.message, true);
  } finally {
    if (boton) boton.disabled = false;
  }
}

function boton(texto, accion) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = texto;
  control.addEventListener('click', () => ejecutar(accion, control));
  return control;
}

function fila(valores, acciones = []) {
  const fila = document.createElement('tr');
  for (const valor of valores) fila.insertCell().textContent = valor;
  if (acciones.length) fila.insertCell().append(...acciones);
  return fila;
}

function tabla(id, filas, columnas) {
  const cuerpo = elemento(id);
  if (filas.length) {
    cuerpo.replaceChildren(...filas);
  } else {
    const vacia = fila(['Sin resultados.']);
    vacia.cells[0].colSpan = columnas;
    cuerpo.replaceChildren(vacia);
  }
}

function editarLibro(libro) {
  libroEnEdicion = libro;
  for (const campo of camposLibro) {
    formularioLibro.elements.namedItem(campo).value = libro[campo];
  }
  formularioLibro.hidden = false;
  elemento('guardarLibro').textContent = 'Guardar cambios';
  elemento('cancelar').hidden = false;
  formularioLibro.elements.namedItem('isbn').focus();
}

function cerrarEdicion() {
  libroEnEdicion = undefined;
  formularioLibro.reset();
  formularioLibro.hidden = !tiene('crear');
  elemento('guardarLibro').textContent = 'Agregar libro';
  elemento('cancelar').hidden = true;
}

async function cargarCatalogo() {
  const q = datosFormulario(elemento('buscar')).q.trim();
  const libros = await biblioteca('/libros?' + new URLSearchParams({ q }));
  tabla('libros', libros.map(libro => {
    const acciones = [];
    if (tiene('editar')) acciones.push(boton('Editar', () => editarLibro(libro)));
    if (tiene('borrar')) acciones.push(boton('Eliminar', async () => {
      if (!confirm('¿Eliminar este libro del catálogo?')) return;
      await biblioteca('/libros/' + libro.id, 'DELETE');
      if (libroEnEdicion?.id === libro.id) cerrarEdicion();
      estado('Libro eliminado.');
      await actualizar();
    }));
    const registro = fila(camposLibro.map(campo => libro[campo]), acciones);
    if (!acciones.length) registro.insertCell();
    return registro;
  }), 7);
}

function actualizarOpciones(campo, registros, etiqueta) {
  const selector = formularioPrestamo.elements.namedItem(campo);
  const anterior = selector.value;
  selector.replaceChildren(new Option('Seleccione…', ''), ...registros.map(
    registro => new Option(etiqueta(registro), registro.id)
  ));
  if (registros.some(registro => String(registro.id) === anterior)) selector.value = anterior;
}

async function cargarOpciones() {
  const [socios, libros] = await Promise.all([biblioteca('/socios'), biblioteca('/libros')]);
  actualizarOpciones('socio_id', socios, socio => socio.nombre + ' · ' + socio.carne);
  actualizarOpciones('libro_id', libros.filter(libro => libro.cantidad_disponible > 0),
    libro => libro.titulo + ' · ' + libro.isbn);
}

async function cargarPrestamos(reporte = false) {
  const prestamos = await biblioteca(reporte ? '/prestamos/vencidos' : '/prestamos');
  tabla(reporte ? 'vencidos' : 'activos', prestamos.map(prestamo => {
    const acciones = reporte ? [] : [boton('Devolver', async () => {
      if (!confirm('¿Registrar la devolución de este préstamo?')) return;
      const resultado = await biblioteca('/prestamos/' + prestamo.id + '/devolucion', 'POST');
      estado('Devolución registrada. Multa: ' + colones.format(resultado.multa));
      await actualizar();
    })];
    return fila([
      prestamo.titulo,
      prestamo.nombre + ' · ' + prestamo.carne,
      fecha.format(new Date(prestamo.fecha_vencimiento)),
      prestamo.dias_atraso
    ], acciones);
  }), reporte ? 4 : 5);
}

async function actualizar() {
  const cargas = [cargarCatalogo()];
  if (tiene('crear')) cargas.push(cargarOpciones());
  if (tiene('editar')) cargas.push(cargarPrestamos());
  if (tiene('ver_reportes')) cargas.push(cargarPrestamos(true));
  await Promise.all(cargas);
}

function alEnviar(id, accion) {
  elemento(id).addEventListener('submit', evento => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    ejecutar(() => accion(formulario), evento.submitter);
  });
}


alEnviar('buscar', cargarCatalogo);
alEnviar('libro', async formulario => {
  const datos = datosFormulario(formulario);
  if (libroEnEdicion) {
    datos.cantidad_anterior = libroEnEdicion.cantidad_disponible;
    await biblioteca('/libros/' + libroEnEdicion.id, 'PUT', datos);
    estado('Libro actualizado.');
  } else {
    await biblioteca('/libros', 'POST', datos);
    estado('Libro agregado.');
  }
  cerrarEdicion();
  await actualizar();
});
alEnviar('socio', async formulario => {
  await biblioteca('/socios', 'POST', datosFormulario(formulario));
  formulario.reset();
  estado('Socio registrado.');
  await cargarOpciones();
});
alEnviar('prestamo', async formulario => {
  const prestamo = await biblioteca('/prestamos', 'POST', datosFormulario(formulario));
  formulario.reset();
  estado('Préstamo registrado. Vence el ' + fecha.format(new Date(prestamo.fecha_vencimiento)) + '.');
  await actualizar();
});
elemento('cancelar').addEventListener('click', cerrarEdicion);
elemento('actualizarReporte').addEventListener('click', evento => {
  ejecutar(() => cargarPrestamos(true), evento.currentTarget);
});

ejecutar(async () => {
  permisos = await biblioteca('/permisos');
  if (!permisos.length) throw new Error('La cuenta no tiene permisos para acceder a la biblioteca.');
  elemento('catalogo').hidden = false;
  elemento('registro').hidden = !tiene('crear');
  elemento('nuevoPrestamo').hidden = !tiene('crear');
  elemento('devoluciones').hidden = !tiene('editar');
  elemento('reporte').hidden = !tiene('ver_reportes');
  cerrarEdicion();
  await actualizar();
});
