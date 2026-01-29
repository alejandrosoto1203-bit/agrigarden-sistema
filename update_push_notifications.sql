-- update_push_notifications.sql
-- Infraestructura para el sistema de notificaciones push

-- 1. Tabla para almacenar las suscripciones de los navegadores de los usuarios
CREATE TABLE IF NOT EXISTS public.sys_push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id bigint REFERENCES public.sys_usuarios(id) ON DELETE CASCADE,
    subscription_data jsonb NOT NULL, -- Datos de la suscripción (endpoint, keys, etc.)
    browser_info text, -- Opcional: Chrome, Firefox, Mobile, etc.
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(usuario_id, browser_info) 
);

-- 2. Tabla para log de notificaciones enviadas
CREATE TABLE IF NOT EXISTS public.sys_notificaciones_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id bigint REFERENCES public.sys_usuarios(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    modulo text, -- 'compras', 'tareas', 'flotilla', etc.
    leida boolean DEFAULT false,
    data jsonb, -- Datos adicionales (link, id_registro)
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.sys_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_notificaciones_log ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (para simplificar según estándar del proyecto)
DROP POLICY IF EXISTS "Acceso total suscripciones" ON public.sys_push_subscriptions;
CREATE POLICY "Acceso total suscripciones" ON public.sys_push_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total log notificaciones" ON public.sys_notificaciones_log;
CREATE POLICY "Acceso total log notificaciones" ON public.sys_notificaciones_log FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.sys_push_subscriptions IS 'Almacena los tokens de suscripción para Web Push API por usuario.';
COMMENT ON TABLE public.sys_notificaciones_log IS 'Historial de notificaciones enviadas a los usuarios del sistema.';
