-- =====================================================
-- MÓDULO DE SOLICITUDES DEL PERSONAL
-- Ejecutar en Supabase SQL Editor (Producción)
-- =====================================================

-- 1. Tabla principal de solicitudes
CREATE TABLE IF NOT EXISTS public.solicitudes_empleado (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    empleado_id         UUID        NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    usuario_id          UUID        NOT NULL,           -- sys_usuarios.id del empleado
    tipo                TEXT        NOT NULL,           -- 'vacaciones' | 'permiso_sin_goce' | 'pase_salida' | 'permiso_horas'
    fecha_inicio        DATE,
    fecha_fin           DATE,
    hora_salida         TIME,
    hora_regreso        TIME,
    dias_solicitados    INT,                            -- calculado al crear
    descripcion         TEXT,
    estado              TEXT        NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aprobada' | 'negada'
    comentario_admin    TEXT,
    respondido_at       TIMESTAMPTZ,
    respondido_por      UUID,                           -- sys_usuarios.id del admin que respondió
    leido_por_empleado  BOOLEAN     NOT NULL DEFAULT false,
    dias_descontados    BOOLEAN     NOT NULL DEFAULT false   -- para el cron de vacaciones
);

-- 2. Seguridad
ALTER TABLE public.solicitudes_empleado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_solicitudes" ON public.solicitudes_empleado;
CREATE POLICY "acceso_solicitudes" ON public.solicitudes_empleado
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_sol_empleado
    ON public.solicitudes_empleado (empleado_id, estado);
CREATE INDEX IF NOT EXISTS idx_sol_usuario
    ON public.solicitudes_empleado (usuario_id, leido_por_empleado);
CREATE INDEX IF NOT EXISTS idx_sol_pendientes
    ON public.solicitudes_empleado (estado, created_at DESC)
    WHERE estado = 'pendiente';

-- =====================================================
-- pg_cron: DESCUENTO AUTOMÁTICO DE DÍAS DE VACACIONES
-- Requiere: Dashboard → Database → Extensions → pg_cron = ON
-- =====================================================
-- Ejecutar DESPUÉS de activar la extensión pg_cron:

SELECT cron.schedule(
    'descontar-vacaciones-aprobadas',
    '0 6 * * *',
    $$
        -- Paso 1: descontar días en empleados
        UPDATE public.empleados e
        SET dias_disponibles_vacaciones =
            GREATEST(0, COALESCE(dias_disponibles_vacaciones, 0) - s.dias_solicitados)
        FROM public.solicitudes_empleado s
        WHERE s.empleado_id = e.id
          AND s.tipo = 'vacaciones'
          AND s.estado = 'aprobada'
          AND s.dias_descontados = false
          AND s.fecha_fin < CURRENT_DATE
          AND s.dias_solicitados IS NOT NULL;

        -- Paso 2: marcar como descontadas para no repetir
        UPDATE public.solicitudes_empleado
        SET dias_descontados = true
        WHERE tipo = 'vacaciones'
          AND estado = 'aprobada'
          AND dias_descontados = false
          AND fecha_fin < CURRENT_DATE;
    $$
);
