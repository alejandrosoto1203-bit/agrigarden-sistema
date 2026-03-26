-- ============================================================
-- MÓDULO: Cuentas Bancarias
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Traspasos entre cuentas bancarias
CREATE TABLE IF NOT EXISTS traspasos_cuentas_bancarias (
  id          BIGSERIAL PRIMARY KEY,
  cuenta_origen   TEXT NOT NULL,   -- key de la cuenta (ej: 'bbva_norte')
  cuenta_destino  TEXT NOT NULL,   -- key de la cuenta (ej: 'hey_banco_sur')
  monto       NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pagos de tarjeta de crédito
CREATE TABLE IF NOT EXISTS pagos_tarjeta_credito (
  id             BIGSERIAL PRIMARY KEY,
  tarjeta        TEXT NOT NULL,   -- key de la tarjeta (ej: 'tdc_bbva')
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  cuenta_origen  TEXT,            -- key de la cuenta que realizó el pago (ej: 'bbva_norte')
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE traspasos_cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_tarjeta_credito ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso (anon key puede leer y escribir)
CREATE POLICY "Allow all on traspasos_cuentas_bancarias"
  ON traspasos_cuentas_bancarias FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on pagos_tarjeta_credito"
  ON pagos_tarjeta_credito FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'traspasos_cuentas_bancarias OK' AS status FROM traspasos_cuentas_bancarias LIMIT 0;
SELECT 'pagos_tarjeta_credito OK' AS status FROM pagos_tarjeta_credito LIMIT 0;
