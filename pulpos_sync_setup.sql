-- =====================================================
-- PULPOS SYNC - SETUP DE BASE DE DATOS
-- Ejecutar en Supabase SQL Editor (producción)
-- =====================================================

-- 1. Agregar columna 'fuente' a transacciones (para identificar registros de Pulpos)
ALTER TABLE public.transacciones
ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'MANUAL';

-- Actualizar registros existentes como manuales
UPDATE public.transacciones SET fuente = 'MANUAL' WHERE fuente IS NULL;

-- 2. Tabla de log de sincronizaciones
CREATE TABLE IF NOT EXISTS public.pulpos_sync_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_sync  DATE        NOT NULL,
    estado      TEXT        NOT NULL DEFAULT 'iniciado' CHECK (estado IN ('iniciado', 'completado', 'error')),
    ventas_importadas   INTEGER DEFAULT 0,
    ventas_pendientes   INTEGER DEFAULT 0,
    mensaje     TEXT,
    detalles    JSONB
);

ALTER TABLE public.pulpos_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_sync_log" ON public.pulpos_sync_log;
CREATE POLICY "acceso_sync_log"
    ON public.pulpos_sync_log FOR ALL
    USING (true) WITH CHECK (true);

-- 3. Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_transacciones_fuente ON public.transacciones (fuente);
CREATE INDEX IF NOT EXISTS idx_transacciones_categoria ON public.transacciones (categoria);
CREATE INDEX IF NOT EXISTS idx_sync_log_fecha ON public.pulpos_sync_log (fecha_sync DESC);
