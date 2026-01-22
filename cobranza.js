// cobranza.js - Gestión de Cuentas por Cobrar y Cuentas por Pagar
let pestañaActualCobros = 'pendiente';
let pestañaActualPagos = 'pendiente';
let datosCacheCobros = [];
let datosCachePagos = [];
let idTransaccionAbono = null;
let idGastoAbono = null;
let itemsLotePagoProv = []; // Almacena los ítems de una cuota compuesta
let saldoMaximoAbono = 0;
let currentTransaccionId = null;
let currentGastoId = null;
let mostrarFuturosPagos = false; // Control de vista "Próximos Meses"

// FUNCIONES DE SOPORTE PARA "OTROS"
function checkMetodoCobro(val) {
    const extra = document.getElementById('extraMetodoCobro');
    if (extra) extra.classList.toggle('hidden', val !== 'Otros');
}

function checkMetodoPagoProv(val) {
    const extra = document.getElementById('extraMetodoProv');
    if (extra) extra.classList.toggle('hidden', val !== 'Otros');
}

// 1. GESTIÓN DE CUENTAS POR COBRAR (CLIENTES) - SE MANTIENE ÍNTEGRO
async function cargarCuentasPorCobrar() {
    const tabla = document.getElementById('tablaCobranza');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?metodo_pago=ilike.Cr%25dito&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        datosCacheCobros = await response.json();
        const hoy = new Date();
        let totalOutstanding = 0; let totalVencidoSuma = 0; let totalRecuperado = 0;

        datosCacheCobros.forEach(item => {
            const montoOriginal = item.monto || 0;
            const saldoPendiente = (item.saldo_pendiente !== null) ? item.saldo_pendiente : montoOriginal;
            const estadoActual = item.estado_cobro || 'Pendiente';
            const fechaVencimiento = new Date(item.created_at); fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

            if (estadoActual === 'Pendiente') {
                totalOutstanding += saldoPendiente;
                if (hoy > fechaVencimiento) totalVencidoSuma += saldoPendiente;
            }
            totalRecuperado += (montoOriginal - saldoPendiente);
        });

        if (document.getElementById('totalPorCobrar')) document.getElementById('totalPorCobrar').innerText = formatMoney(totalOutstanding);
        if (document.getElementById('totalVencido')) document.getElementById('totalVencido').innerText = formatMoney(totalVencidoSuma);
        if (document.getElementById('cuentasVencidas')) document.getElementById('cuentasVencidas').innerText = datosCacheCobros.filter(i => (hoy > new Date(new Date(i.created_at).setDate(new Date(i.created_at).getDate() + 30))) && (i.estado_cobro !== 'Pagado')).length;
        if (document.getElementById('recuperadoMes')) document.getElementById('recuperadoMes').innerText = formatMoney(totalRecuperado);

        aplicarFiltrosCobros();
    } catch (error) { console.error("Error cobranza:", error); }
}

