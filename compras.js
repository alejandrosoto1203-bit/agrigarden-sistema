// compras.js - Gestión Integral de Órdenes de Compra Agrigarden
let listaProveedores = ["AGRILOMBARDIA", "RIVAS", "CARSAN", "JACTO", "EMMSA", "LUPITA", "TRUPER", "GIMBEL", "MERCADO LIBRE", "PROASA", "STHIL", "RINO", "POMOSA", "INDAR", "MACROPRESS", "RANCHO LOS MOLINOS", "MARVEL", "URREA", "PASTO VERDE", "IMPALA", "MD MADERAS", "BOLSAS ARTESANALES", "AMAZON"];
let comprasCache = [];
let currentCompraId = null;
let pestañaActualCompras = 'proceso'; // proceso o completado

// 1. GENERACIÓN DE NÚMERO DE ORDEN
function generarCodigoOrden(origen, fechaInput) {
    const prefijo = origen;
    const fechaBase = fechaInput ? new Date(fechaInput + "T00:00:00") : new Date();
    const d = String(fechaBase.getDate()).padStart(2, '0');
    const m = String(fechaBase.getMonth() + 1).padStart(2, '0');
    const y = String(fechaBase.getFullYear()).slice(-2);
    const ahora = new Date();
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mm = String(ahora.getMinutes()).padStart(2, '0');
    return `P${prefijo}-AGR-${d}${m}${y}_${hh}:${mm}`;
}

function actualizarNumeroOrdenPreview() {
    const origen = document.getElementById('origenOrden')?.value || 'M';
    const fecha = document.getElementById('fechaSolicitud')?.value;
    const preview = document.getElementById('ordenPreview');
    if (preview) preview.innerText = generarCodigoOrden(origen, fecha);
}

// 2. PROVEEDORES
function inicializarProveedores() {
    const select = document.getElementById('proveedorOrden');
    if (!select) return;
    select.innerHTML = listaProveedores.map(p => `<option value="${p}">${p}</option>`).join('') + `<option value="OTROS">-- AGREGAR OTRO --</option>`;
}

function checkNuevoProveedor(val) {
    const input = document.getElementById('nuevoProveedorInput');
    if (val === 'OTROS') input.classList.remove('hidden'); else input.classList.add('hidden');
}

// 3. PRODUCTOS
function agregarFilaProducto(data = null) {
    const tbody = document.getElementById('filasProductos');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "group border-b border-gray-50";
    tr.innerHTML = `
        <td class="py-3 pr-2"><input type="text" class="input-form text-[11px] row-codigo uppercase" placeholder="CÓDIGO" value="${data ? data.codigo_producto : ''}"></td>
        <td class="py-3 pr-2"><input type="text" class="input-form text-[11px] row-nombre uppercase" placeholder="NOMBRE PRODUCTO" value="${data ? data.nombre_producto : ''}"></td>
        <td class="py-3 pr-2 text-center"><input type="number" class="input-form text-center row-cantidad" value="${data ? data.cantidad : 1}" oninput="calcularFila(this)"></td>
        <td class="py-3 pr-2"><input type="number" step="0.01" class="input-form text-right row-precio" placeholder="0.00" value="${data ? data.precio_unitario : ''}" oninput="calcularFila(this)"></td>
        <td class="py-3 pr-2 text-right font-black text-sm row-total">${data ? formatMoney(data.cantidad * data.precio_unitario) : '$ 0.00'}</td>
        <td class="py-3 text-center"><button onclick="this.closest('tr').remove(); calcularGranTotal();" class="text-gray-300 hover:text-red-500"><span class="material-symbols-outlined text-sm">delete</span></button></td>
    `;
    tbody.appendChild(tr);
    actualizarContadorItems();
}

