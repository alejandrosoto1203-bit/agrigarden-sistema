-- =====================================================
-- NUEVA TABLA: pulpos_sync_staging_items
-- Ítems (productos) de cada venta sincronizada desde Pulpos
-- Ejecutar en Supabase SQL Editor ANTES de usar el nuevo sync
-- =====================================================

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS pulpos_sync_staging_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    staging_id      UUID        REFERENCES pulpos_sync_staging(id) ON DELETE CASCADE,
    numero_venta    TEXT,                           -- Ej: #9649 (para búsqueda fácil)
    sku_pulpos      TEXT,                           -- SKU tal como viene de Pulpos
    nombre_pulpos   TEXT,                           -- Nombre tal como viene de Pulpos
    cantidad        NUMERIC(10,4) DEFAULT 1,
    precio_unitario NUMERIC(12,2) DEFAULT 0,
    subtotal        NUMERIC(12,2) DEFAULT 0,
    producto_id     BIGINT,                         -- FK a productos.id (NULL = no encontrado)
    producto_nombre TEXT,                           -- Nombre oficial en nuestro sistema
    match_status    TEXT DEFAULT 'unmatched',       -- matched | unmatched | linked | nuevo | ignorado
    confirmado      BOOLEAN DEFAULT FALSE
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_staging_items_staging_id ON pulpos_sync_staging_items(staging_id);
CREATE INDEX IF NOT EXISTS idx_staging_items_sku        ON pulpos_sync_staging_items(sku_pulpos);
CREATE INDEX IF NOT EXISTS idx_staging_items_confirmado ON pulpos_sync_staging_items(confirmado);

-- 3. Habilitar RLS
ALTER TABLE pulpos_sync_staging_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso Total staging items" ON pulpos_sync_staging_items;
CREATE POLICY "Acceso Total staging items" ON pulpos_sync_staging_items
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VERIFICACIÓN: ejecuta esto para confirmar que quedó bien
-- SELECT id, sku_pulpos, nombre_pulpos, cantidad, match_status
-- FROM pulpos_sync_staging_items LIMIT 10;
-- =====================================================
