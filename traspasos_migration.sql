-- =====================================================
-- MIGRACIÓN: Agregar columna usuario a movimientos y transferencias
-- Ejecutar en Supabase SQL Editor ANTES de usar el módulo de Traspasos
-- =====================================================

-- Agregar columna usuario a movimientos_stock
ALTER TABLE movimientos_stock ADD COLUMN IF NOT EXISTS usuario TEXT;

-- Agregar columna usuario a transferencias_stock
ALTER TABLE transferencias_stock ADD COLUMN IF NOT EXISTS usuario TEXT;
