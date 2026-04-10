// cobranza.js - Gestión de Cuentas por Cobrar y Cuentas por Pagar

// --- UTILS FALLBACK ---
if (typeof formatMoney === 'undefined') {
    window.formatMoney = (n) => {
        if (n === undefined || n === null) return "$0.00";
        return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };
    console.log("⚠️ cobranza.js: formatMoney defined locally as fallback");
}
// ----------------------

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
let vistaActualCxP = 'lista'; // 'lista' | 'calendario'
let vistaActualCxC = 'lista'; // 'lista' | 'calendario'

// Paginación Cuentas por Cobrar
let paginaActualCobros = 1;
const FILAS_POR_PAGINA_COBROS = 15;

function renderizarPaginacionCobros(datosCompletos) {
    const total = datosCompletos.length;
    const totalPaginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA_COBROS));
    const inicio = (paginaActualCobros - 1) * FILAS_POR_PAGINA_COBROS + 1;
    const fin = Math.min(paginaActualCobros * FILAS_POR_PAGINA_COBROS, total);

    const infoEl = document.getElementById('infoPaginacionCobros');
    if (infoEl) infoEl.textContent = total === 0 ? 'Sin resultados' : `Mostrando ${inicio}–${fin} de ${total}`;

    const contEl = document.getElementById('btnsPaginacionCobros');
    if (!contEl) return;

    if (totalPaginas <= 1) { contEl.innerHTML = ''; return; }

    let html = `<button class="btn-pag" ${paginaActualCobros === 1 ? 'disabled' : ''} onclick="cambiarPaginaCobros(${paginaActualCobros - 1})">
        <span class="material-symbols-outlined text-sm">chevron_left</span>
    </button>`;

    const rango = 2;
    for (let p = 1; p <= totalPaginas; p++) {
        if (p === 1 || p === totalPaginas || (p >= paginaActualCobros - rango && p <= paginaActualCobros + rango)) {
            html += `<button class="btn-pag ${p === paginaActualCobros ? 'btn-pag-activa' : ''}" onclick="cambiarPaginaCobros(${p})">${p}</button>`;
        } else if (p === paginaActualCobros - rango - 1 || p === paginaActualCobros + rango + 1) {
            html += `<span class="px-1 text-gray-300 font-black text-xs">…</span>`;
        }
    }

    html += `<button class="btn-pag" ${paginaActualCobros === totalPaginas ? 'disabled' : ''} onclick="cambiarPaginaCobros(${paginaActualCobros + 1})">
        <span class="material-symbols-outlined text-sm">chevron_right</span>
    </button>`;

    contEl.innerHTML = html;
}

function cambiarPaginaCobros(pagina) {
    paginaActualCobros = pagina;
    aplicarFiltrosCobros._desdePaginacion = true;
    aplicarFiltrosCobros();
}

// FUNCIONES DE SOPORTE PARA "OTROS"
function checkMetodoCobro(val) {
    const extra = document.getElementById('extraMetodoCobro');
    if (extra) extra.classList.toggle('hidden', val !== 'Otros');
}

function checkMetodoPagoProv(val) {
    const extra = document.getElementById('extraMetodoProv');
    if (extra) extra.classList.toggle('hidden', val !== 'Otros');
}

// Helper: obtener fecha de vencimiento (usa fecha_vencimiento si existe, sino created_at + 30)
function obtenerFechaVencimiento(item) {
    if (item.fecha_vencimiento) {
        const [y, m, d] = item.fecha_vencimiento.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const fv = new Date(item.created_at);
    fv.setDate(fv.getDate() + 30);
    return fv;
}

// 1. GESTIÓN DE CUENTAS POR COBRAR (CLIENTES)
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
            const fechaVencimiento = obtenerFechaVencimiento(item);

            if (estadoActual === 'Pendiente') {
                totalOutstanding += saldoPendiente;
                if (hoy > fechaVencimiento) totalVencidoSuma += saldoPendiente;
            }
            totalRecuperado += (montoOriginal - saldoPendiente);
        });

        if (document.getElementById('totalPorCobrar')) document.getElementById('totalPorCobrar').innerText = formatMoney(totalOutstanding);
        if (document.getElementById('totalVencido')) document.getElementById('totalVencido').innerText = formatMoney(totalVencidoSuma);
        if (document.getElementById('cuentasVencidas')) document.getElementById('cuentasVencidas').innerText = datosCacheCobros.filter(i => {
            const fv = obtenerFechaVencimiento(i);
            return (hoy > fv) && (i.estado_cobro !== 'Pagado');
        }).length;
        if (document.getElementById('recuperadoMes')) document.getElementById('recuperadoMes').innerText = formatMoney(totalRecuperado);

        aplicarFiltrosCobros();
        verificarSnapshotReset();
    } catch (error) { console.error("Error cobranza:", error); }
}

function renderizarTablaCobros(datosFiltrados) {
    const tabla = document.getElementById('tablaCobranza');
    if (!tabla) return;
    tabla.innerHTML = "";
    const hoy = new Date();

    // Paginar: mostrar solo los registros de la página actual
    const inicio = (paginaActualCobros - 1) * FILAS_POR_PAGINA_COBROS;
    const datosPagina = datosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA_COBROS);

    if (datosPagina.length === 0) {
        tabla.innerHTML = `<tr><td colspan="9" class="px-6 py-12 text-center text-gray-400 text-sm font-semibold italic">Sin resultados para los filtros seleccionados.</td></tr>`;
        renderizarPaginacionCobros(datosFiltrados);
        return;
    }

    datosPagina.forEach(item => {
        const montoOriginal = item.monto || 0;
        const saldoPendiente = (item.saldo_pendiente !== null) ? item.saldo_pendiente : montoOriginal;
        const estadoActual = item.estado_cobro || 'Pendiente';
        const fechaCompra = new Date(item.created_at);
        const fechaVencimiento = obtenerFechaVencimiento(item);
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
                        <button onclick="eliminarCxC('${item.id}', '${item.nombre_cliente}')" class="p-2 bg-red-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center" title="Eliminar CxC">
                            <span class="material-symbols-outlined text-sm font-bold">delete</span>
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

    // Renderizar controles de paginación
    renderizarPaginacionCobros(datosFiltrados);
}

async function enviarWhatsAppCobranza(item, esVencido) {
    const telefono = item.telefono_cliente;
    if (!telefono) return alert("El cliente no tiene teléfono registrado.");

    const montoStr = formatMoney(item.saldo_pendiente || item.monto);
    const fechaVenc = obtenerFechaVencimiento(item).toLocaleDateString();
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
        verificarSnapshotResetCxP();
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
        const llave = esCuota ? (item.notas.split(') - ')[1] + "_" + (item.created_at ? item.created_at.split('T')[0] : '')) : item.id;
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
                        <button onclick="prepararAccionMasivaPagos(${JSON.stringify(items).replace(/"/g, '&quot;')}, 'abono')" class="p-2 bg-green-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center" title="Registrar abono parcial">
                            <span class="material-symbols-outlined text-sm font-bold">payments</span>
                        </button>
                        <button onclick="prepararAccionMasivaPagos(${JSON.stringify(items).replace(/"/g, '&quot;')}, 'liquidacion')" class="p-2 bg-blue-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center" title="Liquidar cuenta completa">
                            <span class="material-symbols-outlined text-sm font-bold">check_circle</span>
                        </button>
                        <button onclick="abrirModalProrroga('${principal.id}', '${principal.proveedor}', '${fechaLimite.toISOString().split('T')[0]}')" class="p-2 bg-orange-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center">
                            <span class="material-symbols-outlined text-sm font-bold">calendar_month</span>
                        </button>
                        ${!(principal.notas && principal.notas.includes('PRÉSTAMO:')) ? `
                        <button onclick="eliminarCxP('${principal.id}', '${principal.proveedor}')" class="p-2 bg-red-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm flex items-center justify-center" title="Eliminar CxP">
                            <span class="material-symbols-outlined text-sm font-bold">delete</span>
                        </button>
                        ` : ''}
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

