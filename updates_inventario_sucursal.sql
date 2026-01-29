-- Migration for Inventory Module Branch Support

-- 1. Add the sucursal column (safe to run multiple times due to IF NOT EXISTS)
ALTER TABLE inventario_mensual ADD COLUMN IF NOT EXISTS sucursal text DEFAULT 'Matriz';

-- 2. Drop the old unique constraint that causes the error
-- The error "duplicate key value violates unique constraint 'inventario_mensual_mes_anio_key'" happens because
-- the old constraint didn't account for different branches having the same month/year.
ALTER TABLE inventario_mensual DROP CONSTRAINT IF EXISTS inventario_mensual_mes_anio_key;

-- 3. Add a new unique constraint that INCLUDES the sucursal
-- This allows (Enero, 2025, Norte) and (Enero, 2025, Sur) to exist simultaneously.
ALTER TABLE inventario_mensual ADD CONSTRAINT inventario_mensual_mes_anio_sucursal_key UNIQUE (mes, anio, sucursal);
