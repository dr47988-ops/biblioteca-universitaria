const helmet = require('helmet');

// CDN usado por Bootstrap y Bootstrap Icons en la página de login
const CDN = 'https://cdn.jsdelivr.net';

// =====================================
// ENCABEZADOS HTTP DE SEGURIDAD (UTN-08)
// =====================================
const encabezadosHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // Solo scripts propios: sin scripts en línea ni eval (XSS)
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", CDN],
      styleSrcAttr: ["'none'"],
      fontSrc: ["'self'", CDN, 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Nadie puede incrustar el sistema en un iframe (clickjacking)
      frameAncestors: ["'none'"]
    }
  },
  // X-Frame-Options: DENY
  frameguard: { action: 'deny' },
  // HSTS: el navegador solo lo aplica cuando se sirve por HTTPS
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  // X-Content-Type-Options: nosniff (activo por defecto en helmet)
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' }
});
const encabezadosSeguridad = [
  encabezadosHelmet,
  (req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    next();
  }
];

// =====================================
// EVITAR QUE SE GUARDEN RESPUESTAS DE LA API
// =====================================
// Tras cerrar sesión, el botón "atrás" no muestra datos en caché.
const sinCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
};

// =====================================
// PÁGINAS QUE REQUIEREN SESIÓN
// =====================================
// Sin sesión válida se redirige al login (UTN-07c).
const PAGINAS_PROTEGIDAS = ['/admin.html', '/biblioteca.html'];

const protegerPaginas = (req, res, next) => {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/?sesion=expirada');
  }

  res.set('Cache-Control', 'no-store');
  next();
};

module.exports = {
  encabezadosSeguridad,
  sinCache,
  PAGINAS_PROTEGIDAS,
  protegerPaginas
};