async function prepararAbonoPago(id, nombre, saldo, modo) {
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

    // Inicializar fecha efectiva con el día de hoy ajustado a zona horaria local
    const inputFechaCobro = document.getElementById('fechaEfectivaCobro');
    if (inputFechaCobro) {
        const hoyLocal = new Date();
        const offset = hoyLocal.getTimezoneOffset() * 60000;
        const fechaLocal = new Date(hoyLocal.getTime() - offset).toISOString().split('T')[0];
        inputFechaCobro.value = fechaLocal;
    }

    // Poblar métodos de pago directo desde PROD en el momento exacto que se abre el modal
    const selectMetodo = document.getElementById('metodoPagoCobro');
    if (selectMetodo) {
        try {
            const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
            const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=nombre,activo&activo=eq.true&order=orden.asc`, {
                headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` }
            });
            if (r.ok) {
                const metodos = await r.json();
                if (metodos && metodos.length > 0) {
                    selectMetodo.innerHTML = metodos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
                }
            }
        } catch(e) { /* mantener opciones existentes */ }
    }

    document.getElementById('modalAbono')?.classList.remove('hidden');
}

async function guardarAbono() {
    const montoInput = document.getElementById('montoAbono').value;
    const monto = parseFloat(montoInput);
    const rawFechaCobro = document.getElementById('fechaEfectivaCobro')?.value;
    let metodo = document.getElementById('metodoPagoCobro').value;
    if (metodo === 'Otros') {
        const otroVal = document.getElementById('otroMetodoCobro')?.value;
        if (!otroVal) return alert("Especifique el método de pago.");
        metodo = otroVal.toUpperCase();
    }
    if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
    if (monto > (saldoMaximoAbono + 0.01)) return alert("El abono no puede ser mayor al saldo pendiente.");
    if (!rawFechaCobro) return alert("Seleccione la fecha efectiva del pago.");

    // Corrección de Fecha: Leer de forma literal YYYY, MM, DD para evitar desfase UTC
    const [year, month, day] = rawFechaCobro.split('-').map(Number);
    const fechaISO = new Date(year, month - 1, day, 12, 0, 0).toISOString();
    const fechaLegible = new Date(year, month - 1, day).toLocaleDateString('es-MX');

    const sucursalSeleccionada = document.getElementById('sucursalCobro')?.value || 'Norte';

    try {
        // 1. Obtener datos originales de la transacción para nombre_cliente
        const resOriginal = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${idTransaccionAbono}&select=sucursal,nombre_cliente`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const dataOriginal = await resOriginal.json();
        const clienteOriginal = dataOriginal[0]?.nombre_cliente || 'CLIENTE';

        // 2. Actualizar saldo pendiente de la cuenta original
        const nuevoSaldo = Math.max(0, saldoMaximoAbono - monto);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${idTransaccionAbono}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldo_pendiente: nuevoSaldo, estado_cobro: nuevoSaldo <= 0 ? 'Pagado' : 'Pendiente' })
        });

        if (res.ok) {
            // 3. Registrar en bitácora con fecha efectiva
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaccion_id: idTransaccionAbono,
                    nota: `PAGO RECIBIDO (FECHA EFECTIVA: ${fechaLegible}): ${formatMoney(monto)} vía ${metodo}. Saldo restante: ${formatMoney(nuevoSaldo)}`,
                    created_at: fechaISO
                })
            });

            // 4. Registrar Transacción de Ingreso (Abono) con sucursal CORRECTA y fecha efectiva
            const resAbono = await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'ABONO',
                    categoria: 'COBRANZA',
                    monto: monto,
                    monto_neto: monto,
                    metodo_pago: metodo,
                    nombre_cliente: clienteOriginal,
                    sucursal: sucursalSeleccionada,
                    notas: `ABONO A CUENTA (REF: ${idTransaccionAbono})`,
                    created_at: fechaISO // ✅ Fecha efectiva seleccionada
                })
            });

            if (!resAbono.ok) {
                console.error("Error al crear registro de abono:", await resAbono.text());
            }

            cerrarModalAbono();
            cargarCuentasPorCobrar();
            alert("¡Pago registrado e ingreso generado!");
        }
    } catch (e) {
        console.error("Error en guardarAbono:", e);
        alert("Error al registrar el pago.");
    }
}

async function prepararAbonoProv(id, nombre, saldo, modo) {
    idGastoAbono = id;
    saldoMaximoAbono = saldo;
    const info = document.getElementById('infoAbonoProv');
    if (info) info.innerText = `PROVEEDOR: ${nombre} (Saldo: ${formatMoney(saldo)})`;
    const elMonto = document.getElementById('montoAbonoProv');
    if (elMonto) {
        elMonto.value = (modo === 'liquidacion') ? saldo.toFixed(2) : "";
        elMonto.readOnly = (modo === 'liquidacion');
    }

    // Inicializar fecha manual con el día de hoy ajustado a zona horaria local
    const inputFecha = document.getElementById('fechaEfectivaPagoProv');
    if (inputFecha) {
        const hoyLocal = new Date();
        const offset = hoyLocal.getTimezoneOffset() * 60000;
        const fechaLocal = new Date(hoyLocal.getTime() - offset).toISOString().split('T')[0];
        inputFecha.value = fechaLocal;
    }

    // Poblar métodos de pago directo desde PROD en el momento exacto que se abre el modal
    const selectMetodoProv = document.getElementById('metodoPagoProv');
    if (selectMetodoProv) {
        try {
            const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
            const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=nombre,activo&activo=eq.true&order=orden.asc`, {
                headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` }
            });
            if (r.ok) {
                const metodos = await r.json();
                if (metodos && metodos.length > 0) {
                    selectMetodoProv.innerHTML = metodos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
                }
            }
        } catch(e) { /* mantener opciones existentes */ }
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
            const totalSaldoLote = itemsLotePagoProv.reduce((s, i) => s + (i.saldo_pendiente !== null ? i.saldo_pendiente : i.monto_total), 0);
            const esPagoTotal = monto >= totalSaldoLote - 0.01;
            const ratio = esPagoTotal ? 1 : monto / totalSaldoLote;
            let registroNotas = `${esPagoTotal ? 'PAGO TOTAL' : 'ABONO PARCIAL'} (FECHA EFECTIVA: ${fechaLegible}): ${formatMoney(monto)} vía ${metodo}. `;
            let detalles = [];

            for (const item of itemsLotePagoProv) {
                const saldoItem = item.saldo_pendiente !== null ? item.saldo_pendiente : item.monto_total;
                const pagoItem = Math.min(saldoItem, parseFloat((saldoItem * ratio).toFixed(2)));
                const nuevoSaldoItem = Math.max(0, parseFloat((saldoItem - pagoItem).toFixed(2)));
                const estadoItem = nuevoSaldoItem <= 0 ? 'Pagado' : 'Pendiente';
                detalles.push(`${item.categoria}: ${formatMoney(pagoItem)}`);

                await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ saldo_pendiente: nuevoSaldoItem, estado_pago: estadoItem })
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

            // Registrar Salida de Dinero en Gastos (Pago de Pasivo)
            const primerItem = itemsLotePagoProv[0];
            const resGastoPago = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    proveedor: primerItem?.proveedor || "PROVEEDOR",
                    proveedor_id: primerItem?.proveedor_id || null,
                    categoria: 'Pago de Pasivo',
                    subcategoria: 'ABONO A CUENTA',
                    monto_total: monto,
                    saldo_pendiente: 0,
                    metodo_pago: metodo,
                    sucursal: primerItem?.sucursal || 'Norte',
                    estado_pago: 'Pagado',
                    created_at: new Date(year, month - 1, day).toISOString(),
                    notas: registroNotas
                })
            });
            if (!resGastoPago.ok) {
                const errBody = await resGastoPago.text();
                console.error('[cobranza] Error creando gasto de pago:', errBody);
            }

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

                // Registrar Salida de Dinero en Gastos (Pago de Pasivo)
                const gastoOrigen = datosCachePagos.find(g => g.id === idGastoAbono);
                await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({
                        proveedor: gastoOrigen?.proveedor || "PROVEEDOR",
                        proveedor_id: gastoOrigen?.proveedor_id || null,
                        categoria: 'Pago de Pasivo',
                        subcategoria: 'ABONO A CUENTA',
                        monto_total: monto,
                        saldo_pendiente: 0,
                        metodo_pago: metodo,
                        sucursal: gastoOrigen?.sucursal || 'Norte',
                        estado_pago: 'Pagado',
                        created_at: new Date(year, month - 1, day).toISOString(),
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

function cambiarPestaña(tipo) {
    pestañaActualCobros = tipo;

    // UI Feedback
    const btnPend = document.getElementById('tabPendiente');
    const btnPag = document.getElementById('tabPagado');

    if (tipo === 'pendiente') {
        btnPend.classList.add('tab-active');
        btnPend.classList.remove('text-gray-400');
        btnPag.classList.remove('tab-active');
        btnPag.classList.add('text-gray-400');
    } else {
        btnPag.classList.add('tab-active');
        btnPag.classList.remove('text-gray-400');
        btnPend.classList.remove('tab-active');
        btnPend.classList.add('text-gray-400');
    }

    paginaActualCobros = 1; // Resetear a primera página al cambiar tab
    aplicarFiltrosCobros();
}
function cambiarPestañaPagar(tipo) { pestañaActualPagos = tipo; aplicarFiltrosPagos(); }

function renderizarAlertasCobranza(datos) {
    const container = document.getElementById('panelAlertasVencidas');
    const grid = document.getElementById('gridAlertasVencidas');
    const masMsg = document.getElementById('masAlertasMsg');
    if (!container || !grid) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const busqueda = document.getElementById('busquedaCobros')?.value.toLowerCase() || '';
    const filtroSucursal = document.getElementById('filtroSucursalCobro')?.value || 'Todos';

    const vencidos = datos.filter(item => {
        if (item.estado_cobro === 'Pagado') return false;
        const fechaVenc = obtenerFechaVencimiento(item);
        if (hoy <= fechaVenc) return false;
        const coincideSuc = filtroSucursal === 'Todos' || item.sucursal === filtroSucursal;
        const coincideTxt = (item.nombre_cliente?.toLowerCase().includes(busqueda) || item.categoria?.toLowerCase().includes(busqueda));
        return coincideSuc && coincideTxt;
    });

    if (vencidos.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    const MAX_CARDS = 6;
    const visibles = vencidos.slice(0, MAX_CARDS);

    grid.innerHTML = visibles.map(item => {
        const fechaVenc = obtenerFechaVencimiento(item);
        const diffDays = Math.ceil(Math.abs(hoy - fechaVenc) / (1000 * 60 * 60 * 24));
        const saldo = item.saldo_pendiente !== null ? item.saldo_pendiente : item.monto;
        const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
        const nivel = item.nivel_cobranza || 0;

        return `
            <div class="alerta-card bg-white border border-red-100 rounded-xl p-3.5 flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-black uppercase text-gray-800 truncate">${item.nombre_cliente}</p>
                    <p class="text-[9px] text-gray-400 font-bold mt-0.5">${item.categoria || '#S/N'} ${item.sucursal ? '· ' + item.sucursal : ''}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black border border-red-200">${diffDays}d atraso</span>
                        <span class="text-xs font-black text-red-600">${formatMoney(saldo)}</span>
                        ${nivel > 0 ? `<span class="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">L${nivel}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="enviarWhatsAppCobranza(${itemJson}, true)"
                        class="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all flex items-center justify-center shadow-sm" title="WhatsApp">
                        <span class="material-symbols-outlined text-sm">chat</span>
                    </button>
                    <button onclick="prepararAbonoPago('${item.id}', '${item.nombre_cliente}', ${saldo}, 'abono')"
                        class="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all flex items-center justify-center shadow-sm" title="Registrar abono">
                        <span class="material-symbols-outlined text-sm">payments</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (masMsg) {
        if (vencidos.length > MAX_CARDS) {
            masMsg.textContent = `Ver las ${vencidos.length - MAX_CARDS} cuentas vencidas restantes en la tabla ↓`;
            masMsg.classList.remove('hidden');
        } else {
            masMsg.classList.add('hidden');
        }
    }
}

function aplicarFiltrosCobros() {
    // Cuando se llama desde UI (no desde cambiarPaginaCobros), resetear a página 1
    if (!aplicarFiltrosCobros._desdePaginacion) paginaActualCobros = 1;
    aplicarFiltrosCobros._desdePaginacion = false;

    const busqueda = document.getElementById('busquedaCobros')?.value.toLowerCase() || '';
    const filtroEstado = document.getElementById('filtroEstadoCobro')?.value || 'Todos';
    const filtroSucursal = document.getElementById('filtroSucursalCobro')?.value || 'Todos';
    const hoy = new Date();
    const datosFiltrados = datosCacheCobros.filter(item => {
        const pagado = item.estado_cobro === 'Pagado';
        const fechaVenc = obtenerFechaVencimiento(item);
        const esVencido = hoy > fechaVenc;
        if (pestañaActualCobros === 'pendiente' && pagado) return false;
        if (pestañaActualCobros === 'pagado' && !pagado) return false;
        if (filtroEstado === 'Vigente' && (esVencido || pagado)) return false;
        if (filtroEstado === 'Vencido' && (!esVencido || pagado)) return false;

        const coincideSuc = filtroSucursal === 'Todos' || item.sucursal === filtroSucursal;
        return (item.nombre_cliente?.toLowerCase().includes(busqueda) || item.categoria?.toLowerCase().includes(busqueda)) && coincideSuc;
    });

    currentFilteredCobros = datosFiltrados; // Store for export

    // Actualizar contador de resultados en filtros
    const resumenEl = document.getElementById('resumenFiltroCobros');
    if (resumenEl) resumenEl.textContent = `${datosFiltrados.length} registro${datosFiltrados.length !== 1 ? 's' : ''}`;

    if (vistaActualCxC === 'calendario') {
        renderizarVistaCalendarioCxC(datosFiltrados);
    } else {
        renderizarTablaCobros(datosFiltrados);
    }
    renderizarAlertasCobranza(datosCacheCobros);
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

        // 1. Obtener todos los gastos de tipo "Pago de Pasivo" (que son salidas de dinero reales por pagos de crédito)
        const resPagos = await fetch(`${SUPABASE_URL}/rest/v1/gastos?categoria=eq.Pago%20de%20Pasivo&metodo_pago=eq.Efectivo&select=*`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const pagosExistentes = await resPagos.json();

        if (pagosExistentes.length === 0) return alert("No se encontraron pagos históricos en efectivo.");

        alert(`Proceso finalizado. Total: ${creados} nuevos registros de caja creados. (${ignorados} ya existían).`);

    } catch (e) {
        console.error(e);
        alert("Error en sincronización: " + e.message);
    }
}

// ============================================================
// RESET DE CUENTAS POR COBRAR
// ============================================================

// Verificar si hay un snapshot de reset guardado
async function verificarSnapshotReset() {
    const btn = document.getElementById('btnDeshacerReset');
    if (!btn) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxc_reset_snapshot&select=value`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].value && data[0].value.registros && data[0].value.registros.length > 0) {
            btn.classList.remove('hidden');
            btn.style.display = '';
        } else {
            btn.classList.add('hidden');
        }
    } catch (e) {
        btn.classList.add('hidden');
    }
}

