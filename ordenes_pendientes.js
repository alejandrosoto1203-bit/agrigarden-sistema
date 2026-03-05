// ordenes_pendientes.js - Módulo de Órdenes Pendientes (Atender + Cotizar)

// =====================================================
// ESTADO
// =====================================================
let ordenesPendientes = [];
let ordenActual = null;
let itemsOrden = [];
let productosCache = [];
let filaIdCounter = 0;

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function inicializarPendientes() {
    await cargarProductosCache();
    await cargarOrdenesPendientes();

    // Si viene con ?id= abrir directo
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
        await abrirDetalle(parseInt(idParam));
    }

    // Cerrar dropdowns al clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sku-input') && !e.target.closest('.sku-dropdown')) {
            document.querySelectorAll('.sku-dropdown').forEach(d => d.classList.add('hidden'));
        }
    });
}

// =====================================================
// CARGAR PRODUCTOS (para SKU autocomplete)
// =====================================================
async function cargarProductosCache() {
    try {
        let all = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const res = await fetch(
                `${window.SUPABASE_URL}/rest/v1/productos?select=id,sku,nombre,precio_publico,iva_porcentaje,aplica_impuestos&activo=not.is.false&order=nombre.asc&limit=${limit}&offset=${offset}`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
            );
            const batch = await res.json();
            all = all.concat(batch);
            hasMore = batch.length >= limit;
            offset += limit;
        }
        productosCache = all;
    } catch (e) { console.error('Error cargando productos:', e); }
}

