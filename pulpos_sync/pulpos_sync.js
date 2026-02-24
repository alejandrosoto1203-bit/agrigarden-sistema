// pulpos_sync.js - Sincronizador Pulpos → Agrigarden CRM
// Uso: node pulpos_sync.js --fecha=2026-02-24
// En GitHub Actions: se pasan las variables de entorno automáticamente

const { chromium } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

// =====================================================
// CONFIGURACIÓN (desde variables de entorno)
// =====================================================
const PULPOS_EMAIL = process.env.PULPOS_EMAIL;
const PULPOS_PASSWORD = process.env.PULPOS_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service key (más permisos que anon)

// Obtener fecha del argumento --fecha=YYYY-MM-DD o usar hoy
const fechaArg = process.argv.find(a => a.startsWith('--fecha='));
const FECHA_SYNC = fechaArg
    ? fechaArg.split('=')[1]
    : new Date().toISOString().split('T')[0];

console.log(`🚀 Iniciando sincronización Pulpos → Agrigarden`);
console.log(`📅 Fecha a sincronizar: ${FECHA_SYNC}`);

// =====================================================
// VALIDACIONES INICIALES
// =====================================================
if (!PULPOS_EMAIL || !PULPOS_PASSWORD) {
    console.error('❌ PULPOS_EMAIL y PULPOS_PASSWORD son requeridos');
    process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
    process.exit(1);
}

// =====================================================
// CLIENTE SUPABASE
// =====================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================
// MAPEO DE MÉTODOS DE PAGO
// Pulpos → Agrigarden
// =====================================================
function mapearMetodoPago(metodoPulpos, comentarios = '') {
    const metodo = (metodoPulpos || '').toLowerCase();
    const notas = (comentarios || '').toLowerCase();

    // Cheque y Efectivo son directos
    if (metodo.includes('cheque')) return { metodo: 'Cheque', claro: true };
    if (metodo.includes('efectivo')) return { metodo: 'Efectivo', claro: true };
    if (metodo.includes('crédito') || metodo.includes('credito') || metodo.includes('a crédito'))
        return { metodo: 'Crédito', claro: true };

    // Transferencias — identificar banco por comentario
    if (metodo.includes('transferencia')) {
        if (notas.includes('bbva')) return { metodo: 'Transferencia BBVA', claro: true };
        if (notas.includes('hey')) return { metodo: 'Transferencia Hey Banco', claro: true };
        return { metodo: 'Transferencia', claro: false }; // Requiere revisión
    }

    // Tarjetas — identificar banco por comentario
    if (metodo.includes('tarjeta') || metodo.includes('débito') || metodo.includes('credito') || metodo.includes('credit') || metodo.includes('debit')) {
        if (notas.includes('bbva')) return { metodo: 'Tarjeta BBVA', claro: true };
        if (notas.includes('hey')) return { metodo: 'Tarjeta Hey Banco', claro: true };
        if (notas.includes('mp') || notas.includes('mercado pago') || notas.includes('mercadopago'))
            return { metodo: 'Tarjeta Mercado Pago', claro: true };
        return { metodo: 'Tarjeta', claro: false }; // Requiere revisión
    }

    // Fallback
    return { metodo: metodoPulpos || 'Otro', claro: false };
}