// Ejecutar el reset con doble confirmación
async function ejecutarReset() {
    const inputConfirm = document.getElementById('inputConfirmReset');
    if (!inputConfirm || inputConfirm.value.trim().toUpperCase() !== 'RESET') {
        return alert('Debes escribir "RESET" exactamente para confirmar.');
    }

    try {
        // 1. Obtener todas las CxC pendientes para el snapshot
        const resPendientes = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?metodo_pago=ilike.Cr%25dito&estado_cobro=eq.Pendiente&select=id,estado_cobro,saldo_pendiente,monto`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const pendientes = await resPendientes.json();

        if (!pendientes || pendientes.length === 0) {
            cerrarModalReset();
            return alert('No hay cuentas por cobrar pendientes para resetear.');
        }

        // 2. Guardar snapshot en sys_config
        const snapshot = {
            fecha_reset: new Date().toISOString(),
            registros: pendientes.map(p => ({
                id: p.id,
                estado_cobro: p.estado_cobro,
                saldo_pendiente: p.saldo_pendiente !== null ? p.saldo_pendiente : p.monto
            }))
        };

        // Intentar upsert en sys_config
        const resSnapshot = await fetch(`${SUPABASE_URL}/rest/v1/sys_config`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'cxc_reset_snapshot', value: snapshot, description: 'Snapshot de CxC antes del último reset' })
        });

        if (!resSnapshot.ok) {
            const err = await resSnapshot.text();
            console.error('Error guardando snapshot:', err);
            return alert('Error al guardar respaldo. El reset NO se aplicó.');
        }

        // 3. PATCH masivo: marcar todas como Pagado con saldo 0
        let patchedCount = 0;
        for (const item of pendientes) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado_cobro: 'Pagado', saldo_pendiente: 0 })
            });
            if (res.ok) patchedCount++;
        }

        // 4. Registrar en bitácora de cada registro
        for (const item of pendientes) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaccion_id: item.id,
                    nota: `RESET APLICADO POR USUARIO. Saldo original: ${formatMoney(item.saldo_pendiente !== null ? item.saldo_pendiente : item.monto)}`,
                    created_at: new Date().toISOString()
                })
            });
        }

        cerrarModalReset();
        cargarCuentasPorCobrar();
        alert(`✅ Reset completado. ${patchedCount} cuentas marcadas como pagadas.\n\nPuedes usar el botón "Deshacer Reset" para revertir.`);

    } catch (e) {
        console.error('Error en reset:', e);
        alert('Error al ejecutar el reset: ' + e.message);
    }
}

// Deshacer el último reset
async function deshacerReset() {
    if (!confirm('¿Estás seguro de deshacer el último reset?\n\nTodas las cuentas por cobrar volverán a su estado anterior.')) return;

    try {
        // 1. Leer snapshot
        const resSnapshot = await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxc_reset_snapshot&select=value`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const snapData = await resSnapshot.json();
        if (!snapData || snapData.length === 0 || !snapData[0].value || !snapData[0].value.registros) {
            return alert('No se encontró ningún respaldo para deshacer.');
        }

        const registros = snapData[0].value.registros;
        let restaurados = 0;

        // 2. Restaurar cada registro a su estado original
        for (const reg of registros) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${reg.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado_cobro: reg.estado_cobro, saldo_pendiente: reg.saldo_pendiente })
            });
            if (res.ok) restaurados++;
        }

        // 3. Eliminar snapshot
        await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxc_reset_snapshot`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        // 4. Registrar en bitácora
        for (const reg of registros) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaccion_id: reg.id,
                    nota: `RESET DESHECHO POR USUARIO. Estado restaurado: ${reg.estado_cobro}, Saldo: ${formatMoney(reg.saldo_pendiente)}`,
                    created_at: new Date().toISOString()
                })
            });
        }

        cargarCuentasPorCobrar();
        alert(`✅ Reset deshecho. ${restaurados} cuentas restauradas a su estado original.`);

    } catch (e) {
        console.error('Error deshaciendo reset:', e);
        alert('Error al deshacer: ' + e.message);
    }
}

// ============================================================
// CREAR CxC MANUAL
// ============================================================

function inicializarFormularioCxC() {
    const hoyLocal = new Date();
    const offset = hoyLocal.getTimezoneOffset() * 60000;
    const fechaLocal = new Date(hoyLocal.getTime() - offset).toISOString().split('T')[0];

    const campoFecha = document.getElementById('manualCxcFecha');
    const campoVenc = document.getElementById('manualCxcVencimiento');
    if (campoFecha) campoFecha.value = fechaLocal;
    if (campoVenc) {
        const venc = new Date(hoyLocal.getTime() - offset);
        venc.setDate(venc.getDate() + 30);
        campoVenc.value = venc.toISOString().split('T')[0];
    }

    // Limpiar campos
    ['manualCxcFolio', 'manualCxcCliente', 'manualCxcTelefono', 'manualCxcMontoOriginal', 'manualCxcMontoPendiente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selectSuc = document.getElementById('manualCxcSucursal');
    if (selectSuc) selectSuc.value = 'Norte';
    const selectEstado = document.getElementById('manualCxcEstado');
    if (selectEstado) selectEstado.value = 'Pendiente';
}

async function guardarCxCManual() {
    const fecha = document.getElementById('manualCxcFecha')?.value;
    const folio = document.getElementById('manualCxcFolio')?.value?.toUpperCase();
    const cliente = document.getElementById('manualCxcCliente')?.value?.toUpperCase();
    const telefono = document.getElementById('manualCxcTelefono')?.value;
    const sucursal = document.getElementById('manualCxcSucursal')?.value;
    const montoOriginal = parseFloat(document.getElementById('manualCxcMontoOriginal')?.value) || 0;
    const montoPendiente = parseFloat(document.getElementById('manualCxcMontoPendiente')?.value) || 0;
    const vencimiento = document.getElementById('manualCxcVencimiento')?.value;
    const estado = document.getElementById('manualCxcEstado')?.value || 'Pendiente';

    if (!fecha) return alert('Selecciona una fecha.');
    if (!cliente) return alert('Ingresa el nombre del cliente.');
    if (montoOriginal <= 0) return alert('El monto original debe ser mayor a 0.');
    if (!vencimiento) return alert('Selecciona la fecha de vencimiento.');

    try {
        const [year, month, day] = fecha.split('-').map(Number);
        const fechaISO = new Date(year, month - 1, day, 12, 0, 0).toISOString();

        const registro = {
            created_at: fechaISO,
            categoria: folio || '#MANUAL',
            nombre_cliente: cliente,
            telefono_cliente: telefono || null,
            sucursal: sucursal,
            monto: montoOriginal,
            monto_neto: montoOriginal,
            saldo_pendiente: montoPendiente,
            metodo_pago: 'Crédito',
            estado_cobro: estado,
            fecha_vencimiento: vencimiento,
            tipo: 'Venta Directa',
            notas: 'CXC MANUAL'
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(registro)
        });

        if (res.ok) {
            cerrarModalNuevaCxC();
            cargarCuentasPorCobrar();
            alert('✅ Cuenta por cobrar creada exitosamente.');
        } else {
            const err = await res.text();
            console.error('Error creando CxC:', err);
            alert('Error al crear la cuenta por cobrar.');
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error al guardar: ' + e.message);
    }
}

// ============================================================
// ELIMINAR CxC INDIVIDUAL
// ============================================================

async function eliminarCxC(id, nombreCliente) {
    if (!confirm(`¿Eliminar la cuenta por cobrar de "${nombreCliente}"?\n\nSe marcará como Pagado (el ingreso original se mantiene intacto).`)) return;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado_cobro: 'Pagado', saldo_pendiente: 0 })
        });

        if (res.ok) {
            // Registrar en bitácora
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaccion_id: id,
                    nota: 'CXC ELIMINADA MANUALMENTE POR USUARIO',
                    created_at: new Date().toISOString()
                })
            });

            cargarCuentasPorCobrar();
            alert('✅ Cuenta por cobrar eliminada.');
        }
    } catch (e) {
        console.error('Error eliminando CxC:', e);
        alert('Error al eliminar.');
    }
}

// ============================================================
// IMPORTAR EXCEL
// ============================================================

let _datosExcelParseados = [];

function resetearModalImportacion() {
    _datosExcelParseados = [];
    const fileInput = document.getElementById('inputExcelCxC');
    if (fileInput) fileInput.value = '';
    const nombreEl = document.getElementById('nombreArchivoExcel');
    if (nombreEl) { nombreEl.textContent = ''; nombreEl.classList.add('hidden'); }
    const previewContainer = document.getElementById('previewExcelContainer');
    if (previewContainer) previewContainer.classList.add('hidden');
    const btnConfirmar = document.getElementById('btnConfirmarImportacion');
    if (btnConfirmar) btnConfirmar.disabled = true;
    const erroresEl = document.getElementById('erroresPreviewExcel');
    if (erroresEl) erroresEl.classList.add('hidden');
}

function previsualizarExcelCxC(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const nombreEl = document.getElementById('nombreArchivoExcel');
    if (nombreEl) { nombreEl.textContent = `📄 ${file.name}`; nombreEl.classList.remove('hidden'); }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (!rawData || rawData.length === 0) {
                alert('El archivo no contiene datos.');
                return;
            }

            // Mapear columnas (buscar por nombre, case-insensitive)
            const mapCol = (row, options) => {
                for (const opt of options) {
                    const key = Object.keys(row).find(k => k.toLowerCase().trim() === opt.toLowerCase());
                    if (key !== undefined) return row[key];
                }
                return '';
            };

            _datosExcelParseados = rawData.map(row => {
                let fechaRaw = mapCol(row, ['fecha', 'date']);
                let vencRaw = mapCol(row, ['vencimiento', 'fecha vencimiento', 'due date', 'venc']);

                // Convertir fechas Excel (Date objects o strings)
                const parseFecha = (val) => {
                    if (!val) return '';
                    if (val instanceof Date) return val.toISOString().split('T')[0];
                    const str = String(val).trim();
                    // Intentar formato YYYY-MM-DD
                    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
                    // Intentar formato DD/MM/YYYY
                    const parts = str.split(/[\/\-]/);
                    if (parts.length === 3) {
                        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                    return str;
                };

                return {
                    fecha: parseFecha(fechaRaw),
                    folio: String(mapCol(row, ['folio', 'folio #', 'no.', 'numero']) || '').toUpperCase(),
                    cliente: String(mapCol(row, ['cliente', 'nombre', 'customer', 'nombre cliente']) || '').toUpperCase(),
                    telefono: String(mapCol(row, ['telefono', 'teléfono', 'tel', 'phone']) || ''),
                    sucursal: String(mapCol(row, ['sucursal', 'branch', 'tienda']) || 'Norte'),
                    montoOriginal: parseFloat(mapCol(row, ['monto original', 'monto', 'total', 'amount'])) || 0,
                    montoPendiente: parseFloat(mapCol(row, ['monto pendiente', 'pendiente', 'saldo', 'balance'])) || 0,
                    vencimiento: parseFecha(vencRaw),
                    estado: String(mapCol(row, ['estado', 'status', 'estatus']) || 'Pendiente')
                };
            });

            // Renderizar preview
            const tbody = document.getElementById('tablaPreviewExcel');
            const contadorEl = document.getElementById('contadorPreviewExcel');
            const erroresEl = document.getElementById('erroresPreviewExcel');
            let errores = 0;

            if (contadorEl) contadorEl.textContent = _datosExcelParseados.length;

            tbody.innerHTML = _datosExcelParseados.map((d, idx) => {
                const hasError = !d.fecha || !d.cliente || d.montoOriginal <= 0;
                if (hasError) errores++;
                return `<tr class="${hasError ? 'bg-red-50' : ''} border-b border-gray-50">
                    <td class="px-3 py-2 text-xs font-medium ${!d.fecha ? 'text-red-500' : ''}">${d.fecha || '❌'}</td>
                    <td class="px-3 py-2 text-xs font-bold">${d.folio || '-'}</td>
                    <td class="px-3 py-2 text-xs font-bold ${!d.cliente ? 'text-red-500' : ''}">${d.cliente || '❌ SIN CLIENTE'}</td>
                    <td class="px-3 py-2 text-xs">${d.telefono || '-'}</td>
                    <td class="px-3 py-2 text-xs">${d.sucursal}</td>
                    <td class="px-3 py-2 text-xs text-right font-bold ${d.montoOriginal <= 0 ? 'text-red-500' : ''}">${formatMoney(d.montoOriginal)}</td>
                    <td class="px-3 py-2 text-xs text-right font-bold">${formatMoney(d.montoPendiente)}</td>
                    <td class="px-3 py-2 text-xs">${d.vencimiento || '-'}</td>
                    <td class="px-3 py-2 text-xs"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${d.estado === 'Pagado' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${d.estado}</span></td>
                </tr>`;
            }).join('');

            if (errores > 0 && erroresEl) {
                erroresEl.textContent = `⚠ ${errores} registro(s) con errores (marcados en rojo)`;
                erroresEl.classList.remove('hidden');
            } else if (erroresEl) {
                erroresEl.classList.add('hidden');
            }

            document.getElementById('previewExcelContainer')?.classList.remove('hidden');
            const btnConfirmar = document.getElementById('btnConfirmarImportacion');
            if (btnConfirmar) btnConfirmar.disabled = false;

        } catch (err) {
            console.error('Error parseando Excel:', err);
            alert('Error al leer el archivo Excel: ' + err.message);
        }
    };
    reader.readAsBinaryString(file);
}

async function confirmarImportacionExcel() {
    if (_datosExcelParseados.length === 0) return alert('No hay datos para importar.');

    // Filtrar registros válidos
    const validos = _datosExcelParseados.filter(d => d.fecha && d.cliente && d.montoOriginal > 0);

    if (validos.length === 0) return alert('No hay registros válidos para importar.');

    if (!confirm(`¿Importar ${validos.length} cuentas por cobrar?\n\n(${_datosExcelParseados.length - validos.length} registros con errores serán omitidos)`)) return;

    try {
        const registros = validos.map(d => {
            const [year, month, day] = d.fecha.split('-').map(Number);
            const fechaISO = new Date(year, month - 1, day, 12, 0, 0).toISOString();

            return {
                created_at: fechaISO,
                categoria: d.folio || '#IMPORT',
                nombre_cliente: d.cliente,
                telefono_cliente: d.telefono || null,
                sucursal: d.sucursal || 'Norte',
                monto: d.montoOriginal,
                monto_neto: d.montoOriginal,
                saldo_pendiente: d.montoPendiente || d.montoOriginal,
                metodo_pago: 'Crédito',
                estado_cobro: d.estado || 'Pendiente',
                fecha_vencimiento: d.vencimiento || null,
                tipo: 'Venta Directa',
                notas: 'CXC IMPORTADA DESDE EXCEL'
            };
        });

        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(registros)
        });

        if (res.ok) {
            cerrarModalImportarExcel();
            cargarCuentasPorCobrar();
            alert(`✅ ${registros.length} cuentas por cobrar importadas exitosamente.`);
        } else {
            const err = await res.text();
            console.error('Error importando:', err);
            alert('Error al importar los registros.');
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error al importar: ' + e.message);
    }
}

// ============================================================
// RESET DE CUENTAS POR PAGAR (SIN TOCAR PRÉSTAMOS)
// ============================================================

async function verificarSnapshotResetCxP() {
    const btn = document.getElementById('btnDeshacerResetCxP');
    if (!btn) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxp_reset_snapshot&select=value`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].value && data[0].value.registros && data[0].value.registros.length > 0) {
            btn.classList.remove('hidden');
            btn.style.display = '';
        } else {
            btn.classList.add('hidden');
        }
    } catch (e) {
        btn.classList.add('hidden');
    }
}

