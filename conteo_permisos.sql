-- PERMISOS PARA TABLAS DE CONTEO DE INVENTARIO
-- Ejecutar en Supabase SQL Editor si "Guardar Avance" no guarda nada

GRANT SELECT, INSERT, UPDATE, DELETE ON conteos_inventario TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conteo_items       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conteo_bitacora    TO anon;

-- Permisos en las vistas (solo lectura)
GRANT SELECT ON v_conteo_diferencias  TO anon;
GRANT SELECT ON v_tendencias_faltantes TO anon;
