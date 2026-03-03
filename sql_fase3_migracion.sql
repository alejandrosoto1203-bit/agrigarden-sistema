-- =====================================================
-- MIGRACIÓN: Convertir contraseñas existentes a hash bcrypt
-- ⚠️ EJECUTAR UNA SOLA VEZ, DESPUÉS de sql_fase3_cifrado.sql
-- ⚠️ EJECUTAR PRIMERO EN AMBIENTE TEST
-- =====================================================

-- Esto toma cada contraseña en texto plano y la convierte a hash bcrypt.
-- Las contraseñas que YA son hash (empiezan con $2) se dejan intactas.

UPDATE sys_usuarios
SET password = crypt(password, gen_salt('bf'))
WHERE password NOT LIKE '$2%';

-- Verificar: todas las contraseñas ahora deben empezar con $2b$
-- Ejecutar esto para confirmar:
SELECT id, nombre, email, LEFT(password, 10) as password_inicio
FROM sys_usuarios;