async function ejecutarResetCxP() {
    const inputConfirm = document.getElementById('inputConfirmResetCxP');
    if (!inputConfirm || inputConfirm.value.trim().toUpperCase() !== 'RESET') {
        return alert('Debes escribir "RESET" exactamente para confirmar.');
    }

    try {
        // 1. Obtener CxP pendientes EXCLUYENDO préstamos
        const resPendientes = await fetch(`${SUPABASE_URL}/rest/v1/gastos?metodo_pago=eq.Crédito&estado_pago=eq.Pendiente&select=id,estado_pago,saldo_pendiente,monto_total,notas`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const todosPendientes = await resPendientes.json();

        // FILTRAR: excluir los que son de préstamos
        const pendientes = todosPendientes.filter(p => !(p.notas && p.notas.includes('PRÉSTAMO:')));

        if (!pendientes || pendientes.length === 0) {
            cerrarModalResetCxP();
            return alert('No hay cuentas por pagar pendientes para resetear (excluyendo préstamos).');
        }

        // 2. Guardar snapshot
        const snapshot = {
            fecha_reset: new Date().toISOString(),
            registros: pendientes.map(p => ({
                id: p.id,
                estado_pago: p.estado_pago,
                saldo_pendiente: p.saldo_pendiente !== null ? p.saldo_pendiente : p.monto_total
            }))
        };

        const resSnapshot = await fetch(`${SUPABASE_URL}/rest/v1/sys_config`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: 'cxp_reset_snapshot', value: snapshot, description: 'Snapshot de CxP antes del último reset' })
        });

        if (!resSnapshot.ok) {
            return alert('Error al guardar respaldo. El reset NO se aplicó.');
        }

        // 3. PATCH masivo
        let patchedCount = 0;
        for (const item of pendientes) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado_pago: 'Pagado', saldo_pendiente: 0 })
            });
            if (res.ok) patchedCount++;
        }

        // 4. Bitácora
        for (const item of pendientes) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gasto_id: item.id,
                    nota: `RESET CXP APLICADO. Saldo original: ${formatMoney(item.saldo_pendiente !== null ? item.saldo_pendiente : item.monto_total)}`
                })
            });
        }

        cerrarModalResetCxP();
        cargarCuentasPorPagar();
        alert(`✅ Reset completado. ${patchedCount} cuentas por pagar marcadas como pagadas.\n(Los préstamos NO fueron afectados)\n\nPuedes usar "Deshacer Reset" para revertir.`);

    } catch (e) {
        console.error('Error en reset CxP:', e);
        alert('Error al ejecutar el reset: ' + e.message);
    }
}

