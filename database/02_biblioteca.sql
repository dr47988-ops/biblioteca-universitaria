
-- Biblioteca Universitaria
-- Tablas compartidas para el modulo de biblioteca

CREATE TABLE IF NOT EXISTS public.libros (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(20) UNIQUE NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0
        CHECK (cantidad_disponible >= 0),
    ubicacion VARCHAR(100) NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.socios (
    id SERIAL PRIMARY KEY,
    carne VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prestamos (
    id SERIAL PRIMARY KEY,
    libro_id INTEGER NOT NULL
        REFERENCES public.libros(id),
    socio_id INTEGER NOT NULL
        REFERENCES public.socios(id),
    fecha_prestamo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    fecha_devolucion TIMESTAMPTZ,
    multa NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (multa >= 0),
    CHECK (
        fecha_devolucion IS NULL
        OR fecha_devolucion >= fecha_prestamo
    )
);
