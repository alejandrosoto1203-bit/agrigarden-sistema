// ventas.js - Módulo de Punto de Venta Agrigarden
// NO modifica archivos existentes, solo usa las tablas compartidas

// =====================================================
// CONFIGURACIÓN
// =====================================================
// =====================================================
// CONFIGURACIÓN
// =====================================================
// Se usan las variables globales definidas en api.js: window.SUPABASE_URL y window.SUPABASE_KEY
// No volver a declararlas para evitar errores de duplicidad.

// =====================================================
// ESTADO GLOBAL
// =====================================================
let cajaActual = null;           // 'Norte' o 'Sur'
let sesionCajaActual = null;     // Objeto de la sesión de caja
let productosCache = [];
let carrito = [];
let categoriaActiva = 'Todos';
let metodoPagoSeleccionado = 'Efectivo';
let tipoPrecioActivo = 'precio_publico';
let ventaDesdeReparacion = null; // Datos de orden de reparación si viene del módulo de taller

// CACHES NUEVOS
let clientesCache = [];
let vendedoresCache = [];
let clienteSeleccionado = null; // Guardará el objeto del cliente validado

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function inicializarPOS() {
    await cargarEstadoCajas();
}

async function cargarEstadoCajas() {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        // Buscar sesiones abiertas de hoy
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?fecha=eq.${hoy}&estado=eq.ABIERTA&select=*`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        const sesiones = await response.json();

        // Estado Norte
        const sesionNorte = sesiones.find(s => s.sucursal === 'Norte');
        if (sesionNorte) {
            document.getElementById('estadoCajaNorte').textContent = '🟢 Abierta';
            document.getElementById('estadoCajaNorte').classList.add('text-green-500');
            document.getElementById('fondoCajaNorte').textContent = formatMoney(sesionNorte.fondo_inicial || 0);
        } else {
            document.getElementById('estadoCajaNorte').textContent = '🔴 Cerrada';
            document.getElementById('fondoCajaNorte').textContent = '-';
        }

        // Estado Sur
        const sesionSur = sesiones.find(s => s.sucursal === 'Sur');
        if (sesionSur) {
            document.getElementById('estadoCajaSur').textContent = '🟢 Abierta';
            document.getElementById('estadoCajaSur').classList.add('text-green-500');
            document.getElementById('fondoCajaSur').textContent = formatMoney(sesionSur.fondo_inicial || 0);
        } else {
            document.getElementById('estadoCajaSur').textContent = '🔴 Cerrada';
            document.getElementById('fondoCajaSur').textContent = '-';
        }

    } catch (error) {
        console.error('Error cargando estado de cajas:', error);
    }
}

// =====================================================
// SELECCIÓN Y APERTURA DE CAJA
// =====================================================
async function seleccionarCaja(sucursal) {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        // Verificar si ya hay sesión abierta
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?sucursal=eq.${sucursal}&fecha=eq.${hoy}&estado=eq.ABIERTA&select=*`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        const sesiones = await response.json();

        if (sesiones.length > 0) {
            // Caja ya está abierta, entrar directamente
            cajaActual = sucursal;
            sesionCajaActual = sesiones[0];
            await entrarPOS();
        } else {
            // Caja cerrada, mostrar modal para abrir
            cajaActual = sucursal;
            document.getElementById('nombreCajaAbrir').textContent = sucursal;
            document.getElementById('inputFondoInicial').value = '0';
            document.getElementById('modalAbrirCaja').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error al seleccionar caja:', error);
        alert('Error de conexión');
    }
}

function cerrarModalAbrirCaja() {
    document.getElementById('modalAbrirCaja').classList.add('hidden');
    cajaActual = null;
}

async function confirmarAbrirCaja() {
    const fondoInicial = parseFloat(document.getElementById('inputFondoInicial').value) || 0;
    const hoy = new Date().toISOString().split('T')[0];

    try {
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                sucursal: cajaActual,
                fecha: hoy,
                fecha_apertura: new Date().toISOString(),
                fondo_inicial: fondoInicial,
                estado: 'ABIERTA'
            })
        });

        if (response.ok) {
            const data = await response.json();
            sesionCajaActual = data[0];
            document.getElementById('modalAbrirCaja').classList.add('hidden');
            await entrarPOS();
        } else {
            const error = await response.json();
            alert('Error al abrir caja: ' + (error.message || 'Intenta de nuevo'));
        }
    } catch (error) {
        console.error('Error abriendo caja:', error);
        alert('Error de conexión');
    }
}

// =====================================================
// PANTALLA POS
// =====================================================
async function entrarPOS() {
    // Ocultar selección, mostrar POS
    document.getElementById('pantallaSeleccionCaja').classList.add('hidden');
    document.getElementById('pantallaPOS').classList.remove('hidden');

    // Actualizar header
    document.getElementById('cajaNombreHeader').textContent = cajaActual;
    document.getElementById('fechaHeader').textContent = new Date().toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    // Cargar Catálogos
    await cargarProductosPOS();
    await cargarClientesPOS();
    await cargarVendedoresPOS();

    // Verificar si viene de una orden de reparación
    const datosReparacion = sessionStorage.getItem('ordenReparacionPOS');
    if (datosReparacion) {
        ventaDesdeReparacion = JSON.parse(datosReparacion);
        sessionStorage.removeItem('ordenReparacionPOS');
        cargarItemsReparacionEnCarrito();
    }
}