async function deshacerResetCxP() {
    if (!confirm('¿Deshacer el último reset de CxP?\n\nTodas las cuentas volverán a su estado anterior.')) return;

    try {
        const resSnapshot = await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxp_reset_snapshot&select=value`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const snapData = await resSnapshot.json();
        if (!snapData || snapData.length === 0 || !snapData[0].value || !snapData[0].value.registros) {
            return alert('No se encontró respaldo para deshacer.');
        }

        const registros = snapData[0].value.registros;
        let restaurados = 0;

        for (const reg of registros) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${reg.id}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado_pago: reg.estado_pago, saldo_pendiente: reg.saldo_pendiente })
            });
            if (res.ok) restaurados++;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/sys_config?key=eq.cxp_reset_snapshot`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        for (const reg of registros) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gasto_id: reg.id,
                    nota: `RESET CXP DESHECHO. Estado restaurado: ${reg.estado_pago}, Saldo: ${formatMoney(reg.saldo_pendiente)}`
                })
            });
        }

        cargarCuentasPorPagar();
        alert(`✅ Reset deshecho. ${restaurados} cuentas restauradas.`);

    } catch (e) {
        console.error('Error deshaciendo reset CxP:', e);
        alert('Error al deshacer: ' + e.message);
    }
}

// ============================================================
// CREAR CxP MANUAL
// ============================================================

