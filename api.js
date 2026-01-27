const SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

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
// NOTE: These are fallback values. The actual rates are loaded from sys_config table.
// Setting to 0 ensures database values take priority.
const DEFAULT_CONFIG = {
    metaMensual: 300000,
    tasasComision: {
        "Efectivo": 0,
        "Transferencia": 0,
        "Transferencia Hey Banco": 0,
        "Transferencia BBVA": 0,
        "Tarjeta Mercado Pago": 0,
        "Tarjeta Hey Banco": 0,
        "Tarjeta BBVA": 0,
        "Cheque": 0,
        "Otro": 0,
        "Crédito": 0
    }
};

// Global Config Object (Mutable)
window.CONFIG_NEGOCIO = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// Function to load dynamic config from Supabase
window.cargarConfiguracionSistema = async function () {
    if (!supabase) return;

    try {
        // 1. Load Commissions
        const { data: configData } = await supabase
            .from('sys_config')
            .select('value')
            .eq('key', 'tasas_comision')
            .maybeSingle();

        if (configData && configData.value) {
            window.CONFIG_NEGOCIO.tasasComision = { ...DEFAULT_CONFIG.tasasComision, ...configData.value };
            console.log("Sistema: Comisiones actualizadas desde BD (Merged)");
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

// Función para formatear dinero en todo el sistema
const formatMoney = (n) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;