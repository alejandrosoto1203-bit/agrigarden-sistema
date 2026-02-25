// pulpos_sync.js - Sincronizador Pulpos → Agrigarden CRM
// Uso: node pulpos_sync.js --fecha=2026-02-24
//       node pulpos_sync.js --modo=inventario
//       node pulpos_sync.js --modo=movimientos
//       node pulpos_sync.js --modo=clientes
//       node pulpos_sync.js --modo=ventas --fecha=2026-02-24
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

// Obtener argumentos de línea de comandos
const fechaArg = process.argv.find(a => a.startsWith('--fecha='));
const modoArg = process.argv.find(a => a.startsWith('--modo='));
const FECHA_SYNC = fechaArg ? fechaArg.split('=')[1] : new Date().toISOString().split('T')[0];
const MODO = modoArg ? modoArg.split('=')[1] : 'ventas'; // ventas | inventario | movimientos | clientes | all

console.log(`🚀 Iniciando sincronización Pulpos → Agrigarden`);
console.log(`📅 Fecha: ${FECHA_SYNC}  |  Modo: ${MODO}`);

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

    if (metodo.includes('cheque')) return { metodo: 'Cheque', claro: true };
    if (metodo.includes('efectivo')) return { metodo: 'Efectivo', claro: true };
    if ((metodo.includes('crédito') || metodo.includes('credito')) && !metodo.includes('tarjeta'))
        return { metodo: 'Crédito', claro: true };

    if (metodo.includes('transferencia')) {
        if (notas.includes('bbva')) return { metodo: 'Transferencia BBVA', claro: true };
        if (notas.includes('hey')) return { metodo: 'Transferencia Hey Banco', claro: true };
        if (metodo.includes('bbva')) return { metodo: 'Transferencia BBVA', claro: true };
        if (metodo.includes('hey')) return { metodo: 'Transferencia Hey Banco', claro: true };
        return { metodo: 'Transferencia', claro: false };
    }

    if (metodo.includes('tarjeta') || metodo.includes('débito') || metodo.includes('debito')
        || (metodo.includes('crédito') && !metodo.startsWith('a ') && metodo !== 'crédito')) {
        if (notas.includes('bbva') || metodo.includes('bbva')) return { metodo: 'Tarjeta BBVA', claro: true };
        if (notas.includes('hey') || metodo.includes('hey')) return { metodo: 'Tarjeta Hey Banco', claro: true };
        if (notas.includes('mp') || notas.includes('mercado pago') || notas.includes('mercadopago'))
            return { metodo: 'Tarjeta Mercado Pago Fiscal Norte', claro: false };
        return { metodo: 'Tarjeta', claro: false };
    }

    return { metodo: metodoPulpos || 'Otro', claro: false };
}

// =====================================================
// MAPEO DE SUCURSALES
// =====================================================
function mapearSucursal(sucursalPulpos) {
    const s = (sucursalPulpos || '').toLowerCase();
    if (s.includes('norte')) return 'Norte';
    if (s.includes('sur')) return 'Sur';
    return 'Norte';
}

// =====================================================
// UTILS
// =====================================================
function parseMoney(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(/[$,\s]/g, '')) || 0;
}

async function loginPulpos(page) {
    console.log('🔑 Iniciando sesión en Pulpos...');
    await page.goto('https://app.pulpos.com/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="email"]', PULPOS_EMAIL);
    await page.fill('input[name="password"]', PULPOS_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 25000 }).catch(() => { });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    console.log('✅ Login exitoso');
}