// Cargar items de orden de reparación automáticamente en el carrito
function cargarItemsReparacionEnCarrito() {
    if (!ventaDesdeReparacion || !ventaDesdeReparacion.items) return;

    carrito = [];
    for (const item of ventaDesdeReparacion.items) {
        const producto = productosCache.find(p => p.id === item.producto_id);
        const precio = item.precio_unitario || (producto ? producto.precio_publico : 0) || 0;
        const ivaPct = producto?.aplica_impuestos !== false ? (producto?.iva_porcentaje || 16) : 0;

        const nuevoItem = {
            producto_id: item.producto_id,
            producto_nombre: item.descripcion || producto?.nombre || '',
            producto_sku: item.sku || producto?.sku || '',
            cantidad: item.cantidad,
            precio_unitario: precio,
            precio_tipo: 'PUBLICO',
            subtotal: precio * item.cantidad,
            iva_porcentaje: ivaPct,
            iva_monto: 0,
            ieps_porcentaje: 0,
            ieps_monto: 0,
            total: 0
        };
        calcularImpuestosItem(nuevoItem, producto || { aplica_impuestos: true, iva_porcentaje: ivaPct });
        carrito.push(nuevoItem);
    }

    renderizarCarrito();

    // Auto-fill cliente
    const inputCliente = document.getElementById('inputClienteVenta');
    if (inputCliente && ventaDesdeReparacion.cliente) {
        inputCliente.value = ventaDesdeReparacion.cliente;
    }
}

function volverSeleccionCaja() {
    if (carrito.length > 0) {
        if (!confirm('Tienes productos en el carrito. ¿Seguro que deseas salir?')) return;
    }
    document.getElementById('pantallaPOS').classList.add('hidden');
    document.getElementById('pantallaSeleccionCaja').classList.remove('hidden');
    carrito = [];
    cajaActual = null;
    sesionCajaActual = null;
    cargarEstadoCajas();
}

// =====================================================
// PRODUCTOS
// =====================================================
async function cargarProductosPOS() {
    try {
        let allProducts = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos?select=*&activo=eq.true&se_vende=eq.true&order=nombre.asc&limit=${limit}&offset=${offset}`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
            });
            const batch = await response.json();
            allProducts = allProducts.concat(batch);
            hasMore = batch.length === limit;
            offset += limit;
        }

        productosCache = allProducts;
        cargarCategorias();
        filtrarProductosPOS();
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

function cargarCategorias() {
    const contenedor = document.getElementById('contenedorCategorias');
    const categorias = [...new Set(productosCache.map(p => p.categoria).filter(c => c))];

    contenedor.innerHTML = `
        <button onclick="filtrarPorCategoria('Todos')" class="categoria-btn px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm whitespace-nowrap" data-cat="Todos">
            Todos
        </button>
        ${categorias.map(cat => `
            <button onclick="filtrarPorCategoria('${cat}')" class="categoria-btn px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm whitespace-nowrap hover:bg-gray-200" data-cat="${cat}">
                ${cat}
            </button>
        `).join('')}
    `;
}

function filtrarPorCategoria(categoria) {
    categoriaActiva = categoria;

    // Actualizar estilos de botones
    document.querySelectorAll('.categoria-btn').forEach(btn => {
        if (btn.dataset.cat === categoria) {
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            btn.classList.add('bg-primary', 'text-white');
        } else {
            btn.classList.remove('bg-primary', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-600');
        }
    });

    filtrarProductosPOS();
}

function filtrarProductosPOS() {
    const busqueda = document.getElementById('busquedaProductoPOS')?.value.toLowerCase() || '';

    const filtrados = productosCache.filter(p => {
        const coincideTexto =
            p.nombre?.toLowerCase().includes(busqueda) ||
            p.sku?.toLowerCase().includes(busqueda) ||
            p.codigo_barras?.includes(busqueda);

        const coincideCategoria = categoriaActiva === 'Todos' || p.categoria === categoriaActiva;

        return coincideTexto && coincideCategoria;
    });

    renderizarProductosPOS(filtrados);
}

function renderizarProductosPOS(productos) {
    const grid = document.getElementById('gridProductos');
    const empty = document.getElementById('emptyProductos');

    if (productos.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    // Campo de stock según la caja actual
    const stockKey = cajaActual === 'Norte' ? 'stock_norte' : 'stock_sur';

    grid.innerHTML = productos.map(p => {
        const stock = p[stockKey] || 0;
        const sinStock = stock <= 0 && p.utiliza_stock !== false;
        const imgUrl = p.imagen_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre?.charAt(0) || 'P')}&background=f8fafc&color=94a3b8&size=80`;

        return `
            <div onclick="${sinStock ? `mostrarStockInsuficiente(${p.id}, 1)` : `agregarAlCarrito(${p.id})`}"
                class="producto-card pos-card p-4 cursor-pointer transition-all ${sinStock ? 'opacity-40 grayscale' : 'hover:border-black/20 hover:shadow-xl hover:-translate-y-1'}">
                <div class="relative">
                    <img src="${imgUrl}" class="w-full aspect-square object-cover rounded-2xl mb-4 bg-gray-50 border border-gray-100/50" alt="${p.nombre}">
                    ${sinStock ? '<div class="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center backdrop-blur-[1px]"><span class="text-[10px] font-black tracking-widest text-red-600 bg-red-50/90 px-3 py-1.5 rounded-lg uppercase">Agotado</span></div>' : ''}
                </div>
                <p class="font-bold text-sm text-gray-800 line-clamp-2 leading-tight min-h-[2.5rem] tracking-tight">${p.nombre}</p>
                <div class="flex justify-between items-center mt-1">
                    <p class="text-[10px] text-gray-400 font-mono tracking-wider">${p.sku || 'N/A'}</p>
                    <p class="text-[10px] font-bold ${stock <= (p.stock_minimo || 0) ? 'text-orange-500' : 'text-emerald-500'} bg-gray-50 px-2 py-0.5 rounded-md">${stock} disp.</p>
                </div>
                <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-end">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Precio</p>
                    <p class="text-lg font-black text-black tracking-tight">${formatMoney(p.precio_publico || 0)}</p>
                </div>
            </div>
        `;
    }).join('');
}