function renderizarTablaCobros(datosFiltrados) {
    const tabla = document.getElementById('tablaCobranza');
    if (!tabla) return;
    tabla.innerHTML = "";
    const hoy = new Date();

    datosFiltrados.forEach(item => {
        const montoOriginal = item.monto || 0;
        const saldoPendiente = (item.saldo_pendiente !== null) ? item.saldo_pendiente : montoOriginal;
        const estadoActual = item.estado_cobro || 'Pendiente';
        const fechaCompra = new Date(item.created_at);
        const fechaVencimiento = new Date(item.created_at); fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
        const esVencido = hoy > fechaVencimiento;

        const nivelActual = item.nivel_cobranza || 0;
        const ultimaFechaWS = item.ultimo_whatsapp ? new Date(item.ultimo_whatsapp).toLocaleDateString() : 'SIN ENVÍOS';
        const proximaCitaWS = item.proximo_whatsapp ? new Date(item.proximo_whatsapp).toLocaleDateString() : 'POR DEFINIR';
        const esHoyProximo = item.proximo_whatsapp && new Date(item.proximo_whatsapp) <= hoy;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50";

        fila.innerHTML = `
            <td class="px-8 py-5 text-sm font-medium text-gray-600">${fechaCompra.toLocaleDateString()}</td>
            <td class="px-8 py-5">
                <div class="flex flex-col">
                    <span class="text-black font-black uppercase text-xs">${item.nombre_cliente}</span>
                    <span class="text-[10px] text-gray-400">${item.telefono_cliente || ''}</span>
                    <div class="mt-1 flex gap-2 text-[9px] font-bold">
                        <span class="text-gray-400 italic">Último: ${ultimaFechaWS}</span>
                        <span class="${esHoyProximo ? 'text-red-500 font-black underline animate-pulse' : 'text-primary'}">Siguiente: ${proximaCitaWS}</span>
                    </div>
                </div>
            </td>
            <td class="px-8 py-5 text-xs font-bold text-gray-500 text-center">${item.categoria || '#S/N'}</td>
            <td class="px-8 py-5 text-xs font-bold text-gray-500 text-center">${item.sucursal || '-'}</td>
            <td class="px-8 py-5 text-right font-bold text-gray-400">${formatMoney(montoOriginal)}</td>
            <td class="px-8 py-5 text-right font-black text-gray-800">${formatMoney(saldoPendiente)}</td>
            <td class="px-8 py-5 text-center text-xs font-bold ${esVencido && estadoActual !== 'Pagado' ? 'text-red-500' : 'text-blue-500'} italic">${fechaVencimiento.toLocaleDateString()}</td>
            <td class="px-8 py-5 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${estadoActual === 'Pagado' ? 'bg-blue-100 text-blue-700' : (esVencido ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}">${estadoActual === 'Pagado' ? 'Cobrado' : (esVencido ? 'Vencido' : 'Vigente')}</span></td>
            <td class="px-8 py-5 text-center">
                <div class="flex justify-center gap-2">
                    ${estadoActual !== 'Pagado' ? `
                        <div class="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button onclick="enviarWhatsAppCobranza(${JSON.stringify(item).replace(/"/g, '&quot;')}, ${esVencido})" 
                                    class="p-2 ${esVencido ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg transition-all flex items-center justify-center shadow-sm">
                                <span class="material-symbols-outlined text-sm font-bold">chat</span>
                            </button>
                            ${esVencido ? `<span class="text-[10px] font-black px-1 text-red-600">L${nivelActual + 1}</span>` : ''}
                        </div>
                        <button onclick="prepararAbonoPago('${item.id}', '${item.nombre_cliente}', ${saldoPendiente}, 'abono')" class="p-2 bg-emerald-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm font-bold">payments</span>
                        </button>
                        <button onclick="prepararAbonoPago('${item.id}', '${item.nombre_cliente}', ${saldoPendiente}, 'liquidacion')" class="p-2 bg-blue-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm font-bold">check_circle</span>
                        </button>
                    ` : ''}
                    <button onclick="abrirBitacora('${item.id}', '${item.nombre_cliente}')" class="p-2 bg-gray-900 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                        <span class="material-symbols-outlined text-sm font-bold">event_note</span>
                    </button>
                </div>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

async function enviarWhatsAppCobranza(item, esVencido) {
    const telefono = item.telefono_cliente;
    if (!telefono) return alert("El cliente no tiene teléfono registrado.");

    const montoStr = formatMoney(item.saldo_pendiente || item.monto);
    const fechaVenc = new Date(new Date(item.created_at).setDate(new Date(item.created_at).getDate() + 30)).toLocaleDateString();
    let mensaje = "";
    let nuevoNivel = item.nivel_cobranza || 0;
    let diasSiguiente = 3;

    if (!esVencido) {
        mensaje = `Hola, *${item.nombre_cliente}*. Te saludamos de *Agrigarden* 🌿. Queremos recordarte que tu saldo de *${montoStr}* tiene como fecha de vencimiento el día *${fechaVenc}*. Quedamos a tus órdenes para cualquier duda o para confirmar tu pago. ¡Que tengas un excelente día! 😊`;
        diasSiguiente = 0;
    } else {
        nuevoNivel++;
        if (nuevoNivel > 5) nuevoNivel = 5;
        switch (nuevoNivel) {
            case 1: mensaje = `Hola, *${item.nombre_cliente}*. Te contactamos de *Agrigarden* 📝. Notamos que tu saldo de *${montoStr}* venció el pasado *${fechaVenc}*. Probablemente se trate de un olvido, ¿podrías apoyarnos con la confirmación de tu pago? ¡Gracias por tu atención! 👋`; diasSiguiente = 3; break;
            case 2: mensaje = `Buen día, *${item.nombre_cliente}*. Seguimos al pendiente de tu cuenta en *Agrigarden* 🔍. Tu saldo por *${montoStr}* presenta un retraso. Para nosotros es muy importante mantener tu historial al corriente para evitar interrupciones en tus servicios o pedidos. Quedamos atentos a tu confirmación. 🤝`; diasSiguiente = 3; break;
            case 3: mensaje = `Estimado(a) *${item.nombre_cliente}*. De parte del equipo de *Agrigarden* ⚠️, te informamos que tu cuenta presenta un saldo vencido de *${montoStr}*. Te solicitamos de la manera más atenta indicarnos una fecha compromiso de pago para actualizar tu estatus hoy mismo. 📅`; diasSiguiente = 2; break;
            case 4: mensaje = `Hola, *${item.nombre_cliente}*. En *Agrigarden* hacemos de tu conocimiento que el saldo vencido de *${montoStr}* ya presenta un atraso considerable 📢. Es necesario liquidar a la brevedad para evitar que tu historial crediticio con nosotros se vea afectado negativamente. Esperamos tu comprobante de pago. 📉`; diasSiguiente = 2; break;
            case 5: mensaje = `AVISO IMPORTANTE de *Agrigarden* 🚫. *${item.nombre_cliente}*, lamentamos informarte que debido al saldo pendiente de *${montoStr}* vencido desde el *${fechaVenc}*, tu crédito ha sido suspendido temporalmente. Para reactivarlo, es indispensable realizar el pago total hoy mismo. Quedamos a la espera de una respuesta inmediata. 📞`; diasSiguiente = 1; break;
        }
    }

    const hoy = new Date();
    const proximaFecha = new Date();
    proximaFecha.setDate(hoy.getDate() + diasSiguiente);

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${item.id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nivel_cobranza: nuevoNivel,
                ultimo_whatsapp: hoy.toISOString(),
                proximo_whatsapp: esVencido ? proximaFecha.toISOString() : null
            })
        });

        await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaccion_id: item.id,
                nota: `WHATSAPP ENVIADO: Nivel ${nuevoNivel}. Próxima gestión: ${proximaFecha.toLocaleDateString()}`
            })
        });

        window.open(`https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
        cargarCuentasPorCobrar();
    } catch (e) { window.open(`https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank'); }
}

// 2. GESTIÓN DE CUENTAS POR PAGAR (PROVEEDORES) - MODIFICADO PARA TABLAS INTELIGENTES Y FILTRO TEMPORAL
async function cargarCuentasPorPagar() {
    const tabla = document.getElementById('tablaCuentasPagar');
    if (!tabla) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?metodo_pago=eq.Crédito&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        datosCachePagos = await res.json();
        aplicarFiltrosPagos();
        actualizarKPIsPagos(datosCachePagos);
    } catch (e) { console.error("Error Cuentas Pagar:", e); }
}

function aplicarFiltrosPagos() {
    const busqueda = document.getElementById('busquedaProveedor')?.value.toLowerCase() || '';
    const filtroSucursal = document.getElementById('filtroSucursalPago')?.value || 'Todos';
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const filtrados = datosCachePagos.filter(item => {
        const esPagado = item.estado_pago === 'Pagado';

        // Determinar fecha límite para el filtro de "Enfoque en el Presente"
        const fCreacion = new Date(item.created_at);
        const fLimite = new Date(item.created_at);
        fLimite.setDate(fCreacion.getDate() + (item.dias_credito || 0));

        if (pestañaActualPagos === 'pendiente' && esPagado) return false;
        if (pestañaActualPagos === 'pagado' && !esPagado) return false;

        // Lógica de "Enfoque en el Presente"
        if (!mostrarFuturosPagos && !esPagado) {
            const esFuturo = (fLimite.getFullYear() > añoActual) || (fLimite.getFullYear() === añoActual && fLimite.getMonth() > mesActual);
            if (esFuturo) return false;
        }

        const coincideSuc = filtroSucursal === 'Todos' || item.sucursal === filtroSucursal;
        return item.proveedor?.toLowerCase().includes(busqueda) && coincideSuc;
    });


    currentFilteredPagos = filtrados; // store for export
    renderizarTablaPagos(filtrados);
}

// Global Export Variables & Functions
let currentFilteredCobros = [];
let currentFilteredPagos = [];

window.exportarCobranza = function () {
    exportToExcel(
        currentFilteredCobros,
        {
            created_at: "Fecha Registro",
            sucursal: "Sucursal",
            nombre_cliente: "Cliente",
            telefono_cliente: "Teléfono",
            categoria: "Categoría",
            monto: "Monto Original",
            saldo_pendiente: "Saldo Pendiente",
            estado_cobro: "Estado",
            nivel_cobranza: "Nivel Cobranza"
        },
        `Reporte_Cuentas_Por_Cobrar_${new Date().toISOString().split('T')[0]}`,
        "CuentasPorCobrar"
    );
}

window.exportarPorPagar = function () {
    exportToExcel(
        currentFilteredPagos,
        {
            created_at: "Fecha Registro",
            sucursal: "Sucursal",
            proveedor: "Proveedor",
            categoria: "Categoría",
            subcategoria: "Subcategoría",
            metodo_pago: "Método Pago",
            monto_total: "Monto Total",
            saldo_pendiente: "Saldo Pendiente",
            estado_pago: "Estado",
            notas: "Notas"
        },
        `Reporte_Cuentas_Por_Pagar_${new Date().toISOString().split('T')[0]}`,
        "CuentasPorPagar"
    );
}

function renderizarTablaPagos(datos) {
    const tabla = document.getElementById('tablaCuentasPagar');
    if (!tabla) return;
    tabla.innerHTML = "";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // AGRUPACIÓN PARA TABLAS INTELIGENTES (ACORDEÓN)
    const grupos = {};
    datos.forEach(item => {
        const esCuota = item.notas && item.notas.includes("CUOTA");
        const llave = esCuota ? item.notas.split(') - ')[1] : item.id;
        if (!grupos[llave]) grupos[llave] = [];
        grupos[llave].push(item);
    });

    Object.values(grupos).forEach(items => {
        const principal = items[0];
        const esGrupo = items.length > 1;

        const totalGrupo = items.reduce((s, i) => s + (i.monto_total || 0), 0);
        // Mostrar monto total original en lugar de saldo pendiente si ya está pagado
        const saldoGrupo = items.reduce((s, i) => s + (i.saldo_pendiente !== null && i.estado_pago !== 'Pagado' ? i.saldo_pendiente : (i.estado_pago === 'Pagado' ? 0 : i.monto_total)), 0);

        const fechaCreacion = new Date(principal.created_at);
        const fechaLimite = new Date(principal.created_at);
        fechaLimite.setDate(fechaCreacion.getDate() + (principal.dias_credito || 0));

        const esVencido = hoy > fechaLimite && principal.estado_pago !== 'Pagado';
        const estaPagado = principal.estado_pago === 'Pagado';
        const filaId = `acordeon-${principal.id}`;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-100";

        fila.innerHTML = `
            <td class="px-6 py-5 text-xs font-medium text-gray-500">${fechaCreacion.toLocaleDateString()}</td>
            <td class="px-6 py-5">
                <div class="flex items-center gap-2">
                    ${esGrupo ? `<button onclick="toggleAcordeon('${filaId}')" class="text-emerald-500 hover:scale-125 transition-all"><span class="material-symbols-outlined text-sm">arrow_circle_down</span></button>` : ''}
                    <span class="text-sm font-black text-gray-800 uppercase">${principal.proveedor}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-center text-xs font-bold text-gray-400">${formatMoney(totalGrupo)}</td>
            <td class="px-6 py-4 text-center">
                <span class="text-sm font-black text-emerald-600">${estaPagado ? formatMoney(0) : formatMoney(saldoGrupo)}</span>
            </td>
            <td class="px-6 py-4 text-center text-xs font-bold italic ${esVencido ? 'text-red-500' : 'text-blue-500'}">
                ${fechaLimite.toLocaleDateString()}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${estaPagado ? 'bg-blue-100 text-blue-700' : (esVencido ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}">
                    ${estaPagado ? 'Pagado' : (esVencido ? 'Vencido' : 'Vigente')}
                </span>
            </td>
            <td class="px-6 py-5 text-center text-xs font-bold text-gray-500">${principal.sucursal}</td>
            <td class="px-6 py-5 text-center">
                <div class="flex justify-center gap-2">
                    ${!estaPagado ? `
                        <button onclick="prepararAccionMasivaPagos(${JSON.stringify(items).replace(/"/g, '&quot;')}, 'liquidacion')" class="p-2 bg-blue-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm font-bold">check_circle</span>
                        </button>
                        <button onclick="abrirModalProrroga('${principal.id}', '${principal.proveedor}', '${fechaLimite.toISOString().split('T')[0]}')" class="p-2 bg-orange-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm font-bold">calendar_month</span>
                        </button>
                    ` : ''}
                    <button onclick="abrirBitacoraProv('${principal.id}', '${principal.proveedor}')" class="p-2 bg-gray-900 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                        <span class="material-symbols-outlined text-sm font-bold">event_note</span>
                    </button>
                </div>
            </td>
        `;
        tabla.appendChild(fila);

        if (esGrupo) {
            const filaDetalle = document.createElement('tr');
            filaDetalle.id = filaId;
            filaDetalle.className = "hidden bg-emerald-50/30";
            filaDetalle.innerHTML = `
                <td colspan="8" class="px-12 py-4">
                    <div class="space-y-2 border-l-4 border-emerald-400 pl-4">
                        ${items.map(sub => `
                            <div class="flex justify-between text-[10px] font-black uppercase">
                                <span>${sub.categoria} (${sub.subcategoria})</span>
                                <span class="text-sm font-black text-slate-800">${estaPagado ? formatMoney(sub.monto_total) : formatMoney(sub.saldo_pendiente !== null ? sub.saldo_pendiente : sub.monto_total)}</span>
                            </div>
                        `).join('')}
                    </div>
                </td>
            `;
            tabla.appendChild(filaDetalle);
        }
    });

    const btnFooter = document.createElement('tr');
    btnFooter.innerHTML = `
        <td colspan="8" class="p-8 text-center">
            <button onclick="toggleVistaFutura()" class="group flex items-center gap-2 mx-auto bg-gray-100 hover:bg-black hover:text-white transition-all px-10 py-4 rounded-full text-[10px] font-black uppercase text-gray-500 shadow-sm">
                <span class="material-symbols-outlined text-lg transition-transform ${mostrarFuturosPagos ? 'rotate-180' : ''}">visibility</span>
                ${mostrarFuturosPagos ? 'Ver Solo Mes Corriente' : 'Ver Próximos Meses'}
            </button>
        </td>
    `;
    tabla.appendChild(btnFooter);
}

function toggleAcordeon(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function toggleVistaFutura() {
    mostrarFuturosPagos = !mostrarFuturosPagos;
    aplicarFiltrosPagos();
}

function prepararAccionMasivaPagos(items, modo) {
    const principal = items[0];
    itemsLotePagoProv = items; // Guardamos el lote para procesamiento múltiple
    const totalSaldo = items.reduce((s, i) => s + (i.saldo_pendiente !== null ? i.saldo_pendiente : i.monto_total), 0);
    prepararAbonoProv(principal.id, principal.proveedor, totalSaldo, modo);
}

function abrirModalProrroga(id, proveedor, fechaActual) {
    currentGastoId = id;
    const info = document.getElementById('infoProrroga');
    if (info) info.innerText = `PROVEEDOR: ${proveedor}`;
    const input = document.getElementById('nuevaFechaProrroga');
    if (input) input.value = fechaActual;
    document.getElementById('modalProrroga')?.classList.remove('hidden');
}

async function guardarProrroga() {
    const nuevaFechaStr = document.getElementById('nuevaFechaProrroga').value;
    if (!nuevaFechaStr) return alert("Selecciona una fecha.");
    try {
        const resGasto = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${currentGastoId}`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const gasto = (await resGasto.json())[0];
        const fCreacion = new Date(gasto.created_at);
        const fNueva = new Date(nuevaFechaStr);
        const diffTime = Math.abs(fNueva - fCreacion);
        const nuevosDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${currentGastoId}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ dias_credito: nuevosDias })
        });
        if (res.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ gasto_id: currentGastoId, nota: `PRÓRROGA APLICADA: Nueva fecha límite ${new Date(nuevaFechaStr).toLocaleDateString()}` })
            });
            cerrarModalProrroga();
            cargarCuentasPorPagar();
            alert("Prórroga aplicada correctamente.");
        }
    } catch (e) { console.error(e); }
}