function inicializarFormularioCxP() {
    const hoyLocal = new Date();
    const offset = hoyLocal.getTimezoneOffset() * 60000;
    const fechaLocal = new Date(hoyLocal.getTime() - offset).toISOString().split('T')[0];
    const campoFecha = document.getElementById('manualCxpFecha');
    if (campoFecha) campoFecha.value = fechaLocal;

    ['manualCxpProveedor', 'manualCxpCategoria', 'manualCxpMontoTotal', 'manualCxpSaldoPendiente', 'manualCxpNotas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selectSuc = document.getElementById('manualCxpSucursal');
    if (selectSuc) selectSuc.value = 'Norte';
    const selectEstado = document.getElementById('manualCxpEstado');
    if (selectEstado) selectEstado.value = 'Pendiente';
    const diasInput = document.getElementById('manualCxpDiasCredito');
    if (diasInput) diasInput.value = '30';
}

async function guardarCxPManual() {
    const fecha = document.getElementById('manualCxpFecha')?.value;
    const proveedor = document.getElementById('manualCxpProveedor')?.value?.toUpperCase();
    const categoria = document.getElementById('manualCxpCategoria')?.value?.toUpperCase() || 'GENERAL';
    const sucursal = document.getElementById('manualCxpSucursal')?.value;
    const montoTotal = parseFloat(document.getElementById('manualCxpMontoTotal')?.value) || 0;
    const saldoPendiente = parseFloat(document.getElementById('manualCxpSaldoPendiente')?.value) || 0;
    const diasCredito = parseInt(document.getElementById('manualCxpDiasCredito')?.value) || 30;
    const estado = document.getElementById('manualCxpEstado')?.value || 'Pendiente';
    const notas = document.getElementById('manualCxpNotas')?.value?.toUpperCase() || 'CXP MANUAL';

    if (!fecha) return alert('Selecciona una fecha.');
    if (!proveedor) return alert('Ingresa el proveedor.');
    if (montoTotal <= 0) return alert('El monto debe ser mayor a 0.');

    try {
        const [year, month, day] = fecha.split('-').map(Number);
        const fechaISO = new Date(year, month - 1, day, 12, 0, 0).toISOString();

        const registro = {
            created_at: fechaISO,
            proveedor: proveedor,
            categoria: categoria,
            metodo_pago: 'Crédito',
            monto_total: montoTotal,
            saldo_pendiente: saldoPendiente,
            estado_pago: estado,
            dias_credito: diasCredito,
            sucursal: sucursal,
            notas: notas
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(registro)
        });

        if (res.ok) {
            cerrarModalNuevaCxP();
            cargarCuentasPorPagar();
            alert('✅ Cuenta por pagar creada exitosamente.');
        } else {
            alert('Error al crear la cuenta por pagar.');
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error al guardar: ' + e.message);
    }
}

// ============================================================
// ELIMINAR CxP INDIVIDUAL
// ============================================================

async function eliminarCxP(id, proveedor) {
    if (!confirm(`¿Eliminar la cuenta por pagar de "${proveedor}"?\n\nSe marcará como Pagado.`)) return;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado_pago: 'Pagado', saldo_pendiente: 0 })
        });

        if (res.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ gasto_id: id, nota: 'CXP ELIMINADA MANUALMENTE POR USUARIO' })
            });
            cargarCuentasPorPagar();
            alert('✅ Cuenta por pagar eliminada.');
        }
    } catch (e) {
        console.error('Error eliminando CxP:', e);
        alert('Error al eliminar.');
    }
}

// ============================================================
// IMPORTAR EXCEL CxP
// ============================================================

let _datosExcelParseadosCxP = [];

function resetearModalImportacionCxP() {
    _datosExcelParseadosCxP = [];
    const fileInput = document.getElementById('inputExcelCxP');
    if (fileInput) fileInput.value = '';
    const nombreEl = document.getElementById('nombreArchivoExcelCxP');
    if (nombreEl) { nombreEl.textContent = ''; nombreEl.classList.add('hidden'); }
    const previewContainer = document.getElementById('previewExcelContainerCxP');
    if (previewContainer) previewContainer.classList.add('hidden');
    const btnConfirmar = document.getElementById('btnConfirmarImportacionCxP');
    if (btnConfirmar) btnConfirmar.disabled = true;
    const erroresEl = document.getElementById('erroresPreviewExcelCxP');
    if (erroresEl) erroresEl.classList.add('hidden');
}

