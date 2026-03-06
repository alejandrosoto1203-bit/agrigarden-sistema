// ventas_analytics.js — Módulo de Análisis de Ventas
// Usa las mismas credenciales que el resto del sistema

const SB_URL_ANA = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY_ANA = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

// ── Estado global ──────────────────────────────────────────────────────────────
let rawTransacciones = [];          // Todas las transacciones del período
let itemsPorTransaccion = {};       // { transaccion_id: [items] }
let transaccionesFiltradas = [];    // Resultado de aplicarFiltros()
let tabActiva = 'vendedores';
let expandidos = new Set();
let offsetDetalle = 0;
const LIMIT_DETALLE = 50;
let filtroBusquedaDetalle = '';

// ── Inicialización ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (typeof inyectarMenu === 'function') inyectarMenu('ventas_analytics');
    inicializarFiltros();
    cargarVendedoresFilter();
    cargarDatos();
});

function inicializarFiltros() {
    const hoy = new Date();
    // Año actual y años previos en selector
    const anioSel = document.getElementById('filtro-anio');
    for (let y = hoy.getFullYear(); y >= 2023; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        anioSel.appendChild(opt);
    }
    // Mes y año actuales por defecto
    document.getElementById('filtro-mes').value = hoy.getMonth() + 1;
    anioSel.value = hoy.getFullYear();

    // Cambiar mes/año recarga datos
    ['filtro-mes', 'filtro-anio'].forEach(id => {
        document.getElementById(id).addEventListener('change', cargarDatos);
    });
    // Demás filtros solo re-filtran en cliente
    ['filtro-sucursal', 'filtro-vendedor', 'filtro-tipo', 'filtro-estado'].forEach(id => {
        document.getElementById(id).addEventListener('change', aplicarFiltros);
    });
}

async function cargarVendedoresFilter() {
    try {
        const res = await fetch(
            `${SB_URL_ANA}/rest/v1/sys_vendedores?select=id,nombre&or=(activo.eq.true,activo.is.null)&order=nombre.asc`,
            { headers: { apikey: SB_KEY_ANA, Authorization: `Bearer ${SB_KEY_ANA}` } }
        );
        if (!res.ok) return;
        const vendedores = await res.json();
        const sel = document.getElementById('filtro-vendedor');
        vendedores.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.nombre;
            opt.textContent = v.nombre;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.warn('No se pudieron cargar vendedores para filtro:', e);
    }
}

// ── Carga de datos ─────────────────────────────────────────────────────────────
async function cargarDatos() {
    const mes = parseInt(document.getElementById('filtro-mes').value);
    const anio = parseInt(document.getElementById('filtro-anio').value);

    // Rango del mes seleccionado
    const inicio = new Date(anio, mes - 1, 1).toISOString();
    const fin = new Date(anio, mes, 0, 23, 59, 59).toISOString();

    setLoading(true);
    expandidos.clear();
    offsetDetalle = 0;

    try {
        // 1. Cargar transacciones del período
        rawTransacciones = await fetchPaginated(
            `${SB_URL_ANA}/rest/v1/transacciones` +
            `?select=id,created_at,tipo,nombre_cliente,vendedor_nombre,sucursal,estado_cobro,total,orden_reparacion_id,numero_ticket` +
            `&created_at=gte.${inicio}&created_at=lte.${fin}` +
            `&order=created_at.desc`
        );

        // 2. Cargar items de venta del mismo período
        const rawItems = await fetchPaginated(
            `${SB_URL_ANA}/rest/v1/venta_items` +
            `?select=transaccion_id,producto_nombre,producto_sku,cantidad,precio_unitario,subtotal,total` +
            `&created_at=gte.${inicio}&created_at=lte.${fin}`
        );

        // 3. Construir mapa transaccion_id → items
        itemsPorTransaccion = {};
        rawItems.forEach(item => {
            if (!itemsPorTransaccion[item.transaccion_id]) {
                itemsPorTransaccion[item.transaccion_id] = [];
            }
            itemsPorTransaccion[item.transaccion_id].push(item);
        });

        aplicarFiltros();
    } catch (e) {
        console.error('Error cargando datos analytics:', e);
        mostrarError('No se pudieron cargar los datos. Intenta de nuevo.');
    } finally {
        setLoading(false);
    }
}

