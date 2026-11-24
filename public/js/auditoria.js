document.addEventListener('DOMContentLoaded', async () => {
  const contenido = document.getElementById('contenido');
  const tabla = document.getElementById('tablaAuditoria');
  const mensaje = document.getElementById('mensajeAuditoria');
  const filtroTipo = document.getElementById('filtroTipo');
  const infoPagina = document.getElementById('infoPagina');
  const btnAnterior = document.getElementById('btnAnterior');
  const btnSiguiente = document.getElementById('btnSiguiente');

  const POR_PAGINA = 50;
  let pagina = 1;
  let totalRegistros = 0;

  const NOMBRES_EVENTO = {
    LOGIN_EXITOSO: 'Inicio exitoso',
    LOGIN_FALLIDO: 'Inicio fallido',
    CAMBIO_ROL: 'Cambio de rol',
    CAMBIO_PERMISOS: 'Cambio de permisos',
    ACCESO_DENEGADO: 'Acceso denegado'
  };

  function mostrarMensaje(texto) {
    mensaje.textContent = texto;
    mensaje.classList.remove('oculto');
  }

  function limpiarMensaje() {
    mensaje.textContent = '';
    mensaje.classList.add('oculto');
  }

  // =====================================
  // VERIFICAR QUE SEA SUPERADMIN
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

      if (!datos.usuario || datos.usuario.rol_id !== 1) {
        window.location.replace('/');
        return false;
      }

      contenido.classList.remove('oculto');
      return true;

    } catch (error) {
      window.location.replace('/');
      return false;
    }
  }

  // =====================================
  // CARGAR REGISTROS
  // Todo el contenido se inserta con textContent, nunca con innerHTML
  // =====================================
  async function cargarRegistros() {
    limpiarMensaje();

    const parametros = new URLSearchParams({
      limite: String(POR_PAGINA),
      pagina: String(pagina)
    });

    if (filtroTipo.value) {
      parametros.set('tipo', filtroTipo.value);
    }

    try {
      const respuesta = await fetch(
        `/api/auditoria?${parametros.toString()}`,
        { credentials: 'same-origin' }
      );

      if (respuesta.status === 403) {
        window.location.replace('/');
        return;
      }

      if (!respuesta.ok) {
        throw new Error('No se pudieron consultar los registros.');
      }

      const datos = await respuesta.json();
      totalRegistros = datos.total;

      tabla.replaceChildren();

      if (datos.registros.length === 0) {
        const fila = tabla.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 7;
        celda.textContent = 'No hay registros para mostrar.';
      }

      datos.registros.forEach((registro) => {
        const fila = tabla.insertRow();

        fila.insertCell().textContent =
          new Date(registro.fecha_hora).toLocaleString('es-CR');

        const celdaEvento = fila.insertCell();
        const etiqueta = document.createElement('span');
        etiqueta.className = 'etiqueta';

        if (registro.tipo_evento === 'LOGIN_FALLIDO') {
          etiqueta.classList.add('fallo');
        } else if (registro.tipo_evento === 'ACCESO_DENEGADO') {
          etiqueta.classList.add('aviso');
        }

        etiqueta.textContent =
          NOMBRES_EVENTO[registro.tipo_evento] || registro.tipo_evento;
        celdaEvento.appendChild(etiqueta);

        [
          registro.usuario_ref,
          registro.ip,
          registro.metodo,
          registro.ruta,
          registro.detalle
        ].forEach((valor) => {
          fila.insertCell().textContent = valor ?? '-';
        });
      });

      const totalPaginas = Math.max(
        1,
        Math.ceil(totalRegistros / POR_PAGINA)
      );

      infoPagina.textContent =
        `Página ${pagina} de ${totalPaginas} ` +
        `(${totalRegistros} registros)`;

      btnAnterior.disabled = pagina <= 1;
      btnSiguiente.disabled = pagina >= totalPaginas;

    } catch (error) {
      mostrarMensaje(error.message);
    }
  }

  filtroTipo.addEventListener('change', () => {
    pagina = 1;
    cargarRegistros();
  });

  btnAnterior.addEventListener('click', () => {
    pagina -= 1;
    cargarRegistros();
  });

  btnSiguiente.addEventListener('click', () => {
    pagina += 1;
    cargarRegistros();
  });

  if (await verificarAcceso()) {
    await cargarRegistros();
  }
});
