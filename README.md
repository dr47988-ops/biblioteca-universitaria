# Biblioteca Universitaria

Proyecto 2 - Pruebas de Software (ISW-622)
Universidad Tecnica Nacional (UTN)

## Descripcion

Sistema web para la gestion de usuarios de una biblioteca universitaria, con autenticacion, roles, permisos y una base de datos PostgreSQL.

## Tecnologias

- Node.js y Express
- PostgreSQL
- HTML, CSS y JavaScript
- bcrypt para contrasenas
- Sesiones y proteccion CSRF
- Jest y Supertest para pruebas automatizadas

## Instalacion

1. Clonar el repositorio.
2. Abrir el proyecto en Visual Studio Code.
3. Instalar las dependencias:

   npm install

4. Copiar el archivo .env.example a .env.
5. Configurar DATABASE_URL y SESSION_SECRET con valores propios.

## Base de datos

Crear una base de datos PostgreSQL y ejecutar los siguientes archivos SQL en orden:

1. database/01_estructura_inicial.sql
2. database/02_biblioteca.sql
3. database/03_datos_iniciales.sql
4. database/04_datos_ejemplo.sql
5. database/05_auditoria.sql

El archivo 04 incluye cinco libros y tres socios ficticios. El archivo 05 crea la tabla de auditoria.

## Iniciar el servidor

Ejecutar:

   npm start

El puerto predeterminado del ejemplo es 3000.

Abrir en el navegador:

   http://localhost:3000

## Variables de entorno

Se configuran en el archivo .env (copiado de .env.example):

- DATABASE_URL: cadena de conexion a PostgreSQL.
- PORT: puerto del servidor (3000 por defecto).
- NODE_ENV: development o production. En production la cookie de sesion se marca Secure y se confia en el proxy del hosting (necesario para HTTPS y para guardar la IP real en la auditoria).
- SESSION_SECRET: clave larga y aleatoria para firmar la cookie de sesion.

## Credenciales de prueba

El sistema no trae usuarios con contrasena. El primer SuperAdmin se crea con el script de abajo y despues puede registrar mas usuarios desde el panel. Las pruebas automatizadas no usan esas cuentas: crean sus propios usuarios temporales (correo terminado en @test.biblioteca.local) y los borran al terminar.

## Pruebas automatizadas

Requisitos: haber ejecutado los scripts SQL (incluido el 05) y tener el archivo .env configurado.

Ejecutar todas las pruebas con un solo comando:

   npm test

El comando corre 44 casos en 3 archivos (tests/seguridad.test.js, tests/auditoria.test.js y tests/sesion.test.js) y cubre SQL Injection, XSS, CSRF, control de acceso (403), sesion, cookies, encabezados HTTP y auditoria. La prueba de sesion espera 61 segundos reales, por eso toda la corrida dura alrededor de 70 segundos.

Al terminar se generan dos reportes en la carpeta reports/:

- reports/reporte-pruebas-seguridad.html (abrir en el navegador)
- reports/reporte-pruebas-seguridad.xml (formato JUnit)

Las pruebas crean usuarios y registros de auditoria temporales y los eliminan al finalizar. Si una corrida se interrumpe, quedan usuarios con identificacion que empieza por TEST- y se limpian en la siguiente ejecucion.

## Auditoria

Se registran en la tabla auditoria: inicios de sesion exitosos y fallidos (fecha, hora e IP), cambios de rol de un usuario, cambios de permisos de un rol y todos los accesos denegados con HTTP 403 (ruta, metodo, usuario y hora).

- Solo el SuperAdmin puede consultarlos: pantalla /auditoria.html (boton Auditoria en el panel) o GET /api/auditoria (filtros opcionales tipo, limite y pagina).
- Los 403 se registran de forma automatica con un middleware (src/middleware/auditoria403.js), no hay que llamarlo en cada ruta.
- Para registrar cambios de permisos, el modulo de roles debe llamar a registrarCambioPermisos de src/services/auditoriaService.js con el rol, los permisos anteriores y los nuevos.
- Nunca se guardan contrasenas en la auditoria.

## Seguridad

- Contrasenas protegidas con bcrypt.
- Control de acceso mediante sesiones y roles.
- Proteccion CSRF.
- Registro de auditoria consultable solo por el SuperAdmin.
- Encabezados de seguridad con helmet (CSP, X-Frame-Options, nosniff y HSTS).
- Sesion que expira a los 60 segundos de inactividad, con cookie HttpOnly.
- Consultas SQL parametrizadas.
- Variables privadas almacenadas en .env, excluido de Git.

## Publicacion

URL del sistema publicado: (completar con la direccion del despliegue)

## Notas

- El archivo .env.example contiene valores de ejemplo, no credenciales reales.
- Para utilizar el panel administrativo se necesita una cuenta con el rol correspondiente.
- No se incluyen contrasenas reales ni datos personales de usuarios en los scripts de ejemplo.

## Crear el primer SuperAdmin

Despues de configurar PostgreSQL y ejecutar los scripts SQL, ejecutar:

    node scripts/crear-superadmin.js

El programa solicitara identificacion, nombre, usuario, correo y contrasena.

La contrasena debe tener al menos 8 caracteres y se almacena protegida con bcrypt.

Por seguridad:
- El script solo permite crear el administrador inicial si no existe otro SuperAdmin.
- No se deben compartir contrasenas ni incluirlas en GitHub.
- Si ya existe un SuperAdmin, el programa no creara otro.