// =====================================================
// CARRITO
// =====================================================
function agregarAlCarrito(productoId) {
    const producto = productosCache.find(p => p.id === productoId);
    if (!producto) return;

    const stockKey = cajaActual === 'Norte' ? 'stock_norte' : 'stock_sur';
    const stockDisponible = producto[stockKey] || 0;

    // Verificar si ya está en carrito
    const itemExistente = carrito.find(item => item.producto_id === productoId);
    const cantidadActual = itemExistente ? itemExistente.cantidad : 0;

    // Validar stock (solo si utiliza_stock)
    if (producto.utiliza_stock !== false && cantidadActual + 1 > stockDisponible) {
        mostrarStockInsuficiente(productoId, cantidadActual + 1);
        return;
    }

    if (itemExistente) {
        itemExistente.cantidad += 1;
        itemExistente.subtotal = itemExistente.cantidad * itemExistente.precio_unitario;
        calcularImpuestosItem(itemExistente, producto);
    } else {
        const precio = producto[tipoPrecioActivo] || producto.precio_publico || 0;
        const nuevoItem = {
            producto_id: productoId,
            producto_nombre: producto.nombre,
            producto_sku: producto.sku,
            cantidad: 1,
            precio_unitario: precio,
            precio_tipo: tipoPrecioActivo.toUpperCase().replace('PRECIO_', ''),
            subtotal: precio,
            iva_porcentaje: producto.aplica_impuestos ? (producto.iva_porcentaje || 16) : 0,
            iva_monto: 0,
            ieps_porcentaje: producto.ieps_porcentaje || 0,
            ieps_monto: 0,
            total: 0
        };
        calcularImpuestosItem(nuevoItem, producto);
        carrito.push(nuevoItem);
    }

    renderizarCarrito();
}

function calcularImpuestosItem(item, producto) {
    // Impuestos sobre el subtotal
    if (producto.aplica_impuestos !== false) {
        item.iva_monto = item.subtotal * (item.iva_porcentaje / 100);
        item.ieps_monto = item.subtotal * (item.ieps_porcentaje / 100);
    } else {
        item.iva_monto = 0;
        item.ieps_monto = 0;
    }
    item.total = item.subtotal + item.iva_monto + item.ieps_monto;
}

function cambiarCantidadCarrito(productoId, delta) {
    const item = carrito.find(i => i.producto_id === productoId);
    if (!item) return;

    const producto = productosCache.find(p => p.id === productoId);
    const stockKey = cajaActual === 'Norte' ? 'stock_norte' : 'stock_sur';
    const stockDisponible = producto ? (producto[stockKey] || 0) : 999;

    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
        carrito = carrito.filter(i => i.producto_id !== productoId);
    } else if (producto?.utiliza_stock !== false && nuevaCantidad > stockDisponible) {
        mostrarStockInsuficiente(productoId, nuevaCantidad);
        return;
    } else {
        item.cantidad = nuevaCantidad;
        item.subtotal = item.cantidad * item.precio_unitario;
        calcularImpuestosItem(item, producto);
    }

    renderizarCarrito();
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(i => i.producto_id !== productoId);
    renderizarCarrito();
}

function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    carrito = [];
    renderizarCarrito();
}

function renderizarCarrito() {
    const lista = document.getElementById('listaCarrito');
    const vacio = document.getElementById('carritoVacio');
    const btnCobrar = document.getElementById('btnCobrar');
    const btnVaciar = document.getElementById('btnVaciarCarrito');

    if (carrito.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-12 text-gray-300" id="carritoVacio">
                <span class="material-symbols-outlined text-5xl">shopping_cart</span>
                <p class="mt-2 text-sm">Agrega productos</p>
            </div>
        `;
        btnCobrar.disabled = true;
        btnVaciar.classList.add('hidden');
        actualizarTotalesCarrito();
        return;
    }

    btnVaciar.classList.remove('hidden');
    btnCobrar.disabled = false;

    lista.innerHTML = carrito.map(item => `
        <div class="carrito-item bg-gray-50 rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
                <p class="font-bold text-sm text-gray-800 truncate flex-1">${item.producto_nombre}</p>
                <button onclick="eliminarDelCarrito(${item.producto_id})" class="text-red-400 hover:text-red-600 ml-2">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <button onclick="cambiarCantidadCarrito(${item.producto_id}, -1)" class="size-8 bg-white border border-gray-200 rounded-lg font-bold hover:bg-gray-100">-</button>
                    <span class="font-bold text-gray-800 w-8 text-center">${item.cantidad}</span>
                    <button onclick="cambiarCantidadCarrito(${item.producto_id}, 1)" class="size-8 bg-white border border-gray-200 rounded-lg font-bold hover:bg-gray-100">+</button>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-400">${formatMoney(item.precio_unitario)} c/u</p>
                    <p class="font-black text-primary">${formatMoney(item.subtotal)}</p>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('itemsCarritoCount').textContent = carrito.reduce((sum, i) => sum + i.cantidad, 0);
    actualizarTotalesCarrito();
}

function actualizarTotalesCarrito() {
    const subtotal = carrito.reduce((sum, i) => sum + i.subtotal, 0);
    const iva = carrito.reduce((sum, i) => sum + i.iva_monto, 0);
    const ieps = carrito.reduce((sum, i) => sum + i.ieps_monto, 0);
    const total = subtotal + iva + ieps;

    document.getElementById('subtotalCarrito').textContent = formatMoney(subtotal);
    document.getElementById('ivaCarrito').textContent = formatMoney(iva);
    document.getElementById('iepsCarrito').textContent = formatMoney(ieps);
    document.getElementById('totalCarrito').textContent = formatMoney(total);
    document.getElementById('itemsCarritoCount').textContent = carrito.reduce((sum, i) => sum + i.cantidad, 0);
}

// =====================================================
// MODAL STOCK INSUFICIENTE
// =====================================================
function mostrarStockInsuficiente(productoId, cantidadSolicitada) {
    const producto = productosCache.find(p => p.id === productoId);
    if (!producto) return;

    const stockKey = cajaActual === 'Norte' ? 'stock_norte' : 'stock_sur';
    const otraKey = cajaActual === 'Norte' ? 'stock_sur' : 'stock_norte';
    const otraSucursal = cajaActual === 'Norte' ? 'Sur' : 'Norte';

    document.getElementById('stockInsufProducto').textContent = producto.nombre;
    document.getElementById('stockInsufSolicitado').textContent = cantidadSolicitada;
    document.getElementById('stockInsufDisponible').textContent = producto[stockKey] || 0;

    const stockOtra = producto[otraKey] || 0;
    if (stockOtra > 0) {
        document.getElementById('seccionOtraSucursal').classList.remove('hidden');
        document.getElementById('stockInsufOtraSucursal').textContent = 'Sucursal ' + otraSucursal;
        document.getElementById('stockInsufOtraCantidad').textContent = stockOtra;
    } else {
        document.getElementById('seccionOtraSucursal').classList.add('hidden');
    }

    document.getElementById('modalStockInsuficiente').classList.remove('hidden');
}

function cerrarModalStockInsuficiente() {
    document.getElementById('modalStockInsuficiente').classList.add('hidden');
}

// =====================================================
// MODAL COBRAR
// =====================================================
async function abrirModalCobrar() {
    if (carrito.length === 0) return;

    const total = carrito.reduce((sum, i) => sum + i.total, 0);
    document.getElementById('totalCobrarModal').textContent = formatMoney(total);
    document.getElementById('inputEfectivoRecibido').value = '';
    document.getElementById('cambioCalculado').textContent = '$0.00';
    document.getElementById('inputNotasVenta').value = '';

    document.getElementById('modalCobrar').classList.remove('hidden');

    // Reset método de pago y renderizar botones dinámicos (await para asegurar config cargada)
    metodoPagoSeleccionado = null;
    await renderMetodosPagoVentas();
    document.getElementById('seccionEfectivo').classList.remove('hidden');
}

function cerrarModalCobrar() {
    document.getElementById('modalCobrar').classList.add('hidden');
}

function getIconoMetodo(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes('efectivo')) return '💵';
    if (n.includes('tarjeta') || n.includes('mercado') || n.includes('visa')) return '💳';
    if (n.includes('transferencia')) return '🏦';
    if (n.includes('crédito') || n.includes('credito') || n.includes('fiado')) return '📝';
    if (n.includes('cheque')) return '🧾';
    return '💰';
}

