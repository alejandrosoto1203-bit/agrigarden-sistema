-- Enable the storage extension if not already enabled (usually is by default)
-- CREATE EXTENSION IF NOT EXISTS "storage";

-- 1. Create 'rrhh_documentos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('rrhh_documentos', 'rrhh_documentos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'fotos_empleados' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos_empleados', 'fotos_empleados', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies for 'rrhh_documentos'
-- First DROP policies if they exist to avoid "already exists" errors
DROP POLICY IF EXISTS "Public Read RRHH" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert RRHH" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public Read RRHH"
ON storage.objects FOR SELECT
USING ( bucket_id = 'rrhh_documentos' );

-- Allow public insert access
CREATE POLICY "Public Insert RRHH"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'rrhh_documentos' );

-- 4. Policies for 'fotos_empleados'
DROP POLICY IF EXISTS "Public Read Fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Fotos" ON storage.objects;

CREATE POLICY "Public Read Fotos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'fotos_empleados' );

CREATE POLICY "Public Insert Fotos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'fotos_empleados' );