function actualizarKPIsPagos(datos) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const totalPendiente = datos.filter(i => i.estado_pago !== 'Pagado').reduce((s, i) => s + (i.saldo_pendiente !== null ? i.saldo_pendiente : i.monto_total), 0);
    const montoVencido = datos.filter(i => {
        const fl = new Date(i.created_at);
        fl.setDate(fl.getDate() + (i.dias_credito || 0));
        return i.estado_pago !== 'Pagado' && hoy > fl;
    }).reduce((s, i) => s + (i.saldo_pendiente || 0), 0);
    const venceHoySuma = datos.filter(i => {
        const fl = new Date(i.created_at);
        fl.setDate(fl.getDate() + (i.dias_credito || 0));
        return i.estado_pago !== 'Pagado' && hoy.toLocaleDateString() === fl.toLocaleDateString();
    }).reduce((s, i) => s + (i.saldo_pendiente || 0), 0);
    if (document.getElementById('kpiTotalPagar')) document.getElementById('kpiTotalPagar').innerText = formatMoney(totalPendiente);
    if (document.getElementById('kpiMontoVencido')) document.getElementById('kpiMontoVencido').innerText = formatMoney(montoVencido);
    if (document.getElementById('kpiVenceHoy')) document.getElementById('kpiVenceHoy').innerText = formatMoney(venceHoySuma);
}

