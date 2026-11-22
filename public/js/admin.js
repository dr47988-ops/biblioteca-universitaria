
document.addEventListener('DOMContentLoaded', async () => {
  const contenido = document.getElementById('contenido');
  const bienvenida = document.getElementById('bienvenidaUsuario');
  const tabla = document.getElementById('tablaUsuarios');
  const mensaje = document.getElementById('mensajePanel');
  const btnSalir = document.getElementById('btnSalir');
  const btnNuevo = document.getElementById('btnNuevoUsuario');

  // Registro
  const panelNuevo = document.getElementById('panelNuevoUsuario');
  const formNuevo = document.getElementById('formNuevoUsuario');
  const btnCancelarRegistro = document.getElementById('btnCancelarRegistro');
  const mensajeRegistro = document.getElementById('mensajeRegistro');
  const btnGuardarUsuario = document.getElementById('btnGuardarUsuario');

  // Edición
  const panelEditar = document.getElementById('panelEditarUsuario');
  const formEditar = document.getElementById('formEditarUsuario');
  const btnCancelarEdicion = document.getElementById('btnCancelarEdicion');
  const mensajeEdicion = document.getElementById('mensajeEdicion');
  const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');

  let usuarioActual = null;
  let usuariosActuales = [];

  // =====================================
  // MOSTRAR MENSAJES
  // =====================================
  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    mensaje.classList.remove('oculto');
  }

  function limpiarMensaje() {
    mensaje.textContent = '';
    mensaje.classList.add('oculto');
  }

  function irAlFormulario(panel) {
    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  // =====================================
  // VERIFICAR ACCESO
  // =====================================
  async function verificarAcceso() {
    try {
      const respuesta = await fetch('/api/auth/mi-sesion', {
        credentials: 'same-origin'
      });

      if (!respuesta.ok) {
        window.location.replace('/');
        return false;
      }

      const datos = await respuesta.json();
      usuarioActual = datos.usuario;

      if (!usuarioActual) {
        window.location.replace('/');
        return false;
      }

      bienvenida.textContent =
        `Bienvenido, ${usuarioActual.nombre}. Rol: ${usuarioActual.rol}.`;

      // Solo el SuperAdmin administra usuarios y roles (UTN-06).
      // El backend responde 403 aunque se fuerce la interfaz.
      if (!usuarioActual.esSuperAdmin) {
        btnNuevo.classList.add('oculto');
      }

      contenido.classList.remove('oculto');
      return true;

    } catch (error) {
      window.location.replace('/');
      return false;
    }
  }

  // =====================================
  // OBTENER TOKEN CSRF
  // =====================================
  async function obtenerTokenCSRF() {
    const respuesta = await fetch('/api/auth/csrf-token', {
      credentials: 'same-origin'
    });

    if (respuesta.status === 403) {
      window.location.replace('/');
      throw new Error('La sesión ha expirado.');
    }

    if (!respuesta.ok) {
      throw new Error('No se pudo obtener el token de seguridad.');
    }

    const datos = await respuesta.json();
    return datos.csrfToken;
  }

  // =====================================
  // CARGAR USUARIOS
  // =====================================
  async function cargarUsuarios() {
    try {
      const respuesta = await fetch('/api/usuarios', {
        credentials: 'same-origin'
      });

      if (respuesta.status === 403) {
        window.location.replace('/');
        return;
      }

      if (!respuesta.ok) {
        throw new Error('No se pudieron consultar los usuarios.');
      }

      const datos = await respuesta.json();
      usuariosActuales = datos.usuarios;

      document.getElementById('totalUsuarios').textContent =
        usuariosActuales.length;

      document.getElementById('totalAdministradores').textContent =
        usuariosActuales.filter(u => u.rol === 'SuperAdmin').length;

      document.getElementById('totalBibliotecarios').textContent =
        usuariosActuales.filter(u => u.rol === 'Bibliotecario').length;

      tabla.replaceChildren();

      if (usuariosActuales.length === 0) {
        const fila = tabla.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 9;
        celda.textContent = 'No hay usuarios registrados.';
        return;
      }

      usuariosActuales.forEach(usuario => {
        const fila = tabla.insertRow();

        [
          usuario.id,
          usuario.identificacion,
          usuario.nombre,
          usuario.username,
          usuario.correo
        ].forEach(valor => {
          const celda = fila.insertCell();
          celda.textContent = valor ?? '';
        });

        // Rol
        const celdaRol = fila.insertCell();
        const etiquetaRol = document.createElement('span');

        etiquetaRol.className = 'rol';
        etiquetaRol.textContent = usuario.rol;
        celdaRol.appendChild(etiquetaRol);

        const celdaPermisos = fila.insertCell();

        celdaPermisos.textContent = Array.isArray(usuario.permisos) ? usuario.permisos.join(String.fromCharCode(44,32)) : String.fromCharCode(45);

        const celdaUltimoInicio = fila.insertCell();

        celdaUltimoInicio.textContent = usuario.ultimo_inicio_sesion ? new Date(usuario.ultimo_inicio_sesion).toLocaleString(String.fromCharCode(101,115,45,67,82)) : String.fromCharCode(45);

        // Acciones

        const acciones = fila.insertCell();

        // Auditor y Bibliotecario: solo lectura de usuarios
        if (!usuarioActual.esSuperAdmin) {
          acciones.textContent = 'Solo lectura';
          return;
        }

        // =====================================
        // BOTÓN EDITAR
        // =====================================
        const editar = document.createElement('button');
        editar.className = 'btn-editar';
        editar.textContent = 'Editar';

        editar.addEventListener('click', () => {
          abrirEdicion(usuario);
        });

        // =====================================
        // BOTÓN ELIMINAR
        // =====================================
        const eliminar = document.createElement('button');
        eliminar.className = 'btn-eliminar';
        eliminar.textContent = 'Eliminar';

        // No permitir eliminar la cuenta propia
        eliminar.disabled = usuario.id === usuarioActual.id;

        eliminar.addEventListener('click', async () => {
          if (usuario.id === usuarioActual.id) {
            mostrarMensaje('No puedes eliminar tu propia cuenta.');
            return;
          }

          const confirmar = window.confirm(
            `¿Estás seguro de que deseas eliminar definitivamente a ${usuario.nombre}?`
          );

          if (!confirmar) {
            return;
          }

          eliminar.disabled = true;
          eliminar.textContent = 'Eliminando...';

          try {
            const csrfToken = await obtenerTokenCSRF();

            const respuesta = await fetch(
              `/api/usuarios/${usuario.id}`,
              {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                  'X-CSRF-Token': csrfToken
                }
              }
            );

            const datos = await respuesta.json();

            if (!respuesta.ok) {
              throw new Error(
                datos.mensaje || 'No se pudo eliminar el usuario.'
              );
            }

            // Cerrar formularios si están abiertos
            panelNuevo.classList.add('oculto');
            panelEditar.classList.add('oculto');

            // Actualizar la tabla y estadísticas
            await cargarUsuarios();

            mostrarMensaje(
              `Usuario ${usuario.nombre} eliminado correctamente.`
            );

          } catch (error) {
            mostrarMensaje(error.message);
            eliminar.disabled = false;
            eliminar.textContent = 'Eliminar';
          }
        });

        acciones.append(editar, eliminar);
      });

    } catch (error) {
      mostrarMensaje(error.message);
    }
  }

  // =====================================
  // ABRIR REGISTRO
  // =====================================
  btnNuevo.addEventListener('click', () => {
    limpiarMensaje();

    panelEditar.classList.add('oculto');
    panelNuevo.classList.remove('oculto');
    mensajeRegistro.textContent = '';

    irAlFormulario(panelNuevo);
    document.getElementById('nuevaIdentificacion').focus();
  });

  // =====================================
  // CANCELAR REGISTRO
  // =====================================
  btnCancelarRegistro.addEventListener('click', () => {
    panelNuevo.classList.add('oculto');
    formNuevo.reset();
    mensajeRegistro.textContent = '';
  });

  // =====================================
  // GUARDAR NUEVO USUARIO
  // =====================================
  formNuevo.addEventListener('submit', async (event) => {
    event.preventDefault();

    const contrasena =
      document.getElementById('nuevaContrasena').value;

    const confirmar =
      document.getElementById('confirmarContrasena').value;

    if (contrasena !== confirmar) {
      mensajeRegistro.textContent =
        'Las contraseñas no coinciden.';
      return;
    }

    btnGuardarUsuario.disabled = true;
    mensajeRegistro.textContent = 'Registrando usuario...';

    try {
      const csrfToken = await obtenerTokenCSRF();

      const respuesta = await fetch('/api/auth/registro', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          identificacion:
            document.getElementById('nuevaIdentificacion').value.trim(),
          nombre:
            document.getElementById('nuevoNombre').value.trim(),
          username:
            document.getElementById('nuevoUsername').value.trim(),
          correo:
            document.getElementById('nuevoCorreo').value.trim(),
          contrasena
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'Error al registrar usuario.'
        );
      }

      formNuevo.reset();

      mensajeRegistro.textContent =
        'Bibliotecario registrado correctamente.';

      await cargarUsuarios();

    } catch (error) {
      mensajeRegistro.textContent = error.message;
    } finally {
      btnGuardarUsuario.disabled = false;
    }
  });

  // =====================================
  // ABRIR EDICIÓN
  // =====================================
  function abrirEdicion(usuario) {
    limpiarMensaje();

    panelNuevo.classList.add('oculto');
    panelEditar.classList.remove('oculto');

    document.getElementById('editarId').value =
      usuario.id;

    document.getElementById('editarIdentificacion').value =
      usuario.identificacion;

    document.getElementById('editarNombre').value =
      usuario.nombre;

    document.getElementById('editarUsername').value =
      usuario.username;

    document.getElementById('editarCorreo').value =
      usuario.correo;

    const selectorRol = document.getElementById('editarRol');

    selectorRol.value = String(usuario.rol_id);

    // No permitir cambiar el rol propio
    selectorRol.disabled = usuario.id === usuarioActual.id;

    mensajeEdicion.textContent = '';

    irAlFormulario(panelEditar);
    document.getElementById('editarNombre').focus();
  }

  // =====================================
  // CANCELAR EDICIÓN
  // =====================================
  btnCancelarEdicion.addEventListener('click', () => {
    panelEditar.classList.add('oculto');
    formEditar.reset();
    mensajeEdicion.textContent = '';
  });

  // =====================================
  // GUARDAR EDICIÓN EN POSTGRESQL
  // =====================================
  formEditar.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = Number(
      document.getElementById('editarId').value
    );

    const usuarioOriginal = usuariosActuales.find(
      usuario => usuario.id === id
    );

    if (!usuarioOriginal) {
      mensajeEdicion.textContent = 'Usuario no encontrado.';
      return;
    }

    const datosActualizados = {
      identificacion:
        document.getElementById('editarIdentificacion').value.trim(),
      nombre:
        document.getElementById('editarNombre').value.trim(),
      username:
        document.getElementById('editarUsername').value.trim(),
      correo:
        document.getElementById('editarCorreo').value.trim(),
      rol_id: id === usuarioActual.id
        ? usuarioActual.rol_id
        : Number(document.getElementById('editarRol').value)
    };

    btnGuardarEdicion.disabled = true;
    mensajeEdicion.textContent = 'Guardando cambios...';

    try {
      const csrfToken = await obtenerTokenCSRF();

      const respuesta = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(datosActualizados)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo actualizar el usuario.'
        );
      }

      mensajeEdicion.textContent =
        'Usuario actualizado correctamente.';

      await cargarUsuarios();

    } catch (error) {
      mensajeEdicion.textContent = error.message;
    } finally {
      btnGuardarEdicion.disabled = false;
    }
  });

  // =====================================
  // CERRAR SESIÓN
  // =====================================
  btnSalir.addEventListener('click', async () => {
    try {
      const csrfToken = await obtenerTokenCSRF();

      const respuesta = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo cerrar la sesión.');
      }

      window.location.replace('/');

    } catch (error) {
      mostrarMensaje(error.message);
    }
  });

  // =====================================
  // OPCIONES DE ROL EN EL FORMULARIO DE EDICIÓN
  // =====================================
  function actualizarSelectorRoles(roles) {
    const selectorRol = document.getElementById('editarRol');

    selectorRol.replaceChildren(
      ...roles.map((rol) => new Option(rol.nombre, String(rol.id)))
    );
  }

  // =====================================
  // INICIAR PANEL
  // =====================================
  const accesoPermitido = await verificarAcceso();

  if (accesoPermitido) {
    await cargarUsuarios();

    if (usuarioActual.esSuperAdmin) {
      const roles = await window.GestionRoles.iniciar({
        obtenerTokenCSRF,
        alCambiar: async (rolesActualizados) => {
          actualizarSelectorRoles(rolesActualizados);
          await cargarUsuarios();
        }
      });

      if (roles.length > 0) {
        actualizarSelectorRoles(roles);
      }
    }
  }
});
