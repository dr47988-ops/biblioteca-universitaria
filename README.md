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

El ultimo archivo incluye cinco libros y tres socios ficticios.

## Iniciar el servidor

Ejecutar:

   npm start

El puerto predeterminado del ejemplo es 3000.

Abrir en el navegador:

   http://localhost:3000

## Módulo de biblioteca

Después de iniciar sesión, abrí **Módulo de biblioteca** desde el panel de administración. El catálogo permite buscar por título, autor o categoría. Los formularios y el reporte se habilitan según los permisos asignados a la cuenta.

- **Crear** habilita agregar libros, registrar socios y prestar ejemplares.
- **Editar** habilita modificar libros y registrar devoluciones.
- **Borrar** habilita eliminar libros sin historial de préstamos.
- **Ver reportes** habilita consultar los préstamos vencidos y los días de atraso.

Cada socio puede tener hasta tres préstamos activos. Los préstamos vencen a los siete días naturales y la multa es de ₡100 por cada día de atraso, según la fecha de Costa Rica. Si el equipo ya tiene la base compartida preparada, configurá `DATABASE_URL` con su conexión y usá las tablas existentes.

## Pruebas automatizadas

Ejecutar:

   npm test

El proyecto incluye pruebas de autenticacion, acceso no autorizado, inyeccion SQL, permisos por rol, CSRF, sesion, cookies y encabezados HTTP.

Las pruebas de permisos que necesitan usuarios reales usan las variables `TEST_*` de `.env.example`. Si no estan definidas, esas pruebas se omiten. La prueba de expiracion de sesion espera 61 segundos.

## Seguridad

- Contrasenas protegidas con bcrypt.
- Control de acceso mediante sesiones y roles.
- Proteccion CSRF.
- Consultas SQL parametrizadas.
- Variables privadas almacenadas en .env, excluido de Git.

## Roles y permisos

Los permisos se asignan a roles, no a usuarios. Hay cuatro permisos independientes: `crear`, `editar`, `borrar` y `ver_reportes`.

| Rol | Permisos | Usuarios | Roles |
|---|---|---|---|
| SuperAdmin | Todos | CRUD | CRUD y asignacion de permisos |
| Auditor | ver_reportes | Solo lectura | Sin acceso (403) |
| Bibliotecario | crear, editar, borrar | Solo lectura | Sin acceso (403) |

- Los roles y permisos se consultan en la base de datos en cada solicitud, por lo que un cambio aplica de inmediato.
- Los roles base no se pueden renombrar ni eliminar, y el SuperAdmin conserva siempre todos los permisos.
- No se puede eliminar un rol que tenga usuarios asignados.
- Toda accion sin permiso responde HTTP 403 con un mensaje generico, sin datos ni trazas.

Middleware disponible en `src/middleware/authMiddleware.js`:

- `usuarioAutenticado`: cualquier sesion valida.
- `requierePermiso('crear')`: exige al menos uno de los permisos indicados.
- `soloSuperAdmin`: exclusivo del SuperAdmin.

### API de roles (solo SuperAdmin)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | /api/roles | Lista roles con permisos y cantidad de usuarios |
| GET | /api/roles/permisos | Catalogo de permisos |
| POST | /api/roles | Crea un rol `{ nombre, descripcion, permisos: [ids] }` |
| PUT | /api/roles/:id | Edita un rol y reemplaza sus permisos |
| DELETE | /api/roles/:id | Elimina un rol sin usuarios |

Las rutas que modifican datos requieren el encabezado `X-CSRF-Token`, obtenido en `GET /api/auth/csrf-token`.

## Protecciones implementadas

| Requerimiento | Implementacion |
|---|---|
| SQL Injection (UTN-07a) | Consultas parametrizadas (`$1, $2...`) en todo el backend |
| XSS (UTN-07b) | Escape al mostrar con `textContent`, CSP sin scripts en linea y validacion de entradas en `src/utils/validacion.js` |
| Sesion (UTN-07c) | Expira tras 60 s de inactividad en servidor y navegador; cookie `biblioteca.sid` con `HttpOnly`, `SameSite=Strict` y `Secure` en produccion; las paginas internas redirigen al login sin sesion |
| CSRF (UTN-07d) | Token sincronizado en el encabezado `X-CSRF-Token` y cookie `SameSite=Strict` |
| Encabezados (UTN-08) | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy` y API sin cache |
| Fuerza bruta | Maximo 10 intentos fallidos de inicio de sesion por IP cada 15 minutos |

En produccion se debe definir `NODE_ENV=production` para activar la cookie `Secure` y `trust proxy`.

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