async function fetchPaginated(baseUrl) {
    let all = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
        const sep = baseUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${baseUrl}${sep}limit=${limit}&offset=${offset}`, {
            headers: { apikey: SB_KEY_ANA, Authorization: `Bearer ${SB_KEY_ANA}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const batch = await res.json();
        all = all.concat(batch);
        if (batch.length < limit) break;
        offset += limit;
    }
    return all;
}

// ── Filtrado client-side ───────────────────────────────────────────────────────
function aplicarFiltros() {
    const sucursal = document.getElementById('filtro-sucursal').value;
    const vendedor = document.getElementById('filtro-vendedor').value;
    const tipo = document.getElementById('filtro-tipo').value;
    const estado = document.getElementById('filtro-estado').value;
    const clienteQ = document.getElementById('filtro-cliente').value.toLowerCase().trim();
    const productoQ = document.getElementById('filtro-producto').value.toLowerCase().trim();

    transaccionesFiltradas = rawTransacciones.filter(tx => {
        if (sucursal && tx.sucursal !== sucursal) return false;
        if (vendedor && tx.vendedor_nombre !== vendedor) return false;
        if (estado && tx.estado_cobro !== estado) return false;
        if (tipo === 'reparacion' && !tx.orden_reparacion_id) return false;
        if (tipo === 'venta' && tx.orden_reparacion_id) return false;
        if (clienteQ && !(tx.nombre_cliente || '').toLowerCase().includes(clienteQ)) return false;
        if (productoQ) {
            const items = itemsPorTransaccion[tx.id] || [];
            const match = items.some(it =>
                (it.producto_nombre || '').toLowerCase().includes(productoQ) ||
                (it.producto_sku || '').toLowerCase().includes(productoQ)
            );
            if (!match) return false;
        }
        return true;
    });

    offsetDetalle = 0;
    expandidos.clear();
    filtroBusquedaDetalle = '';
    const buscador = document.getElementById('buscar-transaccion');
    if (buscador) buscador.value = '';

    renderKPIs();
    renderTab();
    renderDetalleTransacciones();
}

function limpiarFiltros() {
    document.getElementById('filtro-sucursal').value = '';
    document.getElementById('filtro-vendedor').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-cliente').value = '';
    document.getElementById('filtro-producto').value = '';
    aplicarFiltros();
}