// =====================================================
// CARGAR ÓRDENES PENDIENTES
// =====================================================
async function cargarOrdenesPendientes() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?estatus=in.(PENDIENTE,COTIZACION_ENVIADA,EN_PROCESO)&select=*&order=created_at.desc`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        ordenesPendientes = await res.json();
        actualizarKPIsPendientes();
        renderizarLista();
    } catch (e) { console.error(e); }
}

function renderizarLista() {
    const contenedor = document.getElementById('listaOrdenes');

    if (!ordenesPendientes.length) {
        contenedor.innerHTML = '<div class="text-center py-16"><span class="material-symbols-outlined text-5xl text-slate-200">inbox</span><p class="text-slate-400 font-bold mt-2">No hay órdenes pendientes</p></div>';
        return;
    }

    const esAdmin = sessionStorage.getItem('userRole') === 'admin';

    contenedor.innerHTML = ordenesPendientes.map(o => {
        const fecha = new Date(o.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
        const estilos = {
            'PENDIENTE': 'bg-yellow-100 text-yellow-700',
            'COTIZACION_ENVIADA': 'bg-blue-100 text-blue-700',
            'EN_PROCESO': 'bg-orange-100 text-orange-700'
        };
        const labels = { 'PENDIENTE': 'Pendiente', 'COTIZACION_ENVIADA': 'Cotización', 'EN_PROCESO': 'En Proceso' };

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-lg font-black text-primary">${o.folio}</span>
                        <span class="estatus-badge ${estilos[o.estatus] || ''}">${labels[o.estatus] || o.estatus}</span>
                    </div>
                    <p class="text-sm font-bold text-slate-700">${o.cliente_nombre}</p>
                    <p class="text-xs text-slate-400 mt-1">${o.equipo} — ${o.marca_modelo}</p>
                </div>
                <div class="flex items-center gap-6 w-full lg:w-auto mt-2 lg:mt-0 justify-between lg:justify-end">
                    <div class="text-right hidden sm:block">
                        <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-tight">Mecánico</p>
                        <p class="text-sm font-bold text-slate-700 leading-tight">${o.mecanico || 'Sin Asignar'}</p>
                        <p class="text-[10px] text-slate-400 mt-1">${fecha}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="abrirDetalle(${o.id})"
                            class="px-6 py-3 ${o.estatus === 'PENDIENTE' ? 'bg-primary text-black' : 'bg-slate-100 text-slate-600'} rounded-xl text-xs font-black uppercase hover:scale-[1.02] transition-all flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">${o.estatus === 'PENDIENTE' ? 'build' : 'edit'}</span>
                            ${o.estatus === 'PENDIENTE' ? 'Atender' : 'Ver / Editar'}
                        </button>
                        ${esAdmin ? `
                        <button onclick="eliminarOrdenDesdeModulo(${o.id}, '${o.folio}', '${o.estatus}')" title="Eliminar orden"
                            class="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarKPIsPendientes() {
    document.getElementById('kpiTotalOrdenes').textContent = ordenesPendientes.length;
    document.getElementById('kpiPendientes').textContent = ordenesPendientes.filter(o => o.estatus === 'PENDIENTE').length;
    document.getElementById('kpiCotizadas').textContent = ordenesPendientes.filter(o => o.estatus === 'COTIZACION_ENVIADA').length;
    document.getElementById('kpiEnProceso').textContent = ordenesPendientes.filter(o => o.estatus === 'EN_PROCESO').length;

    if (ordenesPendientes.length > 0) {
        const ordenadas = [...ordenesPendientes].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const masAntigua = ordenadas[0];
        document.getElementById('kpiOrdenAntigua').innerHTML = `
            <span class="text-primary text-lg">${masAntigua.folio}</span> <span class="text-slate-400 text-xs ml-1">— ${new Date(masAntigua.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <br><span class="text-[11px] font-bold text-slate-500 mt-1 block">${masAntigua.equipo} (${masAntigua.mecanico || 'Sin Asignar'})</span>
        `;
    } else {
        document.getElementById('kpiOrdenAntigua').innerHTML = '<span class="italic font-normal text-slate-400">Sin órdenes</span>';
    }

    const mecanicos = {};
    ordenesPendientes.forEach(o => {
        const mec = o.mecanico || 'Sin Asignar';
        mecanicos[mec] = (mecanicos[mec] || 0) + 1;
    });

    const mContainer = document.getElementById('kpiMecanicos');
    const mecanicosArr = Object.entries(mecanicos).sort((a, b) => b[1] - a[1]);

    if (mecanicosArr.length > 0) {
        mContainer.innerHTML = mecanicosArr.map(([mec, count]) => `
            <div class="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-grow lg:flex-grow-0">
                <span class="text-slate-600 font-black">${mec}</span>
                <span class="bg-white text-primary px-2 py-0.5 rounded font-black text-xs shadow-sm">${count}</span>
            </div>
        `).join('');
    } else {
        mContainer.innerHTML = '<span class="italic font-normal text-slate-400 text-sm">Sin asignaciones</span>';
    }
}

