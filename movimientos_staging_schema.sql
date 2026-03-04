-- =====================================================
-- MÓDULO DE MOVIMIENTOS - SCHEMA SQL (STAGING)
-- Ejecutar en Supabase SQL Editor (producción)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.movimientos_staging (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_sync      TEXT        NOT NULL,
    sync_log_id     UUID        REFERENCES public.pulpos_sync_log(id) ON DELETE CASCADE,
    producto_id     BIGINT      REFERENCES public.productos(id),
    producto_sku    TEXT,
    producto_nombre TEXT,
    sucursal        TEXT,
    tipo            TEXT,
    cantidad        NUMERIC     DEFAULT 0,
    stock_anterior  NUMERIC     DEFAULT 0,
    stock_nuevo     NUMERIC     DEFAULT 0,
    referencia      TEXT,
    notas           TEXT,
    fecha_movimiento TIMESTAMPTZ,
    confirmado      BOOLEAN     DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimientos_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acceso_movimientos_staging" ON public.movimientos_staging;
CREATE POLICY "acceso_movimientos_staging" ON public.movimientos_staging FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_movimientos_staging_fecha       ON public.movimientos_staging (fecha_sync);
CREATE INDEX IF NOT EXISTS idx_movimientos_staging_log_id      ON public.movimientos_staging (sync_log_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_staging_confirmado  ON public.movimientos_staging (confirmado);
