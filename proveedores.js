// proveedores.js - Módulo de Proveedores Agrigarden CRM

let proveedoresCache = [];

// =====================================================
// 1. CARGA Y RENDERIZADO
// =====================================================
async function cargarProveedores() {
    const tbody = document.getElementById('tablaProveedores');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-slate-300 italic font-bold animate-pulse">Cargando proveedores...</td></tr>';

    try {
        if (!window.SUPABASE_URL) window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        if (!window.SUPABASE_KEY) window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

        // Hacer un fetch con join a gastos para calcular # compras y gasto histórico
        const res = await fetch(`${window.SUPABASE_URL}/rest/v1/proveedores?select=*,gastos(id,monto_total)&order=nombre.asc`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });

        const data = await res.json();

        // Procesar datos para incluir sumatorias
        proveedoresCache = data.map(p => {
            const gastosRelacionados = p.gastos || [];
            return {
                ...p,
                total_compras: gastosRelacionados.length,
                gasto_historico: gastosRelacionados.reduce((sum, g) => sum + (g.monto_total || 0), 0)
            };
        });

        actualizarKPIsProveedores();
        filtrarProveedores();

    } catch (e) {
        console.error('Error cargando proveedores:', e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-400 italic">Error al cargar el directorio</td></tr>';
    }
}

function actualizarKPIsProveedores() {
    const total = proveedoresCache.length;
    const comprasTotal = proveedoresCache.reduce((sum, p) => sum + p.total_compras, 0);
    const gastoTotal = proveedoresCache.reduce((sum, p) => sum + p.gasto_historico, 0);

    document.getElementById('kpiTotal').textContent = total.toLocaleString('es-MX');
    document.getElementById('kpiComprasTotal').textContent = comprasTotal.toLocaleString('es-MX');
    document.getElementById('kpiGastoTotal').textContent = formatMoneyProv(gastoTotal);
}

function filtrarProveedores() {
    const busq = document.getElementById('busquedaProveedor')?.value.toLowerCase() || '';
    const orden = document.getElementById('filtroOrden')?.value || 'nombre_asc';

    let filtrados = proveedoresCache.filter(p => {
        return (p.nombre || '').toLowerCase().includes(busq) ||
            (p.rfc || '').toLowerCase().includes(busq) ||
            (p.telefono || '').includes(busq);
    });

    // Ordenar
    filtrados.sort((a, b) => {
        if (orden === 'nombre_asc') return (a.nombre || '').localeCompare(b.nombre || '');
        if (orden === 'nombre_desc') return (b.nombre || '').localeCompare(a.nombre || '');
        if (orden === 'mayor_gasto') return b.gasto_historico - a.gasto_historico;
        if (orden === 'mas_compras') return b.total_compras - a.total_compras;
        return 0;
    });

    renderizarProveedores(filtrados);
}