function previsualizarExcelCxP(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const nombreEl = document.getElementById('nombreArchivoExcelCxP');
    if (nombreEl) { nombreEl.textContent = `📄 ${file.name}`; nombreEl.classList.remove('hidden'); }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (!rawData || rawData.length === 0) return alert('El archivo no contiene datos.');

            const mapCol = (row, options) => {
                for (const opt of options) {
                    const key = Object.keys(row).find(k => k.toLowerCase().trim() === opt.toLowerCase());
                    if (key !== undefined) return row[key];
                }
                return '';
            };

            const parseFecha = (val) => {
                if (!val) return '';
                if (val instanceof Date) return val.toISOString().split('T')[0];
                const str = String(val).trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
                const parts = str.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
                return str;
            };

            _datosExcelParseadosCxP = rawData.map(row => ({
                fecha: parseFecha(mapCol(row, ['fecha', 'date'])),
                proveedor: String(mapCol(row, ['proveedor', 'supplier', 'nombre proveedor']) || '').toUpperCase(),
                categoria: String(mapCol(row, ['categoria', 'categoría', 'category', 'tipo']) || 'GENERAL').toUpperCase(),
                sucursal: String(mapCol(row, ['sucursal', 'branch', 'tienda']) || 'Norte'),
                montoTotal: parseFloat(mapCol(row, ['monto total', 'monto', 'total', 'amount'])) || 0,
                saldoPendiente: parseFloat(mapCol(row, ['saldo pendiente', 'pendiente', 'saldo', 'balance'])) || 0,
                diasCredito: parseInt(mapCol(row, ['dias credito', 'días crédito', 'dias', 'credit days'])) || 30,
                estado: String(mapCol(row, ['estado', 'status', 'estatus']) || 'Pendiente')
            }));

            const tbody = document.getElementById('tablaPreviewExcelCxP');
            const contadorEl = document.getElementById('contadorPreviewExcelCxP');
            const erroresEl = document.getElementById('erroresPreviewExcelCxP');
            let errores = 0;

            if (contadorEl) contadorEl.textContent = _datosExcelParseadosCxP.length;

            tbody.innerHTML = _datosExcelParseadosCxP.map(d => {
                const hasError = !d.fecha || !d.proveedor || d.montoTotal <= 0;
                if (hasError) errores++;
                return `<tr class="${hasError ? 'bg-red-50' : ''} border-b border-gray-50">
                    <td class="px-3 py-2 text-xs font-medium ${!d.fecha ? 'text-red-500' : ''}">${d.fecha || '❌'}</td>
                    <td class="px-3 py-2 text-xs font-bold ${!d.proveedor ? 'text-red-500' : ''}">${d.proveedor || '❌'}</td>
                    <td class="px-3 py-2 text-xs">${d.categoria}</td>
                    <td class="px-3 py-2 text-xs">${d.sucursal}</td>
                    <td class="px-3 py-2 text-xs text-right font-bold ${d.montoTotal <= 0 ? 'text-red-500' : ''}">${formatMoney(d.montoTotal)}</td>
                    <td class="px-3 py-2 text-xs text-right font-bold">${formatMoney(d.saldoPendiente)}</td>
                    <td class="px-3 py-2 text-xs text-center">${d.diasCredito}</td>
                    <td class="px-3 py-2 text-xs"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${d.estado === 'Pagado' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${d.estado}</span></td>
                </tr>`;
            }).join('');

            if (errores > 0 && erroresEl) {
                erroresEl.textContent = `⚠ ${errores} registro(s) con errores`;
                erroresEl.classList.remove('hidden');
            } else if (erroresEl) { erroresEl.classList.add('hidden'); }

            document.getElementById('previewExcelContainerCxP')?.classList.remove('hidden');
            const btnConfirmar = document.getElementById('btnConfirmarImportacionCxP');
            if (btnConfirmar) btnConfirmar.disabled = false;

        } catch (err) {
            console.error('Error parseando Excel CxP:', err);
            alert('Error al leer el archivo: ' + err.message);
        }
    };
    reader.readAsBinaryString(file);
}

