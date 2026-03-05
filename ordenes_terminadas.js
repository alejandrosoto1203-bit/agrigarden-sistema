// ordenes_terminadas.js - Módulo de Órdenes Terminadas/Entregadas

// =====================================================
// ESTADO
// =====================================================
let ordenesTerminadas = [];
let ordenTerminadaActual = null;
let itemsTerminada = [];

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function inicializarTerminadas() {
    await cargarOrdenesTerminadas();

    // Si viene con ?id= abrir directo
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) await abrirDetalleTerminada(parseInt(idParam));
}

// =====================================================
// CARGAR ÓRDENES
// =====================================================
async function cargarOrdenesTerminadas() {
    const filtro = document.getElementById('filtroEstatus')?.value;
    let query = '';
    if (filtro) {
        query = `estatus=eq.${filtro}`;
    } else {
        query = 'estatus=in.(TERMINADA,COBRADA / ENTREGADA)';
    }

    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?${query}&select=*&order=created_at.desc`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        ordenesTerminadas = await res.json();
        renderizarListaTerminadas();
    } catch (e) { console.error(e); }
}

function renderizarListaTerminadas() {
    const contenedor = document.getElementById('listaTerminadas');

    if (!ordenesTerminadas.length) {
        contenedor.innerHTML = '<div class="text-center py-16"><span class="material-symbols-outlined text-5xl text-slate-200">inbox</span><p class="text-slate-400 font-bold mt-2">No hay órdenes</p></div>';
        return;
    }
    const esAdmin = sessionStorage.getItem('userRole') === 'admin';

    contenedor.innerHTML = ordenesTerminadas.map(o => {
        const fecha = new Date(o.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        const fechaTerm = o.fecha_terminacion ? new Date(o.fecha_terminacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '';
        const estilos = {
            'EN_PROCESO': 'bg-orange-100 text-orange-700',
            'TERMINADA': 'bg-green-100 text-green-700',
            'COBRADA / ENTREGADA': 'bg-slate-100 text-slate-500'
        };
        const labels = { 'EN_PROCESO': 'En Proceso', 'TERMINADA': 'Terminada', 'COBRADA / ENTREGADA': 'Cobrada / Entregada' };

        let accionBtn = '';
        if (o.estatus === 'TERMINADA') {
            accionBtn = `<button onclick="abrirDetalleTerminada(${o.id})" class="px-5 py-3 bg-primary text-black rounded-xl text-xs font-black uppercase hover:scale-[1.02] transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">point_of_sale</span> Cobrar</button>`;
        } else {
            accionBtn = `<button onclick="abrirDetalleTerminada(${o.id})" class="px-5 py-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">visibility</span> Ver</button>`;
        }

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-lg font-black text-primary">${o.folio}</span>
                        <span class="estatus-badge ${estilos[o.estatus] || ''}">${labels[o.estatus] || o.estatus}</span>
                    </div>
                    <p class="text-sm font-bold text-slate-700">${o.cliente_nombre}</p>
                    <p class="text-xs text-slate-400">${o.equipo} — ${o.marca_modelo} | ${o.mecanico} | Creada: ${fecha} ${fechaTerm ? `| Terminada: ${fechaTerm}` : ''}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${accionBtn}
                    ${esAdmin ? `
                    <button onclick="eliminarOrdenDesdeModulo(${o.id}, '${o.folio}', '${o.estatus}')" title="Eliminar orden"
                        class="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// =====================================================
// MARCAR COMO TERMINADA
// =====================================================
async function marcarTerminada(id) {
    if (!confirm('¿Marcar esta orden como TERMINADA?')) return;

    try {
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${id}`, {
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

        alert('✅ Orden marcada como Terminada.');
        await cargarOrdenesTerminadas();
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}

// =====================================================
// DETALLE DE ORDEN TERMINADA
// =====================================================
async function abrirDetalleTerminada(id) {
    ordenTerminadaActual = ordenesTerminadas.find(o => o.id === id);
    if (!ordenTerminadaActual) {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${id}&select=*`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        const data = await res.json();
        ordenTerminadaActual = data[0];
    }
    if (!ordenTerminadaActual) return alert('Orden no encontrada.');

    // Info
    document.getElementById('detTFolio').textContent = ordenTerminadaActual.folio;
    document.getElementById('detTCliente').textContent = ordenTerminadaActual.cliente_nombre;
    document.getElementById('detTEquipo').textContent = `${ordenTerminadaActual.equipo} — ${ordenTerminadaActual.marca_modelo}`;
    document.getElementById('detTMecanico').textContent = `Mecánico: ${ordenTerminadaActual.mecanico}`;

    // Fechas
    let fechasStr = `Creada: ${new Date(ordenTerminadaActual.created_at).toLocaleDateString('es-MX')}`;
    if (ordenTerminadaActual.fecha_terminacion) {
        fechasStr += ` | Terminada: ${new Date(ordenTerminadaActual.fecha_terminacion).toLocaleDateString('es-MX')}`;
    }
    if (ordenTerminadaActual.fecha_entrega) {
        fechasStr += ` | Entregada: ${new Date(ordenTerminadaActual.fecha_entrega).toLocaleDateString('es-MX')}`;
    }
    document.getElementById('detTFechas').textContent = fechasStr;

    // Estatus
    const estilos = { 'EN_PROCESO': 'bg-orange-100 text-orange-700', 'TERMINADA': 'bg-green-100 text-green-700', 'COBRADA / ENTREGADA': 'bg-slate-100 text-slate-500' };
    const labels = { 'EN_PROCESO': 'En Proceso', 'TERMINADA': 'Terminada', 'COBRADA / ENTREGADA': 'Cobrada / Entregada' };
    const det = document.getElementById('detTEstatus');
    det.className = `estatus-badge ${estilos[ordenTerminadaActual.estatus] || ''}`;
    det.textContent = labels[ordenTerminadaActual.estatus] || ordenTerminadaActual.estatus;

    // Observaciones + notas
    let obs = ordenTerminadaActual.observaciones || '';
    if (ordenTerminadaActual.notas_revision) obs += '\n\nNotas de revisión: ' + ordenTerminadaActual.notas_revision;
    document.getElementById('detTObs').textContent = obs || '—';

    // Items
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${id}&select=*&order=id.asc`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        itemsTerminada = await res.json();
    } catch (e) { itemsTerminada = []; }

    document.getElementById('bodyItemsTerminada').innerHTML = itemsTerminada.map(i => `
        <tr class="border-b border-slate-50">
            <td class="px-3 py-2 text-center font-bold">${i.cantidad}</td>
            <td class="px-3 py-2 text-xs font-mono text-slate-500">${i.sku || '—'}</td>
            <td class="px-3 py-2 font-bold">${i.descripcion}</td>
            <td class="px-3 py-2 text-right font-black text-primary">$${(i.precio_con_iva || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    const total = itemsTerminada.reduce((s, i) => s + (i.precio_con_iva || 0), 0);
    document.getElementById('totalTerminada').textContent = `$${total.toFixed(2)}`;

    // Acciones dinámicas
    const acciones = document.getElementById('accionesTerminada');
    if (ordenTerminadaActual.estatus === 'TERMINADA') {
        acciones.innerHTML = `
            <button onclick="descargarPDFFinal()"
                class="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 hover:bg-slate-200">
                <span class="material-symbols-outlined">picture_as_pdf</span> Descargar PDF
            </button>
            <button onclick="cobrarVenta()"
                class="flex-1 bg-primary text-black py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 hover:scale-[1.01] transition-all shadow-xl shadow-primary/20">
                <span class="material-symbols-outlined">point_of_sale</span> Cobrar Venta
            </button>
        `;
    } else if (ordenTerminadaActual.estatus === 'COBRADA / ENTREGADA') {
        acciones.innerHTML = `
            <button onclick="descargarPDFFinal()"
                class="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 hover:bg-slate-200">
                <span class="material-symbols-outlined">picture_as_pdf</span> Descargar PDF
            </button>
            <div class="flex-1 bg-green-50 text-green-700 py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">check_circle</span> Cobrada / Entregada — ${new Date(ordenTerminadaActual.fecha_entrega).toLocaleDateString('es-MX')}
            </div>
        `;
    }

    // Cambiar vista
    document.getElementById('listaTerminadas').classList.add('hidden');
    document.getElementById('detalleTerminada').classList.remove('hidden');
}

function volverListaTerminadas() {
    document.getElementById('detalleTerminada').classList.add('hidden');
    document.getElementById('listaTerminadas').classList.remove('hidden');
    ordenTerminadaActual = null;
    cargarOrdenesTerminadas();
}

// =====================================================
// PDF FINAL PROFESIONAL
// =====================================================
function descargarPDFFinal() {
    if (!ordenTerminadaActual) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const o = ordenTerminadaActual;

    // === Header ===
    doc.setFillColor(25, 230, 107);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('AGRIGARDEN', 14, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Servicio de Reparación', 14, 28);

    // Folio en header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Orden: ${o.folio}`, 140, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const ahora = new Date();
    doc.text(`Impreso: ${ahora.toLocaleDateString('es-MX')} ${ahora.toLocaleTimeString('es-MX')}`, 140, 26);

    doc.setTextColor(0, 0, 0);

    // === Datos del cliente ===
    let y = 45;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', 14, y);
    doc.setDrawColor(200); doc.line(14, y + 1, 196, y + 1);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${o.cliente_nombre}`, 14, y);
    doc.text(`Teléfono: ${o.cliente_telefono || '—'}`, 120, y);
    y += 5;
    doc.text(`Comprobante: ${o.tipo_comprobante}`, 14, y);
    if (o.cliente_email) doc.text(`Email: ${o.cliente_email}`, 120, y);
    y += 8;

    // === Datos del equipo ===
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL EQUIPO', 14, y);
    doc.line(14, y + 1, 196, y + 1);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.text(`Equipo: ${o.equipo}`, 14, y);
    doc.text(`Marca/Modelo: ${o.marca_modelo}`, 100, y);
    y += 5;
    doc.text(`Mecánico: ${o.mecanico}`, 14, y);
    y += 5;
    if (o.observaciones) {
        doc.text(`Observaciones: ${o.observaciones}`, 14, y, { maxWidth: 180 });
        y += Math.ceil(o.observaciones.length / 80) * 5 + 3;
    }
    y += 3;

    // === Tabla de piezas ===
    const tableData = itemsTerminada.map(i => [
        i.cantidad,
        i.sku || '—',
        i.descripcion,
        `$${(i.precio_sin_iva || 0).toFixed(2)}`,
        `$${(i.precio_con_iva || 0).toFixed(2)}`
    ]);

    doc.autoTable({
        startY: y,
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
    const finalY = doc.lastAutoTable.finalY + 8;
    const total = itemsTerminada.reduce((s, i) => s + (i.precio_con_iva || 0), 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: $${total.toFixed(2)}`, 140, finalY);

    // Notas
    if (o.notas_revision) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Notas: ${o.notas_revision}`, 14, finalY + 8, { maxWidth: 120 });
    }

    // Fechas al pie
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let pieY = 275;
    doc.text(`Creada: ${new Date(o.created_at).toLocaleDateString('es-MX')}`, 14, pieY);
    if (o.fecha_aceptacion) doc.text(`Aceptada: ${new Date(o.fecha_aceptacion).toLocaleDateString('es-MX')}`, 60, pieY);
    if (o.fecha_terminacion) doc.text(`Terminada: ${new Date(o.fecha_terminacion).toLocaleDateString('es-MX')}`, 110, pieY);
    if (o.fecha_entrega) doc.text(`Entregada: ${new Date(o.fecha_entrega).toLocaleDateString('es-MX')}`, 160, pieY);

    doc.save(`Orden_Reparacion_${o.folio}.pdf`);
}

// =====================================================
// COBRAR VENTA (integración POS)
// =====================================================
async function cobrarVenta() {
    if (!ordenTerminadaActual || itemsTerminada.length === 0) {
        return alert('No hay items para cobrar.');
    }

    // Primero descarga PDF
    descargarPDFFinal();

    // Preparar datos para POS
    const datosOrden = {
        orden_id: ordenTerminadaActual.id,
        folio: ordenTerminadaActual.folio,
        cliente: ordenTerminadaActual.cliente_nombre,
        items: itemsTerminada.map(i => ({
            producto_id: i.producto_id,
            sku: i.sku,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            precio_con_iva: i.precio_con_iva,
            precio_sin_iva: i.precio_sin_iva
        }))
    };

    // Guardar en sessionStorage para que el POS lo recoja
    sessionStorage.setItem('ordenReparacionPOS', JSON.stringify(datosOrden));

    // Redirigir al POS
    alert('Se abrirá el Punto de Venta con los productos de esta orden. Procesa el cobro normalmente.');
    window.location.href = 'pos.html?from_repair=true';
}

// =====================================================
// ELIMINAR ORDEN (SOLO ADMIN)
// =====================================================
async function eliminarOrdenDesdeModulo(ordenId, folio, estatus) {
    const msg = estatus === 'ENTREGADA'
        ? `¿Eliminar la orden ${folio}?\n\nEsta orden ya fue ENTREGADA. Se eliminará también el ingreso registrado.`
        : `¿Eliminar la orden ${folio} permanentemente?\n\nTodas las piezas asociadas se revertirán.`;

    if (!confirm(msg)) return;
    if (!confirm(`⚠️ CONFIRMACIÓN FINAL: ¿Seguro que deseas eliminar ${folio}?`)) return;

    try {
        const usuario = sessionStorage.getItem('userName') || 'Admin';

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

        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion_items?orden_id=eq.${ordenId}`, {
            method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?id=eq.${ordenId}`, {
            method: 'DELETE', headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });

        alert(`✅ Orden ${folio} eliminada exitosamente.`);
        volverListaTerminadas();
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}
