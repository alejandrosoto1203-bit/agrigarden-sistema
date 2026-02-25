-- =====================================================
-- MÓDULO DE CLIENTES - SCHEMA SQL
-- Ejecutar en Supabase SQL Editor (producción)
-- =====================================================

-- 1. Tabla Principal de Clientes (sincronizada desde Pulpos)
CREATE TABLE IF NOT EXISTS public.clientes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    pulpos_id       TEXT        UNIQUE,                          -- ID interno en Pulpos (dedup)
    nombre          TEXT,
    telefono        TEXT,
    email           TEXT,
    razon_social    TEXT,
    rfc             TEXT,
    lista_precios   TEXT,                                        -- Lista de precios asignada en Pulpos
    limite_credito  NUMERIC     DEFAULT 0,
    saldo           NUMERIC     DEFAULT 0,                      -- Deuda pendiente
    total_ventas    INTEGER     DEFAULT 0,                      -- # de ventas registradas
    total_vendido   NUMERIC     DEFAULT 0,                      -- Monto total histórico vendido
    ultima_venta_at TIMESTAMPTZ,                                -- Fecha de la última venta
    ultima_sync     TIMESTAMPTZ                                  -- Última sincronización desde Pulpos
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acceso_clientes" ON public.clientes;
CREATE POLICY "acceso_clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_clientes_nombre    ON public.clientes (nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_rfc       ON public.clientes (rfc);
CREATE INDEX IF NOT EXISTS idx_clientes_pulpos_id ON public.clientes (pulpos_id);
CREATE INDEX IF NOT EXISTS idx_clientes_saldo     ON public.clientes (saldo DESC);

-- =====================================================
-- 2. Agregar columnas de sync a tabla productos
-- (si ya existe la tabla, estas son migraciones seguras)
-- =====================================================
ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS pulpos_id    TEXT,
    ADD COLUMN IF NOT EXISTS ultima_sync  TIMESTAMPTZ;

-- Índice para dedup por pulpos_id en productos  
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_pulpos_id ON public.productos (pulpos_id)
    WHERE pulpos_id IS NOT NULL;
