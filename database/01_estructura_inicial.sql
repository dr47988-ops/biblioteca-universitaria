
-- PROYECTO 2 - BIBLIOTECA UNIVERSITARIA
-- PERSONA 1: BASE DE DATOS Y USUARIOS

-- Tabla de roles
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

-- Tabla de permisos
CREATE TABLE IF NOT EXISTS public.permisos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);

-- Relacion entre roles y permisos
CREATE TABLE IF NOT EXISTS public.rol_permiso (
    rol_id INTEGER NOT NULL REFERENCES public.roles(id),
    permiso_id INTEGER NOT NULL REFERENCES public.permisos(id),
    PRIMARY KEY (rol_id, permiso_id)
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id SERIAL PRIMARY KEY,
    identificacion VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES public.roles(id),
    ultimo_inicio_sesion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Roles iniciales
INSERT INTO public.roles (nombre, descripcion)
VALUES
('SuperAdmin', 'Administrador general'),
('Auditor', 'Usuario de consulta'),
('Bibliotecario', 'Gestion de biblioteca')
ON CONFLICT (nombre) DO NOTHING;

-- Permisos iniciales
INSERT INTO public.permisos (nombre, descripcion)
VALUES
('crear', 'Crear registros'),
('editar', 'Editar registros'),
('borrar', 'Eliminar registros'),
('ver_reportes', 'Consultar reportes')
ON CONFLICT (nombre) DO NOTHING;