async function renderMetodosPagoVentas() {
    const grid = document.getElementById('metodosPagoGrid');
    if (!grid) return;

    // Fetch directo con credenciales hardcodeadas (igual que configuracion.js)
    if ((window.CONFIG_NEGOCIO?.metodosPago || []).length === 0) {
        grid.innerHTML = '<p class="col-span-2 text-gray-400 italic text-xs">Cargando métodos...</p>';
        try {
            const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
            const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=id,nombre,tasa_base,aplica_iva,activo,orden&order=orden.asc`, {
                headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` }
            });
            if (r.ok) {
                const d = await r.json();
                if (d && d.length > 0) {
                    if (!window.CONFIG_NEGOCIO) window.CONFIG_NEGOCIO = {};
                    window.CONFIG_NEGOCIO.metodosPago = d;
                }
            }
        } catch(e) { console.error('renderMetodosPagoVentas:', e); }
    }

    const metodos = (window.CONFIG_NEGOCIO?.metodosPago || []).filter(m => m.activo);
    if (metodos.length === 0) {
        grid.innerHTML = '<p class="col-span-2 text-gray-400 italic text-xs">No hay métodos activos.</p>';
        return;
    }

    grid.innerHTML = metodos.map(m => {
        const esCreditoOFiado = m.nombre.toLowerCase().includes('crédito') || m.nombre.toLowerCase().includes('credito');
        const spanClass = esCreditoOFiado ? 'col-span-2' : '';
        const nombreCorto = m.nombre.length > 18 ? m.nombre.substring(0, 16) + '…' : m.nombre;
        return `<button onclick="seleccionarMetodoPago('${m.nombre.replace(/'/g, "\\'")}')"
            class="metodo-btn px-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:border-gray-300 ${spanClass}"
            data-metodo="${m.nombre}">
            ${getIconoMetodo(m.nombre)} ${nombreCorto}
        </button>`;
    }).join('');

    // Seleccionar el primero por defecto
    if (!metodoPagoSeleccionado && metodos.length > 0) {
        seleccionarMetodoPago(metodos[0].nombre);
    } else {
        actualizarBotonesMetodoPago();
    }
}

function seleccionarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;
    actualizarBotonesMetodoPago();

    // Mostrar/ocultar sección de efectivo
    if (metodo === 'Efectivo') {
        document.getElementById('seccionEfectivo').classList.remove('hidden');
    } else {
        document.getElementById('seccionEfectivo').classList.add('hidden');
    }
}

function actualizarBotonesMetodoPago() {
    document.querySelectorAll('.metodo-btn').forEach(btn => {
        if (btn.dataset.metodo === metodoPagoSeleccionado) {
            btn.classList.remove('border-gray-200', 'text-gray-600');
            btn.classList.add('border-primary', 'bg-primary/5', 'text-primary');
        } else {
            btn.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
            btn.classList.add('border-gray-200', 'text-gray-600');
        }
    });
}

function calcularCambio() {
    const total = carrito.reduce((sum, i) => sum + i.total, 0);
    const recibido = parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0;
    const cambio = Math.max(0, recibido - total);
    document.getElementById('cambioCalculado').textContent = formatMoney(cambio);
}

function setEfectivoRapido(cantidad) {
    const actual = parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0;
    document.getElementById('inputEfectivoRecibido').value = actual + cantidad;
    calcularCambio();
}

