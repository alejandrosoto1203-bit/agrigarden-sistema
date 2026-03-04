// traspasos.js - Módulo de Traspasos de Mercancía entre Sucursales

// =====================================================
// ESTADO
// =====================================================
let productosCache = [];
let productosTraspaso = []; // [{id, sku, nombre, imagen_url, stockOrigen, cantidad}]
let direccion = { origen: 'Norte', destino: 'Sur' };

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function inicializarTraspasos() {
    document.getElementById('responsableNombre').textContent =
        sessionStorage.getItem('userName') || 'Usuario';

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#buscadorProducto') && !e.target.closest('#dropdownProductos')) {
            document.getElementById('dropdownProductos').classList.add('hidden');
        }
    });

    await cargarCatalogoProductos();
    cargarHistorial();
}

// =====================================================
// CARGAR CATÁLOGO DE PRODUCTOS
// =====================================================
async function cargarCatalogoProductos() {
    try {
        let allProducts = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(
                `${window.SUPABASE_URL}/rest/v1/productos?select=id,sku,nombre,imagen_url,stock_norte,stock_sur,es_servicio&order=nombre.asc&limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${window.SUPABASE_KEY}`
                    }
                }
            );
            const batch = await response.json();
            allProducts = allProducts.concat(batch);
            hasMore = batch.length >= limit;
            offset += limit;
        }

        // Filtrar: solo productos físicos (no servicios)
        productosCache = allProducts.filter(p => !p.es_servicio);
    } catch (e) {
        console.error('Error cargando productos:', e);
    }
}

// =====================================================
// DIRECCIÓN DEL TRASPASO
// =====================================================
function setDireccion(origen, destino) {
    direccion = { origen, destino };

    const btnNS = document.getElementById('btnNorteSur');
    const btnSN = document.getElementById('btnSurNorte');

    if (origen === 'Norte') {
        btnNS.className = 'direction-btn active bg-gradient-to-r from-blue-500 to-emerald-500 text-white p-5 rounded-2xl flex items-center justify-center gap-4';
        btnSN.className = 'direction-btn bg-slate-100 text-slate-600 p-5 rounded-2xl flex items-center justify-center gap-4';
    } else {
        btnSN.className = 'direction-btn active bg-gradient-to-r from-emerald-500 to-blue-500 text-white p-5 rounded-2xl flex items-center justify-center gap-4';
        btnNS.className = 'direction-btn bg-slate-100 text-slate-600 p-5 rounded-2xl flex items-center justify-center gap-4';
    }

    document.getElementById('thStockOrigen').textContent = `Stock ${origen}`;

    // Actualizar stocks en tabla si hay productos
    actualizarStocksTabla();
}

function actualizarStocksTabla() {
    const stockKey = direccion.origen === 'Norte' ? 'stock_norte' : 'stock_sur';

    productosTraspaso.forEach(pt => {
        const prod = productosCache.find(p => p.id === pt.id);
        if (prod) {
            pt.stockOrigen = prod[stockKey] || 0;
        }
    });

    renderizarTabla();
}

