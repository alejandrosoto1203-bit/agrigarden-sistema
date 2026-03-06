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

// Function to load dynamic config from Supabase
window.cargarConfiguracionSistema = async function () {
    if (!supabase) return;

    try {
        // 1. Cargar métodos de pago desde sys_metodos_pago
        const { data: metodosData } = await supabase
            .from('sys_metodos_pago')
            .select('id, nombre, tasa_base, aplica_iva, activo, orden')
            .order('orden');

        if (metodosData && metodosData.length > 0) {
            window.CONFIG_NEGOCIO.metodosPago = metodosData;
            // Construir mapa con tasa efectiva (base + IVA si aplica)
            const tasas = {};
            metodosData.forEach(m => {
                tasas[m.nombre] = m.aplica_iva ? m.tasa_base * 1.16 : m.tasa_base;
            });
            window.CONFIG_NEGOCIO.tasasComision = tasas;
            console.log("Sistema: Métodos de pago cargados:", metodosData.length);
        }

        // 2. Load Monthly Goal
        const date = new Date();
        const { data: metaData } = await supabase
            .from('sys_metas_ingresos')
            .select('monto_meta')
            .eq('anio', date.getFullYear())
            .eq('mes', date.getMonth() + 1)
            .maybeSingle();

        if (metaData) {
            window.CONFIG_NEGOCIO.metaMensual = metaData.monto_meta;
            console.log("Sistema: Meta mensual actualizada:", metaData.monto_meta);
        }

    } catch (e) {
        console.warn("Error cargando configuración:", e);
    }
}

// Trigger load immediately
cargarConfiguracionSistema();

// Función utilitaria para poblar selectores <select> con métodos activos
// Uso: poblarSelectoresMetodoPago(['filtroMetodo', 'editMetodo'], { incluirTodos: true })
window.poblarSelectoresMetodoPago = function (selectorIds = [], opciones = {}) {
    const metodos = (window.CONFIG_NEGOCIO?.metodosPago || []).filter(m => m.activo);
    if (metodos.length === 0) return;

    selectorIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

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
