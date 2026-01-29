-- MIGRACIÓN PARA SOLICITUDES DE TALLER
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS solicitudes_taller (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    codigo TEXT,
    proveedor TEXT,
    marca TEXT,
    nombre_pieza TEXT,
    referencias TEXT,
    cantidad INTEGER DEFAULT 1,
    tipo_solicitud TEXT CHECK (tipo_solicitud IN ('Normal', 'Urgente')),
    motivo_urgencia TEXT,
    evidencia_url TEXT,
    fecha_limite_cotizacion TIMESTAMP WITH TIME ZONE,
    precio_cliente NUMERIC(10,2),
    estatus TEXT DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'Cotizado', 'Aceptado')),
    fecha_cotizacion TIMESTAMP WITH TIME ZONE,
    fecha_aceptacion TIMESTAMP WITH TIME ZONE
);

-- 2. Habilitar RLS (Opcional, pero recomendado si ya usas auth)
ALTER TABLE solicitudes_taller ENABLE ROW LEVEL SECURITY;

-- Política para permitir todo (Ajustar según seguridad deseada, aquí abierto para demo)
CREATE POLICY "Acceso total a solicitudes_taller" ON solicitudes_taller
FOR ALL USING (true) WITH CHECK (true);

-- 3. Crear Bucket de Storage (Si no existe, ejecutar esto o crearlo manual en UI)
-- Nota: Crear buckets vía SQL requiere extensiones a veces. Mejor crear manual si falla.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias-taller', 'evidencias-taller', true)
ON CONFLICT (id) DO NOTHING;

-- Política de Storage (Público)
CREATE POLICY "Public Access Evidencias" ON storage.objects
FOR SELECT USING (bucket_id = 'evidencias-taller');

CREATE POLICY "Public Upload Evidencias" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'evidencias-taller');
