// ============================================================
// conteo_inventario.js - Módulo de Conteo Físico de Inventario
// Agrigarden Sistema
// ============================================================

// --- ESTADO GLOBAL ---
let conteosCache = [];
let conteoActivoId = null;
let conteoActivoData = null;
let itemsActivosCache = [];
let chartVolumen = null;
let chartFrecuencia = null;
let itemOriginalParaEdicion = null;

// --- HELPERS ---
const SB_URL = window.SUPABASE_URL;
const SB_KEY = window.SUPABASE_KEY;

function sbFetch(endpoint, opts = {}) {
    const url = `${SB_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
    };
    return fetch(url, { ...opts, headers });
}

function getUsuarioActual() {
    return sessionStorage.getItem('userName') || 'Usuario';
}

function formatFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function formatFechaLarga(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
}

// ============================================================
// 1. CARGAR HISTORIAL DE CONTEOS
// ============================================================
async function cargarConteos() {
    try {
        const res = await sbFetch('conteos_inventario?order=created_at.desc&select=*');
        conteosCache = await res.json();
        actualizarKPIs(conteosCache);
        filtrarConteos();
    } catch (e) {
        console.error('Error cargar conteos:', e);
        document.getElementById('tablaConteosBody').innerHTML =
            `<tr><td colspan="6" class="text-center py-8 text-red-500 font-bold">Error al cargar conteos: ${e.message}</td></tr>`;
    }
}

function actualizarKPIs(datos) {
    document.getElementById('kpiTotal').innerText = datos.length;
    document.getElementById('kpiActivos').innerText = datos.filter(c => c.estado === 'activo').length;
    document.getElementById('kpiCerrados').innerText = datos.filter(c => c.estado === 'cerrado').length;
}

function filtrarConteos() {
    const sucursal = document.getElementById('filtroSucursal').value;
    const estado = document.getElementById('filtroEstado').value;

    const filtrados = conteosCache.filter(c => {
        const coinSuc = (sucursal === 'Todos') || c.sucursal === sucursal;
        const coinEst = (estado === 'Todos') || c.estado === estado;
        return coinSuc && coinEst;
    });
    renderizarTablaConteos(filtrados);
}

function renderizarTablaConteos(datos) {
    const tbody = document.getElementById('tablaConteosBody');
    if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400 italic text-sm">No hay conteos registrados con los filtros seleccionados.</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map(c => {
        const badgeClass = c.estado === 'activo' ? 'badge-activo' : 'badge-cerrado';
        const badgeLabel = c.estado === 'activo' ? 'Activo' : 'Cerrado';
        const iconEstado = c.estado === 'activo' ? 'radio_button_checked' : 'check_circle';

        const btnAccion = c.estado === 'activo'
            ? `<button onclick="continuarConteo('${c.id}')"
                 class="flex items-center gap-1 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-black hover:bg-gray-800 transition-colors">
                 <span class="material-symbols-outlined text-sm">edit_note</span> Continuar
               </button>`
            : '';

        return `
        <tr class="hover:bg-gray-50/50 transition-all border-b border-gray-50">
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase
                    ${c.sucursal === 'Norte' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}">
                    <span class="material-symbols-outlined text-xs">store</span>
                    ${c.sucursal}
                </span>
            </td>
            <td class="px-6 py-4 text-sm font-black text-gray-700 uppercase">${c.nombre_responsable}</td>
            <td class="px-6 py-4 text-xs font-bold text-gray-500">${formatFecha(c.fecha_inicio)}</td>
            <td class="px-6 py-4 text-xs font-bold text-gray-500">${formatFecha(c.fecha_fin)}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${badgeClass}">
                    <span class="material-symbols-outlined text-xs">${iconEstado}</span> ${badgeLabel}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-center gap-2">
                    ${btnAccion}
                    <button onclick="verConteo('${c.id}')"
                        class="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-gray-200 transition-colors">
                        <span class="material-symbols-outlined text-sm">visibility</span> Ver
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================
// 2. NUEVO CONTEO
// ============================================================
function abrirModalNuevoConteo() {
    document.getElementById('nuevoSucursal').value = '';
    document.getElementById('nuevoResponsable').value = '';
    document.getElementById('fechaInicioPreview').innerText =
        new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    abrirModal('modalNuevoConteo');
}

async function crearNuevoConteo(event) {
    event.preventDefault();
    const sucursal = document.getElementById('nuevoSucursal').value;
    const nombre = document.getElementById('nuevoResponsable').value.toUpperCase().trim();

    if (!sucursal || !nombre) return alert('Completa todos los campos.');

    try {
        const payload = {
            sucursal,
            nombre_responsable: nombre,
            estado: 'activo'
        };

        const res = await sbFetch('conteos_inventario', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await res.text());

        const [nuevo] = await res.json();
        cerrarModal('modalNuevoConteo');
        await cargarConteos();
        continuarConteo(nuevo.id);

    } catch (e) {
        console.error('Error crear conteo:', e);
        alert('Error al crear el conteo: ' + e.message);
    }
}

// ============================================================
// 3. CONTEO ACTIVO - CAPTURA DE PRODUCTOS
// ============================================================
async function continuarConteo(id) {
    try {
        // Cargar cabecera
        const resCab = await sbFetch(`conteos_inventario?id=eq.${id}&select=*`);
        const [cab] = await resCab.json();
        conteoActivoId = id;
        conteoActivoData = cab;

        // Actualizar header del modal
        document.getElementById('tituloConteoActivo').innerText =
            `Conteo de Inventario — ${cab.sucursal}`;
        document.getElementById('subtituloConteoActivo').innerText =
            `Responsable: ${cab.nombre_responsable} · Inicio: ${formatFecha(cab.fecha_inicio)}`;

        // Cargar items existentes
        const resItems = await sbFetch(`conteo_items?conteo_id=eq.${id}&order=created_at.asc`);
        itemsActivosCache = await resItems.json();

        // Renderizar tabla de captura
        renderizarTablaCaptura(itemsActivosCache);
        abrirModal('modalConteoActivo');

    } catch (e) {
        console.error('Error continuar conteo:', e);
        alert('Error al cargar el conteo: ' + e.message);
    }
}

function renderizarTablaCaptura(items) {
    const tbody = document.getElementById('tablaCaptura');

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400 italic text-sm">
            Presiona "Agregar Producto" para iniciar la captura</td></tr>`;
        actualizarContadores();
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => agregarFilaProducto(item));
    actualizarContadores();
}

function agregarFilaProducto(data = null) {
    const tbody = document.getElementById('tablaCaptura');

    // Limpiar mensaje vacío si existe
    if (tbody.querySelector('td[colspan="7"]')) tbody.innerHTML = '';

    const tr = document.createElement('tr');
    const rowId = data ? data.id : `new_${Date.now()}`;
    tr.id = `row_${rowId}`;
    tr.className = 'border-b border-gray-100 transition-all fila-neutral';

    const cod = data ? (data.codigo_producto || '') : '';
    const nom = data ? (data.nombre_producto || '') : '';
    const sis = data ? (data.existencias_sistema || 0) : 0;
    const rea = data ? (data.existencias_reales || 0) : 0;
    const tal = data ? (data.existencias_taller || 0) : 0;
    const diff = data ? (data.diferencia || 0) : 0;
    const anot = data ? (data.anotaciones || '') : '';
    const dbId = data ? `data-db-id="${data.id}"` : '';

    const diffColor = diff === 0 ? 'text-green-600' : (diff < 0 ? 'text-red-600' : 'text-orange-600');
    const diffSign = diff > 0 ? '+' : '';

    tr.setAttribute('data-conteo-id', conteoActivoId);
    if (data) tr.setAttribute('data-item-id', data.id);

    tr.innerHTML = `
        <td class="px-4 py-2">
            <input type="text" value="${cod}"
                class="input-conteo row-codigo uppercase" placeholder="CÓDIGO"
                onchange="onCampoChanged(this)">
        </td>
        <td class="px-4 py-2">
            <input type="text" value="${nom}"
                class="input-conteo row-nombre uppercase text-left" placeholder="NOMBRE PRODUCTO"
                style="text-align:left" onchange="onCampoChanged(this)">
        </td>
        <td class="px-4 py-2">
            <input type="number" value="${sis}" step="0.01"
                class="input-conteo row-sistema" placeholder="0"
                oninput="recalcularFila(this)">
        </td>
        <td class="px-4 py-2">
            <input type="number" value="${rea}" step="0.01"
                class="input-conteo row-reales" placeholder="0"
                oninput="recalcularFila(this)">
        </td>
        <td class="px-4 py-2">
            <input type="number" value="${tal}" step="0.01"
                class="input-conteo row-taller" placeholder="0"
                oninput="recalcularFila(this)">
        </td>
        <td class="px-4 py-2 text-center">
            <span class="row-diferencia text-sm font-black ${diffColor}">
                ${diff === 0 ? '0' : diffSign + diff}
            </span>
        </td>
        <td class="px-4 py-2 text-center">
            <button onclick="eliminarFilaLocal(this)"
                class="text-gray-300 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined text-base">delete</span>
            </button>
        </td>
    `;

    // Anotar si hay diferencia pendiente
    if (diff !== 0) {
        tr.classList.remove('fila-neutral');
        tr.classList.add('fila-diff');
    }

    tbody.appendChild(tr);

    // Agregar fila de anotaciones debajo
    const trAnot = document.createElement('tr');
    trAnot.id = `anot_${rowId}`;
    trAnot.className = `${diff !== 0 ? 'anotacion-row visible' : 'anotacion-row'} bg-red-50`;
    trAnot.innerHTML = `
        <td colspan="7" class="px-4 pb-3">
            <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-red-400 text-sm mt-2 flex-shrink-0">edit_note</span>
                <textarea class="row-anotaciones w-full bg-white border border-red-200 rounded-lg px-3 py-2
                    text-xs font-bold text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
                    rows="2" placeholder="Describe el motivo del faltante o sobrante..."
                    onchange="onCampoChanged(this)">${anot}</textarea>
            </div>
        </td>
    `;
    tbody.appendChild(trAnot);

    actualizarContadores();
}

function recalcularFila(input) {
    const tr = input.closest('tr');
    const sis = parseFloat(tr.querySelector('.row-sistema').value) || 0;
    const rea = parseFloat(tr.querySelector('.row-reales').value) || 0;
    const diff = rea - sis;

    const spanDiff = tr.querySelector('.row-diferencia');
    const diffSign = diff > 0 ? '+' : '';
    spanDiff.innerText = diff === 0 ? '0' : diffSign + diff.toFixed(2);

    // Semáforo
    tr.classList.remove('fila-ok', 'fila-diff', 'fila-neutral');
    if (diff === 0) {
        tr.classList.add('fila-ok');
        spanDiff.className = 'row-diferencia text-sm font-black text-green-600';
    } else {
        tr.classList.add('fila-diff');
        spanDiff.className = 'row-diferencia text-sm font-black ' + (diff < 0 ? 'text-red-600' : 'text-orange-600');
    }

    // Mostrar/ocultar fila de anotaciones
    const rowId = tr.id.replace('row_', '');
    const anotRow = document.getElementById(`anot_${rowId}`);
    if (anotRow) {
        if (diff !== 0) {
            anotRow.classList.add('visible');
        } else {
            anotRow.classList.remove('visible');
        }
    }

    actualizarContadores();
    onCampoChanged(input); // marcar como modificado (no guardado)
}

function onCampoChanged(input) {
    // Marcar fila como "pendiente de guardar"
    const tr = input.closest('tr');
    if (tr) tr.setAttribute('data-dirty', 'true');
}

function eliminarFilaLocal(btn) {
    const tr = btn.closest('tr');
    const rowId = tr.id.replace('row_', '');
    const anotRow = document.getElementById(`anot_${rowId}`);
    if (anotRow) anotRow.remove();
    tr.remove();
    actualizarContadores();
}

function actualizarContadores() {
    const filas = document.querySelectorAll('#tablaCaptura tr[id^="row_"]');
    const totalOk = Array.from(filas).filter(r => r.classList.contains('fila-ok')).length;
    const totalDiff = Array.from(filas).filter(r => r.classList.contains('fila-diff')).length;

    document.getElementById('contadorProductos').innerText = filas.length;
    document.getElementById('totalOk').innerText = totalOk;
    document.getElementById('totalDiff').innerText = totalDiff;

    // Actualizar KPI diffs
    document.getElementById('kpiDiffs').innerText = totalDiff;
}

// ============================================================
// 4. GUARDAR AVANCE DE CONTEO
// ============================================================
async function guardarConteoCompleto() {
    if (!conteoActivoId) return;

    const filas = document.querySelectorAll('#tablaCaptura tr[id^="row_"]');
    if (!filas.length) { alert('Agrega al menos un producto.'); return; }

    const btn = document.querySelector('[onclick="guardarConteoCompleto()"]');
    if (btn) { btn.disabled = true; btn.innerText = 'Guardando...'; }

    try {
        const promises = [];

        for (const tr of filas) {
            const codigo = tr.querySelector('.row-codigo').value.trim().toUpperCase();
            const nombre = tr.querySelector('.row-nombre').value.trim().toUpperCase();
            if (!nombre) continue;

            const rowId = tr.id.replace('row_', '');
            const anotRow = document.getElementById(`anot_${rowId}`);
            const anotaciones = anotRow ? (anotRow.querySelector('.row-anotaciones')?.value || '') : '';

            const payload = {
                conteo_id: conteoActivoId,
                codigo_producto: codigo,
                nombre_producto: nombre,
                existencias_sistema: parseFloat(tr.querySelector('.row-sistema').value) || 0,
                existencias_reales: parseFloat(tr.querySelector('.row-reales').value) || 0,
                existencias_taller: parseFloat(tr.querySelector('.row-taller').value) || 0,
                anotaciones: anotaciones || null
            };

            const dbId = tr.getAttribute('data-item-id');

            if (dbId && !dbId.startsWith('new_')) {
                // UPDATE
                promises.push(sbFetch(`conteo_items?id=eq.${dbId}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify(payload)
                }));
            } else {
                // INSERT
                promises.push(sbFetch('conteo_items', {
                    method: 'POST',
                    headers: { 'Prefer': 'return=representation' },
                    body: JSON.stringify(payload)
                }).then(async r => {
                    if (r.ok) {
                        const [item] = await r.json();
                        tr.setAttribute('data-item-id', item.id);
                        // Actualizar ID de fila de anotaciones
                        const oldAnotId = `anot_${rowId}`;
                        const newAnotId = `anot_${item.id}`;
                        const anotEl = document.getElementById(oldAnotId);
                        if (anotEl) anotEl.id = newAnotId;
                        tr.id = `row_${item.id}`;
                    }
                }));
            }
            tr.removeAttribute('data-dirty');
        }

        await Promise.all(promises);
        mostrarToast('✓ Avance guardado correctamente');

    } catch (e) {
        console.error('Error guardar:', e);
        alert('Error al guardar: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-base">save</span> Guardar Avance'; }
    }
}