// =====================================================
// MODO: INVENTARIO — Sync stock de todos los productos
// Usa SKU como clave de deduplicación
// =====================================================
async function sincronizarInventario(page) {
    console.log('\n📦 Iniciando sync de INVENTARIO (stock por sucursal)...');
    await page.goto('https://app.pulpos.com/products', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Recopilar todos los IDs de productos haciendo scroll
    const productIds = new Set();
    let prevCount = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < 50) {
        const links = await page.$$eval('a[href*="/products/detail"]', els =>
            els.map(a => {
                const url = new URL(a.href);
                return url.searchParams.get('id');
            }).filter(Boolean)
        );
        links.forEach(id => productIds.add(id));

        if (productIds.size === prevCount && scrollAttempts > 5) break;
        prevCount = productIds.size;

        // Scroll hacia abajo para cargar más
        await page.keyboard.press('End');
        await page.waitForTimeout(1500);
        scrollAttempts++;
    }

    console.log(`   📋 Total productos encontrados: ${productIds.size}`);

    let actualizados = 0;
    let insertados = 0;
    let errores = 0;

    for (const pulposId of productIds) {
        try {
            await page.goto(`https://app.pulpos.com/products/detail?id=${pulposId}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const datos = await page.evaluate(() => {
                const txt = document.body.innerText;

                // SKU — buscar en el texto de la página
                const skuMatch = txt.match(/SKU[:\s]+([A-Z0-9\-]+)/i);
                const sku = skuMatch ? skuMatch[1].trim() : null;

                // Nombre — h1 o h2
                const nombre = (document.querySelector('h1, h2')?.innerText || '').trim();

                // Categoría y Marca — buscar etiquetas en el DOM (Pulpos las muestra como spans/labels)
                const allText = txt;
                const catMatch = allText.match(/Categoría[:\s]+([^\n]+)/i);
                const marcaMatch = allText.match(/Marca[:\s]+([^\n]+)/i);
                const categoria = catMatch ? catMatch[1].trim() : null;
                const marca = marcaMatch ? marcaMatch[1].trim() : null;

                // Precio de venta
                const precioMatch = allText.match(/Precio de Venta[:\s]+\$([0-9,]+\.?\d*)/i);
                const precio = precioMatch ? parseFloat(precioMatch[1].replace(/,/g, '')) : 0;

                // Costo
                const costoMatch = allText.match(/Costo[:\s]+\$([0-9,]+\.?\d*)/i);
                const costo = costoMatch ? parseFloat(costoMatch[1].replace(/,/g, '')) : 0;

                // Stock por sucursal — Pulpos muestra "Agrigarden Norte" y "Agrigarden Sur"
                // con el valor de existencias cerca
                const stockNorteMatch = allText.match(/Agrigarden\s+Norte[\s\S]{0,100}?(\d+(?:\.\d+)?)\s*(?:pzas?|piezas?|unidades?)/i);
                const stockSurMatch = allText.match(/Agrigarden\s+Sur[\s\S]{0,100}?(\d+(?:\.\d+)?)\s*(?:pzas?|piezas?|unidades?)/i);

                // Backup: buscar tabla de ubicaciones con números
                const allNums = [...allText.matchAll(/(\d+(?:\.\d+)?)\s*(?:pzas?|piezas?)/gi)];

                const stockNorte = stockNorteMatch ? parseFloat(stockNorteMatch[1]) : (allNums[0] ? parseFloat(allNums[0][1]) : 0);
                const stockSur = stockSurMatch ? parseFloat(stockSurMatch[1]) : (allNums[1] ? parseFloat(allNums[1][1]) : 0);

                return { sku, nombre, categoria, marca, precio, costo, stockNorte, stockSur };
            });

            if (!datos.sku && !datos.nombre) {
                console.log(`   ⚠️ Sin datos para pulpos_id=${pulposId}, saltando`);
                errores++;
                continue;
            }

            // Construir payload — campos a sincronizar
            const payload = {
                pulpos_id: pulposId,
                stock_norte: datos.stockNorte,
                stock_sur: datos.stockSur,
                ultima_sync: new Date().toISOString(),
                ...(datos.nombre && { nombre: datos.nombre.toUpperCase() }),
                ...(datos.categoria && { categoria: datos.categoria.toUpperCase() }),
                ...(datos.marca && { marca: datos.marca.toUpperCase() }),
                ...(datos.precio && { precio_publico: datos.precio }),
                ...(datos.costo && { costo: datos.costo })
            };

            // Intentar update por SKU primero (evita duplicados con productos existentes)
            if (datos.sku) {
                const { data: existing } = await supabase
                    .from('productos')
                    .select('id')
                    .eq('sku', datos.sku.toUpperCase())
                    .maybeSingle();

                if (existing) {
                    // Actualizar producto existente por SKU
                    const { error } = await supabase
                        .from('productos')
                        .update(payload)
                        .eq('sku', datos.sku.toUpperCase());
                    if (error) { console.error(`   ❌ Error actualizando ${datos.sku}: ${error.message}`); errores++; }
                    else { actualizados++; }
                } else {
                    // Insertar nuevo producto
                    const { error } = await supabase
                        .from('productos')
                        .insert({ ...payload, sku: datos.sku.toUpperCase(), activo: true });
                    if (error) { console.error(`   ❌ Error insertando ${datos.sku}: ${error.message}`); errores++; }
                    else { insertados++; }
                }
            } else {
                // Sin SKU — upsert por pulpos_id
                const { error } = await supabase
                    .from('productos')
                    .upsert(payload, { onConflict: 'pulpos_id' });
                if (error) { console.error(`   ❌ Error upsert ${pulposId}: ${error.message}`); errores++; }
                else { actualizados++; }
            }

            console.log(`   ✅ ${datos.sku || pulposId} | N:${datos.stockNorte} S:${datos.stockSur} | ${datos.nombre?.substring(0, 30)}`);

        } catch (e) {
            console.error(`   ❌ Error en ${pulposId}: ${e.message}`);
            errores++;
        }
    }

    console.log(`\n📦 Inventario completado: ${actualizados} actualizados | ${insertados} insertados | ${errores} errores`);
    return { actualizados, insertados, errores };
}

// =====================================================
// MODO: MOVIMIENTOS — Sync historial completo de movimientos
// Itera por cada producto y usa /reports/stock-movements
// =====================================================
async function sincronizarMovimientos(page) {
    console.log('\n📊 Iniciando sync de MOVIMIENTOS DE STOCK (últimos 90 días)...');

    // Obtener lista de productos con pulpos_id desde Supabase
    const { data: productos, error } = await supabase
        .from('productos')
        .select('id, sku, nombre, pulpos_id')
        .not('pulpos_id', 'is', null);

    if (error || !productos?.length) {
        console.log('⚠️ Sin productos con pulpos_id. Ejecuta --modo=inventario primero.');
        return;
    }

    console.log(`   📋 Productos con pulpos_id: ${productos.length}`);

    let totalMovimientos = 0;
    let errores = 0;

    for (const prod of productos) {
        try {
            const encodedName = encodeURIComponent(prod.nombre || prod.sku || '');
            await page.goto(
                `https://app.pulpos.com/reports/stock-movements?productName=${encodedName}&periodGrouping=byDay&period=last90Days`,
                { waitUntil: 'domcontentloaded' }
            );
            await page.waitForTimeout(2500);

            // Extraer filas de la tabla de movimientos
            const movimientos = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('tbody tr'));
                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const textos = cells.map(c => c.innerText?.trim() || '');
                    // Columnas: Fecha | Movimiento | Stock Anterior | Tipo | Cantidad | Nuevo Stock | Ubicación | Usuario
                    return {
                        fecha: textos[0] || '',
                        referencia: textos[1] || '',
                        stock_anterior: parseFloat((textos[2] || '0').replace(/[^0-9.]/g, '')) || 0,
                        tipo_raw: textos[3] || '',
                        cantidad: parseFloat((textos[4] || '0').replace(/[^0-9.]/g, '')) || 0,
                        stock_nuevo: parseFloat((textos[5] || '0').replace(/[^0-9.]/g, '')) || 0,
                        sucursal_raw: textos[6] || '',
                        usuario: textos[7] || ''
                    };
                }).filter(m => m.fecha && m.cantidad > 0);
            });

            if (!movimientos.length) {
                console.log(`   ⚪ ${prod.sku || prod.nombre}: Sin movimientos`);
                continue;
            }

            // Mapear tipo y sucursal
            const registros = movimientos.map(m => {
                let tipo = 'AJUSTE';
                const tipoLower = m.tipo_raw.toLowerCase();
                if (tipoLower.includes('entrada')) tipo = 'ENTRADA';
                else if (tipoLower.includes('salida') || tipoLower.includes('venta')) tipo = 'SALIDA';
                else if (tipoLower.includes('transferencia') && tipoLower.includes('origen')) tipo = 'TRANSFERENCIA_OUT';
                else if (tipoLower.includes('transferencia') && tipoLower.includes('destino')) tipo = 'TRANSFERENCIA_IN';

                const sucLower = m.sucursal_raw.toLowerCase();
                const sucursal = sucLower.includes('sur') ? 'Sur' : 'Norte';

                // Parsear fecha (ej: "24 feb 2026" → ISO)
                let fechaISO = new Date().toISOString();
                try {
                    const meses = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
                    const partes = m.fecha.toLowerCase().split(/\s+/);
                    if (partes.length >= 3) {
                        const d = parseInt(partes[0]);
                        const mo = meses[partes[1]] ?? 0;
                        const y = parseInt(partes[2]);
                        fechaISO = new Date(y, mo, d, 12, 0, 0).toISOString();
                    }
                } catch (_) { }

                return {
                    producto_id: prod.id,
                    sucursal: sucursal,
                    tipo: tipo,
                    cantidad: m.cantidad,
                    stock_anterior: m.stock_anterior,
                    stock_nuevo: m.stock_nuevo,
                    referencia: m.referencia,
                    notas: `${m.usuario ? 'Usuario: ' + m.usuario : ''} | Sync Pulpos`,
                    created_at: fechaISO
                };
            });

            // Upsert por producto_id + referencia + fecha (evitar duplicados en re-sync)
            for (const reg of registros) {
                const { error: mvErr } = await supabase
                    .from('movimientos_stock')
                    .upsert(reg, { onConflict: 'producto_id,referencia,created_at', ignoreDuplicates: true });
                if (!mvErr) totalMovimientos++;
            }

            console.log(`   ✅ ${prod.sku || prod.nombre}: ${registros.length} movimientos`);

        } catch (e) {
            console.error(`   ❌ Error en ${prod.sku}: ${e.message}`);
            errores++;
        }
    }

    console.log(`\n📊 Movimientos completado: ${totalMovimientos} registros | ${errores} errores`);
}

