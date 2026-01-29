-- cleanup_taller_evidence.sql
-- Script para configurar la eliminación automática de evidencias antiguas de taller
-- Requisitos: Habilitar extensión pg_cron (si está disponible en tu plan) o ejecutar manualmente

-- 1. Crear función para eliminar archivos antiguos
CREATE OR REPLACE FUNCTION delete_old_workshop_evidence()
RETURNS void AS $$
DECLARE
  file_record RECORD;
BEGIN
  -- Iterar sobre archivos en el bucket 'evidencias-taller' creados hace más de 14 días
  FOR file_record IN
    SELECT name
    FROM storage.objects
    WHERE bucket_id = 'evidencias-taller'
      AND created_at < now() - INTERVAL '14 days'
  LOOP
    -- Eliminar archivo y su registro
    DELETE FROM storage.objects 
    WHERE bucket_id = 'evidencias-taller' AND name = file_record.name;
    
    RAISE NOTICE 'Deleted old file: %', file_record.name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Configurar CRON JOB (Si tienes extensión pg_cron instalada)
-- Se ejecutará todos los días a las 3:00 AM
-- Descomenta la siguiente línea si tienes pg_cron habilitado
-- SELECT cron.schedule('delete-old-evidence', '0 3 * * *', 'SELECT delete_old_workshop_evidence()');

-- NOTA: Si no tienes pg_cron (versiones gratuitas limitadas), 
-- tendrás que ejecutar: SELECT delete_old_workshop_evidence(); manualmente 
-- o usar un Edge Function programada.
