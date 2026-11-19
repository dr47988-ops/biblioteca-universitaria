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

## Pruebas automatizadas

Ejecutar:

   npm test

El proyecto incluye pruebas iniciales de autenticacion, acceso no autorizado e intentos de inyeccion SQL.

## Seguridad

- Contrasenas protegidas con bcrypt.
- Control de acceso mediante sesiones y roles.
- Proteccion CSRF.
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
