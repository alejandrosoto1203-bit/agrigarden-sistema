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
    const metodo = (metodoPulpos || '').toLowerCase().trim();
    const notas = (comentarios || '').toLowerCase();

    // Cheque
    if (metodo.includes('cheque')) return { metodo: 'Cheque', claro: true };

    // Efectivo
    if (metodo.includes('efectivo')) return { metodo: 'Efectivo', claro: true };

    // "A crédito" = venta a crédito (el cliente debe pagar después)
    // OJO: "tarjeta de crédito" NO es lo mismo ↓
    if (metodo === 'crédito' || metodo === 'a crédito' || metodo === 'credito' || metodo === 'a credito')
        return { metodo: 'Crédito', claro: true };

    // Transferencias — identificar banco por comentario
    if (metodo.includes('transferencia')) {
        if (notas.includes('bbva')) return { metodo: 'Transferencia BBVA', claro: true };
        if (notas.includes('hey')) return { metodo: 'Transferencia Hey Banco', claro: true };
        if (metodo.includes('bbva')) return { metodo: 'Transferencia BBVA', claro: true };
        if (metodo.includes('hey')) return { metodo: 'Transferencia Hey Banco', claro: true };
        return { metodo: 'Transferencia', claro: false }; // Requiere revisión
    }

    // Tarjetas (incluyendo "tarjeta de crédito" y "tarjeta de débito")
    if (metodo.includes('tarjeta') || metodo.includes('débito') || metodo.includes('debito')
        || (metodo.includes('crédito') && !metodo.startsWith('a ') && metodo !== 'crédito')
    ) {
        if (notas.includes('bbva') || metodo.includes('bbva')) return { metodo: 'Tarjeta BBVA', claro: true };
        if (notas.includes('hey') || metodo.includes('hey')) return { metodo: 'Tarjeta Hey Banco', claro: true };
        if (notas.includes('mp') || notas.includes('mercado pago') || notas.includes('mercadopago'))
            return { metodo: 'Tarjeta Mercado Pago', claro: true };
        return { metodo: 'Tarjeta', claro: false }; // Requiere revisión (falta banco)
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
        console.log('🔍 Extrayendo ventas del día...');

        // Obtener links de ventas - SOLO del día seleccionado
        // Pulpos muestra "Hoy" para ventas de hoy, "Ayer" para ayer
        // Determinamos qué texto buscar según la fecha seleccionada
        const hoy = new Date().toISOString().split('T')[0];
        const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let textoBuscado;
        if (FECHA_SYNC === hoy) textoBuscado = 'hoy';
        else if (FECHA_SYNC === ayer) textoBuscado = 'ayer';
        else {
            // Para fechas anteriores, convertir a formato que muestra Pulpos (ej: "24 feb 2026")
            const [anio, mes, dia] = FECHA_SYNC.split('-');
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            textoBuscado = `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`;
        }
        console.log(`   📅 Filtrando por texto de fecha: "${textoBuscado}"`);

        const linksVentas = await page.evaluate((texto) => {
            const links = Array.from(document.querySelectorAll('a[href*="/sales/detail"]'));
            return links
                .filter(a => {
                    const fila = a.closest('tr') || a.parentElement;
                    const textoFila = (fila?.innerText || a.innerText || '').toLowerCase();
                    return textoFila.includes(texto);
                })
                .map(a => ({
                    href: a.href,
                    texto: (a.closest('tr')?.innerText || a.innerText || '').substring(0, 200)
                }));
        }, textoBuscado);

        console.log(`   🔗 Ventas del día encontradas: ${linksVentas.length}`);
        if (linksVentas.length === 0) {
            console.log('   ⚠️ No se encontraron ventas para esta fecha. Verifica que Pulpos muestre ventas de este día.');
        }

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

                // Extraer todos los datos de la venta con selectores precisos
                const datosVenta = await page.evaluate(() => {
                    // Número de venta del título (ej: "Venta #9357")
                    const titulo = document.querySelector('h1, h2')?.innerText || '';
                    const matchNum = titulo.match(/#(\d+)/);
                    const numeroVenta = matchNum ? '#' + matchNum[1] : null;
                    if (!numeroVenta) return null;

                    const pageText = document.body.innerText;

                    // TOTAL: buscar la línea que dice "Total" seguida de un monto
                    // Estrategia: buscar el último "Total" en la página (es el definitivo)
                    // El patrón en Pulpos es "Total\n$X,XXX.XX" o "Total $X,XXX.XX"
                    let totalVenta = 0;
                    // Buscar elemento bold/strong con "Total" y tomar su precio adyacente
                    const allElements = Array.from(document.querySelectorAll('*'));
                    for (const el of allElements) {
                        const txt = el.innerText?.trim() || '';
                        // Buscamos el elemento que contenga SOLO "Total" o "Total $X"
                        if (/^Total\s*\$[\d,]+/.test(txt) && !txt.includes('Subtotal')) {
                            const match = txt.match(/Total\s*\$([\d,]+(?:\.\d{2})?)/);
                            if (match) {
                                const val = parseFloat(match[1].replace(/,/g, ''));
                                if (val > totalVenta) totalVenta = val;
                            }
                        }
                    }
                    // Fallback: si no encontramos con el método anterior,
                    // buscar "Total" seguido de monto en el texto plano
                    if (totalVenta === 0) {
                        const matches = [...pageText.matchAll(/^Total\s+\$([\d,]+(?:\.\d{2})?)$/gm)];
                        if (matches.length > 0) {
                            totalVenta = parseFloat(matches[matches.length - 1][1].replace(/,/g, ''));
                        }
                    }
                    // Fallback 2: buscar el monto en el sidebar derecho ("Total\n$X")
                    if (totalVenta === 0) {
                        const sidebarMatch = pageText.match(/Total\n\$([\d,]+(?:\.\d{2})?)/);
                        if (sidebarMatch) totalVenta = parseFloat(sidebarMatch[1].replace(/,/g, ''));
                    }

                    // Sucursal
                    const sucursalMatch = pageText.match(/Agrigarden\s+(Norte|Sur)/i);
                    const sucursal = sucursalMatch ? 'Agrigarden ' + sucursalMatch[1] : '';

                    // Estado
                    const pagada = pageText.toLowerCase().includes('pagada');

                    // Cliente - buscar link de cliente
                    const clienteLinks = document.querySelectorAll('a[href*="/client"], a[href*="/customer"]');
                    const cliente = clienteLinks.length > 0 ? clienteLinks[0].innerText.trim() : '';

                    // Método de pago - buscar en historial
                    const historial = pageText.match(/Cobro de \$[\d,.]+ en (.+?)(?:\n|$)/i);
                    const metodoPago = historial ? historial[1].trim() : '';

                    // Comentarios para identificar banco en transferencias/tarjetas
                    const comentariosNodes = document.querySelectorAll('[class*="comment"], [class*="histor"] p, [class*="note"]');
                    const comentarios = Array.from(comentariosNodes).map(n => n.innerText).join(' ');

                    // Vendedor
                    const vendedorMatch = pageText.match(/Vendedor[:\s]+([^\n]+)/i);
                    const vendedor = vendedorMatch ? vendedorMatch[1].trim() : '';

                    return { numeroVenta, sucursal, pagada, totalVenta, cliente, metodoPago, comentarios, vendedor };
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
        // FASE 5: Guardar en pulpos_sync_staging (para revisión antes de confirmar)
        // ------------------------------------------------------------------
        console.log(`\n💾 Guardando en staging para revisión...`);
        console.log(`   ✅ Clasificadas: ${ventasProcesadas.length}`);
        console.log(`   ⚠️  Revisión pendiente: ${ventasPendientes.length}`);

        // Guardar TODAS (clasificadas + pendientes) en staging
        const todasLasVentas = [
            ...ventasProcesadas.map(v => ({ ...v, requiere_revision: false })),
            ...ventasPendientes.map(v => ({ ...v, requiere_revision: true }))
        ];

        let stagingInsertadas = 0;
        for (const venta of todasLasVentas) {
            const stagingRecord = {
                sync_log_id: logId,
                fecha_sync: FECHA_SYNC,
                numero_venta: venta.categoria,
                sucursal: venta.sucursal,
                monto: venta.monto,
                metodo_pago: venta.metodo_pago,
                metodo_pulpos: venta._metodoPulpos || venta.metodo_pago,
                nombre_cliente: venta.nombre_cliente,
                estado_cobro: venta.estado_cobro,
                vendedor: (venta.notas || '').match(/Vendedor: ([^|]+)/)?.[1]?.trim() || '',
                notas: venta.notas,
                requiere_revision: venta.requiere_revision,
                confirmado: false
            };
            const { error } = await supabase.from('pulpos_sync_staging').insert(stagingRecord);
            if (error) {
                console.error(`   ❌ Error en staging ${venta.categoria}: ${error.message}`);
            } else {
                stagingInsertadas++;
            }
        }

        console.log(`   📴 Total en staging: ${stagingInsertadas}`);

        // ------------------------------------------------------------------
        // FASE 6: Actualizar log en Supabase
        // ------------------------------------------------------------------
        await supabase.from('pulpos_sync_log').update({
            estado: 'listo_para_revision',
            ventas_importadas: stagingInsertadas,
            ventas_pendientes: ventasPendientes.length,
            mensaje: `Extracción completa: ${stagingInsertadas} ventas listas para revisión (${ventasPendientes.length} requieren ajuste de banco)`,
            detalles: {
                ventas_clasificadas: ventasProcesadas.length,
                ventas_revision: ventasPendientes.length,
                staging_ids: []
            }
        }).eq('id', logId);

        console.log(`\n🎉 Extracción completada:`);
        console.log(`   📵 En staging para revisión: ${stagingInsertadas}`);
        console.log(`   ⚠️  Requieren ajuste de banco: ${ventasPendientes.length}`);
        console.log(`\n→ Abre el CRM y confirma las ventas para guardarlas en Ingresos.`);

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