function prepararAbonoPago(id, nombre, saldo, modo) {
    idTransaccionAbono = id;
    saldoMaximoAbono = saldo;
    const elNombre = document.getElementById('abonoCliente');
    if (elNombre) elNombre.innerText = `CLIENTE: ${nombre} (Saldo: ${formatMoney(saldo)})`;
    const elMonto = document.getElementById('montoAbono');
    const elTitulo = document.getElementById('tituloModalAbono');
    if (elMonto) {
        elMonto.value = (modo === 'liquidacion') ? saldo.toFixed(2) : "";
        elMonto.readOnly = (modo === 'liquidacion');
    }
    if (elTitulo) elTitulo.innerText = (modo === 'liquidacion') ? "Liquidar Cuenta" : "Registrar Abono";
    document.getElementById('modalAbono')?.classList.remove('hidden');
}

async function guardarAbono() {
    const montoInput = document.getElementById('montoAbono').value;
    const monto = parseFloat(montoInput);
    let metodo = document.getElementById('metodoPagoCobro').value;
    if (metodo === 'Otros') {
        const otroVal = document.getElementById('otroMetodoCobro')?.value;
        if (!otroVal) return alert("Especifique el método de pago.");
        metodo = otroVal.toUpperCase();
    }
    if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
    if (monto > (saldoMaximoAbono + 0.01)) return alert("El abono no puede ser mayor al saldo pendiente.");
    try {
        const nuevoSaldo = Math.max(0, saldoMaximoAbono - monto);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${idTransaccionAbono}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldo_pendiente: nuevoSaldo, estado_cobro: nuevoSaldo <= 0 ? 'Pagado' : 'Pendiente' })
        });
        if (res.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaccion_id: idTransaccionAbono,
                    nota: `PAGO RECIBIDO: ${formatMoney(monto)} vía ${metodo}. Saldo restante: ${formatMoney(nuevoSaldo)}`,
                    created_at: new Date().toISOString()
                })
            });

            // NUEVO: Registrar Transacción de Ingreso (Entrada de Dinero)
            await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'ABONO',
                    categoria: 'COBRANZA',
                    monto: monto,
                    monto_neto: monto, // Sin comisión en abonos directos
                    metodo_pago: metodo,
                    nombre_cliente: document.getElementById('abonoCliente').innerText.split(':')[1]?.split('(')[0]?.trim() || "CLIENTE",
                    sucursal: 'Matriz', // Se podría mejorar pasando la sucursal original
                    notas: `ABONO A CUENTA (REF: ${idTransaccionAbono})`
                })
            });

            cerrarModalAbono();
            cargarCuentasPorCobrar();
            alert("¡Pago registrado e ingreso generado!");
        }
    } catch (e) { alert("Error al registrar el pago."); }
}

