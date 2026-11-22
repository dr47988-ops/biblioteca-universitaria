
document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('loginForm');
  const mensaje = document.getElementById('mensaje');
  const boton = document.getElementById('btnIngresar');
  const campoContrasena = document.getElementById('contrasena');
  const mostrarContrasena = document.getElementById('mostrarContrasena');

  if (!formulario) return;

  // Avisar cuando se llega por expiración o falta de sesión
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get('sesion') === 'expirada') {
    mensaje.className = 'alert alert-warning';
    mensaje.textContent =
      'Su sesión expiró por inactividad. Inicie sesión de nuevo.';
    window.history.replaceState(null, '', '/');
  }

  // Mostrar u ocultar contraseña
  mostrarContrasena.addEventListener('click', () => {
    const visible = campoContrasena.type === 'text';

    campoContrasena.type = visible ? 'password' : 'text';

    mostrarContrasena.innerHTML = visible
      ? '<i class="bi bi-eye"></i>'
      : '<i class="bi bi-eye-slash"></i>';

    mostrarContrasena.setAttribute(
      'aria-label',
      visible ? 'Mostrar contraseña' : 'Ocultar contraseña'
    );
  });

  // Iniciar sesión
  formulario.addEventListener('submit', async (event) => {
    event.preventDefault();

    mensaje.className = 'alert d-none';
    boton.disabled = true;
    boton.textContent = 'Verificando credenciales...';

    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          correo: document.getElementById('correo').value.trim(),
          contrasena: campoContrasena.value
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje || 'No se pudo iniciar sesión'
        );
      }

      mensaje.className = 'alert alert-success';
      mensaje.textContent = 'Inicio de sesión exitoso. Redirigiendo...';

      // El panel se adapta al rol y permisos de cada usuario
      window.location.href = '/admin.html';

    } catch (error) {
      mensaje.className = 'alert alert-danger';
      mensaje.textContent = error.message;
    } finally {
      boton.disabled = false;
      boton.innerHTML =
        '<i class="bi bi-box-arrow-in-right me-2"></i>Ingresar al sistema';
    }
  });
});