// =====================================================
// ABRIR DETALLE DE ORDEN
// =====================================================
async function abrirDetalle(id) {
    // Buscar en cache o cargar
    ordenActual = ordenesPendientes.find(o => o.id === id);
    if (!ordenActual) {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${id}&select=*`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        const data = await res.json();
        ordenActual = data[0];
    }
    if (!ordenActual) return alert('Orden no encontrada.');

    // Llenar info
    document.getElementById('detFolio').textContent = ordenActual.folio;
    document.getElementById('detCliente').textContent = ordenActual.cliente_nombre;
    document.getElementById('detTelefono').textContent = ordenActual.cliente_telefono || '';
    document.getElementById('detEquipo').textContent = `${ordenActual.equipo} — ${ordenActual.marca_modelo}`;
    document.getElementById('detMecanico').textContent = `Mecánico: ${ordenActual.mecanico}`;
    document.getElementById('detObservaciones').textContent = ordenActual.observaciones || '—';
    document.getElementById('detFecha').textContent = new Date(ordenActual.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('inputNotasRevision').value = ordenActual.notas_revision || '';

    // Badge estatus
    const estilos = { 'PENDIENTE': 'bg-yellow-100 text-yellow-700', 'COTIZACION_ENVIADA': 'bg-blue-100 text-blue-700', 'EN_PROCESO': 'bg-orange-100 text-orange-700' };
    const labels = { 'PENDIENTE': 'Pendiente', 'COTIZACION_ENVIADA': 'Cotización Enviada', 'EN_PROCESO': 'En Proceso' };
    const det = document.getElementById('detEstatus');
    det.className = `estatus-badge ${estilos[ordenActual.estatus] || ''}`;
    det.textContent = labels[ordenActual.estatus] || ordenActual.estatus;

    // Cargar items
    await cargarItemsOrden();

    // Mostrar/ocultar botones según estatus
    const btnAceptada = document.getElementById('btnAceptada');
    const btnMarcarTerminada = document.getElementById('btnMarcarTerminada');
    if (ordenActual.estatus === 'EN_PROCESO') {
        btnAceptada.classList.add('hidden');
        btnMarcarTerminada.classList.remove('hidden');
    } else {
        btnAceptada.classList.remove('hidden');
        btnMarcarTerminada.classList.add('hidden');
    }

    // Cambiar vista
    document.getElementById('listaOrdenes').classList.add('hidden');
    document.getElementById('detalleOrden').classList.remove('hidden');
}

function volverALista() {
    document.getElementById('detalleOrden').classList.add('hidden');
    document.getElementById('listaOrdenes').classList.remove('hidden');
    ordenActual = null;
    cargarOrdenesPendientes();
}

// =====================================================
// ITEMS DE LA ORDEN
// =====================================================
async function cargarItemsOrden() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenActual.id}&select=*&order=id.asc`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        itemsOrden = await res.json();

        // Hidratar precio_original para calcular descuentos visuales
        itemsOrden.forEach(i => {
            if (i.producto_id) {
                const prod = productosCache.find(p => p.id === i.producto_id);
                if (prod) i.precio_original = prod.precio_publico || 0;
            }
        });

    } catch (e) { itemsOrden = []; }

    if (itemsOrden.length === 0) {
        itemsOrden = [crearItemVacio()];
    }

    renderizarItems();
}

function crearItemVacio() {
    filaIdCounter++;
    return { _filaId: filaIdCounter, id: null, producto_id: null, cantidad: 1, sku: '', descripcion: '', precio_unitario: 0, precio_sin_iva: 0, precio_con_iva: 0 };
}

function agregarFila() {
    itemsOrden.push(crearItemVacio());
    renderizarItems();
}

function eliminarFila(filaId) {
    itemsOrden = itemsOrden.filter(i => (i._filaId || i.id) !== filaId);
    if (itemsOrden.length === 0) itemsOrden.push(crearItemVacio());
    renderizarItems();
}

