// config.js - Configuración de Ambientes Agrigarden
// =====================================================
// Este archivo detecta automáticamente si estás en PRODUCCIÓN o PRUEBAS
// basándose en la URL del navegador.
// =====================================================

const ENV_CONFIG = {
    // PRODUCCIÓN - Datos reales (Tema Verde)
    PROD: {
        SUPABASE_URL: 'https://gajhfqfuvzotppnmzbuc.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ',
        THEME_COLOR: '#19e66b',
        THEME_NAME: 'PRODUCCIÓN',
        IS_TEST: false
    },
    // PRUEBAS - Sandbox seguro (Tema Rojo)
    TEST: {
        SUPABASE_URL: 'https://hvokszbagamuvkqypq1q.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2b2tzemJhZ2FudXZrcXlwZ2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MzMxNTAsImV4cCI6MjA4NTIwOTE1MH0.8NN5_rgDqn701aa-pCFY1sFar9RPWLqSTfumm5oJHkQ',
        THEME_COLOR: '#e63946',
        THEME_NAME: 'PRUEBAS',
        IS_TEST: true
    }
};

// =====================================================
// DETECCIÓN AUTOMÁTICA DE AMBIENTE
// =====================================================
// Cambia a TEST si la URL contiene estas palabras clave:
// - "test", "staging", "pruebas", "localhost", "127.0.0.1"
// =====================================================

function detectarAmbiente() {
    const host = window.location.hostname.toLowerCase();
    // Detectar si es ambiente de pruebas (incluye archivos locales)
    const isTest = host.includes('test') ||
        host.includes('staging') ||
        host.includes('pruebas') ||
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        host === ''; // Para pruebas locales (file://)

    return isTest ? ENV_CONFIG.TEST : ENV_CONFIG.PROD;
}

// Cargar configuración del ambiente detectado
const CURRENT_ENV = detectarAmbiente();

// Exponer globalmente
window.SUPABASE_URL = CURRENT_ENV.SUPABASE_URL;
window.SUPABASE_KEY = CURRENT_ENV.SUPABASE_KEY;
window.THEME_COLOR = CURRENT_ENV.THEME_COLOR;
window.IS_TEST_ENV = CURRENT_ENV.IS_TEST;
window.ENV_NAME = CURRENT_ENV.THEME_NAME;

// Aplicar color de tema dinámicamente
document.documentElement.style.setProperty('--theme-color', CURRENT_ENV.THEME_COLOR);

// Log para debug
// Log para debug
console.log(`🌐 Ambiente: ${CURRENT_ENV.THEME_NAME}`);
console.log(`🏠 Hostname detectado: ${window.location.hostname}`);
console.log(`🔗 Supabase: ${CURRENT_ENV.SUPABASE_URL}`);

// =====================================================
// BANNER VISUAL PARA AMBIENTE DE PRUEBAS
// =====================================================
// =====================================================
// BANNER VISUAL Y ESTILOS PARA AMBIENTE DE PRUEBAS
// =====================================================
if (CURRENT_ENV.IS_TEST) {
    const applyTestVisuals = () => {
        if (document.getElementById('test-banner')) return;

        // 1. Crear Banner
        const banner = document.createElement('div');
        banner.id = 'test-banner';
        banner.innerHTML = `
            <span style="margin-right: 8px;">⚠️</span>
            AMBIENTE DE PRUEBAS - LOS CAMBIOS NO AFECTAN PRODUCCIÓN
        `;
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(90deg, #e63946, #c1121f);
            color: white;
            text-align: center;
            padding: 8px 16px;
            font-weight: 800;
            font-size: 13px;
            z-index: 999999;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.prepend(banner);
        document.body.style.paddingTop = '36px';

        // 2. Forzar el color rojo en el tema (Override CSS)
        const style = document.createElement('style');
        style.innerHTML = `
            :root { --theme-color: #e63946 !important; }
            .bg-primary { background-color: #e63946 !important; }
            .text-primary { color: #e63946 !important; }
            .border-primary { border-color: #e63946 !important; }
            .bg-primary\\/20 { background-color: rgba(230, 57, 70, 0.2) !important; }
            .border-primary\\/30 { border-color: rgba(230, 57, 70, 0.3) !important; }
            #test-banner { animation: slideDown 0.5s ease-out; }
            @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        `;
        document.head.appendChild(style);
        console.log("🎨 Visuales de PRUEBAS aplicados.");
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        applyTestVisuals();
    } else {
        document.addEventListener('DOMContentLoaded', applyTestVisuals);
    }
}
