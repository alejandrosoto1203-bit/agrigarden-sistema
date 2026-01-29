-- Fix for HTTP 409 Error: Enable Cascade Delete for Employees
-- This script updates the foreign key constraints to allow deleting an employee
-- and automatically deleting their associated payroll and task records.

-- 1. Update rrhh_nomina (Payroll)
ALTER TABLE rrhh_nomina
DROP CONSTRAINT IF EXISTS rrhh_nomina_empleado_id_fkey;

ALTER TABLE rrhh_nomina
ADD CONSTRAINT rrhh_nomina_empleado_id_fkey
FOREIGN KEY (empleado_id)
REFERENCES empleados(id)
ON DELETE CASCADE;

-- 2. Update rrhh_tareas (Tasks - if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rrhh_tareas') THEN
        ALTER TABLE rrhh_tareas DROP CONSTRAINT IF EXISTS rrhh_tareas_empleado_id_fkey;
        
        ALTER TABLE rrhh_tareas
        ADD CONSTRAINT rrhh_tareas_empleado_id_fkey
        FOREIGN KEY (empleado_id)
        REFERENCES empleados(id)
        ON DELETE CASCADE;
    END IF;
END $$;