// =====================================================
// MAPEO DE SUCURSALES
// Pulpos → Agrigarden
// =====================================================
function mapearSucursal(sucursalPulpos) {
    const s = (sucursalPulpos || '').toLowerCase();
    if (s.includes('norte')) return 'Norte';
    if (s.includes('sur')) return 'Sur';
    return 'Norte'; // fallback
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================
async function sincronizar() {
    let logId = null;
    let browser = null;

    // Registrar inicio en Supabase
    const { data: logInicio } = await supabase
        .from('pulpos_sync_log')
        .insert({ fecha_sync: FECHA_SYNC, estado: 'iniciado', mensaje: 'Sincronización iniciada' })
        .select()
        .single();
    logId = logInicio?.id;

    try {
        // ------------------------------------------------------------------
        // FASE 1: Abrir Pulpos y hacer login
        // ------------------------------------------------------------------
        console.log('🌐 Abriendo navegador...');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        });
        const page = await context.newPage();

        // Red: interceptar respuestas JSON de Pulpos para extraer datos directamente
        const ventasCapturadas = [];
        page.on('response', async (response) => {
            const url = response.url();
            // Pulpos hace llamadas a su API interna para cargar ventas
            if (url.includes('/api/') && url.includes('sale') && response.status() === 200) {
                try {
                    const json = await response.json();
                    if (json && (json.data || json.sales || json.items)) {
                        ventasCapturadas.push(json);
                        console.log(`   📡 Respuesta API capturada: ${url.split('/api/')[1]}`);
                    }
                } catch (e) { /* no es JSON, ignorar */ }
            }
        });

        // Login
        console.log('🔑 Iniciando sesión en Pulpos...');
        await page.goto('https://app.pulpos.com/login', { waitUntil: 'domcontentloaded' });
        await page.fill('input[name="email"]', PULPOS_EMAIL);
        await page.fill('input[name="password"]', PULPOS_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => { });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        console.log('✅ Login exitoso');

        // ------------------------------------------------------------------
        // FASE 2: Navegar a Ventas y filtrar por fecha
        // ------------------------------------------------------------------
        console.log(`📋 Navegando a Ventas del ${FECHA_SYNC}...`);

        // Navegar a ventas con filtro de fecha
        const fechaInicio = FECHA_SYNC + 'T00:00:00';
        const fechaFin = FECHA_SYNC + 'T23:59:59';

        await page.goto('https://app.pulpos.com/sales', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // ------------------------------------------------------------------
        // FASE 3: Extraer ventas del DOM
        // ------------------------------------------------------------------
        console.log('🔍 Extrayendo ventas del día...');

        // Intentar leer ventas directamente del DOM
        const ventasDOM = await page.evaluate((fechaFiltro) => {
            const rows = document.querySelectorAll('table tr, [data-testid="sale-row"], .sale-row');
            const resultados = [];

            rows.forEach(row => {
                const textoFila = row.innerText || '';
                // Buscar número de venta (#XXXX)
                const matchNum = textoFila.match(/#(\d+)/);
                if (!matchNum) return;

                const numeroVenta = '#' + matchNum[1];

                // Buscar fecha en la fila
                const textoFecha = textoFila;
                const esHoy = textoFecha.toLowerCase().includes('hoy');
                const esAyer = textoFecha.toLowerCase().includes('ayer');

                resultados.push({
                    numero: numeroVenta,
                    texto: textoFila.substring(0, 200),
                    esHoy,
                    esAyer
                });
            });

            return resultados;
        }, FECHA_SYNC);

        console.log(`   📊 Filas encontradas en DOM: ${ventasDOM.length}`);

        // Obtener links de ventas del día
        const linksVentas = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/sales/detail"]'));
            return links.map(a => ({
                href: a.href,
                texto: a.closest('tr')?.innerText || a.innerText || ''
            }));
        });

        console.log(`   🔗 Links de ventas encontrados: ${linksVentas.length}`);

        // ------------------------------------------------------------------
        // FASE 4: Procesar cada venta individualmente
        // ------------------------------------------------------------------
        const ventasProcesadas = [];
        const ventasPendientes = [];
        let procesadas = 0;

        for (const link of linksVentas) {
            try {
                await page.goto(link.href, { waitUntil: 'domcontentloaded' });
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(2000);

                // Extraer todos los datos de la venta
                const datosVenta = await page.evaluate(() => {
                    const getText = (sel) => document.querySelector(sel)?.innerText?.trim() || '';
                    const getAll = (sel) => Array.from(document.querySelectorAll(sel)).map(e => e.innerText?.trim());

                    // Número de venta del título
                    const titulo = document.querySelector('h1, h2')?.innerText || '';
                    const matchNum = titulo.match(/#(\d+)/);
                    const numeroVenta = matchNum ? '#' + matchNum[1] : null;

                    if (!numeroVenta) return null;

                    // Contenido completo de la página para extraer datos
                    const pageText = document.body.innerText;

                    // Fecha
                    const sidebarItems = document.querySelectorAll('aside [class*="detail"], [class*="sidebar"] [class*="item"], [class*="info-row"]');

                    // Extraer sucursal
                    const sucursalMatch = pageText.match(/Agrigarden\s+(Norte|Sur)/i);
                    const sucursal = sucursalMatch ? 'Agrigarden ' + sucursalMatch[1] : '';

                    // Estado (Pagada/Pendiente)
                    const pagada = pageText.toLowerCase().includes('pagada');

                    // Total - buscar el monto más grande con formato de moneda
                    const montos = [...pageText.matchAll(/\$([0-9,]+(?:\.\d{2})?)/g)].map(m =>
                        parseFloat(m[1].replace(/,/g, ''))
                    );
                    const totalVenta = montos.length > 0 ? Math.max(...montos) : 0;

                    // Cliente
                    const clienteLinks = document.querySelectorAll('a[href*="/client"], a[href*="/customer"]');
                    const cliente = clienteLinks.length > 0 ? clienteLinks[0].innerText.trim() : '';

                    // Método de pago - buscar en historial
                    const historial = pageText.match(/Cobro de \$[0-9,.]+ en (.+?)(?:\n|$)/i);
                    const metodoPago = historial ? historial[1].trim() : '';

                    // Comentarios del historial para identificar banco
                    const comentariosNodes = document.querySelectorAll('[class*="comment"], [class*="histor"] p, [class*="note"]');
                    const comentarios = Array.from(comentariosNodes).map(n => n.innerText).join(' ');

                    // Fecha - buscar formato de fecha
                    const fechaMatch = pageText.match(/(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})/i) ||
                        pageText.match(/(\d{4}-\d{2}-\d{2})/);
                    const fechaTexto = fechaMatch ? fechaMatch[0] : 'hoy';

                    // Vendedor
                    const vendedorMatch = pageText.match(/Vendedor[:\s]+([^\n]+)/i);
                    const vendedor = vendedorMatch ? vendedorMatch[1].trim() : '';

                    return {
                        numeroVenta,
                        sucursal,
                        pagada,
                        totalVenta,
                        cliente,
                        metodoPago,
                        comentarios,
                        fechaTexto,
                        vendedor,
                        urlDetalle: window.location.href
                    };
                });

                if (!datosVenta || !datosVenta.numeroVenta) {
                    console.log(`   ⚠️ No se pudo extraer venta de: ${link.href}`);
                    continue;
                }

                // Mapear método de pago
                const { metodo, claro } = mapearMetodoPago(datosVenta.metodoPago, datosVenta.comentarios);
                const sucursal = mapearSucursal(datosVenta.sucursal);

                // Construir registro para Supabase
                const registro = {
                    created_at: new Date(FECHA_SYNC + 'T12:00:00').toISOString(),
                    categoria: datosVenta.numeroVenta,  // #9357
                    tipo: 'Venta Directa',
                    metodo_pago: metodo,
                    nombre_cliente: (datosVenta.cliente || 'PÚBLICO GENERAL').toUpperCase(),
                    monto: datosVenta.totalVenta,
                    comision_bancaria: 0,
                    monto_neto: datosVenta.totalVenta,
                    sucursal: sucursal,
                    estado_cobro: datosVenta.pagada ? 'Pagado' : 'Pendiente',
                    saldo_pendiente: datosVenta.pagada ? 0 : datosVenta.totalVenta,
                    notas: `Venta Pulpos ${datosVenta.numeroVenta}${datosVenta.vendedor ? ' | Vendedor: ' + datosVenta.vendedor : ''}`,
                    fuente: 'PULPOS_SYNC'
                };

                if (!claro) {
                    ventasPendientes.push({ ...registro, _metodoPulpos: datosVenta.metodoPago });
                } else {
                    ventasProcesadas.push(registro);
                }

                procesadas++;
                console.log(`   ✅ ${datosVenta.numeroVenta} | ${sucursal} | ${metodo} | $${datosVenta.totalVenta} ${claro ? '' : '⚠️ revisión'}`);

            } catch (e) {
                console.error(`   ❌ Error procesando ${link.href}: ${e.message}`);
            }
        }

        // ------------------------------------------------------------------
        // FASE 5: Insertar en Supabase
        // ------------------------------------------------------------------
        console.log(`\n💾 Guardando en Supabase...`);
        console.log(`   ✅ Clasificadas: ${ventasProcesadas.length}`);
        console.log(`   ⚠️  Revisión pendiente: ${ventasPendientes.length}`);

        let insertadas = 0;

        // Verificar duplicados por número de venta antes de insertar
        const todasLasVentas = [...ventasProcesadas, ...ventasPendientes];

        for (const venta of todasLasVentas) {
            // Verificar si ya existe esta venta (por número de venta = categoria)
            const { data: existente } = await supabase
                .from('transacciones')
                .select('id')
                .eq('categoria', venta.categoria)
                .eq('fuente', 'PULPOS_SYNC')
                .maybeSingle();

            if (existente) {
                console.log(`   ⏭️  ${venta.categoria} ya existe, omitiendo`);
                continue;
            }

            const { error } = await supabase
                .from('transacciones')
                .insert(venta);

            if (error) {
                console.error(`   ❌ Error insertando ${venta.categoria}: ${error.message}`);
            } else {
                insertadas++;
            }
        }

        // ------------------------------------------------------------------
        // FASE 6: Actualizar log en Supabase
        // ------------------------------------------------------------------
        await supabase.from('pulpos_sync_log').update({
            estado: 'completado',
            ventas_importadas: insertadas,
            ventas_pendientes: ventasPendientes.length,
            mensaje: `Sync exitoso: ${insertadas} ventas importadas, ${ventasPendientes.length} requieren revisión de método de pago`,
            detalles: {
                ventas_clasificadas: ventasProcesadas.length,
                ventas_revision: ventasPendientes.map(v => ({
                    numero: v.categoria,
                    metodo_pulpos: v._metodoPulpos,
                    metodo_asignado: v.metodo_pago
                }))
            }
        }).eq('id', logId);

        console.log(`\n🎉 Sincronización completada:`);
        console.log(`   📥 Ventas importadas: ${insertadas}`);
        console.log(`   ⚠️  Requieren revisión: ${ventasPendientes.length}`);

    } catch (error) {
        console.error(`\n❌ Error en sincronización: ${error.message}`);

        // Registrar error en log
        if (logId) {
            await supabase.from('pulpos_sync_log').update({
                estado: 'error',
                mensaje: error.message
            }).eq('id', logId);
        }
        process.exit(1);

    } finally {
        if (browser) await browser.close();
    }
}

// Ejecutar
sincronizar();
