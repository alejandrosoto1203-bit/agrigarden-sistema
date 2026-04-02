-- ============================================================
-- MIGRACIÓN: Reset de Cuentas por Cobrar
-- Fecha: 2026-04-02
-- Descripción: Agrega columna fecha_vencimiento a transacciones
--              para permitir vencimientos personalizados en CxC manuales
-- ============================================================

-- Columna opcional de fecha de vencimiento
-- Si existe, se usa para el cálculo de vencimiento
-- Si es NULL, se mantiene el cálculo legacy (created_at + 30 días)
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
