-- ============================================================
-- MÓDULO: Préstamos a Empleados
-- Ejecutar en Supabase SQL Editor (PROD)
-- ============================================================

-- 1. Tabla principal de préstamos a empleados
CREATE TABLE IF NOT EXISTS prestamos_empleados (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id         UUID NOT NULL,
  monto_total         NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
  num_quincenas       INT NOT NULL CHECK (num_quincenas > 0),
  monto_por_quincena  NUMERIC(12,2) NOT NULL,
  cuenta_origen_key   TEXT NOT NULL,
  cuenta_origen_nombre TEXT NOT NULL,
  fecha_otorgamiento  DATE NOT NULL DEFAULT CURRENT_DATE,
  quincenas_pagadas   INT DEFAULT 0,
  saldo_pendiente     NUMERIC(12,2) NOT NULL,
  estatus             TEXT DEFAULT 'activo' CHECK (estatus IN ('activo', 'liquidado', 'cancelado')),
  gasto_id            UUID,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de abonos (descuentos vía nómina o pagos voluntarios)
CREATE TABLE IF NOT EXISTS abonos_prestamos_empleados (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id  UUID NOT NULL REFERENCES prestamos_empleados(id) ON DELETE CASCADE,
  monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo         TEXT DEFAULT 'descuento_nomina',  -- 'descuento_nomina' | 'pago_voluntario'
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE prestamos_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos_prestamos_empleados ENABLE ROW LEVEL SECURITY;

-- 4. Políticas (anon key puede leer y escribir)
CREATE POLICY "Allow all on prestamos_empleados"
  ON prestamos_empleados FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on abonos_prestamos_empleados"
  ON abonos_prestamos_empleados FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'prestamos_empleados OK' AS status FROM prestamos_empleados LIMIT 0;
SELECT 'abonos_prestamos_empleados OK' AS status FROM abonos_prestamos_empleados LIMIT 0;