function setEfectivoExacto() {
    const total = carrito.reduce((sum, i) => sum + i.total, 0);
    document.getElementById('inputEfectivoRecibido').value = total.toFixed(2);
    calcularCambio();
}

function recalcularCarritoConPrecio() {
    tipoPrecioActivo = document.getElementById('selectTipoPrecio').value;

    carrito.forEach(item => {
        const producto = productosCache.find(p => p.id === item.producto_id);
        if (producto) {
            item.precio_unitario = producto[tipoPrecioActivo] || producto.precio_publico || 0;
            item.precio_tipo = tipoPrecioActivo.toUpperCase().replace('PRECIO_', '');
            item.subtotal = item.cantidad * item.precio_unitario;
            calcularImpuestosItem(item, producto);
        }
    });

    renderizarCarrito();

    // Actualizar total en modal
    const total = carrito.reduce((sum, i) => sum + i.total, 0);
    document.getElementById('totalCobrarModal').textContent = formatMoney(total);
    calcularCambio();
}

// =====================================================
// CONFIRMAR VENTA
// =====================================================
async function confirmarVenta() {
    if (carrito.length === 0) return;

    const total = carrito.reduce((sum, i) => sum + i.total, 0);
    const subtotal = carrito.reduce((sum, i) => sum + i.subtotal, 0);

    // Obtener vendedor
    const selectVendedor = document.getElementById('selectVendedorPOS');
    const vendedor_nombre = selectVendedor.options[selectVendedor.selectedIndex]?.text || null;

    // Obtener cliente (validado o texto libre)
    const inputCliente = document.getElementById('inputClienteVenta');
    const clienteTexto = inputCliente.value.trim().toUpperCase() || 'PÚBLICO GENERAL';
    const cliente = clienteSeleccionado ? clienteSeleccionado.nombre : clienteTexto;

    const notas = document.getElementById('inputNotasVenta').value.trim().toUpperCase();

    // Validar efectivo si aplica
    if (metodoPagoSeleccionado === 'Efectivo') {
        const recibido = parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0;
        if (recibido < total) {
            alert('El efectivo recibido es menor al total');
            return;
        }
    }

    const btn = document.getElementById('btnConfirmarVenta');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span> Procesando...';

    try {
        // 0. Obtener el último número de transacción (TXN#)
        let proximoTxnNum = 1;
        try {
            // Buscamos todas las categorías que contengan '#' (ya sea #, ##, #TXN)
            const resTxn = await fetch(
                `${window.SUPABASE_URL}/rest/v1/transacciones?categoria=like.*%23*&select=categoria`,
                {
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
                }
            );
            if (resTxn.ok) {
                const dataTxn = await resTxn.json();
                let maxNum = 0;
                dataTxn.forEach(t => {
                    if (t.categoria) {
                        const matchInfo = t.categoria.match(/\d+/);
                        if (matchInfo && matchInfo[0]) {
                            const val = parseInt(matchInfo[0], 10);
                            if (val > maxNum) maxNum = val;
                        }
                    }
                });
                if (maxNum > 0) {
                    proximoTxnNum = maxNum + 1;
                }
            }
        } catch (errorTxn) {
            console.warn("No se pudo obtener el último número de transacción, iniciando en 1", errorTxn);
        }

        const folioTxn = `##${proximoTxnNum}`;

        // 1. Crear transacción en tabla transacciones (para que aparezca en Ingresos)
        const esVentaRep = !!ventaDesdeReparacion;
        // Calcular comisión real según el método de pago seleccionado
        const tasaEfectivaPOS = (window.CONFIG_NEGOCIO?.tasasComision?.[metodoPagoSeleccionado] || 0);
        const comisionPOS = Math.round(total * tasaEfectivaPOS * 100) / 100;
        const transaccionData = {
            // El ID lo genera Supabase de forma incremental (BIGINT)
            created_at: new Date().toISOString(),
            monto: total,
            comision_bancaria: comisionPOS,
            monto_neto: total - comisionPOS,
            categoria: folioTxn,   // <-- Usando el contador TXN# dinámico
            tipo: 'Venta Directa',
            metodo_pago: metodoPagoSeleccionado,
            nombre_cliente: cliente,
            vendedor_nombre: vendedor_nombre, // NUEVA COLUMNA VENDEDOR
            sucursal: cajaActual,
            estado_cobro: metodoPagoSeleccionado === 'Crédito' ? 'Pendiente' : 'Pagado',
            saldo_pendiente: metodoPagoSeleccionado === 'Crédito' ? total : 0,
            notas: esVentaRep
                ? `Reparación ${ventaDesdeReparacion.folio} — ${carrito.length} items`
                : (notas || `Venta POS - ${carrito.length} productos`),
            orden_reparacion_id: esVentaRep ? ventaDesdeReparacion.orden_id : null
        };

        const resTransaccion = await fetch(`${window.SUPABASE_URL}/rest/v1/transacciones`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(transaccionData)
        });

        if (!resTransaccion.ok) {
            throw new Error('Error creando transacción');
        }

        const transaccionesG = await resTransaccion.json();
        const bdTransaccionId = transaccionesG[0].id;

        // 2. Crear items de venta
        const ventaItems = carrito.map(item => ({
            transaccion_id: bdTransaccionId,
            sesion_caja_id: sesionCajaActual.id,
            producto_id: item.producto_id,
            producto_nombre: item.producto_nombre,
            producto_sku: item.producto_sku,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            precio_tipo: item.precio_tipo,
            subtotal: item.subtotal,
            iva_porcentaje: item.iva_porcentaje,
            iva_monto: item.iva_monto,
            ieps_porcentaje: item.ieps_porcentaje,
            ieps_monto: item.ieps_monto,
            total: item.total,
            vendedor_nombre: vendedor_nombre // NUEVA COLUMNA VENDEDOR
        }));

        await fetch(`${window.SUPABASE_URL}/rest/v1/venta_items`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(ventaItems)
        });

        // 3. Descontar stock y registrar movimientos
        // CANDADO: Si la venta viene de una orden de reparación,
        // descontar de stock_taller, NO de stock de sucursal
        const esVentaReparacion = !!ventaDesdeReparacion;
        const stockKey = esVentaReparacion ? 'stock_taller' : (cajaActual === 'Norte' ? 'stock_norte' : 'stock_sur');

        for (const item of carrito) {
            const producto = productosCache.find(p => p.id === item.producto_id);
            if (!producto || producto.utiliza_stock === false) continue;

            const stockAnterior = producto[stockKey] || 0;
            const stockNuevo = Math.max(0, stockAnterior - item.cantidad);

            // Actualizar stock del producto
            const updateStock = {};
            updateStock[stockKey] = stockNuevo;

            await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${item.producto_id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateStock)
            });

            // Registrar movimiento de stock
            await fetch(`${window.SUPABASE_URL}/rest/v1/movimientos_stock`, {
                method: 'POST',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    producto_id: item.producto_id,
                    sucursal: esVentaReparacion ? 'Taller' : cajaActual,
                    tipo: esVentaReparacion ? 'VENTA_REPARACION' : 'VENTA',
                    cantidad: item.cantidad,
                    stock_anterior: stockAnterior,
                    stock_nuevo: stockNuevo,
                    referencia: esVentaReparacion
                        ? `Venta Reparación ${ventaDesdeReparacion.folio}`
                        : `Venta POS - TXN${bdTransaccionId}`
                })
            });

            // Actualizar cache local
            producto[stockKey] = stockNuevo;
        }

        // Si es venta de reparación, marcar orden como ENTREGADA
        if (esVentaReparacion && ventaDesdeReparacion.orden_id) {
            await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ventaDesdeReparacion.orden_id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estatus: 'COBRADA / ENTREGADA',
                    fecha_entrega: new Date().toISOString()
                })
            });
            ventaDesdeReparacion = null; // Limpiar después de procesar
        }

        // 4. Mostrar éxito
        const cambio = metodoPagoSeleccionado === 'Efectivo'
            ? (parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0) - total
            : 0;

        document.getElementById('ventaExitosaTotal').textContent = formatMoney(total);
        document.getElementById('ventaExitosaCambio').textContent = formatMoney(cambio);
        document.getElementById('seccionCambioExitosa').classList.toggle('hidden', metodoPagoSeleccionado !== 'Efectivo');

        cerrarModalCobrar();
        document.getElementById('modalVentaExitosa').classList.remove('hidden');

        // Limpiar carrito
        carrito = [];
        renderizarCarrito();
        filtrarProductosPOS(); // Refrescar grid con stock actualizado

    } catch (error) {
        console.error('Error procesando venta:', error);
        alert('Error al procesar la venta. Intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined align-middle mr-1">check_circle</span> Confirmar Venta';
    }
}

