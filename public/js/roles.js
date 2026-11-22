// =====================================
// GESTIÓN DE ROLES Y PERMISOS (UTN-05, UTN-06)
// =====================================
// Solo se activa para el SuperAdmin. El backend vuelve a validar
// cada acción: ocultar la sección no es la protección real.
// Todo el contenido se inserta con textContent (sin innerHTML).
window.GestionRoles = (() => {
  let obtenerToken = null;
  let alCambiar = () => {};
  let catalogoPermisos = [];
  let rolesActuales = [];

  const $ = (id) => document.getElementById(id);

  function mostrarMensaje(texto) {
    const mensaje = $('mensajeRoles');
    mensaje.textContent = texto;
    mensaje.classList.toggle('oculto', !texto);
  }

  async function peticion(url, opciones = {}) {
    const respuesta = await fetch(url, {
      credentials: 'same-origin',
      ...opciones
    });

    if (respuesta.status === 403 && !opciones.method) {
      window.location.replace('/?sesion=expirada');
      throw new Error('La sesión ha expirado.');
    }

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No se pudo completar la acción.');
    }

    return datos;
  }

  async function modificar(url, metodo, cuerpo) {
    const token = await obtenerToken();

    return peticion(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  }

  // =====================================
  // CASILLAS DE PERMISOS
  // =====================================
  function dibujarCasillas(seleccionados = [], bloqueado = false) {
    const contenedor = $('rolPermisos');
    const leyenda = document.createElement('legend');
    leyenda.textContent = 'Permisos del rol';
    contenedor.replaceChildren(leyenda);

    catalogoPermisos.forEach((permiso) => {
      const etiqueta = document.createElement('label');
      const casilla = document.createElement('input');

      casilla.type = 'checkbox';
      casilla.value = String(permiso.id);
      casilla.checked = seleccionados.includes(permiso.id);
      casilla.disabled = bloqueado;

      const texto = document.createElement('span');
      texto.textContent = permiso.descripcion
        ? `${permiso.nombre} — ${permiso.descripcion}`
        : permiso.nombre;

      etiqueta.append(casilla, texto);
      contenedor.appendChild(etiqueta);
    });
  }

  // =====================================
  // FORMULARIO
  // =====================================
  function abrirFormulario(rol = null) {
    const esSuperAdmin = rol && rol.nombre === 'SuperAdmin';

    $('tituloFormRol').textContent = rol ? `Editar rol: ${rol.nombre}` : 'Nuevo rol';
    $('rolId').value = rol ? rol.id : '';
    $('rolNombre').value = rol ? rol.nombre : '';
    $('rolNombre').disabled = Boolean(rol && rol.es_base);
    $('rolDescripcion').value = rol ? rol.descripcion || '' : '';
    $('mensajeFormRol').textContent = esSuperAdmin
      ? 'El rol SuperAdmin conserva siempre todos los permisos.'
      : '';

    dibujarCasillas(rol ? rol.permisos_ids : [], esSuperAdmin);

    $('formRol').classList.remove('oculto');
    $('formRol').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('rolNombre').focus();
  }

  function cerrarFormulario() {
    $('formRol').classList.add('oculto');
    $('formRol').reset();
    $('mensajeFormRol').textContent = '';
  }

  async function guardar(evento) {
    evento.preventDefault();

    const id = $('rolId').value;
    const boton = $('btnGuardarRol');
    const permisos = [...$('rolPermisos').querySelectorAll('input:checked')]
      .map((casilla) => Number(casilla.value));

    const cuerpo = {
      nombre: $('rolNombre').value.trim(),
      descripcion: $('rolDescripcion').value.trim(),
      permisos
    };

    boton.disabled = true;
    $('mensajeFormRol').textContent = 'Guardando rol...';

    try {
      const datos = id
        ? await modificar(`/api/roles/${encodeURIComponent(id)}`, 'PUT', cuerpo)
        : await modificar('/api/roles', 'POST', cuerpo);

      cerrarFormulario();
      await cargar();
      mostrarMensaje(datos.mensaje);
      alCambiar(rolesActuales);
    } catch (error) {
      $('mensajeFormRol').textContent = error.message;
    } finally {
      boton.disabled = false;
    }
  }

  async function eliminar(rol, boton) {
    if (!window.confirm(`¿Eliminar definitivamente el rol ${rol.nombre}?`)) {
      return;
    }

    boton.disabled = true;

    try {
      const datos = await modificar(
        `/api/roles/${encodeURIComponent(rol.id)}`,
        'DELETE'
      );

      cerrarFormulario();
      await cargar();
      mostrarMensaje(datos.mensaje);
      alCambiar(rolesActuales);
    } catch (error) {
      mostrarMensaje(error.message);
      boton.disabled = false;
    }
  }

  // =====================================
  // TABLA DE ROLES
  // =====================================
  function dibujarTabla() {
    const tabla = $('tablaRoles');
    tabla.replaceChildren();

    rolesActuales.forEach((rol) => {
      const fila = tabla.insertRow();

      [rol.id, rol.nombre, rol.descripcion || '-'].forEach((valor) => {
        fila.insertCell().textContent = valor;
      });

      fila.insertCell().textContent = rol.permisos.length
        ? rol.permisos.join(', ')
        : 'Sin permisos';

      fila.insertCell().textContent = rol.total_usuarios;

      const acciones = fila.insertCell();

      const editar = document.createElement('button');
      editar.className = 'btn-editar';
      editar.textContent = 'Editar';
      editar.addEventListener('click', () => abrirFormulario(rol));

      const borrar = document.createElement('button');
      borrar.className = 'btn-eliminar';
      borrar.textContent = 'Eliminar';
      borrar.disabled = rol.es_base || rol.total_usuarios > 0;
      borrar.title = rol.es_base
        ? 'Los roles base no se pueden eliminar'
        : rol.total_usuarios > 0
          ? 'El rol tiene usuarios asignados'
          : '';
      borrar.addEventListener('click', () => eliminar(rol, borrar));

      acciones.append(editar, borrar);
    });
  }

  async function cargar() {
    const [datosRoles, datosPermisos] = await Promise.all([
      peticion('/api/roles'),
      peticion('/api/roles/permisos')
    ]);

    rolesActuales = datosRoles.roles;
    catalogoPermisos = datosPermisos.permisos;
    dibujarTabla();

    return rolesActuales;
  }

  // =====================================
  // INICIAR MÓDULO
  // =====================================
  async function iniciar(opciones) {
    obtenerToken = opciones.obtenerTokenCSRF;
    alCambiar = opciones.alCambiar || alCambiar;

    $('btnNuevoRol').addEventListener('click', () => abrirFormulario());
    $('btnCancelarRol').addEventListener('click', cerrarFormulario);
    $('formRol').addEventListener('submit', guardar);
    $('panelRoles').classList.remove('oculto');

    try {
      return await cargar();
    } catch (error) {
      mostrarMensaje(error.message);
      return [];
    }
  }

  return { iniciar, cargar };
})();
