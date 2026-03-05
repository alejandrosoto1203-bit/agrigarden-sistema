-- Migración: Vincular transacciones con órdenes de reparación
-- Ejecutar en SQL Editor de Supabase

-- Agregar columna para vincular transacción con orden de reparación
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS orden_reparacion_id BIGINT REFERENCES ordenes_reparacion(id) ON DELETE SET NULL;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_transacciones_orden_reparacion ON transacciones(orden_reparacion_id) WHERE orden_reparacion_id IS NOT NULL;
