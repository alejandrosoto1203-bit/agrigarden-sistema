// productos.js - Gestión de Productos Agrigarden

// Configuración Supabase - Fallback si api.js no cargó primero
if (!window.SUPABASE_URL) window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
if (!window.SUPABASE_KEY) window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let productosCache = [];
let productosImportacion = [];
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
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_matriz || 0);
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
    const stockBajo = activos.filter(p => {
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_matriz || 0);
        return stockTotal <= (p.stock_minimo || 0);
    }).length;

    const valorInventario = activos.reduce((sum, p) => {
        const stockTotal = (p.stock_norte || 0) + (p.stock_sur || 0) + (p.stock_matriz || 0);
        return sum + (stockTotal * (p.precio_publico || 0));
    }, 0);

    const categorias = new Set(activos.map(p => p.categoria).filter(c => c)).size;

    document.getElementById('kpiTotalProductos').textContent = totalProductos;
    document.getElementById('kpiStockBajo').textContent = stockBajo;
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
            <img src="${imgUrl}" class="w-32 h-32 mx-auto rounded-2xl object-cover border-2 border-slate-100 shadow-lg">
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
                <p class="text-sm font-black text-slate-700">${p.iva_porcentaje ?? 16}%</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl">
                <p class="text-[9px] font-bold text-slate-400">IEPS</p>
                <p class="text-sm font-black text-slate-700">${p.ieps_porcentaje || 0}%</p>
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
}

function cerrarDetalleProducto() {
    document.getElementById('slideDetalleProducto').classList.remove('active');
    productoSeleccionado = null;
}

// =====================================================
// 5. IMPORTACIÓN EXCEL
// =====================================================
function abrirModalImportar() {
    document.getElementById('modalImportar').classList.remove('hidden');
    limpiarImportacion();
}

function cerrarModalImportar() {
    document.getElementById('modalImportar').classList.add('hidden');
    limpiarImportacion();
}

function limpiarImportacion() {
    productosImportacion = [];
    document.getElementById('inputExcel').value = '';
    document.getElementById('previewImportacion').classList.add('hidden');
    document.getElementById('btnConfirmarImport').disabled = true;
}

function procesarExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const datos = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Función para parsear Si/No a boolean
            const parseSiNo = (val) => {
                if (!val) return false;
                const str = val.toString().trim().toLowerCase();
                return str === 'si' || str === 'sí' || str === 'yes' || str === '1' || str === 'true';
            };

            // Saltar encabezado si existe - Requiere nombre (columna A)
            const filas = datos.slice(1).filter(row => row.length > 0 && row[0]);

            // Mapeo de las 27 columnas (A-AA)
            productosImportacion = filas.map(row => ({
                // A: Nombre del Producto
                nombre: (row[0] || '').toString().trim().toUpperCase(),
                // B: Es un Servicio (Si/No)
                es_servicio: parseSiNo(row[1]),
                // C: Se Vende (Si/No)
                se_vende: row[2] !== undefined ? parseSiNo(row[2]) : true,
                // D: Descripción
                descripcion: (row[3] || '').toString().trim() || null,
                // E: Categoría
                categoria: (row[4] || '').toString().trim().toUpperCase() || null,
                // F: Marca
                marca: (row[5] || '').toString().trim().toUpperCase() || null,
                // G: Unidad de Venta
                unidad_medida: (row[6] || 'PZA').toString().trim().toUpperCase(),
                // H: Código de Barras
                codigo_barras: (row[7] || '').toString().trim() || null,
                // I: SKU
                sku: (row[8] || '').toString().trim().toUpperCase() || null,
                // J: Utiliza Stock (Si/No)
                utiliza_stock: row[9] !== undefined ? parseSiNo(row[9]) : true,
                // K: Stock Total Norte
                stock_norte: parseFloat(row[10]) || 0,
                // L: Stock Mínimo Norte
                stock_minimo_norte: parseFloat(row[11]) || 0,
                // M: Stock Apartado Norte
                stock_apartado_norte: parseFloat(row[12]) || 0,
                // N: Ubicación Norte
                ubicacion_norte: (row[13] || '').toString().trim().toUpperCase() || null,
                // O: Stock Sur
                stock_sur: parseFloat(row[14]) || 0,
                // P: Stock Mínimo Sur
                stock_minimo_sur: parseFloat(row[15]) || 0,
                // Q: Stock Apartado Sur
                stock_apartado_sur: parseFloat(row[16]) || 0,
                // R: Ubicación Sur
                ubicacion_sur: (row[17] || '').toString().trim().toUpperCase() || null,
                // S: Precio Público
                precio_publico: parseFloat(row[18]) || 0,
                // T: Precio Venta 2
                precio_venta_2: parseFloat(row[19]) || 0,
                // U: Precio Venta 3
                precio_venta_3: parseFloat(row[20]) || 0,
                // V: Precio MercadoLibre
                precio_mercadolibre: parseFloat(row[21]) || 0,
                // W: Costo
                costo: parseFloat(row[22]) || 0,
                // X: Impuestos (Si/No)
                aplica_impuestos: row[23] !== undefined ? parseSiNo(row[23]) : true,
                // Y: IVA %
                iva_porcentaje: parseFloat(row[24]) || 16,
                // Z: IEPS %
                ieps_porcentaje: parseFloat(row[25]) || 0,
                // AA: Clave SAT
                clave_sat: (row[26] || '').toString().trim() || null,
                // Defaults
                activo: true
            }));

            // Mostrar preview
            document.getElementById('contadorImportacion').textContent = productosImportacion.length;
            document.getElementById('tablaPreviewImport').innerHTML = productosImportacion.slice(0, 10).map(p => `
                <tr class="border-b border-slate-100">
                    <td class="px-3 py-2 font-mono">${p.sku || '-'}</td>
                    <td class="px-3 py-2 font-bold">${p.nombre}</td>
                    <td class="px-3 py-2">${p.categoria || '-'}</td>
                    <td class="px-3 py-2 text-center">${p.stock_norte}</td>
                    <td class="px-3 py-2 text-center">${p.stock_sur}</td>
                    <td class="px-3 py-2 text-right font-bold text-primary">${formatMoney(p.precio_publico)}</td>
                </tr>
            `).join('') + (productosImportacion.length > 10 ? `<tr><td colspan="6" class="px-3 py-2 text-center text-slate-400 italic">...y ${productosImportacion.length - 10} más</td></tr>` : '');

            document.getElementById('previewImportacion').classList.remove('hidden');
            document.getElementById('btnConfirmarImport').disabled = false;

        } catch (error) {
            console.error('Error procesando Excel:', error);
            alert('Error al leer el archivo Excel. Verifica el formato.');
        }
    };
    reader.readAsBinaryString(file);
}