async function confirmarImportacionExcelCxP() {
    if (_datosExcelParseadosCxP.length === 0) return alert('No hay datos.');

    const validos = _datosExcelParseadosCxP.filter(d => d.fecha && d.proveedor && d.montoTotal > 0);
    if (validos.length === 0) return alert('No hay registros válidos.');

    if (!confirm(`¿Importar ${validos.length} cuentas por pagar?`)) return;

    try {
        const registros = validos.map(d => {
            const [year, month, day] = d.fecha.split('-').map(Number);
            const fechaISO = new Date(year, month - 1, day, 12, 0, 0).toISOString();
            return {
                created_at: fechaISO,
                proveedor: d.proveedor,
                categoria: d.categoria || 'GENERAL',
                metodo_pago: 'Crédito',
                monto_total: d.montoTotal,
                saldo_pendiente: d.saldoPendiente || d.montoTotal,
                estado_pago: d.estado || 'Pendiente',
                dias_credito: d.diasCredito || 30,
                sucursal: d.sucursal || 'Norte',
                notas: 'CXP IMPORTADA DESDE EXCEL'
            };
        });

        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(registros)
        });

        if (res.ok) {
            cerrarModalImportarExcelCxP();
            cargarCuentasPorPagar();
            alert(`✅ ${registros.length} cuentas por pagar importadas.`);
        } else {
            alert('Error al importar.');
        }
    } catch (e) {
        console.error('Error:', e);
        alert('Error al importar: ' + e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VISTA CALENDARIO DE PAGOS (agrupado por viernes)
// ─────────────────────────────────────────────────────────────────────────────

function _proximoViernes(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    const diff = (5 - dow + 7) % 7; // 0 si ya es viernes
    d.setDate(d.getDate() + diff);
    return d;
}

function cambiarVistaCxP(vista) {
    vistaActualCxP = vista;
    const btnLista = document.getElementById('btnVistaLista');
    const btnCal  = document.getElementById('btnVistaCalendario');
    const divLista = document.getElementById('vistaListaCxP');
    const divCal   = document.getElementById('vistaCalendarioCxP');
    const divFiltros = document.getElementById('filtrosCalendarioCxP');

    if (vista === 'lista') {
        btnLista.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
        btnLista.classList.remove('text-gray-400');
        btnCal.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
        btnCal.classList.add('text-gray-400');
        divLista.classList.remove('hidden');
        divCal.classList.add('hidden');
        divFiltros?.classList.add('hidden');
    } else {
        btnCal.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
        btnCal.classList.remove('text-gray-400');
        btnLista.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
        btnLista.classList.add('text-gray-400');
        divCal.classList.remove('hidden');
        divFiltros?.classList.remove('hidden');
        divLista.classList.add('hidden');
        renderizarVistaCalendario(currentFilteredPagos);
    }
}

function limpiarFiltrosCalCxP() {
    const inp = document.getElementById('calBusqProveedor');
    const mon = document.getElementById('calMontoMin');
    if (inp) inp.value = '';
    if (mon) mon.value = '';
    renderizarVistaCalendario(currentFilteredPagos);
}

function renderizarVistaCalendario(datos) {
    const container = document.getElementById('vistaCalendarioCxP');
    if (!container) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const viernesHoy = _proximoViernes(hoy);

    const busqProv  = (document.getElementById('calBusqProveedor')?.value || '').toLowerCase().trim();
    const montoMin  = parseFloat(document.getElementById('calMontoMin')?.value) || 0;

    const pendientes = (datos || []).filter(g => {
        if (g.estado_pago === 'Pagado') return false;
        if (g.notas && g.notas.includes('PRÉSTAMO:')) return false;
        if (busqProv && !g.proveedor?.toLowerCase().includes(busqProv)) return false;
        if (montoMin > 0 && (parseFloat(g.saldo_pendiente) || 0) < montoMin) return false;
        return true;
    });

    if (pendientes.length === 0) {
        container.innerHTML = `<div class="card p-12 text-center text-gray-400 font-bold">No hay cuentas pendientes</div>`;
        return;
    }

    // Agrupar por viernes objetivo
    const grupos = {};
    for (const g of pendientes) {
        const created = new Date(g.created_at);
        const dias = g.dias_credito || 30;
        const venc = new Date(created);
        venc.setDate(created.getDate() + dias);
        venc.setHours(0, 0, 0, 0);

        // Si ya venció → próximo viernes desde hoy; si no → viernes de su semana de vencimiento
        const viernesTarget = venc <= hoy ? new Date(viernesHoy) : _proximoViernes(venc);
        const key = viernesTarget.toISOString().split('T')[0];
        if (!grupos[key]) grupos[key] = { viernes: viernesTarget, items: [] };
        grupos[key].items.push({ ...g, _vencimiento: venc });
    }

    const sortedKeys = Object.keys(grupos).sort();

    container.innerHTML = sortedKeys.map(key => {
        const { viernes, items } = grupos[key];
        const total = items.reduce((s, i) => s + (parseFloat(i.saldo_pendiente) || 0), 0);
        const vencido = viernes <= hoy;
        const labelViernes = viernes.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const headerColor = vencido ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100';
        const iconColor   = vencido ? 'text-red-500'   : 'text-emerald-600';
        const titleColor  = vencido ? 'text-red-700'   : 'text-emerald-700';
        const totalColor  = vencido ? 'text-red-600'   : 'text-gray-800';

        // Guardar items en cache global para acceso desde onclick
        if (!window._cxpCalCache) window._cxpCalCache = {};
        items.forEach(i => { window._cxpCalCache[i.id] = i; });

        const itemsHTML = items.map(item => {
            const yaVencio = item._vencimiento < hoy;
            const vencLabel = item._vencimiento.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
            const fechaLimiteStr = item._vencimiento.toISOString().split('T')[0];
            const provEnc = encodeURIComponent(item.proveedor);
            const provEsc = item.proveedor.replace(/'/g, "\\'");
            return `
            <div class="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-xl transition-all gap-3">
                <a href="gastos.html?proveedor=${provEnc}" class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group">
                    <div class="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-all">
                        <span class="material-symbols-outlined text-gray-500 text-sm group-hover:text-emerald-600">storefront</span>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-black text-gray-800 uppercase group-hover:text-emerald-700 transition-all truncate">${item.proveedor}</p>
                        <p class="text-[10px] font-medium text-gray-400">
                            Vence: ${vencLabel}
                            ${yaVencio ? '<span class="ml-1 font-black text-red-500">• VENCIDO</span>' : ''}
                            &nbsp;·&nbsp; ${item.sucursal}
                        </p>
                    </div>
                </a>
                <div class="flex items-center gap-1.5 shrink-0">
                    <p class="text-sm font-black text-emerald-600 mr-2">${formatMoney(item.saldo_pendiente)}</p>
                    <button onclick="prepararAccionMasivaPagos([window._cxpCalCache['${item.id}']], 'abono')" title="Abonar"
                        class="p-1.5 bg-green-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">payments</span>
                    </button>
                    <button onclick="prepararAccionMasivaPagos([window._cxpCalCache['${item.id}']], 'liquidacion')" title="Liquidar"
                        class="p-1.5 bg-blue-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">check_circle</span>
                    </button>
                    <button onclick="abrirModalProrroga('${item.id}', '${provEsc}', '${fechaLimiteStr}')" title="Prórroga"
                        class="p-1.5 bg-orange-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">calendar_month</span>
                    </button>
                    <button onclick="eliminarCxP('${item.id}', '${provEsc}')" title="Eliminar"
                        class="p-1.5 bg-red-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <button onclick="abrirBitacoraProv('${item.id}', '${provEsc}')" title="Bitácora"
                        class="p-1.5 bg-gray-800 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">history</span>
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="card overflow-hidden shadow-sm">
            <div class="px-6 py-4 flex justify-between items-center border-b ${headerColor}">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-2xl ${iconColor}">calendar_today</span>
                    <div>
                        <p class="text-xs font-black uppercase tracking-widest ${titleColor} capitalize">${labelViernes}</p>
                        <p class="text-[10px] text-gray-400 font-medium">${items.length} proveedor${items.length !== 1 ? 'es' : ''}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest">Total a pagar</p>
                    <p class="text-2xl font-black ${totalColor}">${formatMoney(total)}</p>
                </div>
            </div>
            <div class="divide-y divide-gray-50 px-2 py-1">${itemsHTML}</div>
        </div>`;
    }).join('');
}

// ─── VISTA CALENDARIO CxC ────────────────────────────────────────────────────

function cambiarVistaCxC(vista) {
    vistaActualCxC = vista;
    const btnLista = document.getElementById('btnVistaListaCxC');
    const btnCal   = document.getElementById('btnVistaCalendarioCxC');
    const divLista = document.getElementById('vistaListaCxC');
    const divCal   = document.getElementById('vistaCalendarioCxC');

    if (vista === 'lista') {
        btnLista?.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
        btnLista?.classList.remove('text-gray-400');
        btnCal?.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
        btnCal?.classList.add('text-gray-400');
        divCal?.classList.add('hidden');
        divLista?.classList.remove('hidden');
    } else {
        btnCal?.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
        btnCal?.classList.remove('text-gray-400');
        btnLista?.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
        btnLista?.classList.add('text-gray-400');
        divLista?.classList.add('hidden');
        divCal?.classList.remove('hidden');
        renderizarVistaCalendarioCxC(currentFilteredCobros);
    }
}

function renderizarVistaCalendarioCxC(datos) {
    const container = document.getElementById('vistaCalendarioCxC');
    if (!container) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const viernesHoy = _proximoViernes(hoy);

    const pendientes = (datos || []).filter(t => t.estado_cobro !== 'Pagado');

    if (pendientes.length === 0) {
        container.innerHTML = `<div class="card p-12 text-center text-gray-400 font-bold">No hay cuentas pendientes por cobrar</div>`;
        return;
    }

    // Agrupar por viernes objetivo
    const grupos = {};
    for (const t of pendientes) {
        const venc = obtenerFechaVencimiento(t);
        venc.setHours(0, 0, 0, 0);
        const viernesTarget = venc <= hoy ? new Date(viernesHoy) : _proximoViernes(venc);
        const key = viernesTarget.toISOString().split('T')[0];
        if (!grupos[key]) grupos[key] = { viernes: viernesTarget, items: [] };
        grupos[key].items.push({ ...t, _vencimiento: venc });
    }

    const sortedKeys = Object.keys(grupos).sort();

    // Cache global para acceso desde onclick
    if (!window._cxcCalCache) window._cxcCalCache = {};

    container.innerHTML = sortedKeys.map(key => {
        const { viernes, items } = grupos[key];
        const total = items.reduce((s, i) => s + (parseFloat(i.saldo_pendiente) || 0), 0);
        const vencido = viernes <= hoy;
        const labelViernes = viernes.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const headerColor = vencido ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100';
        const iconColor   = vencido ? 'text-red-500'   : 'text-emerald-600';
        const titleColor  = vencido ? 'text-red-700'   : 'text-emerald-700';
        const totalColor  = vencido ? 'text-red-600'   : 'text-gray-800';

        items.forEach(i => { window._cxcCalCache[i.id] = i; });

        const itemsHTML = items.map(item => {
            const yaVencio = item._vencimiento < hoy;
            const vencLabel = item._vencimiento.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
            const saldo = parseFloat(item.saldo_pendiente) || 0;
            const clienteEsc = item.nombre_cliente.replace(/'/g, "\\'");
            return `
            <div class="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-xl transition-all gap-3">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-gray-500 text-sm">person</span>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-black text-gray-800 uppercase truncate">${item.nombre_cliente}</p>
                        <p class="text-[10px] font-medium text-gray-400">
                            Vence: ${vencLabel}
                            ${yaVencio ? '<span class="ml-1 font-black text-red-500">• VENCIDO</span>' : ''}
                            &nbsp;·&nbsp; ${item.sucursal || '-'}
                            ${item.telefono_cliente ? `&nbsp;·&nbsp; ${item.telefono_cliente}` : ''}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <p class="text-sm font-black text-emerald-600 mr-2">${formatMoney(saldo)}</p>
                    <button onclick="enviarWhatsAppCobranza(window._cxcCalCache['${item.id}'], ${yaVencio})" title="WhatsApp"
                        class="p-1.5 ${yaVencio ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">chat</span>
                    </button>
                    <button onclick="prepararAbonoPago('${item.id}', '${clienteEsc}', ${saldo}, 'abono')" title="Abonar"
                        class="p-1.5 bg-emerald-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">payments</span>
                    </button>
                    <button onclick="prepararAbonoPago('${item.id}', '${clienteEsc}', ${saldo}, 'liquidacion')" title="Liquidar"
                        class="p-1.5 bg-blue-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">check_circle</span>
                    </button>
                    <button onclick="eliminarCxC('${item.id}', '${clienteEsc}')" title="Eliminar"
                        class="p-1.5 bg-red-500 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <button onclick="abrirBitacora('${item.id}', '${clienteEsc}')" title="Bitácora"
                        class="p-1.5 bg-gray-800 text-white rounded-lg hover:scale-105 transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">history</span>
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="card overflow-hidden shadow-sm">
            <div class="px-6 py-4 flex justify-between items-center border-b ${headerColor}">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-2xl ${iconColor}">calendar_today</span>
                    <div>
                        <p class="text-xs font-black uppercase tracking-widest ${titleColor} capitalize">${labelViernes}</p>
                        <p class="text-[10px] text-gray-400 font-medium">${items.length} cliente${items.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest">Total a cobrar</p>
                    <p class="text-2xl font-black ${totalColor}">${formatMoney(total)}</p>
                </div>
            </div>
            <div class="divide-y divide-gray-50 px-2 py-1">${itemsHTML}</div>
        </div>`;
    }).join('');
}