function cerrarModalVentaExitosa() {
    document.getElementById('modalVentaExitosa').classList.add('hidden');
}

// =====================================================
// MOVIMIENTOS DE CAJA
// =====================================================
function abrirModalMovimientoCaja(tipo) {
    document.getElementById('tipoMovimientoCaja').value = tipo;
    document.getElementById('tituloMovimientoCaja').textContent = tipo === 'ENTRADA' ? 'Entrada de Efectivo' : 'Salida de Efectivo';
    document.getElementById('inputMontoMovimiento').value = '';
    document.getElementById('inputConceptoMovimiento').value = '';
    document.getElementById('modalMovimientoCaja').classList.remove('hidden');
}

function cerrarModalMovimientoCaja() {
    document.getElementById('modalMovimientoCaja').classList.add('hidden');
}

async function confirmarMovimientoCaja() {
    const tipo = document.getElementById('tipoMovimientoCaja').value;
    const monto = parseFloat(document.getElementById('inputMontoMovimiento').value) || 0;
    const concepto = document.getElementById('inputConceptoMovimiento').value.trim().toUpperCase();

    if (monto <= 0) {
        alert('Ingresa un monto válido');
        return;
    }

    try {
        await fetch(`${window.SUPABASE_URL}/rest/v1/caja_movimientos`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                sesion_id: sesionCajaActual.id,
                tipo: tipo,
                monto: monto,
                concepto: concepto || (tipo === 'ENTRADA' ? 'Entrada de efectivo' : 'Salida de efectivo')
            })
        });

        cerrarModalMovimientoCaja();
        alert(`${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada correctamente`);
    } catch (error) {
        console.error('Error registrando movimiento:', error);
        alert('Error al registrar movimiento');
    }
}

