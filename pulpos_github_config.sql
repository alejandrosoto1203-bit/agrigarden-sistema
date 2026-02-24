-- =====================================================
-- CONFIGURACIÓN DE GITHUB SYNC
-- Ejecutar en Supabase SQL Editor después de crear
-- el Personal Access Token en GitHub
-- =====================================================
-- INSTRUCCIONES:
-- 1. Reemplaza 'TU_USUARIO_GITHUB' con tu usuario (ej: alejandrosoto1203-bit)
-- 2. Reemplaza 'TU_REPO' con el nombre del repo (ej: agrigarden-sistema)
-- 3. Reemplaza 'TU_TOKEN_GITHUB' con el token generado en GitHub

INSERT INTO public.sys_config (key, value, description)
VALUES (
    'github_sync_config',
    '{
        "owner": "TU_USUARIO_GITHUB",
        "repo":  "TU_REPO",
        "token": "TU_TOKEN_GITHUB"
    }'::jsonb,
    'Configuración para sincronización con Pulpos via GitHub Actions'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
