-- =====================================================
-- MÓDULO DE CLIENTES - SCHEMA SQL (STAGING)
-- Ejecutar en Supabase SQL Editor (producción)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clientes_staging (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_sync      TEXT        NOT NULL,
    sync_log_id     UUID        REFERENCES public.pulpos_sync_log(id) ON DELETE CASCADE,
    pulpos_id       TEXT,
    nombre          TEXT,
    telefono        TEXT,
    email           TEXT,
    razon_social    TEXT,
    rfc             TEXT,
    lista_precios   TEXT,
    limite_credito  NUMERIC,
    saldo           NUMERIC,
    total_ventas    INTEGER,
    total_vendido   NUMERIC,
    confirmado      BOOLEAN     DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acceso_clientes_staging" ON public.clientes_staging;
CREATE POLICY "acceso_clientes_staging" ON public.clientes_staging FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_staging_fecha    ON public.clientes_staging (fecha_sync);
CREATE INDEX IF NOT EXISTS idx_clientes_staging_log_id   ON public.clientes_staging (sync_log_id);
CREATE INDEX IF NOT EXISTS idx_clientes_staging_confirmado ON public.clientes_staging (confirmado);