// =====================================================
// CORTE DE CAJA
// =====================================================
async function abrirModalCorteCaja() {
    const hoy = new Date().toISOString().split('T')[0];

    document.getElementById('corteCajaNombre').textContent = cajaActual;
    document.getElementById('corteCajaFecha').textContent = new Date().toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    try {
        // 1. Obtener ventas del día por método de pago
        const resVentas = await fetch(`${window.SUPABASE_URL}/rest/v1/transacciones?sucursal=eq.${cajaActual}&created_at=gte.${hoy}T00:00:00&created_at=lt.${hoy}T23:59:59&select=metodo_pago,monto`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        const ventas = await resVentas.json();

        // Agrupar por método de pago
        const ventasPorMetodo = {};
        let totalVentas = 0;
        let ventasEfectivo = 0;

        ventas.forEach(v => {
            const metodo = v.metodo_pago || 'Otro';
            ventasPorMetodo[metodo] = (ventasPorMetodo[metodo] || 0) + (v.monto || 0);
            totalVentas += (v.monto || 0);
            if (metodo === 'Efectivo') {
                ventasEfectivo += (v.monto || 0);
            }
        });

        // Renderizar resumen
        const contenedor = document.getElementById('resumenVentasMetodo');
        contenedor.innerHTML = Object.entries(ventasPorMetodo)
            .sort((a, b) => b[1] - a[1])
            .map(([metodo, monto]) => `
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">${metodo}</span>
                    <span class="font-bold ${metodo === 'Efectivo' ? 'text-green-600' : 'text-gray-800'}">${formatMoney(monto)}</span>
                </div>
            `).join('') || '<p class="text-gray-400 text-sm italic">Sin ventas hoy</p>';

        document.getElementById('corteTotalVentas').textContent = formatMoney(totalVentas);
        document.getElementById('corteVentasEfectivo').textContent = formatMoney(ventasEfectivo);

        // 2. Obtener movimientos de caja
        const resMovimientos = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_movimientos?sesion_id=eq.${sesionCajaActual.id}&select=tipo,monto`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        const movimientos = await resMovimientos.json();

        const entradas = movimientos.filter(m => m.tipo === 'ENTRADA').reduce((sum, m) => sum + (m.monto || 0), 0);
        const salidas = movimientos.filter(m => m.tipo === 'SALIDA').reduce((sum, m) => sum + (m.monto || 0), 0);

        document.getElementById('corteFondoInicial').textContent = formatMoney(sesionCajaActual.fondo_inicial || 0);
        document.getElementById('corteEntradas').textContent = formatMoney(entradas);
        document.getElementById('corteSalidas').textContent = formatMoney(salidas);

        // 3. Calcular efectivo esperado
        const efectivoEsperado = (sesionCajaActual.fondo_inicial || 0) + ventasEfectivo + entradas - salidas;
        document.getElementById('corteEfectivoEsperado').textContent = formatMoney(efectivoEsperado);

        // Guardar para cálculos posteriores
        window.corteData = {
            efectivoEsperado,
            totalVentas,
            ventasEfectivo,
            entradas,
            salidas
        };

        // Reset inputs
        document.getElementById('inputEfectivoReal').value = '';
        document.getElementById('inputFondoSiguiente').value = '0';
        document.getElementById('inputNotasCierre').value = '';
        document.getElementById('montoDiferencia').textContent = '$0.00';
        document.getElementById('seccionDiferencia').className = 'mt-3 p-4 rounded-xl text-center bg-gray-50';
        document.getElementById('montoRetiro').textContent = '$0.00';

        document.getElementById('modalCorteCaja').classList.remove('hidden');

    } catch (error) {
        console.error('Error cargando datos del corte:', error);
        alert('Error al cargar datos del corte');
    }
}

function cerrarModalCorteCaja() {
    document.getElementById('modalCorteCaja').classList.add('hidden');
}

function calcularDiferenciaCaja() {
    const efectivoReal = parseFloat(document.getElementById('inputEfectivoReal').value) || 0;
    const efectivoEsperado = window.corteData?.efectivoEsperado || 0;
    const diferencia = efectivoReal - efectivoEsperado;

    document.getElementById('montoDiferencia').textContent = formatMoney(diferencia);

    const seccion = document.getElementById('seccionDiferencia');
    const label = document.getElementById('labelDiferencia');

    if (diferencia > 0) {
        seccion.className = 'mt-3 p-4 rounded-xl text-center bg-green-50';
        document.getElementById('montoDiferencia').className = 'text-3xl font-black text-green-600';
        label.className = 'text-xs font-bold uppercase text-green-600';
        label.textContent = 'Sobrante';
    } else if (diferencia < 0) {
        seccion.className = 'mt-3 p-4 rounded-xl text-center bg-red-50';
        document.getElementById('montoDiferencia').className = 'text-3xl font-black text-red-600';
        label.className = 'text-xs font-bold uppercase text-red-600';
        label.textContent = 'Faltante';
    } else {
        seccion.className = 'mt-3 p-4 rounded-xl text-center bg-gray-50';
        document.getElementById('montoDiferencia').className = 'text-3xl font-black text-gray-600';
        label.className = 'text-xs font-bold uppercase text-gray-600';
        label.textContent = 'Cuadra';
    }

    calcularRetiro();
}

function calcularRetiro() {
    const efectivoReal = parseFloat(document.getElementById('inputEfectivoReal').value) || 0;
    const fondoSiguiente = parseFloat(document.getElementById('inputFondoSiguiente').value) || 0;
    const retiro = Math.max(0, efectivoReal - fondoSiguiente);
    document.getElementById('montoRetiro').textContent = formatMoney(retiro);
}

async function confirmarCorteCaja() {
    const efectivoReal = parseFloat(document.getElementById('inputEfectivoReal').value);
    const fondoSiguiente = parseFloat(document.getElementById('inputFondoSiguiente').value) || 0;
    const notas = document.getElementById('inputNotasCierre').value.trim().toUpperCase();

    if (isNaN(efectivoReal)) {
        alert('Ingresa el efectivo real en caja');
        return;
    }

    if (!confirm('¿Estás seguro de cerrar la caja? Esta acción no se puede deshacer.')) return;

    const efectivoEsperado = window.corteData?.efectivoEsperado || 0;
    const diferencia = efectivoReal - efectivoEsperado;
    const retiro = Math.max(0, efectivoReal - fondoSiguiente);

    try {
        await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?id=eq.${sesionCajaActual.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fecha_cierre: new Date().toISOString(),
                efectivo_esperado: efectivoEsperado,
                efectivo_real: efectivoReal,
                diferencia: diferencia,
                fondo_siguiente: fondoSiguiente,
                retiro_banco: retiro,
                notas_cierre: notas,
                estado: 'CERRADA'
            })
        });

        alert('Caja cerrada correctamente');
        cerrarModalCorteCaja();

        // Volver a pantalla de selección
        document.getElementById('pantallaPOS').classList.add('hidden');
        document.getElementById('pantallaSeleccionCaja').classList.remove('hidden');
        carrito = [];
        cajaActual = null;
        sesionCajaActual = null;
        cargarEstadoCajas();

    } catch (error) {
        console.error('Error cerrando caja:', error);
        alert('Error al cerrar la caja');
    }
}

// =====================================================
// UTILIDADES
// =====================================================
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
}

// =====================================================
// CLIENTES, VENDEDORES Y TELEFONO (NUEVA LOGICA OBLIGATORIA)
// =====================================================
async function cargarVendedoresPOS() {
    const select = document.getElementById('selectVendedorPOS');
    if (!select) return;

    try {
        const res = await fetch(`${window.SUPABASE_URL}/rest/v1/sys_vendedores?select=id,nombre&or=(activo.eq.true,activo.is.null)&order=nombre.asc`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error("No hay vendedores o tabla no existe.");
        vendedoresCache = await res.json();

        select.innerHTML = '<option value="">Sin Vendedor Asignado</option>';
        vendedoresCache.forEach(v => {
            select.innerHTML += `<option value="${v.id}">${v.nombre}</option>`;
        });
    } catch (e) {
        console.warn("Vendedores no cargados:", e);
        select.innerHTML = '<option value="">Sin Vendedor Asignado</option>';
    }
}

async function cargarClientesPOS() {
    try {
        let all = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const res = await fetch(`${window.SUPABASE_URL}/rest/v1/clientes?select=id,nombre,telefono&order=nombre.asc&limit=${limit}&offset=${offset}`, {
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
            });
            if (!res.ok) break;
            const batch = await res.json();
            all = all.concat(batch);
            if (batch.length < limit) hasMore = false;
            else offset += limit;
        }

        clientesCache = all;
    } catch (e) {
        console.error("Error cargando clientes POS:", e);
    }
}

function filtrarClientesDropdown() {
    const query = document.getElementById('inputClienteVenta').value.toLowerCase().trim();
    const dropdown = document.getElementById('dropdownClientes');
    clienteSeleccionado = null; // Reset al escribir manualmente

    if (!query) {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
        return;
    }

    const filtrados = clientesCache.filter(c =>
        (c.nombre && c.nombre.toLowerCase().includes(query)) ||
        (c.telefono && c.telefono.includes(query))
    ).slice(0, 10); // Limitar a 10 sugerencias

    if (filtrados.length === 0) {
        dropdown.innerHTML = '<div class="p-3 text-xs text-gray-400 italic text-center">Sin resultados</div>';
    } else {
        dropdown.innerHTML = filtrados.map(c => `
            <div onclick="seleccionarClienteVenta('${c.id}')" 
                 class="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 flex flex-col transition-colors">
                <span class="font-bold text-sm text-gray-800">${c.nombre || 'Sin nombre'}</span>
                <span class="text-[10px] text-gray-500 font-mono tracking-widest uppercase">${c.telefono || 'Sin teléfono'}</span>
            </div>
        `).join('');
    }
    dropdown.classList.remove('hidden');
}

function mostrarDropdownClientes() {
    if (document.getElementById('inputClienteVenta').value.trim() && clientesCache.length > 0) {
        document.getElementById('dropdownClientes').classList.remove('hidden');
    }
}

function ocultarDropdownClientes() {
    // Retrasar para permitir click en el dropdown antes de ocultar
    setTimeout(() => {
        document.getElementById('dropdownClientes').classList.add('hidden');
    }, 200);
}

function seleccionarClienteVenta(id) {
    const cliente = clientesCache.find(c => c.id == id);
    if (!cliente) return;

    clienteSeleccionado = cliente;
    document.getElementById('inputClienteVenta').value = cliente.nombre || 'Sin nombre';
    document.getElementById('dropdownClientes').classList.add('hidden');

    // SOLICITAR TELÉFONO OBLIGATORIO
    abrirModalTelefonoCliente(cliente);
}

function abrirModalTelefonoCliente(cliente) {
    document.getElementById('nombreClienteTelefono').textContent = cliente.nombre || 'Cliente';
    document.getElementById('inputTelefonoCliente').value = ''; // FORZAR AL CAJERO A PREGUNTAR!
    document.getElementById('modalTelefonoCliente').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('inputTelefonoCliente').focus();
    }, 100);
}

function cancelarActualizacionTelefono() {
    // Si cancela, deshacemos la selección del cliente para no evadir la validación
    clienteSeleccionado = null;
    document.getElementById('inputClienteVenta').value = 'PÚBLICO GENERAL';
    document.getElementById('modalTelefonoCliente').classList.add('hidden');
}

async function guardarTelefonoCliente() {
    const telefonoNuevo = document.getElementById('inputTelefonoCliente').value.trim();

    if (telefonoNuevo.length < 10) {
        alert("Por favor ingresa un teléfono a 10 dígitos válido.");
        return;
    }

    if (!clienteSeleccionado) return;

    // Solo si ingresó algo distinto (o no lo tenía) procedemos a actualizar en Supabase
    if (clienteSeleccionado.telefono !== telefonoNuevo) {
        try {
            const res = await fetch(`${window.SUPABASE_URL}/rest/v1/clientes?id=eq.${clienteSeleccionado.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ telefono: telefonoNuevo })
            });

            if (res.ok) {
                // Actualizar cache local para no volver a consultarlo
                clienteSeleccionado.telefono = telefonoNuevo;
                const idx = clientesCache.findIndex(c => c.id === clienteSeleccionado.id);
                if (idx > -1) clientesCache[idx].telefono = telefonoNuevo;
            } else {
                console.warn("No se pudo actualizar el teléfono del cliente en DB.");
            }
        } catch (e) {
            console.error("Error guardando teléfono:", e);
        }
    }

    // Cerramos el modal
    document.getElementById('modalTelefonoCliente').classList.add('hidden');
}