function renderizarItems() {
    const tbody = document.getElementById('bodyItems');

    tbody.innerHTML = itemsOrden.map((item, idx) => {
        const key = item._filaId || item.id;

        let htmlDescuento = '';
        const descLower = (item.descripcion || '').toLowerCase();
        const noAplicaDescuento = descLower.includes('mano de obra') || descLower.includes('servicio');

        if (item.precio_original && parseFloat(item.precio_unitario) < parseFloat(item.precio_original) && !noAplicaDescuento) {
            const pct = ((1 - (item.precio_unitario / item.precio_original)) * 100).toFixed(1);
            htmlDescuento = `<p class="text-[9px] font-black text-red-500 uppercase mt-0.5">Desc: ${pct}%</p>`;
        }

        return `
            <tr class="border-b border-slate-50" data-fila="${key}">
                <td class="px-3 py-2">
                    <input type="number" value="${item.cantidad}" min="1" step="0.1"
                        onchange="actualizarItemCantidad('${key}', this.value)"
                        class="w-16 text-center font-bold border border-slate-200 rounded-lg py-1 focus:border-primary focus:outline-none">
                </td>
                <td class="px-3 py-2 relative">
                    <input type="text" value="${item.sku || ''}" placeholder="SKU..."
                        oninput="buscarSKU('${key}', this.value)" onfocus="buscarSKU('${key}', this.value)"
                        class="sku-input input-form text-xs py-2 px-3" data-fila="${key}">
                    <div id="skuDrop_${key}" class="sku-dropdown autocomplete-dropdown hidden w-[400px]"></div>
                </td>
                <td class="px-3 py-2">
                    <input type="text" value="${item.descripcion || ''}" id="desc_${key}"
                        class="input-form text-xs py-2 px-3" readonly>
                </td>
                <td class="px-3 py-2 text-right">
                    <input type="number" step="0.01" min="0" value="${item.precio_unitario || 0}"
                        onchange="actualizarItemPrecio('${key}', this.value)"
                        class="w-24 text-right font-bold border border-slate-200 rounded-lg py-1 px-2 focus:border-primary focus:outline-none">
                    ${htmlDescuento}
                </td>
                <td class="px-3 py-2 text-right font-black text-sm text-primary" id="conIva_${key}">
                    $${(item.precio_con_iva || 0).toFixed(2)}
                </td>
                <td class="px-3 py-2 text-center">
                    <button onclick="eliminarFila('${key}')" class="p-1 text-slate-300 hover:text-red-500 transition-all">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    calcularTotal();
}

// =====================================================
// SKU AUTOCOMPLETE
// =====================================================
function buscarSKU(filaId, query) {
    const dropdown = document.getElementById(`skuDrop_${filaId}`);
    const q = query.toLowerCase().trim();

    if (q.length < 1) { dropdown.classList.add('hidden'); return; }

    const resultados = productosCache
        .filter(p => p.sku?.toLowerCase().includes(q) || p.nombre?.toLowerCase().includes(q))
        .slice(0, 10);

    if (resultados.length === 0) {
        dropdown.innerHTML = '<div class="py-3 text-center text-slate-400 text-xs italic">Sin resultados</div>';
    } else {
        dropdown.innerHTML = resultados.map(p => `
            <div class="autocomplete-item" onclick="seleccionarProductoItem('${filaId}', ${p.id})">
                <div class="flex-1">
                    <p class="text-[11px] font-black text-slate-800 leading-tight">${p.nombre}</p>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">${p.sku || 'N/A'}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-black text-primary">$${(p.precio_publico || 0).toFixed(2)}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Stock: ${p.stock_norte + p.stock_sur + (p.stock_taller || 0)}</p>
                </div>
            </div>
        `).join('');
    }
    dropdown.classList.remove('hidden');
}

function seleccionarProductoItem(filaId, productoId) {
    const producto = productosCache.find(p => p.id === productoId);
    if (!producto) return;

    const item = itemsOrden.find(i => String(i._filaId || i.id) === String(filaId));
    if (!item) return;

    const precioConIva = producto.precio_publico || 0;
    const ivaPct = producto.aplica_impuestos !== false ? (producto.iva_porcentaje || 16) : 0;
    const ivaReal = ivaPct < 1 ? ivaPct : ivaPct / 100;
    const precioSinIva = precioConIva / (1 + ivaReal);

    item.producto_id = producto.id;
    item.sku = producto.sku || '';
    item.descripcion = producto.nombre;
    item.precio_original = precioConIva;
    item.precio_unitario = precioConIva;
    item.precio_sin_iva = precioSinIva * item.cantidad;
    item.precio_con_iva = precioConIva * item.cantidad;

    document.getElementById(`skuDrop_${filaId}`).classList.add('hidden');
    renderizarItems();
}

function actualizarItemCantidad(filaId, valor) {
    const item = itemsOrden.find(i => String(i._filaId || i.id) === String(filaId));
    if (!item) return;

    item.cantidad = Math.max(0.1, parseFloat(valor) || 1);

    if (item.precio_unitario) {
        const ivaPct = item.producto_id ? (() => {
            const p = productosCache.find(pr => pr.id === item.producto_id);
            const raw = p?.aplica_impuestos !== false ? (p?.iva_porcentaje || 16) : 0;
            return raw < 1 ? raw : raw / 100;
        })() : 0.16;

        item.precio_con_iva = item.precio_unitario * item.cantidad;
        item.precio_sin_iva = (item.precio_unitario / (1 + ivaPct)) * item.cantidad;
    }

    renderizarItems();
}

function actualizarItemPrecio(filaId, valor) {
    const item = itemsOrden.find(i => String(i._filaId || i.id) === String(filaId));
    if (!item) return;

    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) valor = 0;

    item.precio_unitario = valor;

    const ivaPct = item.producto_id ? (() => {
        const p = productosCache.find(pr => pr.id === item.producto_id);
        const raw = p?.aplica_impuestos !== false ? (p?.iva_porcentaje || 16) : 0;
        return raw < 1 ? raw : raw / 100;
    })() : 0.16;

    const precioSinIva = valor / (1 + ivaPct);

    item.precio_sin_iva = precioSinIva * item.cantidad;
    item.precio_con_iva = valor * item.cantidad;

    renderizarItems();
}

function calcularTotal() {
    const total = itemsOrden.reduce((s, i) => s + (i.precio_con_iva || 0), 0);
    document.getElementById('totalGeneral').textContent = `$${total.toFixed(2)}`;
}

// =====================================================
// GUARDAR COTIZACIÓN
// =====================================================
async function guardarCotizacion() {
    if (!ordenActual) return;

    const notas = document.getElementById('inputNotasRevision').value.trim().toUpperCase();
    const btn = document.getElementById('btnGuardarCotizacion');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span> Guardando...';

    try {
        // 1. Eliminar items anteriores
        await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenActual.id}`,
            {
                method: 'DELETE',
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
            }
        );

        // 2. Insertar items nuevos (solo los que tienen producto)
        const itemsParaGuardar = itemsOrden
            .filter(i => i.producto_id)
            .map(i => ({
                orden_id: ordenActual.id,
                producto_id: i.producto_id,
                cantidad: i.cantidad,
                sku: i.sku,
                descripcion: i.descripcion,
                precio_unitario: i.precio_unitario,
                precio_sin_iva: i.precio_sin_iva,
                precio_con_iva: i.precio_con_iva
            }));

        if (itemsParaGuardar.length > 0) {
            await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items`, {
                method: 'POST',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemsParaGuardar)
            });
        }

        // 3. Actualizar orden
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenActual.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                estatus: 'COTIZACION_ENVIADA',
                notas_revision: notas || null
            })
        });

        alert('✅ Cotización guardada. Estatus: Cotización Enviada.');
        ordenActual.estatus = 'COTIZACION_ENVIADA';
        ordenActual.notas_revision = notas;
        abrirDetalle(ordenActual.id);

    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Guardar Cotización';
    }
}

// =====================================================
// ACEPTADA POR CLIENTE
// =====================================================
async function aceptadaPorCliente() {
    if (!ordenActual) return;

    const itemsConProducto = itemsOrden.filter(i => i.producto_id);
    if (itemsConProducto.length === 0) {
        return alert('Agrega al menos una pieza antes de aceptar.');
    }

    if (!confirm(`¿Confirmar que el cliente aceptó la orden ${ordenActual.folio}?\n\nLas piezas se moverán a "Stock Taller".`)) return;

    try {
        // Primero guardar cotización si no se ha guardado
        await guardarCotizacionSilenciosa();

        // Mover stock a taller para cada item
        for (const item of itemsConProducto) {
            const resProd = await fetch(
                `${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.producto_id}&select=id,stock_norte,stock_sur,stock_taller`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
            );
            const [prod] = await resProd.json();
            if (!prod) continue;

            // Determinar de qué sucursal sale
            const sucursal = ordenActual.sucursal || 'Norte';
            const stockKey = `stock_${sucursal.toLowerCase()}`;
            const stockActual = prod[stockKey] || 0;
            const stockTaller = prod.stock_taller || 0;

            const updateData = {};
            updateData[stockKey] = Math.max(0, stockActual - item.cantidad);
            updateData.stock_taller = stockTaller + item.cantidad;

            await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.producto_id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            // Registrar movimiento
            const movimientos = [
                {
                    producto_id: item.producto_id,
                    sucursal: sucursal,
                    tipo: 'SALIDA',
                    cantidad: item.cantidad,
                    stock_anterior: stockActual,
                    stock_nuevo: Math.max(0, stockActual - item.cantidad),
                    referencia: `Orden Reparación ${ordenActual.folio} → Taller`,
                    usuario: sessionStorage.getItem('userName') || 'Usuario'
                },
                {
                    producto_id: item.producto_id,
                    sucursal: 'Taller',
                    tipo: 'ENTRADA',
                    cantidad: item.cantidad,
                    stock_anterior: stockTaller,
                    stock_nuevo: stockTaller + item.cantidad,
                    referencia: `Orden Reparación ${ordenActual.folio}`,
                    usuario: sessionStorage.getItem('userName') || 'Usuario'
                }
            ];

            await fetch(`${window.SUPABASE_URL}/rest/v1/movimientos_stock`, {
                method: 'POST',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(movimientos)
            });
        }

        // Actualizar estatus
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenActual.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                estatus: 'EN_PROCESO',
                fecha_aceptacion: new Date().toISOString()
            })
        });

        alert(`✅ Orden ${ordenActual.folio} aceptada. Piezas movidas a Taller. Estatus: En Proceso.`);
        volverALista();

    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}

// =====================================================
// MARCAR COMO TERMINADA
// =====================================================
async function marcarComoTerminada() {
    if (!ordenActual) return;
    if (!confirm(`¿Marcar la orden ${ordenActual.folio} como TERMINADA?\n\nLa orden pasará a la bandeja de Órdenes Terminadas lista para ser cobrada y entregada.`)) return;

    try {
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenActual.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                estatus: 'TERMINADA',
                fecha_terminacion: new Date().toISOString()
            })
        });

        alert('✅ Orden marcada como Terminada exitosamente.');
        volverALista();
    } catch (e) {
        console.error("Error marcando terminada:", e);
        alert('Error al marcar terminada: ' + e.message);
    }
}

async function guardarCotizacionSilenciosa() {
    const notas = document.getElementById('inputNotasRevision').value.trim().toUpperCase();

    await fetch(
        `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenActual.id}`,
        { method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
    );

    const itemsParaGuardar = itemsOrden
        .filter(i => i.producto_id)
        .map(i => ({
            orden_id: ordenActual.id,
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            sku: i.sku,
            descripcion: i.descripcion,
            precio_unitario: i.precio_unitario,
            precio_sin_iva: i.precio_sin_iva,
            precio_con_iva: i.precio_con_iva
        }));

    if (itemsParaGuardar.length > 0) {
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(itemsParaGuardar)
        });
    }

    await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenActual.id}`, {
        method: 'PATCH',
        headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas_revision: notas || null })
    });
}