// =====================================================
// MODO: CLIENTES — Sync todos los clientes de Pulpos
// =====================================================
async function sincronizarClientes(page) {
    console.log('\n👥 Iniciando sync de CLIENTES desde Pulpos...');
    await page.goto('https://app.pulpos.com/clients', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Recopilar todos los IDs de clientes con scroll
    const clientIds = new Set();
    let prevCount = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < 100) {
        const links = await page.$$eval('a[href*="/clients/detail"]', els =>
            els.map(a => {
                const url = new URL(a.href);
                return url.searchParams.get('id');
            }).filter(Boolean)
        );
        links.forEach(id => clientIds.add(id));

        if (clientIds.size === prevCount && scrollAttempts > 5) break;
        prevCount = clientIds.size;

        await page.keyboard.press('End');
        await page.waitForTimeout(1500);
        scrollAttempts++;
    }

    console.log(`   📋 Clientes encontrados: ${clientIds.size}`);

    let actualizados = 0;
    let insertados = 0;
    let errores = 0;

    for (const pulposId of clientIds) {
        try {
            await page.goto(`https://app.pulpos.com/clients/detail?id=${pulposId}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const datos = await page.evaluate(() => {
                const txt = document.body.innerText;

                // Nombre — h1 o h2
                const nombre = (document.querySelector('h1, h2')?.innerText || '').trim();

                // Teléfono
                const telMatch = txt.match(/(?:Teléfono|Tel)[:\s]+([+\d\s\-\(\)]+)/i);
                const telefono = telMatch ? telMatch[1].trim().substring(0, 20) : null;

                // Email
                const emailMatch = txt.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
                const email = emailMatch ? emailMatch[1] : null;

                // RFC
                const rfcMatch = txt.match(/RFC[:\s]+([A-Z&]{3,4}\d{6}[A-Z0-9]{3})/i);
                const rfc = rfcMatch ? rfcMatch[1].trim() : null;

                // Razón Social
                const rsMatch = txt.match(/Razón Social[:\s]+([^\n]+)/i);
                const razon_social = rsMatch ? rsMatch[1].trim() : null;

                // Lista de Precios
                const lpMatch = txt.match(/(?:Lista de Precios|Price List)[:\s]+([^\n]+)/i);
                const lista_precios = lpMatch ? lpMatch[1].trim() : null;

                // Límite de crédito
                const lcMatch = txt.match(/Límite de Crédito[:\s]+\$([0-9,]+\.?\d*)/i);
                const limite_credito = lcMatch ? parseFloat(lcMatch[1].replace(/,/g, '')) : 0;

                // Saldo / Deuda
                const saldoMatch = txt.match(/(?:Deuda|Saldo Pendiente|Balance)[:\s]+\$([0-9,]+\.?\d*)/i);
                const saldo = saldoMatch ? parseFloat(saldoMatch[1].replace(/,/g, '')) : 0;

                // Ventas
                const ventasMatch = txt.match(/(?:Cantidad de Ventas|Ventas)[:\s]+(\d+)/i);
                const total_ventas = ventasMatch ? parseInt(ventasMatch[1]) : 0;

                const totalVendidoMatch = txt.match(/(?:Total Vendido)[:\s]+\$([0-9,]+\.?\d*)/i);
                const total_vendido = totalVendidoMatch ? parseFloat(totalVendidoMatch[1].replace(/,/g, '')) : 0;

                return { nombre, telefono, email, rfc, razon_social, lista_precios, limite_credito, saldo, total_ventas, total_vendido };
            });

            if (!datos.nombre) {
                console.log(`   ⚠️ Sin nombre para pulpos_id=${pulposId}, saltando`);
                errores++;
                continue;
            }

            const payload = {
                pulpos_id: pulposId,
                nombre: datos.nombre,
                telefono: datos.telefono,
                email: datos.email,
                rfc: datos.rfc,
                razon_social: datos.razon_social,
                lista_precios: datos.lista_precios,
                limite_credito: datos.limite_credito,
                saldo: datos.saldo,
                total_ventas: datos.total_ventas,
                total_vendido: datos.total_vendido,
                ultima_sync: new Date().toISOString()
            };

            const { error } = await supabase
                .from('clientes')
                .upsert(payload, { onConflict: 'pulpos_id' });

            if (error) {
                console.error(`   ❌ Error ${datos.nombre}: ${error.message}`);
                errores++;
            } else {
                actualizados++;
                console.log(`   ✅ ${datos.nombre} | Saldo: $${datos.saldo} | Ventas: ${datos.total_ventas}`);
            }

        } catch (e) {
            console.error(`   ❌ Error en cliente ${pulposId}: ${e.message}`);
            errores++;
        }
    }

    console.log(`\n👥 Clientes completado: ${actualizados} sincronizados | ${errores} errores`);
}

// =====================================================
// MODO: VENTAS (original) — Sync de ventas diarias
// =====================================================
async function sincronizarVentas(page) {
    let logId = null;

    const { data: logInicio } = await supabase
        .from('pulpos_sync_log')
        .insert({ fecha_sync: FECHA_SYNC, estado: 'iniciado', mensaje: 'Sincronización iniciada' })
        .select()
        .single();
    logId = logInicio?.id;

    const ventasCapturadas = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') && url.includes('sale') && response.status() === 200) {
            try {
                const json = await response.json();
                if (json && (json.data || json.sales || json.items)) {
                    ventasCapturadas.push(json);
                    console.log(`   📡 Respuesta API capturada: ${url.split('/api/')[1]}`);
                }
            } catch (e) { }
        }
    });

    console.log(`📋 Navegando a Ventas del ${FECHA_SYNC}...`);
    await page.goto('https://app.pulpos.com/sales', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    console.log('🔍 Extrayendo ventas del día...');
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let textoBuscado;
    if (FECHA_SYNC === hoy) textoBuscado = 'hoy';
    else if (FECHA_SYNC === ayer) textoBuscado = 'ayer';
    else {
        const [anio, mes, dia] = FECHA_SYNC.split('-');
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        textoBuscado = `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`;
    }
    console.log(`   📅 Filtrando por texto: "${textoBuscado}"`);

    const linksVentas = await page.evaluate((texto) => {
        const links = Array.from(document.querySelectorAll('a[href*="/sales/detail"]'));
        return links
            .filter(a => {
                const fila = a.closest('tr') || a.parentElement;
                const textoFila = (fila?.innerText || a.innerText || '').toLowerCase();
                return textoFila.includes(texto);
            })
            .map(a => ({ href: a.href, texto: (a.closest('tr')?.innerText || a.innerText || '').substring(0, 200) }));
    }, textoBuscado);

    console.log(`   🔗 Ventas encontradas: ${linksVentas.length}`);

    const ventasProcesadas = [];
    const ventasPendientes = [];

    for (const link of linksVentas) {
        try {
            await page.goto(link.href, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            const datosVenta = await page.evaluate(() => {
                const titulo = document.querySelector('h1, h2')?.innerText || '';
                const matchNum = titulo.match(/#(\d+)/);
                const numeroVenta = matchNum ? '#' + matchNum[1] : null;
                if (!numeroVenta) return null;

                const pageText = document.body.innerText;

                let totalVenta = 0;
                const allElements = Array.from(document.querySelectorAll('*'));
                for (const el of allElements) {
                    const txt = el.innerText?.trim() || '';
                    if (/^Total\s*\$[\d,]+/.test(txt) && !txt.includes('Subtotal')) {
                        const match = txt.match(/Total\s*\$([\d,]+(?:\.\d{2})?)/);
                        if (match) {
                            const val = parseFloat(match[1].replace(/,/g, ''));
                            if (val > totalVenta) totalVenta = val;
                        }
                    }
                }
                if (totalVenta === 0) {
                    const matches = [...pageText.matchAll(/^Total\s+\$([\d,]+(?:\.\d{2})?)$/gm)];
                    if (matches.length > 0) totalVenta = parseFloat(matches[matches.length - 1][1].replace(/,/g, ''));
                }
                if (totalVenta === 0) {
                    const sidebarMatch = pageText.match(/Total\n\$([\d,]+(?:\.\d{2})?)/);
                    if (sidebarMatch) totalVenta = parseFloat(sidebarMatch[1].replace(/,/g, ''));
                }

                const sucursalMatch = pageText.match(/Agrigarden\s+(Norte|Sur)/i);
                const sucursal = sucursalMatch ? 'Agrigarden ' + sucursalMatch[1] : '';
                const pagada = pageText.toLowerCase().includes('pagada');
                const clienteLinks = document.querySelectorAll('a[href*="/client"], a[href*="/customer"]');
                const cliente = clienteLinks.length > 0 ? clienteLinks[0].innerText.trim() : '';
                const historial = pageText.match(/Cobro de \$[\d,.]+  en (.+?)(?:\n|$)/i);
                const metodoPago = historial ? historial[1].trim() : '';
                const comentariosNodes = document.querySelectorAll('[class*="comment"], [class*="histor"] p, [class*="note"]');
                const comentarios = Array.from(comentariosNodes).map(n => n.innerText).join(' ');
                const vendedorMatch = pageText.match(/Vendedor[:\s]+([^\n]+)/i);
                const vendedor = vendedorMatch ? vendedorMatch[1].trim() : '';

                return { numeroVenta, sucursal, pagada, totalVenta, cliente, metodoPago, comentarios, vendedor };
            });

            if (!datosVenta || !datosVenta.numeroVenta) continue;

            const { metodo, claro } = mapearMetodoPago(datosVenta.metodoPago, datosVenta.comentarios);
            const sucursal = mapearSucursal(datosVenta.sucursal);

            const registro = {
                created_at: new Date(FECHA_SYNC + 'T12:00:00').toISOString(),
                categoria: datosVenta.numeroVenta,
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

            if (!claro) ventasPendientes.push({ ...registro, _metodoPulpos: datosVenta.metodoPago });
            else ventasProcesadas.push(registro);

            console.log(`   ✅ ${datosVenta.numeroVenta} | ${sucursal} | ${metodo} | $${datosVenta.totalVenta} ${claro ? '' : '⚠️'}`);

        } catch (e) {
            console.error(`   ❌ Error procesando ${link.href}: ${e.message}`);
        }
    }

    const todasLasVentas = [
        ...ventasProcesadas.map(v => ({ ...v, requiere_revision: false })),
        ...ventasPendientes.map(v => ({ ...v, requiere_revision: true }))
    ];

    let stagingInsertadas = 0;
    for (const venta of todasLasVentas) {
        const { error } = await supabase.from('pulpos_sync_staging').insert({
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
        });
        if (!error) stagingInsertadas++;
    }

    await supabase.from('pulpos_sync_log').update({
        estado: 'listo_para_revision',
        ventas_importadas: stagingInsertadas,
        ventas_pendientes: ventasPendientes.length,
        mensaje: `${stagingInsertadas} ventas listas para revisión (${ventasPendientes.length} requieren ajuste)`
    }).eq('id', logId);

    console.log(`\n🎉 Ventas: ${stagingInsertadas} en staging | ${ventasPendientes.length} requieren revisión`);
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================
async function main() {
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        });
        const page = await context.newPage();

        await loginPulpos(page);

        if (MODO === 'inventario' || MODO === 'all') {
            await sincronizarInventario(page);
        }
        if (MODO === 'movimientos' || MODO === 'all') {
            await sincronizarMovimientos(page);
        }
        if (MODO === 'clientes' || MODO === 'all') {
            await sincronizarClientes(page);
        }
        if (MODO === 'ventas' || MODO === 'all') {
            await sincronizarVentas(page);
        }

        console.log('\n✅ Sincronización completada exitosamente.');

    } catch (error) {
        console.error(`\n❌ Error en sincronización: ${error.message}`);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

main();
