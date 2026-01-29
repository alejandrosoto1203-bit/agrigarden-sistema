-- Estado de Resultados - Schema
-- Tabla para almacenar estados de resultados mensuales cerrados

CREATE TABLE IF NOT EXISTS estados_resultados (
    id SERIAL PRIMARY KEY,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anio INTEGER NOT NULL,
    sucursal TEXT NOT NULL,
    
    -- Ingresos
    ingresos_ventas DECIMAL(12,2) DEFAULT 0,
    ingresos_servicios DECIMAL(12,2) DEFAULT 0,
    total_ingresos DECIMAL(12,2) DEFAULT 0,
    
    -- Costo de Ventas
    costo_ventas DECIMAL(12,2) DEFAULT 0,
    utilidad_bruta DECIMAL(12,2) DEFAULT 0,
    
    -- Gastos
    gastos_operacion DECIMAL(12,2) DEFAULT 0,
    gastos_financieros DECIMAL(12,2) DEFAULT 0,
    gastos_contables DECIMAL(12,2) DEFAULT 0,
    
    -- Utilidades
    utilidad_operacion DECIMAL(12,2) DEFAULT 0,
    utilidad_neta DECIMAL(12,2) DEFAULT 0,
    
    -- Metadata
    cerrado BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per month/year/branch
    UNIQUE(mes, anio, sucursal)
);

-- Enable RLS
ALTER TABLE estados_resultados ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Allow all for authenticated users" ON estados_resultados
    FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_estados_anio ON estados_resultados(anio);
CREATE INDEX IF NOT EXISTS idx_estados_sucursal ON estados_resultados(sucursal);