// =====================================================
// PDF COTIZACIÓN
// =====================================================
function descargarPDFCotizacion() {
    if (!ordenActual) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('AGRIGARDEN', 14, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Cotización de Reparación', 14, 27);

        // Info orden
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Orden: ${ordenActual.folio || 'S/F'}`, 140, 20);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${new Date(ordenActual.created_at || new Date()).toLocaleDateString('es-MX')}`, 140, 26);
        doc.text(`Impreso: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 140, 31);

        // Datos cliente
        doc.setFontSize(10);
        let y = 40;
        doc.setFont('helvetica', 'bold');
        doc.text('Cliente:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(ordenActual.cliente_nombre || 'Desconocido', 40, y);
        y += 5;
        doc.text(`Tel: ${ordenActual.cliente_telefono || '—'}`, 14, y);
        doc.text(`Comp: ${ordenActual.tipo_comprobante || 'Remisión'}`, 100, y);
        y += 5;
        doc.text(`Equipo: ${ordenActual.equipo || '—'} — ${ordenActual.marca_modelo || '—'}`, 14, y);
        y += 5;
        doc.text(`Mecánico: ${ordenActual.mecanico || 'Pendiente'}`, 14, y);
        y += 5;
        if (ordenActual.observaciones) {
            doc.text(`Observaciones: ${ordenActual.observaciones}`, 14, y);
            y += 7;
        }

        // Tabla
        const itemsValidos = itemsOrden.filter(i => i.producto_id || (i.descripcion && i.descripcion.trim() !== ''));
        const tableData = itemsValidos.map(i => [
            i.cantidad || 1,
            i.sku || '—',
            i.descripcion || '—',
            `$${Number(i.precio_sin_iva || 0).toFixed(2)}`,
            `$${Number(i.precio_con_iva || 0).toFixed(2)}`
        ]);

        doc.autoTable({
            startY: y + 2,
            head: [['Cant.', 'SKU', 'Descripción', 'Precio s/IVA', 'Precio c/IVA']],
            body: tableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [25, 230, 107], textColor: 0, fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 15 },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });

        // Total
        const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 5 : y + 20;
        const total = itemsValidos.reduce((s, i) => s + Number(i.precio_con_iva || 0), 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL: $${total.toFixed(2)}`, 150, finalY);

        // Notas
        const notasInput = document.getElementById('inputNotasRevision');
        const notas = notasInput ? notasInput.value.trim() : '';
        if (notas) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Notas de revisión: ${notas}`, 14, finalY + 10);
        }

        doc.save(`Cotizacion_${ordenActual.folio || 'OR'}.pdf`);
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("Ocurrió un error al generar el PDF. Verifica la consola para más detalles.");
    }
}

// =====================================================
// ELIMINAR ORDEN (SOLO ADMIN)
// =====================================================
async function eliminarOrdenDesdeModulo(ordenId, folio, estatus) {
    if (!confirm(`¿Eliminar la orden ${folio} permanentemente?\n\nTodas las piezas asociadas se revertirán.`)) return;
    if (!confirm(`⚠️ CONFIRMACIÓN FINAL: ¿Seguro que deseas eliminar ${folio}?`)) return;

    try {
        const usuario = sessionStorage.getItem('userName') || 'Admin';

        // Si ENTREGADA: eliminar transacción vinculada
        if (estatus === 'ENTREGADA') {
            const resTx = await fetch(
                `${window.SUPABASE_URL}/rest/v1/transacciones?orden_reparacion_id=eq.${ordenId}&select=id`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
            );
            const txs = await resTx.json();
            for (const tx of txs) {
                await fetch(`${window.SUPABASE_URL}/rest/v1/venta_items?transaccion_id=eq.${tx.id}`, {
                    method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
                });
                await fetch(`${window.SUPABASE_URL}/rest/v1/transacciones?id=eq.${tx.id}`, {
                    method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
                });
            }
        }

        // Si EN_PROCESO o TERMINADA: revertir stock_taller
        if (estatus === 'EN_PROCESO' || estatus === 'TERMINADA') {
            const resItems = await fetch(
                `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenId}&select=producto_id,cantidad`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
            );
            const items = await resItems.json();
            for (const item of items) {
                const resProd = await fetch(
                    `${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.producto_id}&select=id,stock_taller,stock_norte`,
                    { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
                );
                const [prod] = await resProd.json();
                if (!prod) continue;
                await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.producto_id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stock_taller: Math.max(0, (prod.stock_taller || 0) - item.cantidad),
                        stock_norte: (prod.stock_norte || 0) + item.cantidad
                    })
                });
                await fetch(`${window.SUPABASE_URL}/rest/v1/movimientos_stock`, {
                    method: 'POST',
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        producto_id: item.producto_id, sucursal: 'Taller', tipo: 'REVERSION', cantidad: item.cantidad,
                        stock_anterior: prod.stock_taller || 0, stock_nuevo: Math.max(0, (prod.stock_taller || 0) - item.cantidad),
                        referencia: `Orden ${folio} eliminada por ${usuario}`, usuario
                    })
                });
            }
        }

        // Eliminar items y orden
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenId}`, {
            method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenId}`, {
            method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });

        alert(`✅ Orden ${folio} eliminada exitosamente.`);
        volverALista();
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}