// ============================================================
// 5. CIERRE DE CONTEO
// ============================================================
function abrirModalCierre() {
    document.getElementById('nombreCierre').value = '';
    document.getElementById('comentariosCierre').value = '';
    document.getElementById('fechaTerminoPreview').innerText =
        new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    abrirModal('modalCierre');
}

async function confirmarCierre(event) {
    event.preventDefault();
    const nombre = document.getElementById('nombreCierre').value.toUpperCase().trim();
    const comentarios = document.getElementById('comentariosCierre').value.trim();

    if (!nombre) { alert('Ingresa el nombre de quien finaliza.'); return; }

    // Primero guardar avance pendiente
    await guardarConteoCompleto();

    try {
        const payload = {
            estado: 'cerrado',
            nombre_cierre: nombre,
            comentarios_cierre: comentarios || null,
            fecha_fin: new Date().toISOString()
        };

        const res = await sbFetch(`conteos_inventario?id=eq.${conteoActivoId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await res.text());

        // Registrar en bitácora
        await sbFetch('conteo_bitacora', {
            method: 'POST',
            body: JSON.stringify({
                conteo_id: conteoActivoId,
                tipo_operacion: 'cierre_conteo',
                campo_modificado: 'estado',
                valor_anterior: 'activo',
                valor_nuevo: 'cerrado',
                modificado_por: nombre
            })
        });

        cerrarModal('modalCierre');
        cerrarModal('modalConteoActivo');
        await cargarConteos();
        mostrarToast('✓ Conteo finalizado y guardado correctamente');

    } catch (e) {
        console.error('Error cierre:', e);
        alert('Error al cerrar el conteo: ' + e.message);
    }
}

// ============================================================
// 6. VER CONTEO (solo lectura + bitácora)
// ============================================================
async function verConteo(id) {
    try {
        const [resCab, resItems, resBit] = await Promise.all([
            sbFetch(`conteos_inventario?id=eq.${id}&select=*`),
            sbFetch(`conteo_items?conteo_id=eq.${id}&order=created_at.asc`),
            sbFetch(`conteo_bitacora?conteo_id=eq.${id}&order=fecha.desc`)
        ]);

        const [cab] = await resCab.json();
        const items = await resItems.json();
        const bitac = await resBit.json();

        // Header
        document.getElementById('verConteoTitulo').innerText =
            `Conteo — ${cab.sucursal}`;
        document.getElementById('verConteoSubtitulo').innerText =
            cab.estado === 'cerrado' ? `Cerrado · ${formatFecha(cab.fecha_fin)}` : 'En proceso';
        document.getElementById('verSucursal').innerText = cab.sucursal;
        document.getElementById('verResponsable').innerText = cab.nombre_responsable;
        document.getElementById('verFechaInicio').innerText = formatFechaLarga(cab.fecha_inicio);
        document.getElementById('verFechaFin').innerText = formatFechaLarga(cab.fecha_fin);

        // Tabla productos
        const tbodyItems = document.getElementById('verTablaItems');
        tbodyItems.innerHTML = items.map(item => {
            const diff = item.diferencia ?? (item.existencias_reales - item.existencias_sistema);
            const rowClass = diff === 0 ? 'bg-green-50' : 'bg-red-50';
            const diffColor = diff === 0 ? 'text-green-600' : (diff < 0 ? 'text-red-600' : 'text-orange-600');
            const diffSign = diff > 0 ? '+' : '';
            return `
            <tr class="${rowClass} border-b border-white/60">
                <td class="px-5 py-3 text-xs font-mono text-gray-600">${item.codigo_producto || '—'}</td>
                <td class="px-5 py-3 text-xs font-black text-gray-800 uppercase">${item.nombre_producto}</td>
                <td class="px-5 py-3 text-center text-xs font-bold">${item.existencias_sistema}</td>
                <td class="px-5 py-3 text-center text-xs font-bold">${item.existencias_reales}</td>
                <td class="px-5 py-3 text-center text-xs font-bold">${item.existencias_taller}</td>
                <td class="px-5 py-3 text-center text-sm font-black ${diffColor}">
                    ${diff === 0 ? '0' : diffSign + parseFloat(diff).toFixed(2)}
                </td>
                <td class="px-5 py-3 text-xs text-gray-500 italic max-w-[200px]">
                    ${item.anotaciones || (diff === 0 ? '' : '<span class="text-red-400 font-bold">Sin anotación</span>')}
                </td>
                <td class="px-5 py-3 text-center">
                    <button onclick="abrirEditarItemDesdeVer(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${id}')"
                        class="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                </td>
            </tr>`;
        }).join('') || `<tr><td colspan="8" class="text-center py-8 text-gray-400 italic text-sm">Sin productos registrados.</td></tr>`;

        // Tabla bitácora
        const tbodyBit = document.getElementById('verTablaBitacora');
        tbodyBit.innerHTML = bitac.map(b => `
            <tr class="border-b border-gray-50 hover:bg-gray-50/50">
                <td class="px-5 py-3 text-xs text-gray-500">${formatFecha(b.fecha)}</td>
                <td class="px-5 py-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-100 text-gray-600">${b.tipo_operacion}</span>
                </td>
                <td class="px-5 py-3 text-xs font-bold text-gray-600">${b.campo_modificado || '—'}</td>
                <td class="px-5 py-3 text-xs text-red-500 font-bold">${b.valor_anterior || '—'}</td>
                <td class="px-5 py-3 text-xs text-green-600 font-bold">${b.valor_nuevo || '—'}</td>
                <td class="px-5 py-3 text-xs font-black text-gray-700 uppercase">${b.modificado_por}</td>
            </tr>
        `).join('') || `<tr><td colspan="6" class="text-center py-8 text-gray-400 italic text-sm">Sin modificaciones registradas.</td></tr>`;

        // Comentarios cierre
        const divCom = document.getElementById('verComentariosCierre');
        if (cab.comentarios_cierre) {
            divCom.classList.remove('hidden');
            document.getElementById('verNombreCierre').innerText = cab.nombre_cierre || '';
            document.getElementById('verComentarios').innerText = cab.comentarios_cierre;
        } else {
            divCom.classList.add('hidden');
        }

        cambiarTabDetalle('productos');
        abrirModal('modalVerConteo');

    } catch (e) {
        console.error('Error ver conteo:', e);
        alert('Error al cargar el detalle: ' + e.message);
    }
}

function cambiarTabDetalle(tab) {
    document.getElementById('tabVerProductos').classList.toggle('hidden', tab !== 'productos');
    document.getElementById('tabVerBitacora').classList.toggle('hidden', tab !== 'bitacora');
    document.getElementById('tabDetProd').className = `text-xs font-black uppercase px-4 py-2 rounded-lg ${tab === 'productos' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`;
    document.getElementById('tabDetBit').className = `text-xs font-black uppercase px-4 py-2 rounded-lg ${tab === 'bitacora' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`;
}

// ============================================================
// 7. EDITAR ITEM (con bitácora)
// ============================================================
function abrirEditarItemDesdeVer(item, conteoId) {
    itemOriginalParaEdicion = { ...item };

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editConteoId').value = conteoId;
    document.getElementById('editCodigo').value = item.codigo_producto || '';
    document.getElementById('editNombre').value = item.nombre_producto || '';
    document.getElementById('editSistema').value = item.existencias_sistema || 0;
    document.getElementById('editReales').value = item.existencias_reales || 0;
    document.getElementById('editTaller').value = item.existencias_taller || 0;
    document.getElementById('editAnotaciones').value = item.anotaciones || '';

    abrirModal('modalEditarItem');
}

async function guardarEdicionItem() {
    const itemId = document.getElementById('editItemId').value;
    const conteoId = document.getElementById('editConteoId').value;
    const usuario = getUsuarioActual();

    const nuevo = {
        codigo_producto: document.getElementById('editCodigo').value.toUpperCase().trim(),
        nombre_producto: document.getElementById('editNombre').value.toUpperCase().trim(),
        existencias_sistema: parseFloat(document.getElementById('editSistema').value) || 0,
        existencias_reales: parseFloat(document.getElementById('editReales').value) || 0,
        existencias_taller: parseFloat(document.getElementById('editTaller').value) || 0,
        anotaciones: document.getElementById('editAnotaciones').value.trim() || null
    };

    if (!nuevo.nombre_producto) { alert('El nombre del producto es requerido.'); return; }

    try {
        // UPDATE item
        const res = await sbFetch(`conteo_items?id=eq.${itemId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(nuevo)
        });
        if (!res.ok) throw new Error(await res.text());

        // Registrar en bitácora cada campo que cambió
        const campos = [
            { key: 'codigo_producto', label: 'Código' },
            { key: 'nombre_producto', label: 'Nombre' },
            { key: 'existencias_sistema', label: 'Exist. Sistema' },
            { key: 'existencias_reales', label: 'Exist. Reales' },
            { key: 'existencias_taller', label: 'Exist. Taller' },
            { key: 'anotaciones', label: 'Anotaciones' }
        ];

        const bitacoraPromises = campos.map(campo => {
            const anterior = String(itemOriginalParaEdicion[campo.key] ?? '');
            const nuevVal = String(nuevo[campo.key] ?? '');
            if (anterior === nuevVal) return Promise.resolve();

            return sbFetch('conteo_bitacora', {
                method: 'POST',
                body: JSON.stringify({
                    conteo_id: conteoId,
                    item_id: itemId,
                    tipo_operacion: 'edicion_item',
                    campo_modificado: campo.label,
                    valor_anterior: anterior,
                    valor_nuevo: nuevVal,
                    modificado_por: usuario
                })
            });
        });

        await Promise.all(bitacoraPromises);

        cerrarModal('modalEditarItem');
        mostrarToast('✓ Cambios guardados y registrados en bitácora');

        // Refrescar vista
        await verConteo(conteoId);

    } catch (e) {
        console.error('Error editar item:', e);
        alert('Error al guardar cambios: ' + e.message);
    }
}

// ============================================================
// 8. TENDENCIAS
// ============================================================
async function cargarTendencias() {
    const sucFiltro = document.getElementById('filtroTendSucursal').value;

    document.getElementById('tablaTendenciasBody').innerHTML =
        `<tr><td colspan="7" class="text-center py-8 text-gray-400 italic text-sm animate-pulse">Analizando datos...</td></tr>`;

    try {
        let endpoint = 'v_tendencias_faltantes?order=volumen_total_diferencia.desc&limit=30';
        if (sucFiltro !== 'Todos') endpoint += `&sucursal=eq.${sucFiltro}`;

        const res = await sbFetch(endpoint);
        const datos = await res.json();

        renderizarTablaTendencias(datos);
        renderizarCharts(datos);

    } catch (e) {
        console.error('Error tendencias:', e);
        document.getElementById('tablaTendenciasBody').innerHTML =
            `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold">Error: ${e.message}</td></tr>`;
    }
}

function renderizarTablaTendencias(datos) {
    const tbody = document.getElementById('tablaTendenciasBody');

    if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400 italic text-sm">No hay suficientes datos de conteos para mostrar tendencias.</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map((d, i) => {
        const volAbsoluto = Math.abs(parseFloat(d.volumen_total_diferencia) || 0);
        const promedio = parseFloat(d.promedio_diferencia || 0).toFixed(2);
        const frecClass = d.veces_con_diferencia >= 3 ? 'text-red-600' : (d.veces_con_diferencia === 2 ? 'text-orange-500' : 'text-yellow-600');
        const rankBadge = i < 3
            ? `<span class="inline-flex items-center justify-center size-5 rounded-full text-[10px] font-black
                ${i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : 'bg-yellow-400 text-black'}">${i + 1}</span>`
            : `<span class="text-xs font-bold text-gray-400">${i + 1}</span>`;

        return `
        <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-all">
            <td class="px-5 py-3 text-center">${rankBadge}</td>
            <td class="px-5 py-3 text-xs font-mono text-gray-500">${d.codigo_producto || '—'}</td>
            <td class="px-5 py-3 text-xs font-black text-gray-800 uppercase">${d.nombre_producto}</td>
            <td class="px-5 py-3 text-center">
                <span class="text-[11px] font-black px-2 py-0.5 rounded-full
                    ${d.sucursal === 'Norte' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}">
                    ${d.sucursal}
                </span>
            </td>
            <td class="px-5 py-3 text-center text-xs font-black ${frecClass}">${d.veces_con_diferencia}</td>
            <td class="px-5 py-3 text-center text-sm font-black text-red-600">${volAbsoluto.toFixed(2)}</td>
            <td class="px-5 py-3 text-center text-xs font-bold text-gray-600">${promedio}</td>
            <td class="px-5 py-3 text-center text-xs font-bold text-gray-500">${d.meses_afectados}</td>
        </tr>`;
    }).join('');
}

