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

## Módulo de biblioteca

Después de iniciar sesión, abrí **Módulo de biblioteca** desde el panel de administración. El catálogo permite buscar por título, autor o categoría. Los formularios y el reporte se habilitan según los permisos asignados a la cuenta.

- **Crear** habilita agregar libros, registrar socios y prestar ejemplares.
- **Editar** habilita modificar libros y registrar devoluciones.
- **Borrar** habilita eliminar libros sin historial de préstamos.
- **Ver reportes** habilita consultar los préstamos vencidos y los días de atraso.

Cada socio puede tener hasta tres préstamos activos. Los préstamos vencen a los siete días naturales y la multa es de ₡100 por cada día de atraso, según la fecha de Costa Rica. Si el equipo ya tiene la base compartida preparada, configurá `DATABASE_URL` con su conexión y usá las tablas existentes.
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

El proyecto incluye pruebas iniciales de autenticacion, acceso no autorizado e intentos de inyeccion SQL.

## Seguridad

- Contrasenas protegidas con bcrypt.
- Control de acceso mediante sesiones y roles.
- Proteccion CSRF.
- Registro de auditoria consultable solo por el SuperAdmin.
- Encabezados de seguridad con helmet (CSP, X-Frame-Options, nosniff y HSTS).
- Sesion que expira a los 60 segundos de inactividad, con cookie HttpOnly.
- Consultas SQL parametrizadas.
- Variables privadas almacenadas en .env, excluido de Git.

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