function prepararAbonoProv(id, nombre, saldo, modo) {
    idGastoAbono = id;
    saldoMaximoAbono = saldo;
    const info = document.getElementById('infoAbonoProv');
    if (info) info.innerText = `PROVEEDOR: ${nombre} (Saldo: ${formatMoney(saldo)})`;
    const elMonto = document.getElementById('montoAbonoProv');
    if (elMonto) {
        elMonto.value = (modo === 'liquidacion') ? saldo.toFixed(2) : "";
        elMonto.readOnly = (modo === 'liquidacion');
    }

    // Nueva lógica: Inicializar fecha manual con el día de hoy ajustado a zona horaria local
    const inputFecha = document.getElementById('fechaEfectivaPagoProv');
    if (inputFecha) {
        const hoyLocal = new Date();
        const offset = hoyLocal.getTimezoneOffset() * 60000;
        const fechaLocal = new Date(hoyLocal.getTime() - offset).toISOString().split('T')[0];
        inputFecha.value = fechaLocal;
    }

    // Si hay un lote cargado (cuota compuesta), mostrar el desglose en el modal
    const desgloseContainer = document.getElementById('desglosePagoLote');
    if (desgloseContainer && itemsLotePagoProv.length > 1) {
        desgloseContainer.innerHTML = `<p class="text-[9px] font-black uppercase text-gray-400 mb-2">Conceptos incluidos:</p>` +
            itemsLotePagoProv.map(i => `<div class="flex justify-between text-[10px] font-bold"><span>${i.categoria}</span><span>${formatMoney(i.saldo_pendiente !== null ? i.saldo_pendiente : i.monto_total)}</span></div>`).join('');
        desgloseContainer.classList.remove('hidden');
    } else {
        desgloseContainer?.classList.add('hidden');
    }

    document.getElementById('modalAbonoProv')?.classList.remove('hidden');
}

