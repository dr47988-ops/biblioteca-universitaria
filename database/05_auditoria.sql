-- PROYECTO 2 - BIBLIOTECA UNIVERSITARIA
-- PERSONA 4: REGISTRO DE AUDITORIA (UTN-09)

-- Cada fila es un evento de seguridad. Si se borra un usuario, el registro
-- se conserva (usuario_id queda en NULL) para no perder la evidencia.
CREATE TABLE IF NOT EXISTS public.auditoria (
    id BIGSERIAL PRIMARY KEY,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tipo_evento VARCHAR(30) NOT NULL
        CHECK (tipo_evento IN (
            'LOGIN_EXITOSO',
            'LOGIN_FALLIDO',
            'CAMBIO_ROL',
            'CAMBIO_PERMISOS',
            'ACCESO_DENEGADO'
        )),
    usuario_id INTEGER
        REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_ref VARCHAR(150),
    ip VARCHAR(64),
    metodo VARCHAR(10),
    ruta VARCHAR(300),
    detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
    ON public.auditoria (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_tipo
    ON public.auditoria (tipo_evento);
