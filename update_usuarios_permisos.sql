-- Actualización de la tabla sys_usuarios para el sistema de permisos
ALTER TABLE public.sys_usuarios 
ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS sucursal TEXT DEFAULT 'Ambas';

-- Actualizar al administrador por defecto con acceso total
UPDATE public.sys_usuarios 
SET permisos = '{
    "dashboard": {"ver": true, "editar": true},
    "ventas": {"ver": true, "editar": true},
    "ingresos": {"ver": true, "editar": true},
    "cobrar": {"ver": true, "editar": true},
    "gastos": {"ver": true, "editar": true},
    "compras": {"ver": true, "editar": true},
    "pagar": {"ver": true, "editar": true},
    "inversiones": {"ver": true, "editar": true},
    "prestamos": {"ver": true, "editar": true},
    "rrhh": {"ver": true, "editar": true},
    "inventario": {"ver": true, "editar": true},
    "productos": {"ver": true, "editar": true},
    "flotilla": {"ver": true, "editar": true},
    "efectivo": {"ver": true, "editar": true},
    "estado_resultados": {"ver": true, "editar": true},
    "reportes": {"ver": true, "editar": true},
    "configuracion": {"ver": true, "editar": true}
}'::jsonb
WHERE email = 'admin@agrigarden.com';

COMMENT ON COLUMN public.sys_usuarios.permisos IS 'Objeto JSONB con esquema {modulo: {ver: bool, editar: bool}}';
COMMENT ON COLUMN public.sys_usuarios.sucursal IS 'Sucursal asignada: Norte, Sur o Ambas';