// =====================================================
// BUSCADOR DE PRODUCTOS (AUTOCOMPLETE)
// =====================================================
function buscarProducto(query) {
    const dropdown = document.getElementById('dropdownProductos');
    const q = query.toLowerCase().trim();

    if (q.length < 1) {
        dropdown.classList.add('hidden');
        return;
    }

    const stockKey = direccion.origen === 'Norte' ? 'stock_norte' : 'stock_sur';
    const idsYaAgregados = new Set(productosTraspaso.map(p => p.id));

    const resultados = productosCache
        .filter(p =>
            !idsYaAgregados.has(p.id) &&
            (p.nombre?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
        )
        .slice(0, 15);

    if (resultados.length === 0) {
        dropdown.innerHTML = '<div class="py-4 text-center text-slate-400 text-xs italic">Sin resultados</div>';
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = resultados.map(p => {
        const imgUrl = p.imagen_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.nombre || 'P').charAt(0))}&background=f1f5f9&color=94a3b8&size=32`;
        const stock = p[stockKey] || 0;

        return `
            <div class="autocomplete-item" onclick="agregarProducto(${p.id})">
                <img src="${imgUrl}" class="size-8 rounded-lg object-cover border border-slate-100 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate">${p.nombre}</p>
                    <p class="text-[10px] font-mono text-slate-400">${p.sku || '—'}</p>
                </div>
                <span class="text-xs font-black ${stock > 0 ? 'text-primary' : 'text-orange-400'}">${stock} uds</span>
            </div>
        `;
    }).join('');

    dropdown.classList.remove('hidden');
}

// =====================================================
// AGREGAR / ELIMINAR PRODUCTOS
// =====================================================
function agregarProducto(id) {
    const prod = productosCache.find(p => p.id === id);
    if (!prod) return;

    const stockKey = direccion.origen === 'Norte' ? 'stock_norte' : 'stock_sur';

    productosTraspaso.push({
        id: prod.id,
        sku: prod.sku || '',
        nombre: prod.nombre || '',
        imagen_url: prod.imagen_url || '',
        stockOrigen: prod[stockKey] || 0,
        cantidad: 1
    });

    document.getElementById('buscadorProducto').value = '';
    document.getElementById('dropdownProductos').classList.add('hidden');

    renderizarTabla();
}

function eliminarProducto(id) {
    productosTraspaso = productosTraspaso.filter(p => p.id !== id);
    renderizarTabla();
}

function actualizarCantidad(id, valor) {
    const prod = productosTraspaso.find(p => p.id === id);
    if (prod) {
        prod.cantidad = Math.max(0, parseFloat(valor) || 0);
    }
    actualizarResumen();
}

// =====================================================
// RENDERIZAR TABLA
// =====================================================
function renderizarTabla() {
    const tbody = document.getElementById('bodyTraspaso');
    const seccion = document.getElementById('seccionConfirmar');

    if (productosTraspaso.length === 0) {
        tbody.innerHTML = '';
        tbody.appendChild(crearFilaVacia());
        seccion.classList.add('hidden');
        return;
    }

    tbody.innerHTML = productosTraspaso.map(p => {
        const imgUrl = p.imagen_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.nombre || 'P').charAt(0))}&background=f1f5f9&color=94a3b8&size=32`;
        const stockBajo = p.cantidad > p.stockOrigen;

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                <td class="px-2 py-3 text-center">
                    <img src="${imgUrl}" class="size-8 rounded-lg object-cover border border-slate-100 mx-auto">
                </td>
                <td class="px-4 py-3 text-center font-mono text-xs text-slate-500">${p.sku || '—'}</td>
                <td class="px-4 py-3">
                    <p class="font-bold text-slate-800 text-sm">${p.nombre}</p>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="font-black ${p.stockOrigen <= 0 ? 'text-red-500' : 'text-slate-600'}">${p.stockOrigen}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <input type="number" value="${p.cantidad}" min="0" step="1"
                        oninput="actualizarCantidad(${p.id}, this.value)"
                        class="w-20 mx-auto text-center font-black text-lg border-2 ${stockBajo ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-primary bg-white'} rounded-xl py-1 focus:border-primary focus:outline-none transition-all">
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="eliminarProducto(${p.id})"
                        class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    seccion.classList.remove('hidden');
    actualizarResumen();
}

function crearFilaVacia() {
    const tr = document.createElement('tr');
    tr.id = 'filaSinProductos';
    tr.innerHTML = `
        <td colspan="6" class="py-12 text-center">
            <span class="material-symbols-outlined text-5xl text-slate-200">local_shipping</span>
            <p class="text-slate-400 font-bold mt-2">Busca y agrega productos para traspasar</p>
        </td>
    `;
    return tr;
}

function actualizarResumen() {
    const totalProds = productosTraspaso.length;
    const totalUds = productosTraspaso.reduce((s, p) => s + (p.cantidad || 0), 0);

    document.getElementById('totalProductos').textContent = totalProds;
    document.getElementById('totalUnidades').textContent = totalUds;
}

// =====================================================
// EJECUTAR TRASPASO
// =====================================================
async function ejecutarTraspaso() {
    if (productosTraspaso.length === 0) {
        alert('Agrega al menos un producto.');
        return;
    }

    // Validar cantidades
    const conCero = productosTraspaso.filter(p => !p.cantidad || p.cantidad <= 0);
    if (conCero.length > 0) {
        alert(`Hay ${conCero.length} producto(s) con cantidad 0 o vacía.`);
        return;
    }

    const sinStock = productosTraspaso.filter(p => p.cantidad > p.stockOrigen);
    if (sinStock.length > 0) {
        alert(`Stock insuficiente en: ${sinStock.map(p => p.sku || p.nombre).join(', ')}`);
        return;
    }

    const totalProds = productosTraspaso.length;
    const totalUds = productosTraspaso.reduce((s, p) => s + p.cantidad, 0);

    if (!confirm(`¿Confirmar traspaso de ${totalProds} producto(s) (${totalUds} unidades) de ${direccion.origen} a ${direccion.destino}?`)) {
        return;
    }

    const usuario = sessionStorage.getItem('userName') || 'Usuario';
    const notas = document.getElementById('notasTraspaso').value.trim().toUpperCase() || null;
    const origenKey = `stock_${direccion.origen.toLowerCase()}`;
    const destinoKey = `stock_${direccion.destino.toLowerCase()}`;

    let exitosos = 0;
    let errores = 0;

    for (const item of productosTraspaso) {
        try {
            // Obtener stock actual fresco
            const resProd = await fetch(
                `${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.id}&select=id,${origenKey},${destinoKey}`,
                {
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${window.SUPABASE_KEY}`
                    }
                }
            );
            const [prod] = await resProd.json();
            if (!prod) { errores++; continue; }

            const stockOrigenActual = prod[origenKey] || 0;
            const stockDestinoActual = prod[destinoKey] || 0;

            if (item.cantidad > stockOrigenActual) {
                console.warn(`Stock insuficiente para ${item.sku}: tiene ${stockOrigenActual}, pide ${item.cantidad}`);
                errores++;
                continue;
            }

            const nuevoOrigen = stockOrigenActual - item.cantidad;
            const nuevoDestino = stockDestinoActual + item.cantidad;

            // 1. Actualizar stocks
            const updateData = {};
            updateData[origenKey] = nuevoOrigen;
            updateData[destinoKey] = nuevoDestino;

            await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            // 2. Registrar movimientos (OUT + IN)
            const movimientos = [
                {
                    producto_id: item.id,
                    sucursal: direccion.origen,
                    tipo: 'TRANSFERENCIA_OUT',
                    cantidad: item.cantidad,
                    stock_anterior: stockOrigenActual,
                    stock_nuevo: nuevoOrigen,
                    referencia: `Traspaso a ${direccion.destino}`,
                    notas: notas,
                    usuario: usuario
                },
                {
                    producto_id: item.id,
                    sucursal: direccion.destino,
                    tipo: 'TRANSFERENCIA_IN',
                    cantidad: item.cantidad,
                    stock_anterior: stockDestinoActual,
                    stock_nuevo: nuevoDestino,
                    referencia: `Traspaso desde ${direccion.origen}`,
                    notas: notas,
                    usuario: usuario
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

            // 3. Registrar en transferencias_stock
            await fetch(`${window.SUPABASE_URL}/rest/v1/transferencias_stock`, {
                method: 'POST',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    producto_id: item.id,
                    sucursal_origen: direccion.origen,
                    sucursal_destino: direccion.destino,
                    cantidad: item.cantidad,
                    notas: notas,
                    usuario: usuario
                })
            });

            exitosos++;

        } catch (e) {
            console.error(`Error traspasando ${item.sku}:`, e);
            errores++;
        }
    }

    // Resultado
    if (errores === 0) {
        alert(`✅ Traspaso completado: ${exitosos} producto(s) movidos de ${direccion.origen} a ${direccion.destino}.`);
    } else {
        alert(`Traspaso parcial: ${exitosos} exitosos, ${errores} con error.`);
    }

    // Limpiar
    productosTraspaso = [];
    document.getElementById('notasTraspaso').value = '';
    renderizarTabla();
    await cargarCatalogoProductos(); // Refrescar stocks
    cargarHistorial();
}

// =====================================================
// HISTORIAL DE TRASPASOS
// =====================================================
async function cargarHistorial() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/transferencias_stock?select=*,productos:producto_id(nombre,sku)&order=created_at.desc&limit=50`,
            {
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`
                }
            }
        );
        const datos = await res.json();
        const tbody = document.getElementById('bodyHistorial');

        if (!Array.isArray(datos) || datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-300 italic text-xs">Sin traspasos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = datos.map(t => {
            const fecha = new Date(t.created_at).toLocaleDateString('es-MX', {
                day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const productoNombre = t.productos?.nombre || '—';
            const productoSku = t.productos?.sku || '';

            return `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                    <td class="px-4 py-2.5 text-xs text-slate-500">${fecha}</td>
                    <td class="px-4 py-2.5 text-center">
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${t.sucursal_origen === 'Norte' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}">
                            ${t.sucursal_origen || '?'}
                            <span class="material-symbols-outlined text-xs">arrow_forward</span>
                            ${t.sucursal_destino || '?'}
                        </span>
                    </td>
                    <td class="px-4 py-2.5">
                        <p class="text-sm font-bold text-slate-700 truncate max-w-[200px]">${productoNombre}</p>
                        <p class="text-[10px] font-mono text-slate-400">${productoSku}</p>
                    </td>
                    <td class="px-4 py-2.5 text-center font-black text-primary">${t.cantidad || 0}</td>
                    <td class="px-4 py-2.5 text-xs font-bold text-slate-600">${t.usuario || '—'}</td>
                    <td class="px-4 py-2.5 text-xs text-slate-400 truncate max-w-[150px]">${t.notas || '—'}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Error cargando historial:', e);
        document.getElementById('bodyHistorial').innerHTML =
            '<tr><td colspan="6" class="py-4 text-center text-red-400 text-xs italic">Error cargando historial</td></tr>';
    }
}
