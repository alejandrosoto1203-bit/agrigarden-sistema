-- =====================================================
-- TABLA: pulpos_sync_staging
-- Área temporal de revisión antes de confirmar sync
-- Ejecutar en Supabase SQL Editor (Producción)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pulpos_sync_staging (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    sync_log_id       UUID,
    fecha_sync        DATE        NOT NULL,
    numero_venta      TEXT,
    sucursal          TEXT,
    monto             NUMERIC(12,2),
    metodo_pago       TEXT,
    metodo_pulpos     TEXT,           -- Método original en Pulpos (para contexto)
    nombre_cliente    TEXT,
    estado_cobro      TEXT,
    vendedor          TEXT,
    notas             TEXT,
    requiere_revision BOOLEAN     DEFAULT false,
    confirmado        BOOLEAN     DEFAULT false
);

-- Seguridad
ALTER TABLE public.pulpos_sync_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_staging" ON public.pulpos_sync_staging;
CREATE POLICY "acceso_staging" ON public.pulpos_sync_staging
    FOR ALL USING (true) WITH CHECK (true);

-- Índice para consultas por fecha
CREATE INDEX IF NOT EXISTS idx_staging_fecha
    ON public.pulpos_sync_staging (fecha_sync, confirmado);