function renderizarProveedores(datos) {
    const tbody = document.getElementById('tablaProveedores');
    const empty = document.getElementById('emptyStateProveedores');
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    tbody.innerHTML = datos.map(p => {
        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((p.nombre || 'PR').charAt(0))}&background=f1f5f9&color=64748b&size=80`;

        return `
        <tr class="hover:bg-slate-50/80 transition-all border-b border-slate-50 cursor-pointer group"
            onclick="verDetalleProveedor('${p.id}')">
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="size-9 rounded-xl object-cover border border-slate-100" alt="${p.nombre}">
                    <div>
                        <p class="font-bold text-slate-800 group-hover:text-primary transition-colors">${p.nombre || '—'}</p>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5">
                <p class="font-mono text-xs text-slate-600 font-bold">${p.rfc || '—'}</p>
                ${p.regimen_fiscal ? `<p class="text-xs text-slate-400 truncate max-w-[160px]" title="${p.regimen_fiscal}">${p.regimen_fiscal}</p>` : ''}
            </td>
            <td class="px-5 py-3.5 text-center">
                ${p.telefono
                ? `<a href="https://wa.me/52${p.telefono.replace(/\D/g, '')}" target="_blank"
                          onclick="event.stopPropagation()"
                          class="inline-flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700 transition-colors">
                          <span class="material-symbols-outlined text-sm">phone</span>${p.telefono}
                       </a>`
                : '<span class="text-slate-300">—</span>'}
            </td>
            <td class="px-5 py-3.5 text-center">
                <span class="font-black text-slate-700">${p.total_compras.toLocaleString('es-MX')}</span>
            </td>
            <td class="px-5 py-3.5 text-right font-bold text-primary">
                ${formatMoneyProv(p.gasto_historico)}
            </td>
        </tr>`;
    }).join('');
}

// =====================================================
// 2. DETALLE PROVEEDOR (SLIDE-OVER)
// =====================================================
function verDetalleProveedor(id) {
    // La ID es BIGINT, por lo que viene como numero, pero desde HTML puede ser string. Los comparamos convertidos.
    const p = proveedoresCache.find(x => x.id == id);
    if (!p) return;

    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent((p.nombre || 'PR').charAt(0))}&background=f1f5f9&color=64748b&size=200`;
    const fechaReg = p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : '—';

    document.getElementById('contenidoDetalleProveedor').innerHTML = `
        <!-- Cabecera -->
        <div class="text-center">
            <img src="${avatar}" class="w-20 h-20 mx-auto rounded-2xl object-cover border-2 border-slate-100 shadow-sm">
            <h3 class="text-xl font-black text-slate-800 mt-3">${p.nombre || '—'}</h3>
            ${p.regimen_fiscal ? `<p class="text-sm text-slate-400 mt-0.5">${p.regimen_fiscal}</p>` : ''}
        </div>

        <!-- Acciones Rápidas -->
        <div class="flex justify-center gap-2">
            <button onclick="editarProveedor(${p.id})" class="text-xs font-bold bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-all">Editar</button>
            <button onclick="eliminarProveedor(${p.id})" class="text-xs font-bold bg-red-50 text-red-500 px-4 py-2 rounded-xl hover:bg-red-100 transition-all">Eliminar</button>
        </div>

        <!-- Resumen financiero -->
        <div class="grid grid-cols-2 gap-3 text-center">
            <div class="bg-primary/5 p-3 rounded-2xl">
                <p class="text-[9px] font-black text-slate-400 uppercase"># Compras</p>
                <p class="text-2xl font-black text-primary">${p.total_compras.toLocaleString('es-MX')}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-2xl">
                <p class="text-[9px] font-black text-slate-400 uppercase">Gasto Total Acumulado</p>
                <p class="text-lg font-black text-slate-700">${formatMoneyProv(p.gasto_historico)}</p>
            </div>
        </div>

        <!-- Datos Fiscales -->
        <div class="bg-slate-50 p-4 rounded-2xl space-y-2">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Información Fiscal</p>
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500">RFC</span>
                <span class="font-mono text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg">${p.rfc || '—'}</span>
            </div>
            <div class="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-200">
                <span class="text-xs font-bold text-slate-500">Dirección</span>
                <span class="text-xs font-black text-slate-700">${p.direccion || '—'} ${p.codigo_postal ? `(CP: ${p.codigo_postal})` : ''}</span>
            </div>
        </div>

        <!-- Contacto -->
        <div class="bg-slate-50 p-4 rounded-2xl space-y-2">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contacto Directo</p>
            ${p.telefono ? `
            <div class="flex flex-col gap-1">
                <a href="https://wa.me/52${p.telefono.replace(/\D/g, '')}" target="_blank"
                   class="text-xs font-black text-green-600 flex items-center gap-1 hover:text-green-700 bg-green-50 w-fit px-3 py-1.5 rounded-lg">
                    <span class="material-symbols-outlined text-sm">phone</span> ${p.telefono}
                </a>
            </div>` : '<p class="text-xs text-slate-400">Sin teléfono registrado</p>'}
        </div>
        
        <div class="text-center mt-6">
            <p class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                Registrado el: ${fechaReg}
            </p>
        </div>
    `;

    document.getElementById('slideDetalleProveedor').classList.add('active');
    document.getElementById('overlayProveedor')?.classList.remove('hidden');
}

function cerrarDetalleProveedor() {
    document.getElementById('slideDetalleProveedor').classList.remove('active');
    document.getElementById('overlayProveedor')?.classList.add('hidden');
}

// =====================================================
// 3. CRUD PROVEEDORES
// =====================================================
function abrirModalNuevoProveedor() {
    cerrarDetalleProveedor();
    document.getElementById('formProveedor').reset();
    document.getElementById('formProveedorId').value = '';
    document.getElementById('modalProveedorTitulo').textContent = 'Nuevo Proveedor';
    document.getElementById('modalFormularioProveedor').classList.remove('hidden');
    document.getElementById('modalFormularioProveedor').classList.add('flex');
}

function cerrarModalNuevoProveedor() {
    document.getElementById('modalFormularioProveedor').classList.add('hidden');
    document.getElementById('modalFormularioProveedor').classList.remove('flex');
}

function editarProveedor(id) {
    const p = proveedoresCache.find(x => x.id == id);
    if (!p) return;
    cerrarDetalleProveedor();

    document.getElementById('formProveedorId').value = p.id;
    document.getElementById('formProveedorNombre').value = p.nombre || '';
    document.getElementById('formProveedorTelefono').value = p.telefono || '';
    document.getElementById('formProveedorRfc').value = p.rfc || '';
    document.getElementById('formProveedorRegimen').value = p.regimen_fiscal || '';
    document.getElementById('formProveedorDireccion').value = p.direccion || '';
    document.getElementById('formProveedorCP').value = p.codigo_postal || '';

    document.getElementById('modalProveedorTitulo').textContent = 'Editar Proveedor';
    document.getElementById('modalFormularioProveedor').classList.remove('hidden');
    document.getElementById('modalFormularioProveedor').classList.add('flex');
}

async function guardarProveedor(event) {
    event.preventDefault();
    const btnGuardar = document.getElementById('btnGuardarProveedor');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Guardando...';

    const id = document.getElementById('formProveedorId').value;
    const data = {
        nombre: document.getElementById('formProveedorNombre').value.trim(),
        telefono: document.getElementById('formProveedorTelefono').value.trim(),
        rfc: document.getElementById('formProveedorRfc').value.trim().toUpperCase(),
        regimen_fiscal: document.getElementById('formProveedorRegimen').value.trim(),
        direccion: document.getElementById('formProveedorDireccion').value.trim(),
        codigo_postal: document.getElementById('formProveedorCP').value.trim()
    };

    try {
        let res;
        if (id) {
            // Update
            res = await fetch(`${window.SUPABASE_URL}/rest/v1/proveedores?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // Insert
            res = await fetch(`${window.SUPABASE_URL}/rest/v1/proveedores`, {
                method: 'POST',
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        if (!res.ok) throw new Error('Error al guardar proveedor');

        cerrarModalNuevoProveedor();
        await cargarProveedores();
        alert('Proveedor guardado exitosamente');

    } catch (e) {
        console.error(e);
        alert('Hubo un error al guardar el proveedor. Inténtalo de nuevo.');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> Guardar';
    }
}

async function eliminarProveedor(id) {
    if (!confirm("¿Estás seguro que deseas eliminar este proveedor? Sus gastos asociados perderán el vínculo.")) return;

    try {
        const res = await fetch(`${window.SUPABASE_URL}/rest/v1/proveedores?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });

        if (!res.ok) throw new Error('Error al eliminar');

        cerrarDetalleProveedor();
        await cargarProveedores();

    } catch (e) {
        console.error(e);
        alert('Hubo un error al eliminar el proveedor.');
    }
}

// =====================================================
// UTILS
// =====================================================
function formatMoneyProv(n) {
    if (n === undefined || n === null) return '$0.00';
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
