// clientes.js - Módulo de Clientes Agrigarden CRM (sincronizado desde Pulpos)

let clientesCache = [];

// =====================================================
// 1. CARGA Y RENDERIZADO
// =====================================================
async function cargarClientes() {
    const tbody = document.getElementById('tablaClientes');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-300 italic font-bold animate-pulse">Cargando clientes...</td></tr>';

    try {
        if (!window.SUPABASE_URL) window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        if (!window.SUPABASE_KEY) window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

        let all = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const res = await fetch(`${window.SUPABASE_URL}/rest/v1/clientes?select=*&order=nombre.asc&limit=${limit}&offset=${offset}`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
            });
            const batch = await res.json();
            all = all.concat(batch);
            if (batch.length < limit) hasMore = false;
            else offset += limit;
        }

        clientesCache = all;
        actualizarKPIsClientes();
        filtrarClientes();

        // Mostrar badge de sync si hay clientes sincronizados
        const conSync = all.filter(c => c.pulpos_id).length;
        if (conSync > 0) {
            document.getElementById('syncBadge')?.classList.remove('hidden');
        }

    } catch (e) {
        console.error('Error cargando clientes:', e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-red-400 italic">Error cargando clientes</td></tr>';
    }
}

function actualizarKPIsClientes() {
    const total = clientesCache.length;
    const conDeuda = clientesCache.filter(c => (c.saldo || 0) > 0).length;
    const deudaTotal = clientesCache.reduce((s, c) => s + (c.saldo || 0), 0);
    const ventasTotal = clientesCache.reduce((s, c) => s + (c.total_ventas || 0), 0);

    document.getElementById('kpiTotal').textContent = total.toLocaleString('es-MX');
    document.getElementById('kpiConDeuda').textContent = conDeuda.toLocaleString('es-MX');
    document.getElementById('kpiDeudaTotal').textContent = formatMoneyCli(deudaTotal);
    document.getElementById('kpiVentasTotal').textContent = ventasTotal.toLocaleString('es-MX');
}

function filtrarClientes() {
    const busq = document.getElementById('busquedaCliente')?.value.toLowerCase() || '';
    const filtroDeuda = document.getElementById('filtroDeuda')?.value || 'Todos';
    const orden = document.getElementById('filtroOrden')?.value || 'nombre';

    let filtrados = clientesCache.filter(c => {
        const coincide =
            (c.nombre || '').toLowerCase().includes(busq) ||
            (c.rfc || '').toLowerCase().includes(busq) ||
            (c.telefono || '').includes(busq) ||
            (c.email || '').toLowerCase().includes(busq) ||
            (c.razon_social || '').toLowerCase().includes(busq);

        const deudaOk =
            filtroDeuda === 'Todos' ||
            (filtroDeuda === 'ConDeuda' && (c.saldo || 0) > 0) ||
            (filtroDeuda === 'SinDeuda' && (c.saldo || 0) <= 0);

        return coincide && deudaOk;
    });

    // Ordenar
    filtrados.sort((a, b) => {
        if (orden === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '');
        if (orden === 'saldo') return (b.saldo || 0) - (a.saldo || 0);
        if (orden === 'total_ventas') return (b.total_ventas || 0) - (a.total_ventas || 0);
        if (orden === 'total_vendido') return (b.total_vendido || 0) - (a.total_vendido || 0);
        return 0;
    });

    renderizarClientes(filtrados);
}