async function guardarAbonoProv() {
    const monto = parseFloat(document.getElementById('montoAbonoProv').value);
    const rawFecha = document.getElementById('fechaEfectivaPagoProv').value; // Nueva fecha manual literal
    let metodo = document.getElementById('metodoPagoProv').value;
    if (metodo === 'Otros') {
        const otroVal = document.getElementById('otroMetodoProv')?.value;
        if (!otroVal) return alert("Especifique el método de salida.");
        metodo = otroVal.toUpperCase();
    }
    if (!monto || monto <= 0 || monto > (saldoMaximoAbono + 0.01)) return alert("Monto no válido.");
    if (!rawFecha) return alert("Seleccione la fecha efectiva del pago.");

    // Corrección de Fecha: Leer de forma literal YYYY, MM, DD para evitar desfase UTC
    const [year, month, day] = rawFecha.split('-').map(Number);
    const fechaLegible = new Date(year, month - 1, day).toLocaleDateString('es-MX');

    try {
        // PROCESAMIENTO MULTI-REGISTRO SI ES UN LOTE (CUOTA COMPUESTA)
        if (itemsLotePagoProv.length > 0) {
            let registroNotas = `PAGO TOTAL (FECHA EFECTIVA: ${fechaLegible}): ${formatMoney(monto)} vía ${metodo}. `;
            let detalles = [];

            for (const item of itemsLotePagoProv) {
                const montoItem = item.saldo_pendiente !== null ? item.saldo_pendiente : item.monto_total;
                detalles.push(`${item.categoria}: ${formatMoney(montoItem)}`);

                await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ saldo_pendiente: 0, estado_pago: 'Pagado' })
                });
            }

            // Registro detallado en la bitácora de TODOS los ítems del lote
            for (const item of itemsLotePagoProv) {
                await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gasto_id: item.id, nota: (registroNotas + detalles.join(' + ')).toUpperCase() })
                });
            }

            // NUEVO: Registrar Salida de Dinero por el TOTAL del Lote (Ej: Pago Préstamo)
            await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proveedor: document.getElementById('infoAbonoProv').innerText.split(':')[1]?.split('(')[0]?.trim() || "PROVEEDOR",
                    categoria: 'Pago de Pasivo',
                    subcategoria: 'ABONO A CUENTA',
                    monto_total: monto,
                    metodo_pago: metodo,
                    sucursal: 'Matriz',
                    estado_pago: 'Pagado',
                    created_at: new Date(year, month - 1, day).toISOString(),
                    notas: registroNotas
                })
            });

            itemsLotePagoProv = []; // Limpiamos lote
        } else {
            // Procesamiento individual estándar
            const nuevoSaldo = Math.max(0, saldoMaximoAbono - monto);
            const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${idGastoAbono}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ saldo_pendiente: nuevoSaldo, estado_pago: nuevoSaldo <= 0 ? 'Pagado' : 'Pendiente' })
            });
            if (res.ok) {
                await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gasto_id: idGastoAbono, nota: `PAGO REALIZADO (FECHA EFECTIVA: ${fechaLegible}): ${formatMoney(monto)} vía ${metodo}. Saldo restante: ${formatMoney(nuevoSaldo)}`.toUpperCase() })
                });

                // NUEVO: Registrar Salida de Dinero (Gasto Real)
                await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        proveedor: document.getElementById('infoAbonoProv').innerText.split(':')[1]?.split('(')[0]?.trim() || "PROVEEDOR",
                        categoria: 'Pago de Pasivo',
                        subcategoria: 'ABONO A CUENTA',
                        monto_total: monto,
                        metodo_pago: metodo,
                        sucursal: 'Matriz', // Idealmente pasar la sucursal del gasto origen
                        estado_pago: 'Pagado',
                        created_at: new Date(year, month - 1, day).toISOString(), // Usar la fecha efectiva
                        notas: `PAGO A PROVEEDOR (REF: ${idGastoAbono})`
                    })
                });
            }
        }

        cerrarModalAbonoProv();
        cargarCuentasPorPagar();
        alert("Pago aplicado correctamente.");
    } catch (e) { console.error(e); }
}