function renderizarCharts(datos) {
    const top10Vol = datos.slice(0, 10);
    const top10Frec = [...datos].sort((a, b) => b.veces_con_diferencia - a.veces_con_diferencia).slice(0, 10);

    const labels1 = top10Vol.map(d => (d.nombre_producto.length > 20 ? d.nombre_producto.slice(0, 18) + '…' : d.nombre_producto));
    const vals1 = top10Vol.map(d => Math.abs(parseFloat(d.volumen_total_diferencia) || 0));

    const labels2 = top10Frec.map(d => (d.nombre_producto.length > 20 ? d.nombre_producto.slice(0, 18) + '…' : d.nombre_producto));
    const vals2 = top10Frec.map(d => parseInt(d.veces_con_diferencia) || 0);

    // Destruir charts previos
    if (chartVolumen) { chartVolumen.destroy(); chartVolumen = null; }
    if (chartFrecuencia) { chartFrecuencia.destroy(); chartFrecuencia = null; }

    const optBase = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.parsed.x ?? ctx.parsed.y}` } }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10, weight: '700' } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
        }
    };

    const ctx1 = document.getElementById('chartVolumen').getContext('2d');
    chartVolumen = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels1,
            datasets: [{
                data: vals1,
                backgroundColor: vals1.map((_, i) => `rgba(239,68,68,${0.9 - i * 0.07})`),
                borderRadius: 8
            }]
        },
        options: { ...optBase }
    });

    const ctx2 = document.getElementById('chartFrecuencia').getContext('2d');
    chartFrecuencia = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels2,
            datasets: [{
                data: vals2,
                backgroundColor: vals2.map((_, i) => `rgba(249,115,22,${0.9 - i * 0.07})`),
                borderRadius: 8
            }]
        },
        options: { ...optBase }
    });
}

// ============================================================
// 9. NAVEGACIÓN DE TABS (Historial / Tendencias)
// ============================================================
let tabActual = 'historial';

function cambiarTab(tab) {
    tabActual = tab;
    document.getElementById('vistaHistorial').classList.toggle('hidden', tab !== 'historial');
    document.getElementById('vistaTendencias').classList.toggle('hidden', tab !== 'tendencias');

    document.getElementById('tabHistorial').classList.toggle('active', tab === 'historial');
    document.getElementById('tabTendencias').classList.toggle('active', tab === 'tendencias');

    if (tab === 'tendencias') cargarTendencias();
}

// ============================================================
// 10. HELPERS DE MODAL
// ============================================================
function abrirModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('visible'), 10);
}

function cerrarModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('hidden'), 250);
}

// Cerrar modal al hacer clic en el overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('visible');
        setTimeout(() => e.target.classList.add('hidden'), 250);
    }
});

// ============================================================
// 11. TOAST DE CONFIRMACIÓN
// ============================================================
function mostrarToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.cssText = `
            position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
            background:#18181b; color:white; padding:12px 24px; border-radius:12px;
            font-size:13px; font-weight:800; z-index:9999; box-shadow:0 8px 30px rgba(0,0,0,0.2);
            opacity:0; transition:opacity 0.3s; pointer-events:none;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', 3000);
}
