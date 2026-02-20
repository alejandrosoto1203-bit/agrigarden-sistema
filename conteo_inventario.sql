-- MODULO: CONTEO DE INVENTARIO - AGRIGARDEN
-- Ejecutar en Supabase SQL Editor


-- 1. TABLA PRINCIPAL: CABECERA DE CONTEOS
CREATE TABLE IF NOT EXISTS conteos_inventario (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal            TEXT        NOT NULL CHECK (sucursal IN ('Norte', 'Sur')),
    nombre_responsable  TEXT        NOT NULL,
    fecha_inicio        TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_fin           TIMESTAMPTZ,
    estado              TEXT        NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
    nombre_cierre       TEXT,
    comentarios_cierre  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteos_sucursal ON conteos_inventario (sucursal);
CREATE INDEX IF NOT EXISTS idx_conteos_estado   ON conteos_inventario (estado);
CREATE INDEX IF NOT EXISTS idx_conteos_fecha    ON conteos_inventario (fecha_inicio DESC);


-- 2. TABLA DE ITEMS: PRODUCTOS DE CADA CONTEO
CREATE TABLE IF NOT EXISTS conteo_items (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id               UUID        NOT NULL REFERENCES conteos_inventario(id) ON DELETE CASCADE,
    codigo_producto         TEXT,
    nombre_producto         TEXT        NOT NULL,
    existencias_sistema     NUMERIC     NOT NULL DEFAULT 0,
    existencias_reales      NUMERIC     NOT NULL DEFAULT 0,
    existencias_taller      NUMERIC     NOT NULL DEFAULT 0,
    diferencia              NUMERIC     GENERATED ALWAYS AS (existencias_reales - existencias_sistema) STORED,
    anotaciones             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteo_items_conteo ON conteo_items (conteo_id);
CREATE INDEX IF NOT EXISTS idx_conteo_items_codigo  ON conteo_items (codigo_producto);


-- 3. TABLA DE BITACORA: HISTORIAL DE MODIFICACIONES
CREATE TABLE IF NOT EXISTS conteo_bitacora (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conteo_id           UUID        NOT NULL REFERENCES conteos_inventario(id) ON DELETE CASCADE,
    item_id             UUID        REFERENCES conteo_items(id) ON DELETE SET NULL,
    tipo_operacion      TEXT        NOT NULL DEFAULT 'edicion_item',
    campo_modificado    TEXT,
    valor_anterior      TEXT,
    valor_nuevo         TEXT,
    modificado_por      TEXT        NOT NULL,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_conteo ON conteo_bitacora (conteo_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_item   ON conteo_bitacora (item_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha  ON conteo_bitacora (fecha DESC);


-- 4. TRIGGER: actualizar updated_at en conteo_items
CREATE OR REPLACE FUNCTION fn_update_conteo_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conteo_items_updated ON conteo_items;

CREATE TRIGGER trg_conteo_items_updated
    BEFORE UPDATE ON conteo_items
    FOR EACH ROW EXECUTE FUNCTION fn_update_conteo_items_timestamp();


-- 5. ROW LEVEL SECURITY
ALTER TABLE conteos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteo_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteo_bitacora    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_conteos"  ON conteos_inventario;
DROP POLICY IF EXISTS "anon_all_items"    ON conteo_items;
DROP POLICY IF EXISTS "anon_all_bitacora" ON conteo_bitacora;

CREATE POLICY "anon_all_conteos"
    ON conteos_inventario FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_items"
    ON conteo_items FOR ALL TO anon
    USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_bitacora"
    ON conteo_bitacora FOR ALL TO anon
    USING (true) WITH CHECK (true);


-- 6. VISTA: DIFERENCIAS POR CONTEO
CREATE OR REPLACE VIEW v_conteo_diferencias AS
SELECT
    ci.conteo_id,
    c.sucursal,
    date_trunc('month', c.fecha_inicio) AS mes,
    ci.codigo_producto,
    ci.nombre_producto,
    ci.existencias_sistema,
    ci.existencias_reales,
    ci.existencias_taller,
    ci.diferencia,
    ci.anotaciones,
    c.estado,
    c.nombre_responsable,
    c.fecha_inicio,
    c.fecha_fin
FROM conteo_items ci
JOIN conteos_inventario c ON c.id = ci.conteo_id
WHERE ci.diferencia <> 0;


-- 7. VISTA: TENDENCIAS DE FALTANTES POR PRODUCTO
CREATE OR REPLACE VIEW v_tendencias_faltantes AS
SELECT
    codigo_producto,
    nombre_producto,
    sucursal,
    COUNT(*)                                              AS veces_con_diferencia,
    SUM(ABS(diferencia))                                  AS volumen_total_diferencia,
    AVG(diferencia)                                       AS promedio_diferencia,
    MIN(diferencia)                                       AS peor_diferencia,
    COUNT(DISTINCT date_trunc('month', fecha_inicio))     AS meses_afectados
FROM v_conteo_diferencias
GROUP BY codigo_producto, nombre_producto, sucursal
ORDER BY volumen_total_diferencia DESC;