// ── KPIs ───────────────────────────────────────────────────────────────────────
function renderKPIs() {
    const total = transaccionesFiltradas.length;
    const reps = transaccionesFiltradas.filter(tx => tx.orden_reparacion_id).length;
    const monto = transaccionesFiltradas.reduce((s, tx) => s + (tx.total || 0), 0);
    const pagado = transaccionesFiltradas.filter(tx => tx.estado_cobro === 'Pagada').reduce((s, tx) => s + (tx.total || 0), 0);
    const pendiente = monto - pagado;
    const pctPag = monto > 0 ? ((pagado / monto) * 100).toFixed(1) : '0';
    const pctPen = monto > 0 ? ((pendiente / monto) * 100).toFixed(1) : '0';
    const promedio = total > 0 ? monto / total : 0;

    document.getElementById('kpi-total-tx').textContent = total.toLocaleString('es-MX');
    document.getElementById('kpi-rep-tx').textContent = `${reps} reparaciones · ${total - reps} ventas directas`;
    document.getElementById('kpi-total-monto').textContent = fmt(monto);
    document.getElementById('kpi-promedio').textContent = `Promedio: ${fmt(promedio)}`;
    document.getElementById('kpi-pagado').textContent = fmt(pagado);
    document.getElementById('kpi-pagado-pct').textContent = `${pctPag}% del total`;
    document.getElementById('kpi-pendiente').textContent = fmt(pendiente);
    document.getElementById('kpi-pendiente-pct').textContent = `${pctPen}% del total`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    tabActiva = tab;
    ['vendedores', 'clientes', 'productos'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (t === tab) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderTab();
}

function renderTab() {
    if (tabActiva === 'vendedores') renderTabVendedores();
    else if (tabActiva === 'clientes') renderTabClientes();
    else renderTabProductos();
}

function renderTabVendedores() {
    const grupos = {};
    transaccionesFiltradas.forEach(tx => {
        const key = tx.vendedor_nombre || 'Sin Vendedor';
        if (!grupos[key]) grupos[key] = { count: 0, total: 0, pagado: 0, pendiente: 0, reps: 0 };
        grupos[key].count++;
        grupos[key].total += tx.total || 0;
        if (tx.estado_cobro === 'Pagada') grupos[key].pagado += tx.total || 0;
        else grupos[key].pendiente += tx.total || 0;
        if (tx.orden_reparacion_id) grupos[key].reps++;
    });

    const filas = Object.entries(grupos)
        .sort((a, b) => b[1].total - a[1].total);

    if (filas.length === 0) {
        document.getElementById('tab-content').innerHTML = emptyState('No hay datos para los filtros seleccionados');
        return;
    }

    const totalGlobal = filas.reduce((s, [, v]) => s + v.total, 0);

    document.getElementById('tab-content').innerHTML = `
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b border-gray-100">
                    <th class="text-left pb-3 section-label">Vendedor</th>
                    <th class="text-right pb-3 section-label">Transacciones</th>
                    <th class="text-right pb-3 section-label">Total</th>
                    <th class="text-right pb-3 section-label">Cobrado</th>
                    <th class="text-right pb-3 section-label">Por Cobrar</th>
                    <th class="text-right pb-3 section-label">Reparaciones</th>
                    <th class="pb-3 section-label pl-4">Participación</th>
                </tr>
            </thead>
            <tbody>
                ${filas.map(([vendedor, v]) => {
                    const pct = totalGlobal > 0 ? ((v.total / totalGlobal) * 100).toFixed(1) : 0;
                    return `
                    <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td class="py-3 font-bold text-gray-800">${esc(vendedor)}</td>
                        <td class="py-3 text-right text-gray-600">${v.count}</td>
                        <td class="py-3 text-right font-bold">${fmt(v.total)}</td>
                        <td class="py-3 text-right text-green-600">${fmt(v.pagado)}</td>
                        <td class="py-3 text-right text-amber-500">${fmt(v.pendiente)}</td>
                        <td class="py-3 text-right text-purple-600">${v.reps}</td>
                        <td class="py-3 pl-4 min-w-[120px]">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div class="h-full bg-primary rounded-full" style="width:${pct}%"></div>
                                </div>
                                <span class="text-xs text-gray-400 w-10 text-right">${pct}%</span>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        </div>`;
}

function renderTabClientes() {
    const grupos = {};
    transaccionesFiltradas.forEach(tx => {
        const key = tx.nombre_cliente || 'Cliente General';
        if (!grupos[key]) grupos[key] = { count: 0, total: 0, pagado: 0, pendiente: 0, productos: {} };
        grupos[key].count++;
        grupos[key].total += tx.total || 0;
        if (tx.estado_cobro === 'Pagada') grupos[key].pagado += tx.total || 0;
        else grupos[key].pendiente += tx.total || 0;
        // Acumular productos por cliente
        (itemsPorTransaccion[tx.id] || []).forEach(it => {
            const pk = it.producto_nombre || it.producto_sku || 'Desconocido';
            grupos[key].productos[pk] = (grupos[key].productos[pk] || 0) + (it.cantidad || 1);
        });
    });

    const filas = Object.entries(grupos)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 100); // Top 100 clientes

    if (filas.length === 0) {
        document.getElementById('tab-content').innerHTML = emptyState('No hay datos para los filtros seleccionados');
        return;
    }

    document.getElementById('tab-content').innerHTML = `
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b border-gray-100">
                    <th class="text-left pb-3 section-label">Cliente</th>
                    <th class="text-right pb-3 section-label">Compras</th>
                    <th class="text-right pb-3 section-label">Total</th>
                    <th class="text-right pb-3 section-label">Cobrado</th>
                    <th class="text-right pb-3 section-label">Por Cobrar</th>
                    <th class="text-left pb-3 section-label pl-4">Producto más comprado</th>
                </tr>
            </thead>
            <tbody>
                ${filas.map(([cliente, v]) => {
                    const topProd = Object.entries(v.productos).sort((a, b) => b[1] - a[1])[0];
                    return `
                    <tr class="border-b border-gray-50 hover:bg-gray-50">
                        <td class="py-3 font-bold text-gray-800">${esc(cliente)}</td>
                        <td class="py-3 text-right text-gray-600">${v.count}</td>
                        <td class="py-3 text-right font-bold">${fmt(v.total)}</td>
                        <td class="py-3 text-right text-green-600">${fmt(v.pagado)}</td>
                        <td class="py-3 text-right text-amber-500">${fmt(v.pendiente)}</td>
                        <td class="py-3 pl-4 text-gray-500 text-xs">${topProd ? esc(topProd[0]) + ` (×${topProd[1]})` : '—'}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        ${filas.length === 100 ? `<p class="text-xs text-gray-400 text-center pt-4">Mostrando top 100 clientes</p>` : ''}
        </div>`;
}

function renderTabProductos() {
    const productos = {};
    transaccionesFiltradas.forEach(tx => {
        (itemsPorTransaccion[tx.id] || []).forEach(it => {
            const key = it.producto_sku ? `${it.producto_sku}||${it.producto_nombre}` : (it.producto_nombre || 'Desconocido');
            if (!productos[key]) productos[key] = { nombre: it.producto_nombre || 'Desconocido', sku: it.producto_sku || '', cantidad: 0, total: 0, clientes: new Set(), vendedores: new Set() };
            productos[key].cantidad += Number(it.cantidad) || 1;
            productos[key].total += Number(it.total) || 0;
            if (tx.nombre_cliente) productos[key].clientes.add(tx.nombre_cliente);
            if (tx.vendedor_nombre) productos[key].vendedores.add(tx.vendedor_nombre);
        });
    });

    const filas = Object.values(productos)
        .sort((a, b) => b.cantidad - a.cantidad);

    if (filas.length === 0) {
        document.getElementById('tab-content').innerHTML = emptyState('No hay productos registrados para este período');
        return;
    }

    document.getElementById('tab-content').innerHTML = `
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b border-gray-100">
                    <th class="text-left pb-3 section-label">SKU</th>
                    <th class="text-left pb-3 section-label">Producto</th>
                    <th class="text-right pb-3 section-label">Cantidad</th>
                    <th class="text-right pb-3 section-label">Total Generado</th>
                    <th class="text-right pb-3 section-label">Clientes únicos</th>
                    <th class="text-right pb-3 section-label">Vendedores</th>
                </tr>
            </thead>
            <tbody>
                ${filas.map(p => `
                    <tr class="border-b border-gray-50 hover:bg-gray-50">
                        <td class="py-3 text-gray-400 font-mono text-xs">${esc(p.sku) || '—'}</td>
                        <td class="py-3 font-bold text-gray-800">${esc(p.nombre)}</td>
                        <td class="py-3 text-right font-bold">${p.cantidad.toLocaleString('es-MX')}</td>
                        <td class="py-3 text-right text-blue-600 font-bold">${fmt(p.total)}</td>
                        <td class="py-3 text-right text-gray-500">${p.clientes.size}</td>
                        <td class="py-3 text-right text-gray-500">${p.vendedores.size}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

// ── Tabla Detalle ──────────────────────────────────────────────────────────────
function filtrarDetalle(q) {
    filtroBusquedaDetalle = q.toLowerCase().trim();
    offsetDetalle = 0;
    expandidos.clear();
    renderDetalleTransacciones();
}

function getTransaccionesFiltradas() {
    if (!filtroBusquedaDetalle) return transaccionesFiltradas;
    return transaccionesFiltradas.filter(tx =>
        (tx.numero_ticket || '').toLowerCase().includes(filtroBusquedaDetalle) ||
        String(tx.id || '').toLowerCase().includes(filtroBusquedaDetalle)
    );
}

function renderDetalleTransacciones() {
    const todas = getTransaccionesFiltradas();
    const porMostrar = todas.slice(0, offsetDetalle + LIMIT_DETALLE);
    const total = todas.length;

    document.getElementById('detalle-count').textContent =
        `${total.toLocaleString('es-MX')} transacciones en total`;
    document.getElementById('pag-info').textContent =
        `Mostrando ${Math.min(porMostrar.length, total)} de ${total}`;

    const tbody = document.getElementById('tbody-detalle');

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-12 text-gray-400 text-sm">Sin resultados</td></tr>`;
        document.getElementById('btn-cargar-mas').classList.add('hidden');
        return;
    }

    tbody.innerHTML = porMostrar.map(tx => renderFilaTx(tx)).join('');

    // Mostrar botón "cargar más"
    const btnMas = document.getElementById('btn-cargar-mas');
    if (porMostrar.length < total) {
        btnMas.classList.remove('hidden');
        btnMas.textContent = `Cargar más (${total - porMostrar.length} restantes) →`;
    } else {
        btnMas.classList.add('hidden');
    }
}

function renderFilaTx(tx) {
    const esRep = !!tx.orden_reparacion_id;
    const expanded = expandidos.has(tx.id);
    const fecha = tx.created_at ? new Date(tx.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const items = itemsPorTransaccion[tx.id] || [];
    const ticketLabel = tx.numero_ticket || (tx.id ? String(tx.id).slice(0, 8) + '…' : '—');

    let filas = `
        <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expanded ? 'row-expanded' : ''}" onclick="toggleExpand('${tx.id}')">
            <td class="px-4 py-3 text-gray-400">
                <span class="material-symbols-outlined text-base transition-transform ${expanded ? 'rotate-90' : ''}" style="font-size:16px">chevron_right</span>
            </td>
            <td class="px-4 py-3 text-gray-600 text-xs">${fecha}</td>
            <td class="px-4 py-3 font-mono text-xs text-gray-500" title="${tx.id}">${esc(ticketLabel)}</td>
            <td class="px-4 py-3 font-bold text-gray-800">${esc(tx.nombre_cliente || 'General')}</td>
            <td class="px-4 py-3 text-gray-600">${esc(tx.vendedor_nombre || '—')}</td>
            <td class="px-4 py-3">
                ${tx.sucursal ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full ${tx.sucursal === 'Norte' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${esc(tx.sucursal)}</span>` : '—'}
            </td>
            <td class="px-4 py-3">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${esRep ? 'badge-reparacion' : 'badge-venta'}">${esRep ? 'Reparación' : 'Venta'}</span>
            </td>
            <td class="px-4 py-3 text-right font-bold">${fmt(tx.total)}</td>
            <td class="px-4 py-3">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${tx.estado_cobro === 'Pagada' ? 'badge-pagada' : 'badge-pendiente'}">${esc(tx.estado_cobro || 'Pendiente')}</span>
            </td>
        </tr>`;

    if (expanded) {
        if (items.length === 0) {
            filas += `
                <tr class="expand-row">
                    <td colspan="9" class="px-8 py-3 text-xs text-gray-400 italic">Sin productos registrados en esta transacción</td>
                </tr>`;
        } else {
            filas += `
                <tr class="expand-row">
                    <td colspan="9" class="px-0 py-0">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="text-left px-10 py-2 section-label">SKU</th>
                                    <th class="text-left px-4 py-2 section-label">Producto</th>
                                    <th class="text-right px-4 py-2 section-label">Cantidad</th>
                                    <th class="text-right px-4 py-2 section-label">Precio Unit.</th>
                                    <th class="text-right px-4 py-2 section-label">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(it => `
                                    <tr class="product-row border-b border-gray-100">
                                        <td class="px-10 py-2 font-mono text-gray-400">${esc(it.producto_sku || '—')}</td>
                                        <td class="px-4 py-2 font-bold text-gray-700">${esc(it.producto_nombre || 'Desconocido')}</td>
                                        <td class="px-4 py-2 text-right text-gray-600">${Number(it.cantidad).toLocaleString('es-MX')}</td>
                                        <td class="px-4 py-2 text-right text-gray-600">${fmt(it.precio_unitario)}</td>
                                        <td class="px-4 py-2 text-right font-bold">${fmt(it.subtotal || it.total)}</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </td>
                </tr>`;
        }
    }

    return filas;
}

function toggleExpand(txId) {
    if (expandidos.has(txId)) expandidos.delete(txId);
    else expandidos.add(txId);
    renderDetalleTransacciones();
}

function cargarMasDetalle() {
    offsetDetalle += LIMIT_DETALLE;
    renderDetalleTransacciones();
    // Scroll suave al botón de cargar más para UX
    document.getElementById('btn-cargar-mas').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Exportar CSV ───────────────────────────────────────────────────────────────
function exportarCSV() {
    if (transaccionesFiltradas.length === 0) {
        alert('No hay datos para exportar con los filtros actuales.');
        return;
    }

    const mes = document.getElementById('filtro-mes').value;
    const anio = document.getElementById('filtro-anio').value;
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const nombreMes = meses[parseInt(mes) - 1];

    const filas = [];
    // Encabezado
    filas.push([
        'Fecha', 'Ticket', 'ID Transaccion', 'Cliente', 'Vendedor', 'Sucursal',
        'Tipo', 'Estado', 'Total Transaccion',
        'SKU Producto', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal Producto'
    ]);

    transaccionesFiltradas.forEach(tx => {
        const esRep = !!tx.orden_reparacion_id;
        const fecha = tx.created_at ? new Date(tx.created_at).toLocaleDateString('es-MX') : '';
        const items = itemsPorTransaccion[tx.id] || [];

        if (items.length === 0) {
            filas.push([
                fecha,
                tx.numero_ticket || '',
                tx.id || '',
                tx.nombre_cliente || 'General',
                tx.vendedor_nombre || '',
                tx.sucursal || '',
                esRep ? 'Reparación' : 'Venta Directa',
                tx.estado_cobro || 'Pendiente',
                tx.total || 0,
                '', '', '', '', ''
            ]);
        } else {
            items.forEach((it, idx) => {
                filas.push([
                    idx === 0 ? fecha : '',
                    idx === 0 ? (tx.numero_ticket || '') : '',
                    idx === 0 ? (tx.id || '') : '',
                    idx === 0 ? (tx.nombre_cliente || 'General') : '',
                    idx === 0 ? (tx.vendedor_nombre || '') : '',
                    idx === 0 ? (tx.sucursal || '') : '',
                    idx === 0 ? (esRep ? 'Reparación' : 'Venta Directa') : '',
                    idx === 0 ? (tx.estado_cobro || 'Pendiente') : '',
                    idx === 0 ? (tx.total || 0) : '',
                    it.producto_sku || '',
                    it.producto_nombre || '',
                    it.cantidad || '',
                    it.precio_unitario || '',
                    it.subtotal || it.total || ''
                ]);
            });
        }
    });

    const csv = '\uFEFF' + filas.map(r =>
        r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${nombreMes}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n) {
    if (n === null || n === undefined) return '$0.00';
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emptyState(msg) {
    return `<div class="flex flex-col items-center justify-center py-12 text-gray-300">
        <span class="material-symbols-outlined text-5xl mb-3">bar_chart</span>
        <p class="text-sm">${msg}</p>
    </div>`;
}

function setLoading(on) {
    const icon = document.getElementById('reload-icon');
    const btn = document.getElementById('btn-reload');
    if (on) {
        if (icon) icon.classList.add('animate-spin');
        if (btn) btn.disabled = true;
        document.getElementById('tab-content').innerHTML =
            `<div class="flex justify-center py-8"><div class="loading-spinner"></div></div>`;
        document.getElementById('tbody-detalle').innerHTML =
            `<tr><td colspan="9" class="text-center py-10"><div class="flex justify-center"><div class="loading-spinner"></div></div></td></tr>`;
    } else {
        if (icon) icon.classList.remove('animate-spin');
        if (btn) btn.disabled = false;
    }
}

function mostrarError(msg) {
    document.getElementById('tab-content').innerHTML =
        `<div class="flex flex-col items-center py-10 text-red-400">
            <span class="material-symbols-outlined text-4xl mb-2">error</span>
            <p class="text-sm font-bold">${msg}</p>
        </div>`;
    document.getElementById('tbody-detalle').innerHTML =
        `<tr><td colspan="9" class="text-center py-8 text-red-400 text-sm">${msg}</td></tr>`;
}