function calcularFila(input) {
    const fila = input.closest('tr');
    const cant = parseFloat(fila.querySelector('.row-cantidad').value) || 0;
    const precio = parseFloat(fila.querySelector('.row-precio').value) || 0;
    fila.querySelector('.row-total').innerText = formatMoney(cant * precio);
    calcularGranTotal();
}

function calcularGranTotal() {
    let granTotal = 0;
    document.querySelectorAll('.row-total').forEach(el => granTotal += parseFloat(el.innerText.replace(/[$,]/g, '')) || 0);
    const elTotal = document.getElementById('totalOrden');
    if (elTotal) elTotal.innerText = formatMoney(granTotal);
    actualizarContadorItems();
}

function actualizarContadorItems() {
    const rows = document.querySelectorAll('#filasProductos tr').length;
    if (document.getElementById('contadorItems')) document.getElementById('contadorItems').innerText = `${rows} ITEMS`;
}

// 4. GUARDADO Y ACTUALIZACIÓN EN SUPABASE
async function guardarOrdenCompra() {
    const sol = document.getElementById('nombreSolicitante').value.toUpperCase();
    if (!sol) return alert("Por favor ingresa el nombre del solicitante.");
    const provSel = document.getElementById('proveedorOrden').value;
    const finalProv = provSel === 'OTROS' ? document.getElementById('nuevoProveedorInput').value.toUpperCase() : provSel;
    const fechaCrea = document.getElementById('fechaSolicitud').value;
    const editId = document.getElementById('compraIdEdit').value;

    const cabecera = {
        numero_orden: document.getElementById('ordenPreview').innerText,
        nombre_solicitante: sol,
        proveedor: finalProv,
        fecha_creacion: fechaCrea,
        sucursal_origen: document.getElementById('origenOrden').value,
        total_monto: parseFloat(document.getElementById('totalOrden').innerText.replace(/[$,]/g, ''))
    };

    try {
        let res;
        if (editId) {
            res = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${editId}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify(cabecera)
            });
            await fetch(`${SUPABASE_URL}/rest/v1/compras_items?compra_id=eq.${editId}`, {
                method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
        } else {
            res = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({ ...cabecera, estado: 'Pendiente' })
            });
        }

        const data = await res.json();
        const compraId = data[0].id;
        const items = Array.from(document.querySelectorAll('#filasProductos tr')).map(fila => ({
            compra_id: compraId,
            codigo_producto: fila.querySelector('.row-codigo').value,
            nombre_producto: fila.querySelector('.row-nombre').value.toUpperCase(),
            cantidad: parseInt(fila.querySelector('.row-cantidad').value),
            precio_unitario: parseFloat(fila.querySelector('.row-precio').value)
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/compras_items`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(items)
        });

        alert(editId ? "Orden actualizada." : "Orden generada.");
        window.location.href = "compras.html";
    } catch (e) { console.error(e); }
}

// 5. CARGA DE LISTA Y AUTOMATIZACIÓN DE RETRASOS
async function cargarListaCompras() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?order=fecha_creacion.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        comprasCache = await res.json();

        // Lógica de detección automática de retrasos
        await verificarRetrasosAutomaticos(comprasCache);

        filtrarCompras(); // Renderiza según pestaña actual
        actualizarKPIs(comprasCache);
    } catch (e) { console.error(e); }
}

async function verificarRetrasosAutomaticos(datos) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let c of datos) {
        if (c.estado !== 'Completo' && c.estado !== 'Retrasado' && c.fecha_tentativa_recepcion) {
            const fTentativa = new Date(c.fecha_tentativa_recepcion + "T00:00:00");
            if (hoy > fTentativa) {
                // Actualizar en DB
                await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${c.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: 'Retrasado' })
                });
                c.estado = 'Retrasado'; // Actualizar en caché local
            }
        }
    }
}

function cambiarPestañaCompras(tab) {
    pestañaActualCompras = tab;
    document.getElementById('tabProceso').classList.toggle('tab-active', tab === 'proceso');
    document.getElementById('tabProceso').classList.toggle('text-gray-400', tab !== 'proceso');
    document.getElementById('tabCompletado').classList.toggle('tab-active', tab === 'completado');
    document.getElementById('tabCompletado').classList.toggle('text-gray-400', tab !== 'completado');
    filtrarCompras();
}

function filtrarCompras() {
    const busq = document.getElementById('busquedaCompras')?.value.toLowerCase() || '';
    const filtroEstado = document.getElementById('filtroEstado')?.value || 'Todos';
    const filtroSucursal = document.getElementById('filtroSucursal')?.value || 'Todos';

    const filtrados = comprasCache.filter(c => {
        const coincidePestaña = (pestañaActualCompras === 'proceso') ? c.estado !== 'Completo' : c.estado === 'Completo';
        const coincideBusq = c.proveedor.toLowerCase().includes(busq) || c.nombre_solicitante?.toLowerCase().includes(busq);
        const coincideEst = (filtroEstado === 'Todos') || c.estado === filtroEstado;
        const coincideSuc = (filtroSucursal === 'Todos') || c.sucursal_origen === filtroSucursal;
        return coincidePestaña && coincideBusq && coincideEst && coincideSuc;
    });

    renderizarTabla(filtrados);
}

function renderizarTabla(datos) {
    const tbody = document.getElementById('tablaComprasBody');
    if (!tbody) return;
    tbody.innerHTML = datos.map(c => {
        const fOrden = c.fecha_orden ? `<div class="text-[9px] font-bold text-blue-500 mt-1">ORDENADO: ${new Date(c.fecha_orden + "T00:00:00").toLocaleDateString()}</div>` : '';
        const fRecibo = c.fecha_tentativa_recepcion ? `<div class="text-[9px] font-bold text-emerald-500">EST. RECIBO: ${new Date(c.fecha_tentativa_recepcion + "T00:00:00").toLocaleDateString()}</div>` : '';
        const mapaSucursal = { 'M': 'MATRIZ', 'N': 'NORTE', 'S': 'SUR' };
        const sucursalNombre = mapaSucursal[c.sucursal_origen] || c.sucursal_origen || '-';

        return `
        <tr class="hover:bg-gray-50/50 transition-all border-b border-gray-50">
            <td class="px-6 py-5">
                <div class="text-sm text-gray-600 font-bold">${new Date(c.fecha_creacion + "T00:00:00").toLocaleDateString()}</div>
                ${fOrden} ${fRecibo}
            </td>
            <td class="px-6 py-5"><span class="font-mono-order text-xs font-bold">${c.numero_orden}</span></td>
            <td class="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">${sucursalNombre}</td>
            <td class="px-6 py-5 uppercase text-xs font-black">${c.nombre_solicitante || 'SIN NOMBRE'}</td>
            <td class="px-6 py-5 uppercase text-xs font-bold text-gray-500">${c.proveedor}</td>
            <td class="px-6 py-5 text-center text-xs font-black text-gray-400">Items</td>
            <td class="px-6 py-5 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${getColorEstado(c.estado)}">${c.estado}</span></td>
            <td class="px-6 py-5">
                <div class="flex justify-center gap-2">
                    <button onclick="abrirVerCompra('${c.id}')" class="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"><span class="material-symbols-outlined text-sm font-bold">visibility</span></button>
                    ${pestañaActualCompras === 'proceso' ? `
                        <button onclick="abrirEditarCompra('${c.id}')" class="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-sm"><span class="material-symbols-outlined text-sm font-bold">edit</span></button>
                    ` : ''}
                    <button onclick="eliminarCompra('${c.id}')" class="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm"><span class="material-symbols-outlined text-sm font-bold">delete</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function getColorEstado(e) {
    if (e === 'Pendiente') return 'bg-yellow-100 text-yellow-700';
    if (e === 'Ordenado') return 'bg-blue-100 text-blue-700';
    if (e === 'Parcial') return 'bg-orange-100 text-orange-700';
    if (e === 'Completo') return 'bg-green-100 text-green-700';
    if (e === 'Retrasado') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
}

function actualizarKPIs(d) {
    if (document.getElementById('kpiPendientes')) document.getElementById('kpiPendientes').innerText = d.filter(x => x.estado === 'Pendiente').length;
    if (document.getElementById('kpiCamino')) document.getElementById('kpiCamino').innerText = d.filter(x => x.estado === 'Ordenado').length;
    if (document.getElementById('kpiParcial')) document.getElementById('kpiParcial').innerText = d.filter(x => x.estado === 'Parcial').length;
    if (document.getElementById('kpiRetrasos')) document.getElementById('kpiRetrasos').innerText = d.filter(x => x.estado === 'Retrasado').length;
}

// 6. FUNCIONES DE MODAL Y EDICIÓN
async function abrirVerCompra(id) {
    try {
        const resCab = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${id}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const compra = (await resCab.json())[0];
        const resItm = await fetch(`${SUPABASE_URL}/rest/v1/compras_items?compra_id=eq.${id}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const items = await resItm.json();

        document.getElementById('modalDetalleTitulo').innerText = `Orden: ${compra.numero_orden}`;
        document.getElementById('detSolicitante').innerText = compra.nombre_solicitante || 'N/A';
        document.getElementById('detProveedor').innerText = compra.proveedor;
        document.getElementById('detEstadoActual').innerText = compra.estado;

        const tbody = document.getElementById('detListaProductos');
        tbody.innerHTML = items.map(i => `
            <tr class="border-b border-gray-50"><td class="py-2 text-xs font-mono">${i.codigo_producto}</td><td class="py-2 text-xs uppercase">${i.nombre_producto}</td><td class="py-2 text-center text-xs">${i.cantidad}</td><td class="py-2 text-right text-xs font-bold">${formatMoney(i.precio_unitario)}</td><td class="py-2 text-right text-xs font-black">${formatMoney(i.cantidad * i.precio_unitario)}</td></tr>
        `).join('');

        const divF = document.getElementById('detSeccionFechas');
        if (compra.fecha_orden) {
            divF.classList.remove('hidden');
            document.getElementById('valFechaOrden').innerText = new Date(compra.fecha_orden + "T00:00:00").toLocaleDateString();
            document.getElementById('valFechaRecibo').innerText = new Date(compra.fecha_tentativa_recepcion + "T00:00:00").toLocaleDateString();
        } else { divF.classList.add('hidden'); }

        currentCompraId = id;
        document.getElementById('modalVerDetalle').classList.remove('hidden');
    } catch (e) { console.error(e); }
}

async function actualizarEstadoPro(nuevoEstado) {
    let data = { estado: nuevoEstado };
    if (nuevoEstado === 'Ordenado') {
        data.fecha_orden = document.getElementById('inputFechaOrdenModal').value;
        data.fecha_tentativa_recepcion = document.getElementById('inputFechaReciboModal').value;
        if (!data.fecha_orden || !data.fecha_tentativa_recepcion) return alert("Indica fechas de logística.");
    }

    // Si marcamos como completo, el objeto data simplemente lleva el estado 'Completo'

    await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${currentCompraId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    alert("Gestión actualizada correctamente.");
    cerrarModalDetalle();
    cargarListaCompras();
}

function cerrarModalDetalle() { document.getElementById('modalVerDetalle').classList.add('hidden'); }
function abrirEditarCompra(id) { window.location.href = `nueva_compra.html?edit=${id}`; }

async function cargarDatosParaEditar(id) {
    try {
        const resCab = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${id}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const c = (await resCab.json())[0];
        const resItm = await fetch(`${SUPABASE_URL}/rest/v1/compras_items?compra_id=eq.${id}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const items = await resItm.json();

        document.getElementById('compraIdEdit').value = c.id;
        document.getElementById('nombreSolicitante').value = c.nombre_solicitante;
        document.getElementById('origenOrden').value = c.sucursal_origen;
        document.getElementById('proveedorOrden').value = c.proveedor;
        document.getElementById('fechaSolicitud').value = c.fecha_creacion;
        document.getElementById('ordenPreview').innerText = c.numero_orden;
        document.getElementById('txtTituloPagina').innerText = `Editando Orden: ${c.numero_orden}`;
        document.getElementById('btnGuardarOrden').innerText = "Actualizar Orden";

        document.getElementById('filasProductos').innerHTML = "";
        items.forEach(i => agregarFilaProducto(i));
        calcularGranTotal();
    } catch (e) { console.error(e); }
}

async function eliminarCompra(id) {
    if (!confirm("¿Borrar orden permanentemente?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${id}`, {
        method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    cargarListaCompras();
}
// 7. GENERACIÓN DE PDF
async function descargarPDFOrden() {
    if (!currentCompraId) return alert("No hay orden seleccionada.");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Obtener datos frescos
        const resCab = await fetch(`${SUPABASE_URL}/rest/v1/compras_agrigarden?id=eq.${currentCompraId}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const compra = (await resCab.json())[0];

        const resItm = await fetch(`${SUPABASE_URL}/rest/v1/compras_items?compra_id=eq.${currentCompraId}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const items = await resItm.json();

        // 1. ENCABEZADO
        doc.setFillColor(25, 230, 107); // Primary Green
        doc.rect(0, 0, 210, 20, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("SOLICITUD DE COMPRA", 105, 13, { align: "center" });

        // 2. INFO PRINCIPAL
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);

        doc.setFont("helvetica", "bold");
        doc.text("ORDEN #:", 14, 35);
        doc.setFont("helvetica", "normal");
        doc.text(compra.numero_orden, 40, 35);

        doc.setFont("helvetica", "bold");
        doc.text("FECHA:", 14, 42);
        doc.setFont("helvetica", "normal");
        doc.text(new Date(compra.fecha_creacion + "T00:00:00").toLocaleDateString(), 40, 42);

        doc.setFont("helvetica", "bold");
        doc.text("ESTADO:", 140, 35);
        doc.setFont("helvetica", "normal");
        doc.text(compra.estado.toUpperCase(), 160, 35);

        // 3. CAJA DE PROVEEDOR Y SOLICITANTE
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(248, 248, 250);
        doc.roundedRect(14, 50, 182, 30, 3, 3, 'FD');

        doc.setFont("helvetica", "bold");
        doc.text("PROVEEDOR:", 20, 60);
        doc.text("SOLICITANTE:", 110, 60);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text(compra.proveedor || "---", 20, 68);
        doc.text(compra.nombre_solicitante || "---", 110, 68);

        // 4. TABLA DE PRODUCTOS
        const tableBody = items.map(i => [
            i.codigo_producto,
            i.nombre_producto,
            i.cantidad,
            formatMoney(i.precio_unitario),
            formatMoney(i.cantidad * i.precio_unitario)
        ]);

        doc.autoTable({
            startY: 90,
            head: [['CÓDIGO', 'PRODUCTO', 'CANT', 'UNITARIO', 'TOTAL']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 30 },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // 5. TOTALES
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL ORDEN:", 140, finalY);
        doc.setTextColor(25, 230, 107); // Primary Green for Amount
        doc.text(formatMoney(compra.total_monto), 175, finalY);

        // 6. Footer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Generado por Agrigarden System - " + new Date().toLocaleString(), 105, 280, { align: "center" });

        // Guardar
        doc.save(`Orden_${compra.numero_orden}.pdf`);

    } catch (e) {
        console.error("PDF Generate Error:", e);
        alert("Error al generar PDF. Ver consola.");
    }
}
