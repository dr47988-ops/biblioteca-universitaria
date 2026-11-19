-- PROYECTO 2 - BIBLIOTECA UNIVERSITARIA
-- PERSONA 1: ASIGNACION DE PERMISOS

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p ON
    (r.nombre = 'SuperAdmin' AND p.nombre IN ('crear', 'editar', 'borrar', 'ver_reportes'))
    OR (r.nombre = 'Auditor' AND p.nombre = 'ver_reportes')
    OR (r.nombre = 'Bibliotecario' AND p.nombre IN ('crear', 'editar'))
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
