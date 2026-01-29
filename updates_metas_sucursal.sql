-- Migration to split Income Goals by Branch (Norte/Sur)

-- 1. Add sucursal column with default 'Norte' for existing global goals
ALTER TABLE sys_metas_ingresos 
ADD COLUMN IF NOT EXISTS sucursal text NOT NULL DEFAULT 'Norte';

-- 2. Update existing entries to explicit 'Norte' (already covered by default but good to be sure)
UPDATE sys_metas_ingresos SET sucursal = 'Norte' WHERE sucursal IS NULL;

-- 3. Modify Unique Constraint
ALTER TABLE sys_metas_ingresos DROP CONSTRAINT IF EXISTS sys_metas_unique;

ALTER TABLE sys_metas_ingresos 
ADD CONSTRAINT sys_metas_unique UNIQUE (anio, mes, sucursal);
