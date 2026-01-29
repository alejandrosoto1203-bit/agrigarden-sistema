-- Final Fix for Employee Deletion (Recursive & Other Constraints)

-- 1. Fix Recursive Relationship (Manager -> Subordinates)
-- If a manager is deleted, set their subordinates' 'reporta_a' to NULL.
ALTER TABLE empleados
DROP CONSTRAINT IF EXISTS empleados_reporta_a_fkey;

ALTER TABLE empleados
ADD CONSTRAINT empleados_reporta_a_fkey
FOREIGN KEY (reporta_a)
REFERENCES empleados(id)
ON DELETE SET NULL;

-- 2. Fix System Users Link (if exists)
-- If employee is deleted, maybe keep the user but nullify the link, or delete user?
-- Safe approach: Set NULL.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sys_usuarios' AND column_name = 'empleado_id') THEN
        ALTER TABLE sys_usuarios DROP CONSTRAINT IF EXISTS sys_usuarios_empleado_id_fkey;
        
        ALTER TABLE sys_usuarios
        ADD CONSTRAINT sys_usuarios_empleado_id_fkey
        FOREIGN KEY (empleado_id)
        REFERENCES empleados(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Fix Vehicles/Flotilla (Responsable)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'flotilla_vehiculos' AND column_name = 'responsable_id') THEN
        ALTER TABLE flotilla_vehiculos DROP CONSTRAINT IF EXISTS flotilla_vehiculos_responsable_id_fkey;
        
        ALTER TABLE flotilla_vehiculos
        ADD CONSTRAINT flotilla_vehiculos_responsable_id_fkey
        FOREIGN KEY (responsable_id)
        REFERENCES empleados(id)
        ON DELETE SET NULL;
    END IF;
END $$;
