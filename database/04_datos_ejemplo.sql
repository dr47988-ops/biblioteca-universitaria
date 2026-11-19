-- DATOS FICTICIOS - BIBLIOTECA UNIVERSITARIA
INSERT INTO public.libros (isbn,titulo,autor,categoria,cantidad_disponible,ubicacion) VALUES
('9780000000001','Introduccion a la Programacion','Autor Ejemplo Uno','Tecnologia',5,'A1'),
('9780000000002','Fundamentos de Bases de Datos','Autor Ejemplo Dos','Tecnologia',4,'A2'),
('9780000000003','Matematica Universitaria','Autor Ejemplo Tres','Matematica',6,'B1'),
('9780000000004','Historia y Sociedad','Autor Ejemplo Cuatro','Historia',3,'C1'),
('9780000000005','Introduccion a la Estadistica','Autor Ejemplo Cinco','Estadistica',5,'B2')
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO public.socios (carne,nombre,correo) VALUES
('FICT-001','Estudiante Ejemplo Uno','estudiante1@example.com'),
('FICT-002','Estudiante Ejemplo Dos','estudiante2@example.com'),
('FICT-003','Estudiante Ejemplo Tres','estudiante3@example.com')
ON CONFLICT (carne) DO NOTHING;