async function abrirBitacora(id, nombre) {
    currentTransaccionId = id;
    const elNombre = document.getElementById('clienteBitacora');
    if (elNombre) elNombre.innerText = `CLIENTE: ${nombre}`;
    document.getElementById('modalBitacora')?.classList.remove('hidden');
    cargarHistorialNotas(id, 'cliente');
}

async function abrirBitacoraProv(id, nombre) {
    currentGastoId = id;
    const elNombre = document.getElementById('nombreProveedorBitacora');
    if (elNombre) elNombre.innerText = nombre;
    document.getElementById('modalBitacoraProv')?.classList.remove('hidden');
    cargarHistorialNotas(id, 'proveedor');
}

async function cargarHistorialNotas(id, tipo) {
    const contenedor = tipo === 'cliente' ? document.getElementById('historialNotas') : document.getElementById('historialNotasProv');
    const tabla = tipo === 'cliente' ? 'bitacora_cobranza' : 'bitacora_proveedores';
    const filtro = tipo === 'cliente' ? `transaccion_id=eq.${id}` : `gasto_id=eq.${id}`;
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="text-center text-[10px] animate-pulse">Cargando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${filtro}&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const notas = await res.json();
        contenedor.innerHTML = notas.length ? notas.map(n => `
            <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 font-bold mb-2">
                <p class="text-xs text-gray-700">${n.nota}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[9px] text-gray-300">${new Date(n.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('') : '<p class="text-center text-[10px] text-gray-400 italic">Sin historial.</p>';
    } catch (e) { console.error(e); }
}

async function guardarNotaProv() {
    const nota = document.getElementById('notaProv').value;
    if (!nota) return alert("Escribe una nota.");
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ gasto_id: currentGastoId, nota: nota.toUpperCase() })
        });
        if (res.ok) { document.getElementById('notaProv').value = ""; cargarHistorialNotas(currentGastoId, 'proveedor'); }
    } catch (e) { console.error(e); }
}

async function guardarGestion() {
    const nota = document.getElementById('notaCobranza').value;
    const fecha = document.getElementById('fechaPromesa').value;
    if (!nota) return alert("Escribe un comentario.");
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaccion_id: currentTransaccionId,
                nota: nota.toUpperCase(),
                fecha_promesa: fecha || null,
                created_at: new Date().toISOString()
            })
        });
        if (res.ok) { document.getElementById('notaCobranza').value = ""; document.getElementById('fechaPromesa').value = ""; cargarHistorialNotas(currentTransaccionId, 'cliente'); }
    } catch (e) { alert("Error."); }
}

function cambiarPestaña(tipo) { pestañaActualCobros = tipo; aplicarFiltrosCobros(); }
function cambiarPestañaPagar(tipo) { pestañaActualPagos = tipo; aplicarFiltrosPagos(); }

function aplicarFiltrosCobros() {
    const busqueda = document.getElementById('busquedaCobros')?.value.toLowerCase() || '';
    const filtroEstado = document.getElementById('filtroEstadoCobro')?.value || 'Todos';
    const filtroSucursal = document.getElementById('filtroSucursalCobro')?.value || 'Todos';
    const hoy = new Date();
    const datosFiltrados = datosCacheCobros.filter(item => {
        const pagado = item.estado_cobro === 'Pagado';
        const fechaVenc = new Date(item.created_at); fechaVenc.setDate(fechaVenc.getDate() + 30);
        const esVencido = hoy > fechaVenc;
        if (pestañaActualCobros === 'pendiente' && pagado) return false;
        if (pestañaActualCobros === 'pagado' && !pagado) return false;
        if (filtroEstado === 'Vigente' && (esVencido || pagado)) return false;
        if (filtroEstado === 'Vencido' && (!esVencido || pagado)) return false;

        const coincideSuc = filtroSucursal === 'Todos' || item.sucursal === filtroSucursal;
        return (item.nombre_cliente?.toLowerCase().includes(busqueda) || item.categoria?.toLowerCase().includes(busqueda)) && coincideSuc;
    });


    currentFilteredCobros = datosFiltrados; // Store for export
    renderizarTablaCobros(datosFiltrados);
}

function cerrarModalAbonoProv() {
    itemsLotePagoProv = []; // Limpiamos lote al cerrar
    document.getElementById('modalAbonoProv')?.classList.add('hidden');
    document.getElementById('extraMetodoProv')?.classList.add('hidden');
}
function cerrarModalAbono() { document.getElementById('modalAbono')?.classList.add('hidden'); document.getElementById('extraMetodoCobro')?.classList.add('hidden'); }
function cerrarBitacora() { document.getElementById('modalBitacora')?.classList.add('hidden'); }
function cerrarBitacoraProv() { document.getElementById('modalBitacoraProv')?.classList.add('hidden'); }
async function sincronizarPagosHistoricos() {
    if (!confirm("Esta acción buscará en el historial pagos en EFECTIVO antiguos que no estén en 'Control de Efectivo' y creará los registros faltantes. ¿Deseas continuar?")) return;

    try {
        let creados = 0;
        let ignorados = 0;
        let errores = 0;
        const btn = document.getElementById('btnSyncHistory');
        if (btn) btn.disabled = true;

        // 1. SINCRONIZAR COBROS (INGRESOS)
        const { data: notasCobro } = await sbClient
            .from('bitacora_cobranza')
            .select('*, transacciones(nombre_cliente)')
            .ilike('nota', '%EFECTIVO%')
            .order('created_at', { ascending: true });

        const processedNotesCobro = new Set();

        for (const nota of notasCobro || []) {
            if (!nota.nota.includes("PAGO RECIBIDO")) continue;
            if (processedNotesCobro.has(nota.nota)) continue; // Evitar duplicados exactos
            processedNotesCobro.add(nota.nota);

            const montoMatch = nota.nota.match(/\$([\d,]+\.?\d*)/);
            if (!montoMatch) continue;
            const monto = parseFloat(montoMatch[1].replace(/,/g, ''));

            // Verificar existencia por NOTA ÚNICA
            const refNota = `ABONO A CUENTA (REF: ${nota.transaccion_id}) - HISTORICO BITACORA ${nota.id}`;
            const { data: existe } = await sbClient
                .from('transacciones')
                .select('id')
                .eq('notas', refNota)
                .maybeSingle();

            if (!existe) {
                const { error } = await sbClient.from('transacciones').insert({
                    tipo: 'ABONO',
                    categoria: 'COBRANZA',
                    monto: monto,
                    monto_neto: monto,
                    metodo_pago: 'EFECTIVO',
                    nombre_cliente: nota.transacciones?.nombre_cliente || "CLIENTE HISTORICO",
                    sucursal: 'Matriz',
                    created_at: nota.created_at,
                    notas: refNota
                });
                if (!error) creados++; else errores++;
            } else {
                ignorados++;
            }
        }

        // 2. SINCRONIZAR PAGOS PROVEEDORES (EGRESOS)
        const { data: notasProv } = await sbClient
            .from('bitacora_proveedores')
            .select('*, gastos(proveedor)')
            .ilike('nota', '%EFECTIVO%')
            .order('created_at', { ascending: true });

        const processedNotesProv = new Set();

        for (const nota of notasProv || []) {
            if (!nota.nota.includes("PAGO")) continue;

            // Lógica Anti-Duplicados para Lotes: Si la nota es IDÉNTICA a una ya procesada, la saltamos.
            if (processedNotesProv.has(nota.nota)) continue;
            processedNotesProv.add(nota.nota);

            const montoMatch = nota.nota.match(/\$([\d,]+\.?\d*)/);
            if (!montoMatch) continue;
            const monto = parseFloat(montoMatch[1].replace(/,/g, ''));

            // Usar la nota original como referencia única para evitar re-creación
            const refNota = `PAGO A PROVEEDOR (REF: ${nota.gasto_id}) - HISTORICO BITACORA ${nota.id}`;
            // Buscar si YA existe un gasto creado por esta sincronización
            // Modificamos la búsqueda para ser más laxa con el ID de la bitacora en caso de lotes
            const { data: existe } = await sbClient
                .from('gastos')
                .select('id')
                .ilike('notas', `%HISTORICO BITACORA%`) // Optimización: buscar genéricamente primero
                .eq('created_at', nota.created_at) // Coincidencia exacta de fecha/hora
                .eq('monto_total', monto)
                .maybeSingle();

            if (!existe) {
                const { error } = await sbClient.from('gastos').insert({
                    proveedor: nota.gastos?.proveedor || "PROVEEDOR HISTORICO",
                    categoria: 'Pago de Pasivo',
                    subcategoria: 'ABONO A CUENTA',
                    monto_total: monto,
                    metodo_pago: 'EFECTIVO',
                    sucursal: 'Matriz',
                    estado_pago: 'Pagado',
                    created_at: nota.created_at,
                    notas: refNota
                });
                if (!error) creados++; else errores++;
            } else {
                ignorados++;
            }
        }

        alert(`Sincronización Completada.\n\nNuevos Registros Creados: ${creados}\nYa Existían (Ignorados): ${ignorados}\nErrores: ${errores}\n\nPor favor revisa 'Control de Efectivo' ahora.`);
        if (btn) btn.disabled = false;

    } catch (e) {
        console.error(e);
        alert("Error crítico en la sincronización: " + e.message);
        const btn = document.getElementById('btnSyncHistory');
        if (btn) btn.disabled = false;
    }
}