function renderizarClientes(datos) {
    const tbody = document.getElementById('tablaClientes');
    const empty = document.getElementById('emptyStateClientes');
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    tbody.innerHTML = datos.map(c => {
        const tieneDeuda = (c.saldo || 0) > 0;
        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((c.nombre || 'CL').charAt(0))}&background=f1f5f9&color=64748b&size=80`;

        return `
        <tr class="hover:bg-slate-50/80 transition-all border-b border-slate-50 cursor-pointer group"
            onclick="verDetalleCliente('${c.id}')">
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="size-9 rounded-xl object-cover border border-slate-100" alt="${c.nombre}">
                    <div>
                        <p class="font-bold text-slate-800 group-hover:text-primary transition-colors">${c.nombre || '—'}</p>
                        ${c.email ? `<p class="text-xs text-slate-400">${c.email}</p>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5">
                <p class="font-mono text-xs text-slate-600 font-bold">${c.rfc || '—'}</p>
                ${c.razon_social ? `<p class="text-xs text-slate-400 truncate max-w-[160px]" title="${c.razon_social}">${c.razon_social}</p>` : ''}
            </td>
            <td class="px-5 py-3.5 text-center">
                ${c.telefono
                ? `<a href="https://wa.me/52${c.telefono.replace(/\D/g, '')}" target="_blank"
                          onclick="event.stopPropagation()"
                          class="inline-flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700 transition-colors">
                          <span class="material-symbols-outlined text-sm">phone</span>${c.telefono}
                       </a>`
                : '<span class="text-slate-300">—</span>'}
            </td>
            <td class="px-5 py-3.5 text-center">
                <span class="font-black text-slate-700">${(c.total_ventas || 0).toLocaleString('es-MX')}</span>
            </td>
            <td class="px-5 py-3.5 text-right font-bold text-primary">
                ${formatMoneyCli(c.total_vendido || 0)}
            </td>
            <td class="px-5 py-3.5 text-right">
                <span class="font-black ${tieneDeuda ? 'text-red-500' : 'text-slate-300'}">
                    ${tieneDeuda ? formatMoneyCli(c.saldo) : '$0.00'}
                </span>
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// 2. DETALLE CLIENTE (SLIDE-OVER)
// =====================================================
function verDetalleCliente(id) {
    const c = clientesCache.find(x => x.id === id);
    if (!c) return;

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((c.nombre || 'CL').charAt(0))}&background=f1f5f9&color=64748b&size=200`;
    const tieneDeuda = (c.saldo || 0) > 0;
    const syncDate = c.ultima_sync
        ? new Date(c.ultima_sync).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

    document.getElementById('contenidoDetalleCliente').innerHTML = `
        <!-- Cabecera -->
        <div class="text-center">
            <img src="${avatar}" class="w-20 h-20 mx-auto rounded-2xl object-cover border-2 border-slate-100 shadow-sm">
            <h3 class="text-xl font-black text-slate-800 mt-3">${c.nombre || '—'}</h3>
            ${c.razon_social ? `<p class="text-sm text-slate-400 mt-0.5">${c.razon_social}</p>` : ''}
            ${c.lista_precios ? `<span class="inline-block mt-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase">${c.lista_precios}</span>` : ''}
        </div>

        <!-- Resumen financiero -->
        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-primary/5 p-3 rounded-2xl">
                <p class="text-[9px] font-black text-slate-400 uppercase"># Ventas</p>
                <p class="text-2xl font-black text-primary">${(c.total_ventas || 0).toLocaleString()}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-2xl">
                <p class="text-[9px] font-black text-slate-400 uppercase">Total Vendido</p>
                <p class="text-lg font-black text-slate-700">${formatMoneyCli(c.total_vendido || 0)}</p>
            </div>
            <div class="bg-${tieneDeuda ? 'red' : 'slate'}-50 p-3 rounded-2xl">
                <p class="text-[9px] font-black text-slate-400 uppercase">Deuda</p>
                <p class="text-2xl font-black ${tieneDeuda ? 'text-red-500' : 'text-slate-300'}">${formatMoneyCli(c.saldo || 0)}</p>
            </div>
        </div>

        <!-- Datos de contacto -->
        <div class="bg-slate-50 p-4 rounded-2xl space-y-2">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Datos de Contacto</p>
            ${c.telefono ? `
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">Teléfono</span>
                <a href="https://wa.me/52${c.telefono.replace(/\D/g, '')}" target="_blank"
                   class="text-xs font-black text-green-600 flex items-center gap-1 hover:text-green-700">
                    <span class="material-symbols-outlined text-sm">phone</span>${c.telefono}
                </a>
            </div>` : ''}
            ${c.email ? `
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">Email</span>
                <a href="mailto:${c.email}" class="text-xs font-black text-blue-600">${c.email}</a>
            </div>` : ''}
        </div>

        <!-- Datos fiscales -->
        ${(c.rfc || c.razon_social) ? `
        <div class="bg-slate-50 p-4 rounded-2xl space-y-2">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Datos Fiscales</p>
            ${c.rfc ? `
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">RFC</span>
                <span class="font-mono text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg">${c.rfc}</span>
            </div>` : ''}
            ${c.razon_social ? `
            <div class="flex items-start justify-between gap-2">
                <span class="text-xs font-bold text-slate-500 shrink-0">Razón Social</span>
                <span class="text-xs font-black text-slate-700 text-right">${c.razon_social}</span>
            </div>` : ''}
        </div>` : ''}

        <!-- Crédito -->
        ${(c.limite_credito || 0) > 0 ? `
        <div class="bg-blue-50 p-4 rounded-2xl">
            <p class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Crédito</p>
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-slate-500">Límite</span>
                <span class="font-black text-blue-700">${formatMoneyCli(c.limite_credito)}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-xs font-bold text-slate-500">Saldo Pendiente</span>
                <span class="font-black ${tieneDeuda ? 'text-red-500' : 'text-slate-400'}">${formatMoneyCli(c.saldo || 0)}</span>
            </div>
        </div>` : ''}

        <!-- Meta -->
        ${syncDate ? `
        <div class="text-center">
            <p class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                Último sync: ${syncDate}
            </p>
        </div>` : ''}
    `;

    document.getElementById('slideDetalleCliente').classList.add('active');
    document.getElementById('overlayCliente')?.classList.remove('hidden');
}

function cerrarDetalleCliente() {
    document.getElementById('slideDetalleCliente').classList.remove('active');
    document.getElementById('overlayCliente')?.classList.add('hidden');
}

// =====================================================
// UTILS
// =====================================================
function formatMoneyCli(n) {
    if (n === undefined || n === null) return '$0.00';
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