async function confirmarImportacion() {
    if (productosImportacion.length === 0) return;

    const btn = document.getElementById('btnConfirmarImport');
    btn.disabled = true;

    const BATCH_SIZE = 1000; // Límite máximo de Supabase
    const totalBatches = Math.ceil(productosImportacion.length / BATCH_SIZE);
    let importados = 0;
    let errores = 0;

    try {
        for (let i = 0; i < totalBatches; i++) {
            const batch = productosImportacion.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            btn.innerHTML = `<span class="animate-spin material-symbols-outlined">sync</span> Importando lote ${i + 1}/${totalBatches} (${batch.length} productos)`;

            try {
                const response = await fetch(`${window.SUPABASE_URL}/rest/v1/productos`, {
                    method: 'POST',
                    headers: {
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(batch)
                });

                if (response.ok) {
                    importados += batch.length;
                } else {
                    const errorText = await response.text();
                    errores += batch.length;
                    console.error('Error en lote', i + 1, errorText);
                    // Mostrar el error real al usuario
                    alert(`Error en lote ${i + 1}: ${errorText}`);
                }
            } catch (batchError) {
                errores += batch.length;
                console.error('Error en lote', i + 1, batchError);
                alert(`Error de conexión en lote ${i + 1}: ${batchError.message}`);
            }

            // Pequeña pausa entre lotes
            if (i < totalBatches - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (errores === 0) {
            alert(`¡${importados} productos importados exitosamente!`);
        } else {
            alert(`Importación completada:\n✅ ${importados} productos importados\n❌ ${errores} con errores (posibles SKUs duplicados)`);
        }

        cerrarModalImportar();
        cargarProductos();

    } catch (error) {
        console.error('Error importando:', error);
        alert('Error de conexión. Intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Importar Productos';
    }
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
                notas: notas || null
            },
            {
                producto_id: productoId,
                sucursal: destino,
                tipo: 'TRANSFERENCIA_IN',
                cantidad: cantidad,
                stock_anterior: productoSeleccionado[destinoKey] || 0,
                stock_nuevo: nuevoStockDestino,
                referencia: `Transferencia desde ${origen}`,
                notas: notas || null
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
// 7. DESCARGA DE PLANTILLA EXCEL
// =====================================================
function descargarPlantillaExcel() {
    // Encabezados de la plantilla (26 columnas A-Z)
    const headers = [
        'Nombre del Producto',        // A
        'Es un Servicio',             // B (Si/No)
        'Se Vende',                   // C (Si/No)
        'Descripción',                // D
        'Categoría',                  // E
        'Marca',                      // F
        'Unidad de Venta',            // G
        'Código de Barras',           // H
        'SKU',                        // I
        'Utiliza Stock',              // J (Si/No)
        'Stock Total Norte',          // K
        'Stock Mínimo Norte',         // L
        'Stock Apartado Norte',       // M
        'Ubicación Norte',            // N
        'Stock Sur',                  // O
        'Stock Mínimo Sur',           // P
        'Stock Apartado Sur',         // Q
        'Ubicación Sur',              // R
        'Precio Público',             // S
        'Precio Venta 2',             // T
        'Precio Venta 3',             // U
        'Precio MercadoLibre',        // V
        'Costo',                      // W
        'Impuestos',                  // X (Si/No)
        'IVA %',                      // Y
        'IEPS %',                     // Z
        'Clave SAT'                   // AA
    ];

    // Fila de ejemplo (27 columnas A-AA)
    const ejemploRow = [
        'FERTILIZANTE ORGÁNICO',      // Nombre del Producto
        'No',                         // Es un Servicio
        'Si',                         // Se Vende
        'Fertilizante natural para plantas', // Descripción
        'FERTILIZANTES',              // Categoría
        'AGRIQUÍM',                   // Marca
        'KG',                         // Unidad de Venta
        '7501234567890',              // Código de Barras
        'FO-001',                     // SKU
        'Si',                         // Utiliza Stock
        50,                           // Stock Total Norte
        10,                           // Stock Mínimo Norte
        0,                            // Stock Apartado Norte
        'ESTANTE A-1',                // Ubicación Norte
        30,                           // Stock Sur
        5,                            // Stock Mínimo Sur
        0,                            // Stock Apartado Sur
        'ESTANTE B-2',                // Ubicación Sur
        150.00,                       // Precio Público
        120.00,                       // Precio Venta 2
        100.00,                       // Precio Venta 3
        180.00,                       // Precio MercadoLibre
        80.00,                        // Costo
        'Si',                         // Impuestos
        16,                           // IVA %
        0,                            // IEPS %
        '43211501'                    // Clave SAT
    ];

    // Crear workbook y worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ejemploRow]);

    // Ajustar anchos de columna
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Descargar
    XLSX.writeFile(wb, 'Plantilla_Productos_Agrigarden.xlsx');
}

// =====================================================
// 8. UTILIDADES
// =====================================================
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
}
