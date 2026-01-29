-- Migration Script for Multi-Branch Architecture
-- Run this in your Supabase SQL Editor to ensure all tables have the required branch columns.

-- 1. Transacciones (Ingresos / Cuentas por Cobrar)
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS sucursal text DEFAULT 'Matriz';

-- 2. Gastos (Egresos / Cuentas por Pagar)
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS sucursal text DEFAULT 'Matriz';

-- 3. Inversiones (Activos Fijos)
ALTER TABLE inversiones ADD COLUMN IF NOT EXISTS sucursal text DEFAULT 'Matriz';

-- 4. Préstamos (Pasivos)
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS sucursal text DEFAULT 'Matriz';

-- 5. Compras (Ordenes de Compra)
-- Note: Logic uses 'sucursal_origen' with values 'M', 'N', 'S'
ALTER TABLE compras_agrigarden ADD COLUMN IF NOT EXISTS sucursal_origen text DEFAULT 'M';

-- Optional: Add Index for performance on filtering
CREATE INDEX IF NOT EXISTS idx_transacciones_sucursal ON transacciones(sucursal);
CREATE INDEX IF NOT EXISTS idx_gastos_sucursal ON gastos(sucursal);
