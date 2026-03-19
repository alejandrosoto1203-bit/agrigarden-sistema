// api.js - Cliente Global de Supabase
// Prioridad: 1. Configuración Dinámica (config.js) 2. Fallback Producción
const SUPABASE_URL = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SUPABASE_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
// Exponer explícitamente en window para módulos que usan window.SUPABASE_URL
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

// --- UTILITIES ---
// Definir formatMoney inmediatamente para evitar ReferenceError
window.formatMoney = (n) => {
    if (n === undefined || n === null) return "$0.00";
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
};
console.log("✅ API Utilities: formatMoney ready");




// Inicializar cliente si la librería está cargada
let supabase;
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.sb = supabase; // Expose globally to avoid scope issues
    console.log("Supabase Global Client Initialized");
} else {
    console.error("Supabase Library not found in api.js");
}

// Default fallback configuration
const DEFAULT_CONFIG = {
    metaMensual: 300000,
    metodosPago: [],  // Array {id, nombre, tasa_base, aplica_iva, activo, orden}
    tasasComision: {} // Mapa {nombre: tasa_efectiva} — incluye IVA si aplica
};

// Global Config Object (Mutable)
window.CONFIG_NEGOCIO = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// Shared helper: fetches sys_metodos_pago and populates CONFIG_NEGOCIO
// Usa credenciales PROD hardcodeadas igual que configuracion.js para garantizar acceso
window._fetchMetodosPago = async function() {
    const _URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const _KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
    try {
        const res = await fetch(`${_URL}/rest/v1/sys_metodos_pago?select=id,nombre,tasa_base,aplica_iva,activo,orden&order=orden.asc`, {
            headers: { 'apikey': _KEY, 'Authorization': `Bearer ${_KEY}` }
        });
        if (!res.ok) {
            console.error(`❌ sys_metodos_pago HTTP ${res.status}:`, await res.text());
            return [];
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            window.CONFIG_NEGOCIO.metodosPago = data;
            const tasas = {};
            data.forEach(m => { tasas[m.nombre] = m.aplica_iva ? m.tasa_base * 1.16 : m.tasa_base; });
            window.CONFIG_NEGOCIO.tasasComision = tasas;
            console.log('✅ Métodos de pago cargados:', data.length);
        } else {
            console.warn('⚠️ sys_metodos_pago vacío:', data);
        }
        return data || [];
    } catch(e) {
        console.error('❌ Error fetching sys_metodos_pago:', e);
        return [];
    }
};

// Singleton promise — todos los callers esperan la misma petición
let _configPromise = null;
window.cargarConfiguracionSistema = function() {
    if (_configPromise) return _configPromise;
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_KEY;
    if (!url || !key) return Promise.resolve();
    _configPromise = (async () => {
        await window._fetchMetodosPago();
        // Meta mensual
        try {
            const date = new Date();
            const resMeta = await fetch(
                `${url}/rest/v1/sys_metas_ingresos?select=monto_meta&anio=eq.${date.getFullYear()}&mes=eq.${date.getMonth() + 1}&limit=1`,
                { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }
            );
            if (resMeta.ok) {
                const metaArr = await resMeta.json();
                if (metaArr && metaArr.length > 0) window.CONFIG_NEGOCIO.metaMensual = metaArr[0].monto_meta;
            }
        } catch(e) {}
    })();
    return _configPromise;
};

// Trigger load immediately
window.cargarConfiguracionSistema();

// Función utilitaria para poblar selectores <select> con métodos activos
// Uso: poblarSelectoresMetodoPago(['filtroMetodo', 'editMetodo'], { incluirTodos: true })
window.poblarSelectoresMetodoPago = function (selectorIds = [], opciones = {}) {
    const metodos = (window.CONFIG_NEGOCIO?.metodosPago || []).filter(m => m.activo);

    selectorIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Si no hay métodos activos, dejar el select sin modificar (mantiene el fallback hardcodeado)
        if (metodos.length === 0) return;

        const valorActual = el.value;
        const opcionesPrevias = opciones.incluirTodos ? '<option value="Todos">Todos</option>' : '';
        el.innerHTML = opcionesPrevias + metodos.map(m =>
            `<option value="${m.nombre}">${m.nombre}</option>`
        ).join('');

        // Restaurar valor previo si sigue existiendo
        if (valorActual && [...el.options].some(o => o.value === valorActual)) {
            el.value = valorActual;
        }
    });
}
