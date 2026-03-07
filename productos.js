// productos.js - Gestión de Productos Agrigarden

// Configuración Supabase - Fallback si api.js no cargó primero
if (!window.SUPABASE_URL) window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
if (!window.SUPABASE_KEY) window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let productosCache = [];
let productoSeleccionado = null;

// =====================================================
// 1. CARGA Y RENDERIZADO DE PRODUCTOS
// =====================================================
async function cargarProductos() {
    try {
        let allProducts = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos?select=*&order=nombre.asc&limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const batch = await response.json();
            allProducts = allProducts.concat(batch);

            if (batch.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        productosCache = allProducts;
        actualizarCategorias();
        filtrarProductos();
        actualizarKPIs();
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function actualizarCategorias() {
    const select = document.getElementById('filtroCategoria');
    const datalist = document.getElementById('listaCategorias');
    if (!select) return;

    const categorias = [...new Set(productosCache.map(p => p.categoria).filter(c => c))];

    select.innerHTML = '<option value="Todos">Todas las Categorías</option>' +
        categorias.map(c => `<option value="${c}">${c}</option>`).join('');

    if (datalist) {
        datalist.innerHTML = categorias.map(c => `<option value="${c}">`).join('');
    }
}

function filtrarProductos() {
    const busqueda = document.getElementById('busquedaProducto')?.value.toLowerCase() || '';
    const filtroCategoria = document.getElementById('filtroCategoria')?.value || 'Todos';
    const filtroSucursal = document.getElementById('filtroSucursal')?.value || 'Todos';

    const filtrados = productosCache.filter(p => {
        const coincideTexto =
            p.nombre?.toLowerCase().includes(busqueda) ||
            p.sku?.toLowerCase().includes(busqueda) ||
            p.codigo_barras?.includes(busqueda);

        const coincideCategoria = filtroCategoria === 'Todos' || p.categoria === filtroCategoria;

        let coincideSucursal = true;
        if (filtroSucursal !== 'Todos') {
            const stockKey = `stock_${filtroSucursal.toLowerCase()}`;
            coincideSucursal = (p[stockKey] || 0) > 0;
        }

        return coincideTexto && coincideCategoria && coincideSucursal && p.activo !== false;
    });

    renderizarTabla(filtrados);
}

function renderizarTabla(datos) {
    const tabla = document.getElementById('tablaProductos');
    const emptyState = document.getElementById('emptyState');
    if (!tabla) return;

    if (datos.length === 0) {
        tabla.innerHTML = '';
        emptyState?.classList.remove('hidden');
        return;
    }

    emptyState?.classList.add('hidden');

    tabla.innerHTML = datos.map(p => {
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_taller || 0) + (p.stock_matriz || 0);
        const stockBajo = stockTotal <= (p.stock_minimo || 0);
        const imgUrl = p.imagen_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre?.charAt(0) || 'P')}&background=f1f5f9&color=94a3b8`;

        return `
            <tr class="hover:bg-slate-50/80 transition-all border-b border-slate-50 cursor-pointer" onclick="abrirDetalleProducto(${p.id})">
                <td class="px-4 py-3">
                    <img src="${imgUrl}" class="size-12 rounded-xl object-cover border border-slate-100" alt="${p.nombre}">
                </td>
                <td class="px-4 py-3">
                    <p class="font-bold text-slate-800">${p.nombre}</p>
                    <p class="text-xs text-slate-400">${p.marca || ''}</p>
                </td>
                <td class="px-4 py-3 text-center font-mono text-xs text-slate-500">${p.sku || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase">${p.categoria || '-'}</span>
                </td>
                <td class="px-4 py-3 text-center font-bold ${(p.stock_norte || 0) <= (p.stock_minimo || 0) ? 'text-orange-500' : 'text-slate-600'}">${p.stock_norte || 0}</td>
                <td class="px-4 py-3 text-center font-bold ${(p.stock_sur || 0) <= (p.stock_minimo || 0) ? 'text-orange-500' : 'text-slate-600'}">${p.stock_sur || 0}</td>
                <td class="px-4 py-3 text-center font-bold text-slate-600">${p.stock_taller || 0}</td>
                <td class="px-4 py-3 text-center font-black ${stockBajo ? 'text-orange-500' : 'text-primary'}">${stockTotal}</td>
                <td class="px-4 py-3 text-right font-black text-slate-700">${formatMoney(p.precio_publico || 0)}</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                    <div class="flex justify-center gap-1">
                        <button onclick="editarProducto('${p.id}')" class="p-2 bg-slate-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="eliminarProducto('${p.id}')" class="p-2 bg-slate-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function actualizarKPIs() {
    const activos = productosCache.filter(p => p.activo !== false);
    const totalProductos = activos.length;

    const costoNorte = activos.reduce((sum, p) => sum + ((p.stock_norte || 0) * (p.costo || 0)), 0);
    const costoSur   = activos.reduce((sum, p) => sum + ((p.stock_sur   || 0) * (p.costo || 0)), 0);

    const valorInventario = activos.reduce((sum, p) => {
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_taller || 0) + (p.stock_matriz || 0);
        return sum + (stockTotal * (p.precio_publico || 0));
    }, 0);

    const categorias = new Set(activos.map(p => p.categoria).filter(c => c)).size;

    document.getElementById('kpiTotalProductos').textContent = totalProductos;
    document.getElementById('kpiCostoNorte').textContent = formatMoney(costoNorte);
    document.getElementById('kpiCostoSur').textContent   = formatMoney(costoSur);
    document.getElementById('kpiValorInventario').textContent = formatMoney(valorInventario);
    document.getElementById('kpiCategorias').textContent = categorias;
}

// =====================================================
// 2. MODAL CREAR/EDITAR PRODUCTO
// =====================================================
function abrirModalProducto() {
    document.getElementById('tituloModalProducto').textContent = 'Nuevo Producto';
    document.getElementById('formProducto').reset();
    document.getElementById('editProductoId').value = '';
    document.getElementById('previewImagenProducto').src = 'https://ui-avatars.com/api/?name=P&background=f1f5f9&color=94a3b8&size=160';

    // Configuración por defecto
    document.getElementById('esServicio').checked = false;
    document.getElementById('seVende').checked = true;
    document.getElementById('utilizaStock').checked = true;

    // Stock Norte
    document.getElementById('stockNorte').value = 0;
    document.getElementById('stockMinimoNorte').value = 0;
    document.getElementById('stockApartadoNorte').value = 0;
    document.getElementById('ubicacionNorte').value = '';

    // Stock Sur
    document.getElementById('stockSur').value = 0;
    document.getElementById('stockMinimoSur').value = 0;
    document.getElementById('stockApartadoSur').value = 0;
    document.getElementById('ubicacionSur').value = '';

    // Precios
    document.getElementById('precioPublico').value = 0;
    document.getElementById('precioVenta2').value = 0;
    document.getElementById('precioVenta3').value = 0;
    document.getElementById('precioMercadolibre').value = 0;
    document.getElementById('costoProducto').value = 0;

    // Impuestos
    document.getElementById('aplicaImpuestos').checked = true;
    document.getElementById('ivaPorcentaje').value = 16;
    document.getElementById('iepsPorcentaje').value = 0;
    document.getElementById('claveSat').value = '';

    document.getElementById('modalProducto').classList.remove('hidden');
}

function cerrarModalProducto() {
    document.getElementById('modalProducto').classList.add('hidden');
}

function editarProducto(id) {
    const producto = productosCache.find(p => String(p.id) === String(id));
    if (!producto) {
        console.error('Producto no encontrado:', id);
        return;
    }

    document.getElementById('tituloModalProducto').textContent = 'Editar Producto';
    document.getElementById('editProductoId').value = producto.id;
    document.getElementById('nombreProducto').value = producto.nombre || '';
    document.getElementById('skuProducto').value = producto.sku || '';
    document.getElementById('codigoBarrasProducto').value = producto.codigo_barras || '';
    document.getElementById('categoriaProducto').value = producto.categoria || '';
    document.getElementById('marcaProducto').value = producto.marca || '';
    document.getElementById('unidadProducto').value = producto.unidad_medida || 'PZA';
    document.getElementById('descripcionProducto').value = producto.descripcion || '';

    // Configuración
    document.getElementById('esServicio').checked = producto.es_servicio || false;
    document.getElementById('seVende').checked = producto.se_vende !== false; // default true
    document.getElementById('utilizaStock').checked = producto.utiliza_stock !== false; // default true

    // Stock Norte
    document.getElementById('stockNorte').value = producto.stock_norte || 0;
    document.getElementById('stockMinimoNorte').value = producto.stock_minimo_norte || 0;
    document.getElementById('stockApartadoNorte').value = producto.stock_apartado_norte || 0;
    document.getElementById('ubicacionNorte').value = producto.ubicacion_norte || '';

    // Stock Sur
    document.getElementById('stockSur').value = producto.stock_sur || 0;
    document.getElementById('stockMinimoSur').value = producto.stock_minimo_sur || 0;
    document.getElementById('stockApartadoSur').value = producto.stock_apartado_sur || 0;
    document.getElementById('ubicacionSur').value = producto.ubicacion_sur || '';

    // Precios
    document.getElementById('precioPublico').value = producto.precio_publico || 0;
    document.getElementById('precioVenta2').value = producto.precio_venta_2 || 0;
    document.getElementById('precioVenta3').value = producto.precio_venta_3 || 0;
    document.getElementById('precioMercadolibre').value = producto.precio_mercadolibre || 0;
    document.getElementById('costoProducto').value = producto.costo || 0;

    // Impuestos
    document.getElementById('aplicaImpuestos').checked = producto.aplica_impuestos !== false;
    document.getElementById('ivaPorcentaje').value = producto.iva_porcentaje ?? 16;
    document.getElementById('iepsPorcentaje').value = producto.ieps_porcentaje || 0;
    document.getElementById('claveSat').value = producto.clave_sat || '';

    if (producto.imagen_url) {
        document.getElementById('previewImagenProducto').src = producto.imagen_url;
    }

    document.getElementById('modalProducto').classList.remove('hidden');
}

async function guardarProducto() {
    const id = document.getElementById('editProductoId').value;
    const nombre = document.getElementById('nombreProducto').value.trim().toUpperCase();

    if (!nombre) {
        alert('El nombre del producto es requerido.');
        return;
    }

    const datos = {
        nombre: nombre,
        sku: document.getElementById('skuProducto').value.trim().toUpperCase() || null,
        codigo_barras: document.getElementById('codigoBarrasProducto').value.trim() || null,
        categoria: document.getElementById('categoriaProducto').value.trim().toUpperCase() || null,
        marca: document.getElementById('marcaProducto').value.trim().toUpperCase() || null,
        unidad_medida: document.getElementById('unidadProducto').value,
        descripcion: document.getElementById('descripcionProducto').value.trim() || null,

        // Configuración
        es_servicio: document.getElementById('esServicio').checked,
        se_vende: document.getElementById('seVende').checked,
        utiliza_stock: document.getElementById('utilizaStock').checked,

        // Stock Norte
        stock_norte: parseFloat(document.getElementById('stockNorte').value) || 0,
        stock_minimo_norte: parseFloat(document.getElementById('stockMinimoNorte').value) || 0,
        stock_apartado_norte: parseFloat(document.getElementById('stockApartadoNorte').value) || 0,
        ubicacion_norte: document.getElementById('ubicacionNorte').value.trim().toUpperCase() || null,

        // Stock Sur
        stock_sur: parseFloat(document.getElementById('stockSur').value) || 0,
        stock_minimo_sur: parseFloat(document.getElementById('stockMinimoSur').value) || 0,
        stock_apartado_sur: parseFloat(document.getElementById('stockApartadoSur').value) || 0,
        ubicacion_sur: document.getElementById('ubicacionSur').value.trim().toUpperCase() || null,

        // Precios
        precio_publico: parseFloat(document.getElementById('precioPublico').value) || 0,
        precio_venta_2: parseFloat(document.getElementById('precioVenta2').value) || 0,
        precio_venta_3: parseFloat(document.getElementById('precioVenta3').value) || 0,
        precio_mercadolibre: parseFloat(document.getElementById('precioMercadolibre').value) || 0,
        costo: parseFloat(document.getElementById('costoProducto').value) || 0,

        // Impuestos
        aplica_impuestos: document.getElementById('aplicaImpuestos').checked,
        iva_porcentaje: parseFloat(document.getElementById('ivaPorcentaje').value) || 0,
        ieps_porcentaje: parseFloat(document.getElementById('iepsPorcentaje').value) || 0,
        clave_sat: document.getElementById('claveSat').value.trim() || null,

        imagen_url: document.getElementById('previewImagenProducto').src.includes('ui-avatars.com') ? null : document.getElementById('previewImagenProducto').src
    };

    try {
        let response;
        if (id) {
            // Actualizar
            response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
        } else {
            // Crear
            response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos`, {
                method: 'POST',
                headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify(datos)
            });
        }

        if (response.ok) {
            cerrarModalProducto();
            cargarProductos();
            alert(id ? 'Producto actualizado.' : 'Producto creado exitosamente.');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.message || 'No se pudo guardar el producto.'));
        }
    } catch (error) {
        console.error('Error guardando producto:', error);
        alert('Error de conexión.');
    }
}

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });

        if (response.ok) {
            cargarProductos();
            cerrarDetalleProducto();
        }
    } catch (error) {
        console.error('Error eliminando producto:', error);
    }
}

// =====================================================
// 3. COMPRESIÓN Y SUBIDA DE IMAGEN
// =====================================================
async function procesarImagenProducto(input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loadingImagen').classList.remove('hidden');

    try {
        const imagenComprimida = await comprimirImagen(file, 30);
        document.getElementById('previewImagenProducto').src = imagenComprimida;
    } catch (error) {
        console.error('Error procesando imagen:', error);
        alert('Error al procesar la imagen.');
    } finally {
        document.getElementById('loadingImagen').classList.add('hidden');
    }
}

async function comprimirImagen(file, maxSizeKB = 30) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Reducir dimensiones si es muy grande
                const MAX_DIM = 400;
                if (width > height && width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                } else if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Comprimir hasta que sea < maxSizeKB
                let quality = 0.8;
                let result;
                do {
                    result = canvas.toDataURL('image/jpeg', quality);
                    quality -= 0.1;
                } while ((result.length / 1024) > maxSizeKB && quality > 0.1);

                resolve(result);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =====================================================
// 4. SLIDE-OVER DETALLE PRODUCTO
// =====================================================
function abrirDetalleProducto(id) {
    productoSeleccionado = productosCache.find(p => p.id === id);
    if (!productoSeleccionado) return;

    const p = productoSeleccionado;
    const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_matriz || 0);
    const imgUrl = p.imagen_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre?.charAt(0) || 'P')}&background=f1f5f9&color=94a3b8&size=200`;

    document.getElementById('contenidoDetalleProducto').innerHTML = `
        <div class="text-center">
            <img src="${imgUrl}" class="w-32 h-32 mx-auto rounded-2xl object-cover border-2 border-slate-100 shadow-lg ${p.imagen_url ? 'cursor-zoom-in hover:ring-4 hover:ring-primary/30 transition-all' : ''}" onclick="${p.imagen_url ? `abrirImagenGrande('${encodeURIComponent(p.imagen_url)}')` : ''}" title="${p.imagen_url ? 'Clic para ver en grande' : ''}">
            <h3 class="text-xl font-black text-slate-800 mt-4">${p.nombre}</h3>
            <p class="text-sm text-slate-400">${p.categoria || 'Sin categoría'} ${p.marca ? '• ' + p.marca : ''}</p>
            ${p.sku ? `<p class="font-mono text-xs text-slate-500 mt-1">SKU: ${p.sku}</p>` : ''}
            <div class="flex justify-center gap-2 mt-2">
                ${p.es_servicio ? '<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[10px] font-bold">SERVICIO</span>' : ''}
                ${p.se_vende ? '<span class="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-bold">SE VENDE</span>' : ''}
                ${p.utiliza_stock ? '<span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">USA STOCK</span>' : ''}
            </div>
        </div>

        ${p.descripcion ? `<p class="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">${p.descripcion}</p>` : ''}

        ${!p.es_servicio ? `
        <!-- Stock Norte -->
        <div class="bg-blue-50 p-4 rounded-2xl">
            <p class="text-xs font-black uppercase text-blue-600 mb-2">Sucursal Norte</p>
            <div class="grid grid-cols-4 gap-2 text-center">
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">STOCK</p>
                    <p class="text-lg font-black ${(p.stock_norte || 0) <= (p.stock_minimo_norte || 0) ? 'text-orange-500' : 'text-slate-700'}">${p.stock_norte || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">MÍNIMO</p>
                    <p class="text-lg font-bold text-orange-500">${p.stock_minimo_norte || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">APARTADO</p>
                    <p class="text-lg font-bold text-slate-600">${p.stock_apartado_norte || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">UBICACIÓN</p>
                    <p class="text-sm font-bold text-slate-600">${p.ubicacion_norte || '-'}</p>
                </div>
            </div>
        </div>

        <!-- Stock Sur -->
        <div class="bg-emerald-50 p-4 rounded-2xl">
            <p class="text-xs font-black uppercase text-emerald-600 mb-2">Sucursal Sur</p>
            <div class="grid grid-cols-4 gap-2 text-center">
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">STOCK</p>
                    <p class="text-lg font-black ${(p.stock_sur || 0) <= (p.stock_minimo_sur || 0) ? 'text-orange-500' : 'text-slate-700'}">${p.stock_sur || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">MÍNIMO</p>
                    <p class="text-lg font-bold text-orange-500">${p.stock_minimo_sur || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">APARTADO</p>
                    <p class="text-lg font-bold text-slate-600">${p.stock_apartado_sur || 0}</p>
                </div>
                <div class="bg-white p-2 rounded-xl">
                    <p class="text-[9px] font-bold text-slate-400">UBICACIÓN</p>
                    <p class="text-sm font-bold text-slate-600">${p.ubicacion_sur || '-'}</p>
                </div>
            </div>
        </div>

        <!-- Stock Total -->
        <div class="flex justify-between items-center px-4 py-3 bg-primary/10 rounded-xl">
            <span class="font-bold text-slate-600">Stock Total:</span>
            <span class="text-2xl font-black text-primary">${stockTotal}</span>
        </div>

        <!-- Piezas en Taller -->
        ${(p.stock_taller || 0) > 0 ? `
        <div class="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <div class="flex justify-between items-center cursor-pointer" onclick="toggleDetallesTaller(${p.id})">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-amber-600">build</span>
                    <span class="text-xs font-black uppercase text-amber-700">Piezas en Taller</span>
                </div>
                <span class="text-2xl font-black text-amber-600">${p.stock_taller}</span>
            </div>
            <p class="text-[10px] text-amber-600 mt-1">Clic para ver en qué órdenes</p>
            <div id="detalleTaller_${p.id}" class="hidden mt-3 space-y-1"></div>
        </div>
        ` : ''}
        ` : `
        <div class="flex items-center gap-2 px-4 py-3 bg-purple-50 rounded-xl">
            <span class="material-symbols-outlined text-purple-500">info</span>
            <span class="text-sm font-bold text-purple-600">Este producto es un servicio — no maneja existencias</span>
        </div>
        `}

        <!-- Precios -->
        <div class="bg-primary/5 p-4 rounded-2xl border border-primary/20">
            <p class="text-xs font-black uppercase text-primary mb-3">Precios de Venta</p>
            <div class="grid grid-cols-3 gap-2">
                <div class="bg-white p-3 rounded-xl text-center">
                    <p class="text-[9px] font-bold text-slate-400">PÚBLICO</p>
                    <p class="text-lg font-black text-primary">${formatMoney(p.precio_publico || 0)}</p>
                </div>
                <div class="bg-white p-3 rounded-xl text-center">
                    <p class="text-[9px] font-bold text-slate-400">VENTA 2</p>
                    <p class="text-lg font-black text-blue-600">${formatMoney(p.precio_venta_2 || 0)}</p>
                </div>
                <div class="bg-white p-3 rounded-xl text-center">
                    <p class="text-[9px] font-bold text-slate-400">VENTA 3</p>
                    <p class="text-lg font-black text-slate-600">${formatMoney(p.precio_venta_3 || 0)}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2">
                <div class="bg-white p-3 rounded-xl text-center">
                    <p class="text-[9px] font-bold text-slate-400">MERCADOLIBRE</p>
                    <p class="text-lg font-black text-yellow-600">${formatMoney(p.precio_mercadolibre || 0)}</p>
                </div>
                <div class="bg-white p-3 rounded-xl text-center">
                    <p class="text-[9px] font-bold text-slate-400">COSTO</p>
                    <p class="text-lg font-black text-red-500">${formatMoney(p.costo || 0)}</p>
                </div>
            </div>
        </div>

        <!-- Impuestos -->
        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-slate-50 p-3 rounded-xl">
                <p class="text-[9px] font-bold text-slate-400">IMPUESTOS</p>
                <p class="text-sm font-black ${p.aplica_impuestos ? 'text-green-600' : 'text-slate-400'}">${p.aplica_impuestos !== false ? 'SÍ' : 'NO'}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl">
                <p class="text-[9px] font-bold text-slate-400">IVA</p>
                <p class="text-sm font-black text-slate-700">${((p.iva_porcentaje ?? 16) < 1 ? (p.iva_porcentaje * 100) : (p.iva_porcentaje ?? 16))}%</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl">
                <p class="text-[9px] font-bold text-slate-400">IEPS</p>
                <p class="text-sm font-black text-slate-700">${((p.ieps_porcentaje || 0) < 1 && (p.ieps_porcentaje || 0) > 0 ? (p.ieps_porcentaje * 100) : (p.ieps_porcentaje || 0))}%</p>
            </div>
        </div>

        <!-- Info Adicional -->
        <div class="text-xs text-slate-400 space-y-1 bg-slate-50 p-4 rounded-xl">
            <p>Unidad: <span class="font-bold text-slate-600">${p.unidad_medida || 'PZA'}</span></p>
            ${p.codigo_barras ? `<p>Código de Barras: <span class="font-mono text-slate-600">${p.codigo_barras}</span></p>` : ''}
            ${p.clave_sat ? `<p>Clave SAT: <span class="font-mono text-slate-600">${p.clave_sat}</span></p>` : ''}
            <p>Creado: <span class="text-slate-600">${new Date(p.created_at).toLocaleDateString('es-MX')}</span></p>
        </div>
    `;

    document.getElementById('btnEditarProducto').onclick = () => editarProducto(id);
    document.getElementById('slideDetalleProducto').classList.add('active');

    // Cargar movimientos de stock asincrónicamente
    cargarMovimientosProducto(p.id);
}

async function cargarMovimientosProducto(productoId) {
    // Agregar sección de movimientos al contenido del detalle
    const contenido = document.getElementById('contenidoDetalleProducto');
    if (!contenido) return;

    // Agregar placeholder de movimientos
    const seccionMov = document.createElement('div');
    seccionMov.id = 'seccionMovimientos';
    seccionMov.innerHTML = `
        <div class="pt-2">
            <p class="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">history</span>
                Últimos Movimientos de Stock
            </p>
            <p class="text-center text-slate-300 text-xs font-bold animate-pulse py-4">Cargando...</p>
        </div>
    `;
    contenido.appendChild(seccionMov);

    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/movimientos_stock?select=*&producto_id=eq.${productoId}&order=created_at.desc&limit=20`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        const movimientos = await res.json();

        if (!Array.isArray(movimientos) || movimientos.length === 0) {
            seccionMov.innerHTML = `
                <div class="pt-2">
                    <p class="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">history</span>
                        Últimos Movimientos de Stock
                    </p>
                    <p class="text-center text-slate-300 text-xs italic py-4">Sin movimientos registrados</p>
                </div>`;
            return;
        }

        const badgeColor = {
            'ENTRADA': 'bg-green-100 text-green-700',
            'SALIDA': 'bg-red-100 text-red-700',
            'VENTA': 'bg-red-100 text-red-700',
            'VENTA_REPARACION': 'bg-red-100 text-red-700',
            'AJUSTE': 'bg-yellow-100 text-yellow-700',
            'TRANSFERENCIA_IN': 'bg-blue-100 text-blue-700',
            'TRANSFERENCIA_OUT': 'bg-purple-100 text-purple-700'
        };
        const tiposNegativos = new Set(['SALIDA', 'VENTA', 'VENTA_REPARACION', 'TRANSFERENCIA_OUT']);
        const esAdmin = sessionStorage.getItem('userRole') === 'admin';

        seccionMov.innerHTML = `
            <div class="pt-2">
                <p class="text-xs font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">history</span>
                    Últimos Movimientos (${movimientos.length})
                </p>
                <div class="space-y-2">
                    ${movimientos.map(m => {
            const fecha = new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
            const tipoClass = badgeColor[m.tipo] || 'bg-slate-100 text-slate-600';
            const esNegativo = tiposNegativos.has(m.tipo);
            const cantSign = esNegativo ? '-' : '+';
            return `
                        <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl">
                            <div class="flex items-center gap-2">
                                <span class="text-[9px] font-bold text-slate-400">${fecha}</span>
                                <span class="px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${tipoClass}">${m.tipo?.replace(/_/g, ' ') || '—'}</span>
                                <span class="text-[9px] text-slate-500 font-bold truncate max-w-[80px]">${m.referencia || ''}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="text-right">
                                    <p class="text-xs font-black ${esNegativo ? 'text-red-500' : 'text-green-600'}">${cantSign}${m.cantidad}</p>
                                    <p class="text-[8px] text-slate-400">${m.sucursal || ''}</p>
                                </div>
                                ${esAdmin ? `<button onclick="eliminarMovimiento('${m.id}', ${productoId})" class="p-1 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar movimiento"><span class="material-symbols-outlined text-sm">delete</span></button>` : ''}
                            </div>
                        </div>`;
        }).join('')}
                </div>
            </div>`;
    } catch (e) {
        seccionMov.innerHTML = '<p class="text-xs text-red-400 italic text-center py-2">Error cargando movimientos</p>';
    }
}

function cerrarDetalleProducto() {
    document.getElementById('slideDetalleProducto').classList.remove('active');
    productoSeleccionado = null;
}

async function eliminarMovimiento(movimientoId, productoId) {
    if (!confirm('¿Eliminar este movimiento del historial?')) return;
    try {
        const res = await fetch(`${window.SUPABASE_URL}/rest/v1/movimientos_stock?id=eq.${movimientoId}`, {
            method: 'DELETE',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        if (res.ok) abrirDetalleProducto(productoId);
    } catch(e) { console.error(e); }
}

// Mostrar/ocultar en qué órdenes de reparación están las piezas de taller
async function toggleDetallesTaller(productoId) {
    const contenedor = document.getElementById(`detalleTaller_${productoId}`);
    if (!contenedor) return;

    if (!contenedor.classList.contains('hidden')) {
        contenedor.classList.add('hidden');
        return;
    }

    contenedor.innerHTML = '<p class="text-xs text-amber-500 italic">Buscando órdenes...</p>';
    contenedor.classList.remove('hidden');

    try {
        // Buscar items de órdenes que tengan este producto y estatus EN_PROCESO
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?producto_id=eq.${productoId}&select=cantidad,orden_id,ordenes_reparacion(id,folio,estatus,mecanico)`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        const items = await res.json();

        // Filtrar solo las que están EN_PROCESO
        const enTaller = items.filter(i => i.ordenes_reparacion?.estatus === 'EN_PROCESO');

        if (enTaller.length === 0) {
            contenedor.innerHTML = '<p class="text-xs text-amber-500 italic">Sin órdenes activas en taller.</p>';
            return;
        }

        contenedor.innerHTML = enTaller.map(i => `
            <a href="ordenes_pendientes.html?id=${i.ordenes_reparacion.id}"
                class="flex justify-between items-center bg-white px-3 py-2 rounded-lg hover:bg-amber-100 transition-all">
                <div>
                    <span class="text-xs font-black text-primary">${i.ordenes_reparacion.folio}</span>
                    <span class="text-[10px] text-slate-400 ml-2">${i.ordenes_reparacion.mecanico}</span>
                </div>
                <span class="text-xs font-bold text-amber-700">${i.cantidad} pzas</span>
            </a>
        `).join('');

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = '<p class="text-xs text-red-500">Error cargando datos</p>';
    }
}

// =====================================================
// 5. EXPORTACIÓN EXCEL
// =====================================================
function exportarInventarioExcel() {
    const activos = productosCache.filter(p => p.activo !== false);
    if (activos.length === 0) { alert('No hay productos para exportar.'); return; }

    const headers = [
        'ID (No modificar)', 'Nombre del Producto', 'SKU', 'Categoría',
        'Stock Norte', 'Stock Sur', 'Stock Taller', 'Stock Total',
        'Precio Público', 'Precio Venta 2', 'Precio Venta 3', 'Costo',
        'Ubicación Norte', 'Ubicación Sur',
        'Impuestos', 'IVA %', 'IEPS %', 'Unidad', 'Clave SAT'
    ];

    const filas = activos.map(p => {
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_taller || 0);
        return [
            p.id,
            p.nombre || '',
            p.sku || '',
            p.categoria || '',
            p.stock_norte || 0,
            p.stock_sur || 0,
            p.stock_taller || 0,
            stockTotal,
            p.precio_publico || 0,
            p.precio_venta_2 || 0,
            p.precio_venta_3 || 0,
            p.costo || 0,
            p.ubicacion_norte || '',
            p.ubicacion_sur || '',
            p.aplica_impuestos ? 'Si' : 'No',
            p.iva_porcentaje ?? 16,
            p.ieps_porcentaje ?? 0,
            p.unidad_medida || 'PZA',
            p.clave_sat || ''
        ];
    });

    // Hoja principal con datos
    const ws = XLSX.utils.aoa_to_sheet([headers, ...filas]);

    // Anchos de columna
    ws['!cols'] = [
        { wch: 40 }, // ID
        { wch: 40 }, // Nombre
        { wch: 15 }, // SKU
        { wch: 20 }, // Categoría
        { wch: 14 }, // Stock Norte
        { wch: 12 }, // Stock Sur
        { wch: 14 }, // Stock Taller
        { wch: 13 }, // Stock Total
        { wch: 16 }, // Precio Público
        { wch: 15 }, // Precio Venta 2
        { wch: 15 }, // Precio Venta 3
        { wch: 12 }, // Costo
        { wch: 18 }, // Ubicación Norte
        { wch: 16 }, // Ubicación Sur
        { wch: 12 }, // Impuestos
        { wch: 8  }, // IVA %
        { wch: 8  }, // IEPS %
        { wch: 10 }, // Unidad
        { wch: 14 }  // Clave SAT
    ];

    // Primera fila fija (freeze)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Hoja de instrucciones
    const instrucciones = [
        ['INSTRUCCIONES DE USO'],
        [''],
        ['Este archivo permite actualizar inventario, costos y precios de forma masiva.'],
        ['Pasos:', '1. Modifica los valores en las columnas EDITABLES (marcadas abajo)'],
        ['',        '2. Guarda el archivo sin cambiar el nombre de las hojas'],
        ['',        '3. En el sistema, ve a Productos → Actualizar Inventario → carga este archivo'],
        [''],
        ['COLUMNAS EDITABLES (puedes modificar estos valores):'],
        ['E', 'Stock Norte'],
        ['F', 'Stock Sur'],
        ['G', 'Stock Taller'],
        ['I', 'Precio Público'],
        ['J', 'Precio Venta 2'],
        ['K', 'Precio Venta 3'],
        ['L', 'Costo'],
        [''],
        ['COLUMNAS DE SOLO LECTURA (NO modificar — el sistema las ignora al importar):'],
        ['A', 'ID — identificador interno del sistema (NO borrar)'],
        ['B', 'Nombre del Producto'],
        ['C', 'SKU'],
        ['D', 'Categoría'],
        ['H', 'Stock Total (calculado automáticamente)'],
        ['M', 'Ubicación Norte'],
        ['N', 'Ubicación Sur'],
        ['O', 'Impuestos'],
        ['P', 'IVA %'],
        ['Q', 'IEPS %'],
        ['R', 'Unidad'],
        ['S', 'Clave SAT'],
        [''],
        ['NOTA: El sistema identifica cada producto por el ID en columna A.'],
        ['Si agregas filas nuevas con nombre pero sin ID, se crearán como productos nuevos.']
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones);
    wsInstr['!cols'] = [{ wch: 6 }, { wch: 80 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.utils.book_append_sheet(wb, wsInstr, 'INSTRUCCIONES');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Inventario_Agrigarden_${fecha}.xlsx`);
}

// =====================================================
// 6. IMPORTACIÓN / ACTUALIZACIÓN EXCEL
// =====================================================
let previewActualizacion = [];

function abrirModalActualizarInventario() {
    document.getElementById('modalActualizarInv').classList.remove('hidden');
    _limpiarActualizacion();
}

function cerrarModalActualizarInventario() {
    document.getElementById('modalActualizarInv').classList.add('hidden');
    _limpiarActualizacion();
}

function _limpiarActualizacion() {
    previewActualizacion = [];
    const inp = document.getElementById('inputExcelActualizar');
    if (inp) inp.value = '';
    const prev = document.getElementById('previewActualizacion');
    if (prev) prev.classList.add('hidden');
    const btn = document.getElementById('btnConfirmarActualizacion');
    if (btn) btn.disabled = true;
}

function procesarExcelActualizacion(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const datos = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const filas = datos.slice(1).filter(row => row.length > 0);

            previewActualizacion = filas.map((row, idx) => {
                const excelId    = (row[0] || '').toString().trim();
                const nombre     = (row[1] || '').toString().trim();
                const sku        = (row[2] || '').toString().trim().toUpperCase();
                const categoria  = (row[3] || '').toString().trim().toUpperCase();
                const stockNorte = parseFloat(row[4]) || 0;
                const stockSur   = parseFloat(row[5]) || 0;
                const stockTaller= parseFloat(row[6]) || 0;
                // col H (row[7]) = Stock Total — ignorado
                const precioPublico = parseFloat(row[8]) || 0;
                const precioVenta2  = parseFloat(row[9]) || 0;
                const precioVenta3  = parseFloat(row[10]) || 0;
                const costo         = parseFloat(row[11]) || 0;
                const ubicNorte     = (row[12] || '').toString().trim();
                const ubicSur       = (row[13] || '').toString().trim();
                const aplImpuestos  = (row[14] || '').toString().trim().toLowerCase();
                const ivaPct        = parseFloat(row[15]) ?? 16;
                const iepsPct       = parseFloat(row[16]) ?? 0;
                const unidad        = (row[17] || 'PZA').toString().trim().toUpperCase();
                const claveSat      = (row[18] || '').toString().trim();

                if (!nombre) return { idx, estado: 'incompleto', nombre: '', sku, excelId };

                // Buscar match en cache
                let match = null;
                if (excelId) match = productosCache.find(p => String(p.id) === excelId);
                if (!match && sku) match = productosCache.find(p => p.sku && p.sku.toUpperCase() === sku);
                if (!match) match = productosCache.find(p => p.nombre && p.nombre.toUpperCase() === nombre.toUpperCase());

                return {
                    idx,
                    estado: match ? 'encontrado' : 'no_encontrado',
                    matchId: match ? match.id : null,
                    nombre, sku, categoria, excelId,
                    stockNorte, stockSur, stockTaller,
                    precioPublico, precioVenta2, precioVenta3, costo,
                    ubicNorte, ubicSur, aplImpuestos, ivaPct, iepsPct, unidad, claveSat,
                    esNuevo: false // el usuario puede marcar como nuevo
                };
            }).filter(Boolean);

            _renderPreviewActualizacion();
            document.getElementById('previewActualizacion').classList.remove('hidden');
            document.getElementById('btnConfirmarActualizacion').disabled = false;
        } catch (err) {
            console.error(err);
            alert('Error al leer el archivo. Verifica que sea el formato exportado por este sistema.');
        }
    };
    reader.readAsBinaryString(file);
}

function _renderPreviewActualizacion() {
    const encontrados  = previewActualizacion.filter(r => r.estado === 'encontrado').length;
    const noEncontrados= previewActualizacion.filter(r => r.estado === 'no_encontrado').length;
    const incompletos  = previewActualizacion.filter(r => r.estado === 'incompleto').length;

    document.getElementById('resumenActualizacion').innerHTML =
        `<span class="text-green-600 font-black">${encontrados} encontrados</span> · ` +
        `<span class="text-orange-500 font-black">${noEncontrados} no encontrados</span> · ` +
        `<span class="text-red-500 font-black">${incompletos} sin nombre (se omitirán)</span>`;

    document.getElementById('tablaPreviewActualizacion').innerHTML = previewActualizacion.map((r, i) => {
        if (r.estado === 'incompleto') {
            return `<tr class="bg-red-50 border-b border-red-100">
                <td class="px-3 py-2 text-center"><span class="text-[9px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded">✗ SIN NOMBRE</span></td>
                <td class="px-3 py-2 text-xs text-red-400 italic" colspan="5">Fila ${i + 2} — se omitirá</td>
            </tr>`;
        }
        if (r.estado === 'encontrado') {
            return `<tr class="bg-green-50/60 border-b border-green-100">
                <td class="px-3 py-2 text-center"><span class="text-[9px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded">✓ OK</span></td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${r.sku || '-'}</td>
                <td class="px-3 py-2 font-bold text-xs">${r.nombre}</td>
                <td class="px-3 py-2 text-center text-xs">${r.stockNorte} / ${r.stockSur} / ${r.stockTaller}</td>
                <td class="px-3 py-2 text-center text-xs text-primary font-bold">${formatMoney(r.precioPublico)}</td>
                <td class="px-3 py-2 text-center text-xs text-red-500 font-bold">${formatMoney(r.costo)}</td>
            </tr>`;
        }
        // no_encontrado
        return `<tr class="bg-orange-50/60 border-b border-orange-100" id="fila-act-${i}">
            <td class="px-3 py-2 text-center"><span class="text-[9px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded">⚠ NO ENCONTRADO</span></td>
            <td class="px-3 py-2 font-mono text-xs text-slate-500">${r.sku || '-'}</td>
            <td class="px-3 py-2 font-bold text-xs">${r.nombre}</td>
            <td class="px-3 py-2" colspan="3">
                <div class="flex items-center gap-2 flex-wrap">
                    <div class="relative flex-1 min-w-[160px]">
                        <input type="text" placeholder="Buscar producto existente..."
                            oninput="buscarProductoRelacionar(${i}, this.value)"
                            class="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
                            id="searchRelacionar-${i}">
                        <div id="dropdownRelacionar-${i}" class="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden max-h-40 overflow-auto"></div>
                    </div>
                    <label class="flex items-center gap-1 text-[10px] font-bold text-slate-500 cursor-pointer whitespace-nowrap">
                        <input type="checkbox" onchange="marcarComoNuevo(${i}, this.checked)" class="rounded">
                        Agregar como nuevo
                    </label>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function buscarProductoRelacionar(rowIndex, query) {
    const dropdown = document.getElementById(`dropdownRelacionar-${rowIndex}`);
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }
    const q = query.toUpperCase();
    const resultados = productosCache.filter(p =>
        (p.nombre && p.nombre.toUpperCase().includes(q)) ||
        (p.sku && p.sku.toUpperCase().includes(q))
    ).slice(0, 8);
    if (resultados.length === 0) { dropdown.classList.add('hidden'); return; }
    dropdown.innerHTML = resultados.map(p => `
        <div onclick="relacionarProducto(${rowIndex}, ${p.id})"
            class="px-3 py-2 text-xs hover:bg-primary/10 cursor-pointer border-b border-slate-50">
            <span class="font-bold">${p.nombre}</span>
            ${p.sku ? `<span class="text-slate-400 ml-1">${p.sku}</span>` : ''}
        </div>`).join('');
    dropdown.classList.remove('hidden');
}

function relacionarProducto(rowIndex, productoId) {
    previewActualizacion[rowIndex].matchId = productoId;
    previewActualizacion[rowIndex].estado = 'relacionado';
    previewActualizacion[rowIndex].esNuevo = false;
    const prod = productosCache.find(p => p.id === productoId);
    const search = document.getElementById(`searchRelacionar-${rowIndex}`);
    if (search && prod) search.value = prod.nombre;
    const dropdown = document.getElementById(`dropdownRelacionar-${rowIndex}`);
    if (dropdown) dropdown.classList.add('hidden');
    const fila = document.getElementById(`fila-act-${rowIndex}`);
    if (fila) fila.classList.replace('bg-orange-50/60', 'bg-blue-50/60');
    const badge = fila?.querySelector('span');
    if (badge) { badge.textContent = '🔗 RELACIONADO'; badge.className = 'text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded'; }
}

function marcarComoNuevo(rowIndex, checked) {
    previewActualizacion[rowIndex].esNuevo = checked;
    if (checked) {
        previewActualizacion[rowIndex].matchId = null;
        previewActualizacion[rowIndex].estado = 'no_encontrado';
    }
}

async function confirmarActualizacion() {
    const btn = document.getElementById('btnConfirmarActualizacion');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span> Procesando...';

    let actualizados = 0, agregados = 0, ignorados = 0, errores = 0;

    for (const r of previewActualizacion) {
        if (r.estado === 'incompleto') { ignorados++; continue; }

        const camposActualizables = {
            stock_norte: r.stockNorte, stock_sur: r.stockSur, stock_taller: r.stockTaller,
            precio_publico: r.precioPublico, precio_venta_2: r.precioVenta2,
            precio_venta_3: r.precioVenta3, costo: r.costo
        };

        if ((r.estado === 'encontrado' || r.estado === 'relacionado') && r.matchId) {
            try {
                const res = await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${r.matchId}`, {
                    method: 'PATCH',
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(camposActualizables)
                });
                res.ok ? actualizados++ : errores++;
            } catch { errores++; }
        } else if (r.esNuevo && r.nombre) {
            const parseSiNo = v => { const s = (v || '').toString().toLowerCase(); return s === 'si' || s === 'sí' || s === 'yes' || s === '1' || s === 'true'; };
            const nuevoProducto = {
                nombre: r.nombre.toUpperCase(), sku: r.sku || null, categoria: r.categoria || null,
                stock_norte: r.stockNorte, stock_sur: r.stockSur, stock_taller: r.stockTaller,
                precio_publico: r.precioPublico, precio_venta_2: r.precioVenta2,
                precio_venta_3: r.precioVenta3, costo: r.costo,
                ubicacion_norte: r.ubicNorte || null, ubicacion_sur: r.ubicSur || null,
                aplica_impuestos: parseSiNo(r.aplImpuestos),
                iva_porcentaje: r.ivaPct, ieps_porcentaje: r.iepsPct,
                unidad_medida: r.unidad || 'PZA', clave_sat: r.claveSat || null,
                activo: true, utiliza_stock: true
            };
            try {
                const res = await fetch(`${window.SUPABASE_URL}/rest/v1/productos`, {
                    method: 'POST',
                    headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify(nuevoProducto)
                });
                res.ok ? agregados++ : errores++;
            } catch { errores++; }
        } else {
            ignorados++;
        }
    }

    alert(`Actualización completada:\n✅ ${actualizados} actualizados\n➕ ${agregados} agregados nuevos\n⏭ ${ignorados} ignorados${errores > 0 ? `\n❌ ${errores} con errores` : ''}`);
    cerrarModalActualizarInventario();
    cargarProductos();
}

// =====================================================
// 6. TRANSFERENCIA DE STOCK
// =====================================================
function abrirModalTransferencia() {
    if (!productoSeleccionado) return;

    document.getElementById('transferProductoId').value = productoSeleccionado.id;
    document.getElementById('transferProductoNombre').textContent = productoSeleccionado.nombre;
    document.getElementById('transferCantidad').value = 1;
    document.getElementById('transferNotas').value = '';
    actualizarStockDisponible();
    document.getElementById('modalTransferencia').classList.remove('hidden');
}

function cerrarModalTransferencia() {
    document.getElementById('modalTransferencia').classList.add('hidden');
}

function actualizarStockDisponible() {
    if (!productoSeleccionado) return;
    const origen = document.getElementById('transferOrigen').value.toLowerCase();
    const stockKey = `stock_${origen}`;
    const disponible = productoSeleccionado[stockKey] || 0;
    document.getElementById('stockDisponibleOrigen').textContent = `Disponible: ${disponible}`;
}

async function ejecutarTransferencia() {
    const productoId = document.getElementById('transferProductoId').value;
    const origen = document.getElementById('transferOrigen').value;
    const destino = document.getElementById('transferDestino').value;
    const cantidad = parseFloat(document.getElementById('transferCantidad').value) || 0;
    const notas = document.getElementById('transferNotas').value.trim().toUpperCase();

    if (origen === destino) {
        alert('El origen y destino deben ser diferentes.');
        return;
    }

    if (cantidad <= 0) {
        alert('La cantidad debe ser mayor a 0.');
        return;
    }

    const origenKey = `stock_${origen.toLowerCase()}`;
    const destinoKey = `stock_${destino.toLowerCase()}`;
    const stockOrigen = productoSeleccionado[origenKey] || 0;

    if (cantidad > stockOrigen) {
        alert(`Stock insuficiente. Disponible en ${origen}: ${stockOrigen}`);
        return;
    }

    try {
        // 1. Actualizar producto
        const nuevoStockOrigen = stockOrigen - cantidad;
        const nuevoStockDestino = (productoSeleccionado[destinoKey] || 0) + cantidad;

        const updateData = {};
        updateData[origenKey] = nuevoStockOrigen;
        updateData[destinoKey] = nuevoStockDestino;

        await fetch(`${window.SUPABASE_URL}/rest/v1/productos?id=eq.${productoId}`, {
            method: 'PATCH',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        // 2. Registrar transferencia
        await fetch(`${window.SUPABASE_URL}/rest/v1/transferencias_stock`, {
            method: 'POST',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                producto_id: productoId,
                sucursal_origen: origen,
                sucursal_destino: destino,
                cantidad: cantidad,
                notas: notas || null
            })
        });

        // 3. Registrar movimientos
        const movimientos = [
            {
                producto_id: productoId,
                sucursal: origen,
                tipo: 'TRANSFERENCIA_OUT',
                cantidad: cantidad,
                stock_anterior: stockOrigen,
                stock_nuevo: nuevoStockOrigen,
                referencia: `Transferencia a ${destino}`,
                notas: notas || null,
                usuario: sessionStorage.getItem('userName') || 'Usuario'
            },
            {
                producto_id: productoId,
                sucursal: destino,
                tipo: 'TRANSFERENCIA_IN',
                cantidad: cantidad,
                stock_anterior: productoSeleccionado[destinoKey] || 0,
                stock_nuevo: nuevoStockDestino,
                referencia: `Transferencia desde ${origen}`,
                notas: notas || null,
                usuario: sessionStorage.getItem('userName') || 'Usuario'
            }
        ];

        await fetch(`${window.SUPABASE_URL}/rest/v1/movimientos_stock`, {
            method: 'POST',
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(movimientos)
        });

        alert(`¡Transferencia completada! ${cantidad} unidades de ${origen} a ${destino}.`);
        cerrarModalTransferencia();
        cerrarDetalleProducto();
        cargarProductos();

    } catch (error) {
        console.error('Error en transferencia:', error);
        alert('Error al realizar la transferencia.');
    }
}

// =====================================================
// 8. UTILIDADES
// =====================================================
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
}

// =====================================================
// 9. LIGHTBOX — VER IMAGEN EN GRANDE
// =====================================================
function abrirImagenGrande(imgUrlEncoded) {
    const imgUrl = decodeURIComponent(imgUrlEncoded);

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.85);
        display: flex; align-items: center; justify-content: center;
        cursor: zoom-out; opacity: 0; transition: opacity 0.3s ease;
    `;

    overlay.innerHTML = `
        <div style="position:relative; max-width:90vw; max-height:90vh;">
            <img src="${imgUrl}" style="max-width:90vw; max-height:85vh; object-fit:contain; border-radius:16px; box-shadow:0 25px 60px rgba(0,0,0,0.5);">
            <button onclick="cerrarImagenGrande()" style="
                position:absolute; top:-12px; right:-12px;
                width:36px; height:36px; border-radius:50%;
                background:white; border:none; cursor:pointer;
                font-size:18px; font-weight:900; color:#334155;
                box-shadow:0 4px 15px rgba(0,0,0,0.3);
                display:flex; align-items:center; justify-content:center;
            ">✕</button>
        </div>
    `;

    overlay.onclick = (e) => {
        if (e.target === overlay) cerrarImagenGrande();
    };

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    // Cerrar con Escape
    document.addEventListener('keydown', _lightboxEscHandler);
}

function _lightboxEscHandler(e) {
    if (e.key === 'Escape') cerrarImagenGrande();
}

function cerrarImagenGrande() {
    const overlay = document.getElementById('lightboxOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
    document.removeEventListener('keydown', _lightboxEscHandler);
}
