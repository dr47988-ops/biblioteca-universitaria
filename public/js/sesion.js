// =====================================
// CONTROL DE INACTIVIDAD EN EL NAVEGADOR (UTN-07c)
// =====================================
// El servidor invalida la sesión tras 60 segundos sin solicitudes.
// Este script replica ese plazo: si pasan 60 segundos desde la
// última solicitud a la API, envía al usuario al login.
// Debe cargarse antes que los demás scripts de la página.
(() => {
  const LIMITE_INACTIVIDAD_MS = 60 * 1000;
  const fetchOriginal = window.fetch.bind(window);
  let temporizador = null;

  function expirarSesion() {
    window.location.replace('/?sesion=expirada');
  }

  function reiniciarTemporizador() {
    clearTimeout(temporizador);
    temporizador = setTimeout(expirarSesion, LIMITE_INACTIVIDAD_MS);
  }

  // Cada solicitud al servidor renueva la sesión en ambos lados
  window.fetch = async (...argumentos) => {
    const respuesta = await fetchOriginal(...argumentos);
    reiniciarTemporizador();
    return respuesta;
  };

  reiniciarTemporizador();
})();
