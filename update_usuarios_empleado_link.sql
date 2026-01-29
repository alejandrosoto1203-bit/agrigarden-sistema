-- Vincular usuarios con empleados de RRHH (Corrección de Tipo UUID)
ALTER TABLE public.sys_usuarios 
ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sys_usuarios.empleado_id IS 'Referencia al ID del empleado en la tabla de empleados (RRHH)';
