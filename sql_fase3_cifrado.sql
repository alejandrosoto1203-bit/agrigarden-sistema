-- =====================================================
-- FASE 3: CIFRADO DE CONTRASEÑAS CON BCRYPT
-- Ejecutar en Supabase SQL Editor (Dashboard Web)
-- ⚠️ EJECUTAR PRIMERO EN AMBIENTE TEST
-- =====================================================

-- 1. Habilitar extensión pgcrypto (bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Función para verificar login (el "portero")
-- Se llama desde el frontend con: sb.rpc('verify_login', { p_email, p_password })
CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Corre con permisos de admin, no del usuario anónimo
AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Buscar usuario por email
    SELECT id, nombre, email, password, rol, sucursal, permisos, empleado_id
    INTO v_user
    FROM sys_usuarios
    WHERE email = p_email;

    -- Si no existe el email
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Credenciales incorrectas');
    END IF;

    -- Comparar contraseña con hash bcrypt
    IF v_user.password = crypt(p_password, v_user.password) THEN
        -- Login exitoso: devolver datos SIN la contraseña
        RETURN json_build_object(
            'success', true,
            'user', json_build_object(
                'id', v_user.id,
                'nombre', v_user.nombre,
                'email', v_user.email,
                'rol', v_user.rol,
                'sucursal', v_user.sucursal,
                'permisos', v_user.permisos,
                'empleado_id', v_user.empleado_id
            )
        );
    ELSE
        RETURN json_build_object('success', false, 'error', 'Credenciales incorrectas');
    END IF;
END;
$$;

-- 3. Función para hashear una contraseña (se usa al guardar usuarios)
-- Se llama desde el frontend con: sb.rpc('hash_password', { p_password })
CREATE OR REPLACE FUNCTION hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN crypt(p_password, gen_salt('bf'));
END;
$$;

-- 4. Dar permisos para que el frontend pueda llamar estas funciones
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION hash_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION hash_password(TEXT) TO authenticated;
