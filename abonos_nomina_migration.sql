-- ============================================================
-- MÓDULO: Pagos Parciales de Nómina
-- Ejecutar en Supabase SQL Editor (PROD)
-- ============================================================

-- 1. Agregar columna monto_pagado a rrhh_nomina (track de abonos acumulados)
ALTER TABLE rrhh_nomina ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12,2) DEFAULT 0;

-- 2. Tabla de abonos de nómina (historial de pagos parciales)
CREATE TABLE IF NOT EXISTS abonos_nomina (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nomina_id       UUID NOT NULL REFERENCES rrhh_nomina(id) ON DELETE CASCADE,
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo_pago     TEXT NOT NULL,
  cuenta_origen   TEXT,
  sucursal        TEXT,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  abono_num       INT DEFAULT 1,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE abonos_nomina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on abonos_nomina"
  ON abonos_nomina FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'abonos_nomina OK' AS status FROM abonos_nomina LIMIT 0;
SELECT column_name FROM information_schema.columns WHERE table_name = 'rrhh_nomina' AND column_name = 'monto_pagado';
