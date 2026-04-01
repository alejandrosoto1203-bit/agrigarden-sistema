// rrhh_nomina.js - Lógica del Centro de Gestión de Nómina
let nominaCache = [];
let seleccionados = new Set();
let nominaCacheEmp = []; // Cache de empleados
let sbClient = null; // Cliente local para este módulo
let prestamosActivosCache = []; // Cache de préstamos activos por empleado

// Cuentas bancarias disponibles para pago de nómina (transferencias)
const CUENTAS_NOMINA_TRANSFER = [
    { key: 'bbva_norte',  nombre: 'BBVA Norte',              metodo_pago: 'Transferencia BBVA NORTE',              sucursal: 'Norte' },
    { key: 'hey_sur',     nombre: 'Hey Banco Sur',           metodo_pago: 'Transferencia HEY BANCO SUR',            sucursal: 'Sur'   },
    { key: 'bbva_sur',    nombre: 'BBVA Sur',                metodo_pago: 'Terminal BBVA Pyme Sur',                 sucursal: 'Sur'   },
    { key: 'mp_nofiscal', nombre: 'Mercado Pago No Fiscal',  metodo_pago: 'Terminal MERCADO PAGO NO FISCAL NORTE',  sucursal: 'Norte' },
    { key: 'mp_fiscal',   nombre: 'Mercado Pago Fiscal',     metodo_pago: 'Terminal Mercado Pago Fiscal Norte',     sucursal: 'Norte' },
];

// Helper para formatear dinero
const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

function initNominaClient() {
    const SB_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        sbClient = window.supabase.createClient(SB_URL, SB_KEY);
    } else {
        alert("CRITICAL ERROR: Supabase library not loaded.");
    }
}

async function cargarNomina() {
    if (!sbClient) initNominaClient();
    if (!sbClient) return;

    try {
        // Obtenemos empleados y su información de nómina actual
        const { data: empleados, error } = await sbClient
            .from('empleados')
            .select('id, nombre_completo, puesto, sucursal, foto_url, telefono, sueldo_base');

        if (error) throw new Error("Error fetching empleados: " + error.message);

        nominaCacheEmp = empleados || [];

        // Simulamos o cargamos los datos de la tabla rrhh_nomina
        // Usamos el cliente también aquí en lugar de fetch manual para consistencia, 
        // o mantenemos fetch si preferimos, pero cliente es mejor.
        // Fetch con el ID para poder borrar
        const { data: nominaData, error: errNomina } = await sbClient
            .from('rrhh_nomina')
            .select('*')
            .order('id', { ascending: false });

        if (errNomina) throw new Error("Error fetching nomina: " + errNomina.message);

        nominaCache = nominaData || [];

        // Cargar préstamos activos
        const { data: prestamosData } = await sbClient
            .from('prestamos_empleados')
            .select('*')
            .eq('estatus', 'activo');
        prestamosActivosCache = prestamosData || [];

        renderizarTablaNomina();
        actualizarKPIsNomina(nominaCache);
    } catch (e) {
        console.error("Error cargando nómina:", e);
        alert(`Error al cargar nómina: ${e.message}`);
    }
}

let estadoFiltro = 'Pendiente'; // Por defecto Nómina Actual
let currentTab = 'actual';
let sucursalFiltro = 'Todos';
let frecuenciaFiltro = 'Todos';

function cambiarTab(tab) {
    currentTab = tab;
    estadoFiltro = (tab === 'actual') ? 'actual' : 'Pagado';

    // Actualizar UI Pestañas
    const tActual = document.getElementById('tabActual');
    const tHistorial = document.getElementById('tabHistorial');

    if (tab === 'actual') {
        tActual.classList.add('border-primary', 'text-slate-900');
        tActual.classList.remove('border-transparent', 'text-slate-400');
        tHistorial.classList.add('border-transparent', 'text-slate-400');
        tHistorial.classList.remove('border-primary', 'text-slate-900');

        // Limpiar selección al cambiar de tab por seguridad
        seleccionados.clear();
        document.getElementById('barAccionesMasivas').classList.add('hidden');
    } else {
        tHistorial.classList.add('border-primary', 'text-slate-900');
        tHistorial.classList.remove('border-transparent', 'text-slate-400');
        tActual.classList.add('border-transparent', 'text-slate-400');
        tActual.classList.remove('border-primary', 'text-slate-900');

        // Esconder barra masiva en historial si no aplica
        document.getElementById('barAccionesMasivas').classList.add('hidden');
    }

    renderizarTablaNomina();
}

// Listeners Filtros Dropdown
const selectSucursal = document.getElementById('filtroSucursal');
if (selectSucursal) {
    selectSucursal.addEventListener('change', (e) => {
        sucursalFiltro = e.target.value;
        renderizarTablaNomina();
    });
}
const selectFrecuencia = document.getElementById('filtroFrecuencia');
if (selectFrecuencia) {
    selectFrecuencia.addEventListener('change', (e) => {
        frecuenciaFiltro = e.target.value;
        renderizarTablaNomina();
    });
}

function filtrarEstado(estado) {
    estadoFiltro = estado;

    // Actualizar UI botones filtro
    const container = document.getElementById('filtroEstadoContainer');
    if (container) {
        const botones = container.querySelectorAll('button');
        botones.forEach(btn => {
            const btnEstado = btn.getAttribute('data-estado');
            if (btnEstado === estado) {
                // Activo
                btn.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
                btn.classList.remove('text-slate-400', 'hover:bg-white/50');
            } else {
                // Inactivo
                btn.classList.remove('bg-white', 'shadow-sm', 'text-slate-900');
                btn.classList.add('text-slate-400', 'hover:bg-white/50');
            }
        });
    }

    renderizarTablaNomina();
}

function renderizarTablaNomina() {
    const tbody = document.getElementById('tablaNominaBody');
    if (!tbody) return;

    // 1. Filtrar registros de nómina según estado, sucursal y frecuencia
    let registrosVisibles = nominaCache.filter(n => {
        const emp = nominaCacheEmp.find(e => e.id === n.empleado_id);
        if (!emp) return false;

        // Filtro Estado
        if (estadoFiltro === 'actual') {
            if (n.estado !== 'Pendiente' && n.estado !== 'Parcial') return false;
        } else if (estadoFiltro !== 'Todos' && n.estado !== estadoFiltro) return false;

        // Filtro Sucursal
        if (sucursalFiltro !== 'Todos' && emp.sucursal !== sucursalFiltro) return false;

        // Filtro Frecuencia (Asumimos solo Quincenal por ahora, o agregamos campo a empleado futuro)
        // Si el usuario elige Semanal y no hay lógica, mostramos vacío.
        if (frecuenciaFiltro !== 'Todos') {
            // Podríamos checar emp.frecuencia pero no existe aun, asumimos Quincenal por defecto
            if (frecuenciaFiltro === 'Semanal') return false;
            // Si es Quincenal pasa (dado que todos son quincenales por ahora)
        }

        return true;
    });

    // 2. Si no hay registros (y estamos en 'Todos'), tal vez queramos mostrar "Sin Generar" para empleados activos?
    // Por ahora, nos enfocamos en mostrar los registros existentes (Historial + Pendientes)

    // Actualizar contador
    const countLabel = document.getElementById('labelRegistrosCount');
    if (countLabel) countLabel.innerText = `${registrosVisibles.length} Registros encontrados`;

    if (registrosVisibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-20">
            <div class="flex flex-col items-center gap-2 text-slate-300">
                <span class="material-symbols-outlined text-5xl">folder_open</span>
                <p class="text-sm font-bold uppercase">No hay registros en ${currentTab === 'actual' ? 'Nómina Actual' : 'Historial'}</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = registrosVisibles.map(det => {
        const emp = nominaCacheEmp.find(e => e.id === det.empleado_id);
        if (!emp) return ''; // Empleado borrado? Omitir

        const base = det.sueldo_base;
        const bonos = det.bonificaciones || 0;
        const deduc = det.deducciones || 0;
        const totalNeto = base + bonos - deduc;
        const montoPagado = det.monto_pagado || 0;
        const saldoNomina = totalNeto - montoPagado;
        const estado = det.estado;
        const fecha = det.periodo || '---';

        const badgeClass = estado === 'Pagado' ? 'bg-green-100 text-green-700' :
                           estado === 'Parcial' ? 'bg-amber-100 text-amber-700' :
                           estado === 'Sin Generar' ? 'bg-gray-100 text-gray-400' :
                           'bg-orange-100 text-orange-700';
        const badgeLabel = estado === 'Parcial' ? 'Pagada Parcialmente' : estado;

        return `
        <tr class="hover:bg-slate-50/50 transition-all font-bold group">
            <td class="px-8 py-5">
                <div class="flex items-center gap-4">
                    ${(estado === 'Pendiente' || estado === 'Parcial') ? `<input type="checkbox" onchange="toggleSeleccion('${det.empleado_id}')" class="rounded text-primary focus:ring-primary border-slate-300">` : '<div class="size-4"></div>'}
                    <div class="size-10 rounded-full bg-slate-100 overflow-hidden shadow-sm">
                        <img src="${emp.foto_url || 'https://ui-avatars.com/api/?name=' + emp.nombre_completo}" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <p class="text-sm font-black text-slate-900 uppercase tracking-tight">${emp.nombre_completo}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase">ID: ${emp.id.slice(0, 5)} • ${emp.puesto}</p>
                        <p class="text-[9px] font-bold text-blue-500 uppercase mt-1">Periodo: ${fecha}</p>
                        ${prestamosActivosCache.some(p => p.empleado_id === det.empleado_id) ? `<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full uppercase mt-1">⚠ Préstamo activo</span>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-8 py-5"><span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">Quincenal</span></td>
            <td class="px-8 py-5 text-right text-sm text-slate-600">${formatMoney(base)}</td>
            <td class="px-8 py-5 text-center">
                <span class="text-green-500">+${formatMoney(bonos)}</span> /
                <span class="text-red-400">-${formatMoney(deduc)}</span>
            </td>
            <td class="px-8 py-5 text-right font-black text-slate-900 text-base">
                ${formatMoney(totalNeto)}
                ${estado === 'Parcial' ? `<p class="text-[9px] font-bold text-amber-600 mt-1">Pagado: ${formatMoney(montoPagado)} · Saldo: ${formatMoney(saldoNomina)}</p>` : ''}
            </td>
            <td class="px-8 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${badgeClass}">
                    ${badgeLabel}
                </span>
            </td>
            <td class="px-8 py-5 text-center">
                <div class="flex justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    ${(estado === 'Pendiente' || estado === 'Parcial') ? `
                    <button onclick="abrirModalNomina('${det.empleado_id}')" class="p-2 text-slate-400 hover:text-primary transition-colors" title="Editar Montos Manualmente">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    ` : ''}
                    <button onclick="enviarNotificacionWhatsApp('${det.empleado_id}')" class="p-2 text-green-500 hover:text-green-700 transition-colors" title="Notificar Pago por WhatsApp"><span class="material-symbols-outlined text-sm">chat</span></button>
                    <button onclick="eliminarNomina('${det.id}')" class="p-2 text-red-400 hover:text-red-600 transition-colors" title="Eliminar Registro Nómina"><span class="material-symbols-outlined text-sm">delete</span></button>
                    <button onclick="verDetalleNomina('${det.empleado_id}')" class="p-2 text-slate-400 hover:text-slate-900 transition-colors" title="Ver Detalle"><span class="material-symbols-outlined text-sm">visibility</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function toggleSeleccion(id) {
    if (seleccionados.has(id)) seleccionados.delete(id);
    else seleccionados.add(id);

    const bar = document.getElementById('barAccionesMasivas');
    const count = document.getElementById('countSeleccionados');

    if (seleccionados.size > 0) {
        bar.classList.remove('hidden');
        count.innerText = seleccionados.size;
    } else {
        bar.classList.add('hidden');
    }
}

function actualizarKPIsNomina(datos) {
    // Por defecto mostramos totales de lo PENDIENTE para que sea relevante a la nómina actual
    // O si queremos historial, todo.
    // Generalmente "Costo Total" en esta vista operativa se refiere a "Cuánto voy a pagar esta quincena".
    // Vamos a filtrar por 'Pendiente' para los KPIs principales, o usamos todo si queremos histórico.
    // Dado que hay histórico 'Pagado', sumar todo el histórico daría números gigantes sin sentido.
    // Mejor mostremos los totales de la nómina PENDIENTE (Actual).

    const pendientes = datos.filter(n => n.estado === 'Pendiente' || n.estado === 'Parcial');

    const totalNeto = pendientes.reduce((s, n) => s + (n.sueldo_base + (n.bonificaciones || 0) - (n.deducciones || 0)), 0);
    const totalBonos = pendientes.reduce((s, n) => s + (n.bonificaciones || 0), 0);
    const totalDeduc = pendientes.reduce((s, n) => s + (n.deducciones || 0), 0);
    // Saldo pendiente real (descuenta lo ya pagado en parciales)
    const totalSaldo = pendientes.reduce((s, n) => {
        const neto = n.sueldo_base + (n.bonificaciones || 0) - (n.deducciones || 0);
        return s + (neto - (n.monto_pagado || 0));
    }, 0);

    // Costo Total Nómina (De lo actual)
    document.getElementById('kpiCostoNomina').innerText = formatMoney(totalNeto);

    // Pagos Pendientes (Saldo real restante)
    document.getElementById('kpiPendientes').innerText = formatMoney(totalSaldo);
    document.getElementById('empSinPagar').innerText = pendientes.length;

    // Nuevos KPIs
    document.getElementById('kpiBonos').innerText = formatMoney(totalBonos);
    document.getElementById('kpiDeducciones').innerText = formatMoney(totalDeduc);
}

// Variable global para almacenar el recibo actual y poder editarlo
let reciboActualData = null;

function actualizarPreviewGlobal() {
    // Si hay un recibo siendo visualizado, refrescarlo con los nuevos valores globales
    if (reciboActualData && reciboActualData.id) {
        actualizarPreviewRecibo(reciboActualData.id);
    }
}

function aprobarPagosMasivos() {
    if (!seleccionados.size) return alert("Selecciona al menos un empleado para aprobar el pago.");

    // Establecer fecha de pago por defecto (hoy)
    const inputFecha = document.getElementById('globalFechaPago');
    if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

    // Pre-llenar periodo actual (Quincenal por defecto)
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = hoy.getMonth();
    const day = hoy.getDate();
    let start, end;

    if (day <= 15) {
        start = new Date(year, month, 1);
        end = new Date(year, month, 15);
    } else {
        start = new Date(year, month, 16);
        end = new Date(year, month + 1, 0);
    }

    const inputStart = document.getElementById('globalPeriodoInicio');
    const inputEnd = document.getElementById('globalPeriodoFin');
    if (inputStart) inputStart.value = start.toISOString().split('T')[0];
    if (inputEnd) inputEnd.value = end.toISOString().split('T')[0];

    // Abrir modal en lugar de confirmar directo
    renderizarTablaPagos();

    const modal = document.getElementById('modalPagoNomina');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modalPagoContent').classList.remove('scale-95');
        document.getElementById('modalPagoContent').classList.add('scale-100');
    }, 10);
}

function cerrarModalPago() {
    const modal = document.getElementById('modalPagoNomina');
    modal.classList.add('opacity-0');
    document.getElementById('modalPagoContent').classList.remove('scale-100');
    document.getElementById('modalPagoContent').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function renderizarTablaPagos() {
    const tbody = document.getElementById('tablaPagosBody');
    tbody.innerHTML = '';
    const ids = Array.from(seleccionados);
    let totalGeneral = 0;

    ids.forEach(id => {
        // Buscar nómina pendiente o parcial
        let record = nominaCache.find(n => n.empleado_id === id && (n.estado === 'Pendiente' || n.estado === 'Parcial'));
        if (!record) return;

        const emp = nominaCacheEmp.find(e => e.id === id);
        const neto = record.sueldo_base + (record.bonificaciones || 0) - (record.deducciones || 0);
        const montoPagado = record.monto_pagado || 0;
        const saldo = neto - montoPagado;
        totalGeneral += saldo;

        const tr = document.createElement('tr');
        tr.className = "cursor-pointer hover:bg-slate-50 transition-colors";
        tr.onclick = () => actualizarPreviewRecibo(id);
        const prestamoActivo = prestamosActivosCache.find(p => p.empleado_id === id);
        tr.innerHTML = `
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-900">${emp ? emp.nombre_completo : 'Empleado'}</p>
                    ${record.estado === 'Parcial' ? `
                    <div class="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2">
                        <p class="text-[10px] font-black text-amber-700 uppercase">Abono parcial — saldo: ${formatMoney(saldo)}</p>
                        <p class="text-[10px] text-amber-500">Ya pagado: ${formatMoney(montoPagado)} de ${formatMoney(neto)}</p>
                    </div>` : ''}
                    ${prestamoActivo ? `
                    <div class="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                        <p class="text-[10px] font-black text-orange-700 uppercase flex items-center gap-1">⚠ Préstamo activo — Descuento ya incluido</p>
                        <p class="text-[10px] font-bold text-orange-600">Descuento: $${parseFloat(prestamoActivo.monto_por_quincena).toFixed(2)} · Saldo: $${parseFloat(prestamoActivo.saldo_pendiente).toFixed(2)}</p>
                        <p class="text-[10px] text-orange-400">${prestamoActivo.quincenas_pagadas}/${prestamoActivo.num_quincenas} quincenas pagadas</p>
                    </div>` : ''}
                    <textarea id="obs_${id}" oninput="actualizarPreviewRecibo('${id}')" placeholder="Observaciones..." class="text-[10px] w-full bg-slate-50 border border-slate-200 rounded-lg focus:border-primary outline-none py-2 px-3 mt-2 resize-none" rows="2" onclick="event.stopPropagation()"></textarea>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-2 min-w-[200px]">
                        <div class="flex justify-between items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-500">Sueldo Base:</span>
                            <div class="relative w-24">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-[10px]">$</span>
                                <input type="number" id="base_${id}" oninput="modificarSueldoVariables('${id}')" onclick="event.stopPropagation()" class="w-full bg-transparent border-none text-slate-900 rounded text-[10px] py-1 pl-5 pr-0 text-right font-black" value="${record.sueldo_base.toFixed(2)}" placeholder="0.00">
                            </div>
                        </div>
                        <div class="flex justify-between items-center gap-2">
                            <span class="text-[9px] font-bold text-green-600 uppercase">Bonos:</span>
                            <div class="relative w-24">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 font-bold text-[10px]">$</span>
                                <input type="number" id="bonos_${id}" oninput="modificarSueldoVariables('${id}')" onclick="event.stopPropagation()" class="w-full bg-green-50 border-green-200 text-green-700 rounded text-[10px] py-1 pl-5 pr-2 text-right font-bold" value="${(record.bonificaciones || 0).toFixed(2)}" placeholder="0.00">
                            </div>
                        </div>
                        <div class="flex justify-between items-center gap-2">
                            <span class="text-[9px] font-bold text-red-500 uppercase">Deducciones:</span>
                            <div class="relative w-24">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-red-500 font-bold text-[10px]">$</span>
                                <input type="number" id="deducciones_${id}" oninput="modificarSueldoVariables('${id}')" onclick="event.stopPropagation()" class="w-full bg-red-50 border-red-200 text-red-700 rounded text-[10px] py-1 pl-5 pr-2 text-right font-bold" value="${(record.deducciones || 0).toFixed(2)}" placeholder="0.00">
                            </div>
                        </div>
                        <div class="border-t border-slate-200 mt-1 pt-2 flex justify-between items-center">
                            <span class="text-[10px] font-black uppercase text-slate-700">Neto:</span>
                            <span id="neto_display_${id}" class="text-sm font-black text-slate-900" data-sueldo="${record.sueldo_base}">$${neto.toFixed(2)}</span>
                        </div>
                        <div class="border-t border-amber-200 mt-1 pt-2">
                            <label class="text-[9px] font-black uppercase text-amber-700 block mb-1">Monto de este abono:</label>
                            <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-[10px]">$</span>
                                <input type="number" id="monto_abono_${id}"
                                    value="${saldo.toFixed(2)}"
                                    data-saldo="${saldo}"
                                    oninput="actualizarDistribucionAbono('${id}')"
                                    onclick="event.stopPropagation()"
                                    class="w-full bg-amber-50 border border-amber-200 rounded-lg pl-6 py-1 font-black text-amber-700 text-center text-[10px]">
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="relative mb-2">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input type="number"
                            id="pago_efectivo_${id}"
                            data-total="${saldo}"
                            oninput="calcularRestantePago('${id}', 'efectivo')"
                            onclick="event.stopPropagation()"
                            class="w-full bg-slate-50 border-slate-200 rounded-lg pl-6 py-2 font-bold text-slate-700 text-center"
                            placeholder="0.00" value="0.00">
                    </div>
                    <select id="sucursal_efectivo_${id}" onclick="event.stopPropagation()" class="w-full bg-slate-50 border-slate-200 rounded-lg text-[9px] font-bold py-1 focus:ring-primary uppercase">
                        <option value="Norte" ${emp && emp.sucursal?.toUpperCase() === 'NORTE' ? 'selected' : ''}>Norte</option>
                        <option value="Sur" ${emp && emp.sucursal?.toUpperCase() === 'SUR' ? 'selected' : ''}>Sur</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <div class="relative mb-2">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input type="number"
                            id="pago_transferencia_${id}"
                            data-total="${saldo}"
                            oninput="calcularRestantePago('${id}', 'transferencia')"
                            onclick="event.stopPropagation()"
                            class="w-full bg-blue-50 border-blue-200 rounded-lg pl-6 py-2 font-bold text-blue-700 text-center"
                            placeholder="0.00" value="${saldo.toFixed(2)}">
                    </div>
                    <select id="cuenta_transferencia_${id}" onclick="event.stopPropagation()" class="w-full bg-blue-50 border-blue-200 rounded-lg text-[9px] font-bold py-1 focus:ring-primary text-blue-700">
                        ${CUENTAS_NOMINA_TRANSFER.map(c => `<option value="${c.key}">${c.nombre}</option>`).join('')}
                    </select>
                </td>
            `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalDispersar').innerText = formatMoney(totalGeneral);

    // Si hay seleccionados, mostrar el primero en el preview por defecto
    if (ids.length > 0) {
        actualizarPreviewRecibo(ids[0]);
    }
}

function actualizarPreviewRecibo(id) {
    const container = document.getElementById('previewReciboContainer');
    if (!container) return;

    const record = nominaCache.find(n => n.empleado_id === id && (n.estado === 'Pendiente' || n.estado === 'Parcial'));
    const emp = nominaCacheEmp.find(e => e.id === id);
    if (!record || !emp) return;

    // Obtener valores de controles globales
    const fechaPago = document.getElementById('globalFechaPago').value || new Date().toISOString().split('T')[0];
    const sucursalPago = document.getElementById('globalSucursal').value;
    const frecuenciaPago = document.getElementById('globalFrecuencia').value;
    const pInicio = document.getElementById('globalPeriodoInicio').value;
    const pFin = document.getElementById('globalPeriodoFin').value;

    const inputBase = document.getElementById(`base_${id}`);
    const inputBonos = document.getElementById(`bonos_${id}`);
    const inputDeduc = document.getElementById(`deducciones_${id}`);
    
    const base = inputBase ? (parseFloat(inputBase.value) || 0) : record.sueldo_base;
    const bonos = inputBonos ? (parseFloat(inputBonos.value) || 0) : (record.bonificaciones || 0);
    const deduc = inputDeduc ? (parseFloat(inputDeduc.value) || 0) : (record.deducciones || 0);
    
    const neto = base + bonos - deduc;
    const montoPagadoAntes = record.monto_pagado || 0;
    const montoAbono = parseFloat(document.getElementById(`monto_abono_${id}`)?.value) || (neto - montoPagadoAntes);
    const efectivo = parseFloat(document.getElementById(`pago_efectivo_${id}`).value) || 0;
    const transfer = parseFloat(document.getElementById(`pago_transferencia_${id}`).value) || 0;
    const obs = document.getElementById(`obs_${id}`)?.value || '';

    // Cuenta bancaria seleccionada para transferencia
    const cuentaKey = document.getElementById(`cuenta_transferencia_${id}`)?.value;
    const cuentaInfo = CUENTAS_NOMINA_TRANSFER.find(c => c.key === cuentaKey);
    const sucursalEfectivo = document.getElementById(`sucursal_efectivo_${id}`)?.value || sucursalPago;
    const sucursalTransferencia = cuentaInfo ? cuentaInfo.nombre : (sucursalPago);

    // Guardamos datos para referencia
    reciboActualData = { id, record, emp, neto };

    const fechaHoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const esParcial = montoAbono < neto - 0.01;

    container.innerHTML = `
        <div id="recibo-pdf" class="bg-white p-8 shadow-inner border border-slate-200 max-w-2xl mx-auto text-slate-800 font-sans">
            <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                    <h2 class="text-2xl font-black uppercase tracking-tighter italic">Agrigarden</h2>
                    <p class="text-[10px] font-bold text-slate-500">SISTEMA DE GESTIÓN DE CAPITAL HUMANO</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-black uppercase">Recibo de Nómina${esParcial ? ' — Pago Parcial' : ''}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">Folio: ${record.id || 'N/A'}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">Fecha: ${fechaHoy}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <label class="block text-[8px] font-black uppercase text-slate-400 mb-1">Empleado</label>
                    <p class="text-sm font-black uppercase" contenteditable="true">${emp.nombre_completo}</p>
                    <p class="text-[10px] font-bold text-slate-500 uppercase">${emp.puesto} | <span contenteditable="true">${sucursalPago}</span></p>
                </div>
                <div class="text-right">
                    <label class="block text-[8px] font-black uppercase text-slate-400 mb-1">Periodo de Pago (<span contenteditable="true">${frecuenciaPago}</span>)</label>
                    <p class="text-sm font-black uppercase" contenteditable="true">${pInicio || '---'} al ${pFin || '---'}</p>
                    <p class="text-[8px] font-black uppercase text-slate-400 mt-1">Fecha de Pago: <span contenteditable="true">${fechaPago}</span></p>
                </div>
            </div>

            ${esParcial ? `
            <div class="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p class="text-[9px] font-black uppercase text-amber-700">Pago Parcial — Abono: ${formatMoney(montoAbono)}</p>
                <p class="text-[8px] text-amber-500 font-bold">Ya pagado antes: ${formatMoney(montoPagadoAntes)} · Saldo restante tras este abono: ${formatMoney(neto - montoPagadoAntes - montoAbono)}</p>
            </div>` : ''}
            <div class="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p class="text-[9px] font-black uppercase text-slate-400 mb-1 text-center">Detalle de Dispersión${esParcial ? ` (Abono ${formatMoney(montoAbono)})` : ''}</p>
                <div class="flex justify-around text-center">
                    <div>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Efectivo (${sucursalEfectivo})</p>
                        <p class="text-xs font-black" contenteditable="true">${formatMoney(efectivo)}</p>
                    </div>
                    <div>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Transferencia (${sucursalTransferencia})</p>
                        <p class="text-xs font-black" contenteditable="true">${formatMoney(transfer)}</p>
                    </div>
                </div>
                ${obs ? `<p class="text-[8px] italic text-slate-400 text-center mt-2 font-bold uppercase">Obs: ${obs}</p>` : ''}
            </div>

            <table class="w-full mb-8">
                <thead>
                    <tr class="bg-slate-900 text-white text-[9px] font-black uppercase">
                        <th class="px-4 py-2 text-left">Concepto</th>
                        <th class="px-4 py-2 text-right">Percepciones</th>
                        <th class="px-4 py-2 text-right">Deducciones</th>
                    </tr>
                </thead>
                <tbody class="text-[11px] font-bold divide-y divide-slate-100">
                    <tr>
                        <td class="px-4 py-3">Sueldo Base (Quincenal)</td>
                        <td class="px-4 py-3 text-right" contenteditable="true">${formatMoney(base)}</td>
                        <td class="px-4 py-3 text-right">---</td>
                    </tr>
                    <tr>
                        <td class="px-4 py-3">Bonificaciones / Incentivos</td>
                        <td class="px-4 py-3 text-right text-green-600" contenteditable="true">+${formatMoney(bonos)}</td>
                        <td class="px-4 py-3 text-right">---</td>
                    </tr>
                    <tr>
                        <td class="px-4 py-3">Deducciones (Impuestos/Préstamos)</td>
                        <td class="px-4 py-3 text-right">---</td>
                        <td class="px-4 py-3 text-right text-red-500" contenteditable="true">-${formatMoney(deduc)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="bg-slate-50">
                        <td class="px-4 py-4 text-sm font-black uppercase text-slate-900">Total Neto a Recibir</td>
                        <td colspan="2" class="px-4 py-4 text-right text-lg font-black text-slate-900" id="previewTotalNeto">
                            ${formatMoney(neto)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <div class="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12">
                <div class="text-center">
                    <div class="h-px bg-slate-300 w-full mb-2"></div>
                    <p class="text-[9px] font-black uppercase">Firma del Empleado</p>
                </div>
                <div class="text-center">
                    <div class="h-px bg-slate-300 w-full mb-2"></div>
                    <p class="text-[9px] font-black uppercase">Sello de Empresa</p>
                </div>
            </div>
            
            <p class="text-[7px] text-center text-slate-400 mt-10 font-bold uppercase tracking-widest">Este documento es un comprobante de dispersión electrónica de fondos.</p>
        </div>
    `;
}

async function generarYDescargarPDF(id) {
    const element = document.getElementById('recibo-pdf');
    if (!element) return;

    const emp = nominaCacheEmp.find(e => e.id === id);
    const nombre = emp ? emp.nombre_completo : 'Empleado';
    const opt = {
        margin: 0.5,
        filename: `Recibo_Nomina_${nombre.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(element).save();
    } catch (e) {
        console.error("Error al generar PDF:", e);
    }
}

window.recalcularTotalDispersarVar = function() {
    let totalGeneral = 0;
    Array.from(seleccionados).forEach(id => {
        const displayNeto = document.getElementById(`neto_display_${id}`);
        if (displayNeto) {
            totalGeneral += parseFloat(displayNeto.innerText.replace(/[^0-9.-]+/g,"")) || 0;
        }
    });
    const lbl = document.getElementById('totalDispersar');
    if (lbl) lbl.innerText = formatMoney(totalGeneral);
};

window.modificarSueldoVariables = function(id) {
    const inputBase = document.getElementById(`base_${id}`);
    const inputBonos = document.getElementById(`bonos_${id}`);
    const inputDeduc = document.getElementById(`deducciones_${id}`);
    const displayNeto = document.getElementById(`neto_display_${id}`);
    
    const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
    const inputTransfer = document.getElementById(`pago_transferencia_${id}`);
    
    if(!inputBase || !inputBonos || !inputDeduc || !displayNeto || !inputEfectivo || !inputTransfer) return;
    
    const sueldo = parseFloat(inputBase.value) || 0;
    const bonos = parseFloat(inputBonos.value) || 0;
    const deduc = parseFloat(inputDeduc.value) || 0;
    
    const nuevoNeto = sueldo + bonos - deduc;
    displayNeto.innerText = formatMoney(nuevoNeto);
    
    inputEfectivo.setAttribute('data-total', nuevoNeto);
    inputTransfer.setAttribute('data-total', nuevoNeto);
    
    // Auto-adjust transfer to match the new net, keeping efectivo same
    let efectivoActual = parseFloat(inputEfectivo.value) || 0;
    if (efectivoActual > nuevoNeto) {
        efectivoActual = nuevoNeto;
        inputEfectivo.value = efectivoActual.toFixed(2);
    }
    
    const nuevoTransfer = Math.max(0, nuevoNeto - efectivoActual);
    inputTransfer.value = nuevoTransfer.toFixed(2);
    
    recalcularTotalDispersarVar();
    actualizarPreviewRecibo(id);
};

// Actualiza distribución efectivo/transferencia cuando cambia el monto del abono
window.actualizarDistribucionAbono = function(id) {
    const inputAbono = document.getElementById(`monto_abono_${id}`);
    const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
    const inputTransfer = document.getElementById(`pago_transferencia_${id}`);
    if (!inputAbono || !inputEfectivo || !inputTransfer) return;

    const nuevoTotal = parseFloat(inputAbono.value) || 0;
    inputEfectivo.setAttribute('data-total', nuevoTotal);
    inputTransfer.setAttribute('data-total', nuevoTotal);

    // Ajustar: mantener efectivo, recalcular transferencia
    let efectivo = parseFloat(inputEfectivo.value) || 0;
    if (efectivo > nuevoTotal) {
        efectivo = nuevoTotal;
        inputEfectivo.value = efectivo.toFixed(2);
    }
    inputTransfer.value = Math.max(0, nuevoTotal - efectivo).toFixed(2);

    actualizarPreviewRecibo(id);
};

// Función expuesta globalmente para el oninput
window.calcularRestantePago = function (id, source) {
    const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
    const inputTransfer = document.getElementById(`pago_transferencia_${id}`);
    const inputAbono = document.getElementById(`monto_abono_${id}`);
    const total = inputAbono ? (parseFloat(inputAbono.value) || 0) : parseFloat(inputEfectivo.getAttribute('data-total'));

    let efectivo = parseFloat(inputEfectivo.value) || 0;
    let transfer = parseFloat(inputTransfer.value) || 0;

    if (source === 'efectivo') {
        transfer = Math.max(0, total - efectivo);
        inputTransfer.value = transfer.toFixed(2);
    } else {
        efectivo = Math.max(0, total - transfer);
        inputEfectivo.value = efectivo.toFixed(2);
    }

    // Actualizar preview en tiempo real
    actualizarPreviewRecibo(id);

    // Validación visual simple si se pasan
    if (Math.abs((efectivo + transfer) - total) > 0.1) {
        inputEfectivo.classList.add('ring-2', 'ring-red-500');
        inputTransfer.classList.add('ring-2', 'ring-red-500');
    } else {
        inputEfectivo.classList.remove('ring-2', 'ring-red-500');
        inputTransfer.classList.remove('ring-2', 'ring-red-500');
    }
};

async function confirmarDisersionPagos() {
    const ids = Array.from(seleccionados);
    const fechaHoy = new Date().toISOString().split('T')[0];

    let gastosPayload = [];
    let nominaUpdates = []; // { nominaId, empleadoId, nuevoEstado, nuevoMontoPagado, baseReal, bonosReal, deducReal, montoAbono, abonoNum }

    const frecuenciaPago = document.getElementById('globalFrecuencia').value;
    const fechaPagoGasto = (document.getElementById('globalFechaPago').value || fechaHoy) + 'T12:00:00';
    const pInicio = document.getElementById('globalPeriodoInicio').value;
    const pFin = document.getElementById('globalPeriodoFin').value;

    // 1. Recolectar datos y validar
    for (const id of ids) {
        const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
        if (!inputEfectivo) continue;

        let record = nominaCache.find(n => n.empleado_id === id && (n.estado === 'Pendiente' || n.estado === 'Parcial'));
        if (!record) continue;

        const inputBase = document.getElementById(`base_${id}`);
        const inputBonos = document.getElementById(`bonos_${id}`);
        const inputDeduc = document.getElementById(`deducciones_${id}`);
        const baseReal = inputBase ? (parseFloat(inputBase.value) || 0) : record.sueldo_base;
        const bonosReal = inputBonos ? (parseFloat(inputBonos.value) || 0) : (record.bonificaciones || 0);
        const deducReal = inputDeduc ? (parseFloat(inputDeduc.value) || 0) : (record.deducciones || 0);
        const netoTotal = baseReal + bonosReal - deducReal;

        const efectivo = parseFloat(document.getElementById(`pago_efectivo_${id}`).value) || 0;
        const transfer = parseFloat(document.getElementById(`pago_transferencia_${id}`).value) || 0;
        const montoAbono = parseFloat(document.getElementById(`monto_abono_${id}`)?.value) || (efectivo + transfer);
        const obs = document.getElementById(`obs_${id}`).value;

        const sucursalEfectivoPago = document.getElementById(`sucursal_efectivo_${id}`)?.value || 'Norte';
        const cuentaKey = document.getElementById(`cuenta_transferencia_${id}`)?.value;
        const cuentaInfo = CUENTAS_NOMINA_TRANSFER.find(c => c.key === cuentaKey);
        const metodoTransfer = cuentaInfo ? cuentaInfo.metodo_pago : 'Transferencia';
        const sucursalTransfer = cuentaInfo ? cuentaInfo.sucursal : sucursalEfectivoPago;

        if (Math.abs((efectivo + transfer) - montoAbono) > 1.0) {
            return alert(`Error en la distribución de pago para un empleado.\nLa suma (efectivo + transferencia) no coincide con el monto del abono.`);
        }

        const montoPagadoAntes = record.monto_pagado || 0;
        const nuevoMontoPagado = montoPagadoAntes + montoAbono;
        const nuevoEstado = nuevoMontoPagado >= netoTotal - 0.01 ? 'Pagado' : 'Parcial';
        // Número de abono (cuántos abonos previos existen + 1)
        const abonoNum = record.abono_num_siguiente || 1;

        nominaUpdates.push({
            nominaId: record.id,
            empleadoId: id,
            nuevoEstado,
            nuevoMontoPagado,
            baseReal,
            bonosReal,
            deducReal,
            montoAbono,
            abonoNum,
            cuentaKey,
            metodoTransfer,
            sucursalTransfer,
            sucursalEfectivoPago,
            efectivo,
            transfer,
            obs,
            frecuenciaPago,
            pInicio,
            pFin
        });

        if (efectivo > 0) {
            gastosPayload.push({
                created_at: fechaPagoGasto,
                proveedor: 'NOMINA EMPLEADOS',
                categoria: 'Costo',
                subcategoria: 'NOMINA',
                metodo_pago: 'Efectivo',
                monto_total: efectivo,
                sucursal: sucursalEfectivoPago,
                notas: `PAGO NOMINA ${frecuenciaPago.toUpperCase()} (${pInicio} AL ${pFin}) ABONO #${abonoNum} (EFECTIVO) ID: ${id} | ${obs}`,
                estado_pago: 'Pagado'
            });
        }

        if (transfer > 0) {
            gastosPayload.push({
                created_at: fechaPagoGasto,
                proveedor: 'NOMINA EMPLEADOS',
                categoria: 'Costo',
                subcategoria: 'NOMINA',
                metodo_pago: metodoTransfer,
                monto_total: transfer,
                sucursal: sucursalTransfer,
                notas: `PAGO NOMINA ${frecuenciaPago.toUpperCase()} (${pInicio} AL ${pFin}) ABONO #${abonoNum} (TRANSF ${cuentaInfo?.nombre || ''}) ID: ${id} | ${obs}`,
                estado_pago: 'Pagado'
            });
        }
    }

    if (!confirm(`¿Confirmar pagos?\nSe crearán ${gastosPayload.length} registros de gasto.`)) return;

    try {
        if (!sbClient) initNominaClient();

        // A. Actualizar nóminas (estado, monto_pagado, montos ajustados)
        for (const u of nominaUpdates) {
            const { error: errNomina } = await sbClient
                .from('rrhh_nomina')
                .update({
                    estado: u.nuevoEstado,
                    fecha_pago: u.nuevoEstado === 'Pagado' ? fechaHoy : null,
                    monto_pagado: u.nuevoMontoPagado,
                    sueldo_base: u.baseReal,
                    bonificaciones: u.bonosReal,
                    deducciones: u.deducReal
                })
                .eq('id', u.nominaId);
            if (errNomina) throw errNomina;

            // A2. Insertar registro en abonos_nomina
            const { error: errAbono } = await sbClient.from('abonos_nomina').insert({
                nomina_id: u.nominaId,
                monto: u.montoAbono,
                metodo_pago: u.transfer > 0 ? u.metodoTransfer : 'Efectivo',
                cuenta_origen: u.cuentaKey || null,
                sucursal: u.transfer > 0 ? u.sucursalTransfer : u.sucursalEfectivoPago,
                fecha: fechaHoy,
                abono_num: u.abonoNum,
                notas: `${u.frecuenciaPago} (${u.pInicio} al ${u.pFin}) | ${u.obs}`
            });
            if (errAbono) console.error("Error insertando abono_nomina:", errAbono);
        }

        // B. Insertar Gastos
        if (gastosPayload.length > 0) {
            const { error: errGasto } = await sbClient.from('gastos').insert(gastosPayload);
            if (errGasto) console.error("Error insertando gastos:", errGasto);
        }

        // C. Registrar abonos de préstamos y actualizar saldos
        for (const u of nominaUpdates) {
            const prestamo = prestamosActivosCache.find(p => p.empleado_id === u.empleadoId);
            if (!prestamo) continue;

            const abono = parseFloat(prestamo.monto_por_quincena);
            const nuevoSaldo = Math.max(0, parseFloat(prestamo.saldo_pendiente) - abono);
            const nuevasQnas = prestamo.quincenas_pagadas + 1;
            const liquidado = nuevasQnas >= prestamo.num_quincenas || nuevoSaldo <= 0;

            await sbClient.from('abonos_prestamos_empleados').insert({
                prestamo_id: prestamo.id,
                monto: abono,
                fecha: fechaHoy,
                tipo: 'descuento_nomina',
                notas: `Descuento vía nómina periodo ${pInicio || fechaHoy}`
            });

            await sbClient.from('prestamos_empleados').update({
                saldo_pendiente: nuevoSaldo,
                quincenas_pagadas: nuevasQnas,
                estatus: liquidado ? 'liquidado' : 'activo'
            }).eq('id', prestamo.id);
        }

        // D. Generar y Descargar PDFs
        alert("Pagos y gastos registrados. Iniciando descarga de recibos...");
        for (const u of nominaUpdates) {
            actualizarPreviewRecibo(u.empleadoId);
            await generarYDescargarPDF(u.empleadoId);
        }

        alert("Proceso completado correctamente.");
        cerrarModalPago();
        seleccionados.clear();
        document.getElementById('barAccionesMasivas').classList.add('hidden');
        cargarNomina();

    } catch (e) {
        console.error(e);
        alert("Error procesando pagos: " + e.message);
    }
}

async function generarNominaMasiva() {
    // 1. Mostrar modal de selección
    const modal = document.getElementById('modalSeleccionGenerar');
    const tbody = document.getElementById('tablaSeleccionGenerarBody');
    tbody.innerHTML = '';

    // Filtrar empleados que NO tengan ya una nómina PENDIENTE o PARCIAL
    const empleadosDisponibles = nominaCacheEmp.filter(emp => {
        return !nominaCache.some(n => n.empleado_id === emp.id && (n.estado === 'Pendiente' || n.estado === 'Parcial'));
    });

    if (empleadosDisponibles.length === 0) {
        return alert("Todos los empleados ya tienen una nómina pendiente o no hay empleados activos.");
    }

    empleadosDisponibles.forEach(emp => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/50 transition-all font-bold group cursor-pointer";
        tr.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = tr.querySelector('input');
                cb.checked = !cb.checked;
            }
        };
        tr.innerHTML = `
            <td class="px-6 py-4"><input type="checkbox" value="${emp.id}" class="cb-generar rounded text-primary focus:ring-primary border-slate-300"></td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="size-8 rounded-full bg-slate-100 overflow-hidden">
                        <img src="${emp.foto_url || 'https://ui-avatars.com/api/?name=' + emp.nombre_completo}" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <p class="text-xs font-black uppercase">${emp.nombre_completo}</p>
                        <p class="text-[9px] text-slate-400">${emp.puesto}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-[10px] font-black uppercase text-slate-500">${emp.sucursal}</td>
        `;
        tbody.appendChild(tr);
    });

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modalSeleccionGenerarContent').classList.remove('scale-95');
        document.getElementById('modalSeleccionGenerarContent').classList.add('scale-100');
    }, 10);
}

function cerrarModalSeleccionGenerar() {
    const modal = document.getElementById('modalSeleccionGenerar');
    modal.classList.add('opacity-0');
    document.getElementById('modalSeleccionGenerarContent').classList.remove('scale-100');
    document.getElementById('modalSeleccionGenerarContent').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function seleccionarTodoGenerar(val) {
    document.querySelectorAll('.cb-generar').forEach(cb => cb.checked = val);
}

async function ejecutarGeneracionSelectiva() {
    const seleccionadosGenerar = Array.from(document.querySelectorAll('.cb-generar:checked')).map(cb => cb.value);

    if (seleccionadosGenerar.length === 0) {
        return alert("Selecciona al menos un empleado.");
    }

    try {
        if (!sbClient) initNominaClient();

        const fechaHoy = new Date().toISOString().split('T')[0];

        // Preparar registros
        const hoy = new Date();
        const year = hoy.getFullYear();
        const month = hoy.getMonth();
        const day = hoy.getDate();
        let fechaInicio, fechaFin;

        if (day <= 15) {
            fechaInicio = new Date(year, month, 1).toISOString().split('T')[0];
            fechaFin = new Date(year, month, 15).toISOString().split('T')[0];
        } else {
            fechaInicio = new Date(year, month, 16).toISOString().split('T')[0];
            fechaFin = new Date(year, month + 1, 0).toISOString().split('T')[0];
        }

        const empleadosData = nominaCacheEmp.filter(e => seleccionadosGenerar.includes(e.id));

        const nominaInsert = empleadosData.map(emp => {
            const sBaseRaw = emp.sueldo_base || 0;
            const sueldoQuincenal = parseFloat(sBaseRaw) / 2;

            // Aplicar descuento de préstamo activo si existe
            const prestamo = prestamosActivosCache.find(p => p.empleado_id === emp.id);
            const deduccionPrestamo = prestamo ? parseFloat(prestamo.monto_por_quincena) : 0;

            return {
                empleado_id: emp.id,
                periodo: fechaHoy,
                periodo_inicio: fechaInicio,
                periodo_fin: fechaFin,
                sueldo_base: sueldoQuincenal,
                bonificaciones: 0,
                deducciones: deduccionPrestamo,
                estado: 'Pendiente'
            };
        });

        const { error } = await sbClient.from('rrhh_nomina').insert(nominaInsert);
        if (error) throw error;

        alert(`Nómina generada para ${seleccionadosGenerar.length} empleados.`);
        cerrarModalSeleccionGenerar();
        cargarNomina();

    } catch (e) {
        console.error("Error generando nómina:", e);
        alert(`Error: ${e.message}`);
    }
}

async function calcularDeduccionesMasivas() {
    if (!seleccionados.size) return alert("Selecciona empleados para calcular.");

    // Simulación de cálculo: ISR (5%) + IMSS (2.5%) = 7.5% de deducción
    const porcentajeDeduc = 0.075;

    try {
        if (!sbClient) initNominaClient();

        const ids = Array.from(seleccionados);

        // 1. Obtener datos actuales de los seleccionados para calcular sobre su base
        // (Usamos el caché para no hacer otra query de lectura)
        const aProcesar = nominaCache.filter(n => ids.includes(n.empleado_id) && n.estado === 'Pendiente');

        if (aProcesar.length === 0) return alert("Los empleados seleccionados ya están pagados o no tienen nómina pendiente.");

        // 2. Preparar updates
        for (const item of aProcesar) {
            const deduc = item.sueldo_base * porcentajeDeduc;

            await sbClient
                .from('rrhh_nomina')
                .update({
                    deducciones: deduc,
                    // bonificaciones: 0 // Podríamos poner lógica de bonos aquí
                })
                .eq('empleado_id', item.empleado_id)
                .eq('estado', 'Pendiente');
        }

        alert("Cálculo de deducciones (ISR/IMSS estimado) aplicado correctamente.");
        cargarNomina(); // Recargar tabla

    } catch (e) {
        console.error(e);
        alert("Error al calcular deducciones.");
    }
}

function abrirModalNomina(id) {
    const nomina = nominaCache.find(n => n.empleado_id === id);
    if (!nomina) return alert("Primero debes generar la nómina.");

    const emp = nominaCacheEmp.find(e => e.id === id); // Necesitamos caché de empleados global o pasarlo
    // Nota: en cargarNomina definimos 'empleados', deberíamos guardarlo en global.
    // Hack: buscamos en el DOM o mejor, guardamos empleados en variable global al cargar.

    document.getElementById('modalEmpleadoId').value = id;
    document.getElementById('modalEmpleadoNombre').innerText = emp ? emp.nombre_completo : 'Empleado';
    document.getElementById('modalSueldoBase').value = formatMoney(nomina.sueldo_base);

    document.getElementById('modalBonos').value = nomina.bonificaciones || 0;
    document.getElementById('modalDeducciones').value = nomina.deducciones || 0;

    actualizarPreviewNeto();

    const modal = document.getElementById('modalNomina');
    modal.classList.remove('hidden');
    // Pequeño timeout para animación
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modalNominaContent').classList.remove('scale-95');
        document.getElementById('modalNominaContent').classList.add('scale-100');
    }, 10);
}

function cerrarModalNomina() {
    const modal = document.getElementById('modalNomina');
    modal.classList.add('opacity-0');
    document.getElementById('modalNominaContent').classList.remove('scale-100');
    document.getElementById('modalNominaContent').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

async function guardarCambiosNomina() {
    const id = document.getElementById('modalEmpleadoId').value;
    const bonos = parseFloat(document.getElementById('modalBonos').value) || 0;
    const deduc = parseFloat(document.getElementById('modalDeducciones').value) || 0;

    try {
        if (!sbClient) initNominaClient();

        const { error } = await sbClient
            .from('rrhh_nomina')
            .update({ bonificaciones: bonos, deducciones: deduc })
            .eq('empleado_id', id)
            .eq('estado', 'Pendiente'); // Solo editar si está pendiente

        if (error) throw error;

        alert("Calculo actualizado correctamente.");
        cerrarModalNomina();
        cargarNomina();

    } catch (e) {
        console.error("Error guardando cambios:", e);
        alert("No se pudo actualizar. " + e.message);
    }
}

function actualizarPreviewNeto() {
    // Calculo simple para el modal
    // Necesitamos el sueldo base. Lo tomamos del input (limpiando formato) o del caché.
    const id = document.getElementById('modalEmpleadoId').value;
    const nomina = nominaCache.find(n => n.empleado_id === id);
    if (!nomina) return;

    const base = nomina.sueldo_base || 0;
    const bonos = parseFloat(document.getElementById('modalBonos').value) || 0;
    const deduc = parseFloat(document.getElementById('modalDeducciones').value) || 0;

    document.getElementById('modalTotalNeto').innerText = formatMoney(base + bonos - deduc);
}

// Listeners inputs modal
document.getElementById('modalBonos').addEventListener('input', actualizarPreviewNeto);
document.getElementById('modalDeducciones').addEventListener('input', actualizarPreviewNeto);

function verDetalleNomina(id) {
    const nomina = nominaCache.find(n => n.empleado_id === id && (estadoFiltro === 'Todos' ? true : n.estado === estadoFiltro));
    // Nota: buscar en nominaCache sin filtro estricto podría traer varios. 
    // Lo ideal es pasar el ID del registro de nómina (rrhh_nomina.id) en lugar del empleado_id para ser exactos.
    // Pero por now usaremos el empleado_id y lógica similar a la visualización.
    // Una mejora sería cambiar todas las funciones para usar 'nomina.id' en vez de 'empleado.id'

    // Simplificación para no romper mucho: buscamos el registro visible más relevante (Pendiente preferido)
    let record = nominaCache.find(n => n.empleado_id === id && (n.estado === 'Pendiente' || n.estado === 'Parcial'));
    if (!record) record = nominaCache.find(n => n.empleado_id === id); // El primero que encuentre si no hay pendiente/parcial

    if (!record) return alert("No se encontró información de nómina.");

    const emp = nominaCacheEmp.find(e => e.id === id);
    const nombre = emp ? emp.nombre_completo : 'Empleado';

    const neto = record.sueldo_base + (record.bonificaciones || 0) - (record.deducciones || 0);

    alert(`DETALLE DE NÓMINA\n\nEmpleado: ${nombre}\nPeriodo: ${record.periodo || 'N/A'}\nEstado: ${record.estado}\n\nSueldo Base: ${formatMoney(record.sueldo_base)}\nBonificaciones: ${formatMoney(record.bonificaciones)}\nDeducciones: ${formatMoney(record.deducciones)}\n-------------------\nTOTAL NETO: ${formatMoney(neto)}`);
}

function enviarNotificacionWhatsApp(id) {
    const emp = nominaCacheEmp.find(e => e.id === id);
    if (!emp) return;

    // Buscar el recibo más relevante (Pendiente o el último visible)
    let record = nominaCache.find(n => n.empleado_id === id && n.estado === 'Pendiente');
    if (!record) record = nominaCache.find(n => n.empleado_id === id); // Fallback al historial si ya está pagado

    if (!record) return alert("No hay información de nómina para enviar.");

    let telefono = emp.telefono ? emp.telefono.replace(/\D/g, '') : '';
    // Asumir código de país México si no viene (+52)
    if (telefono && telefono.length === 10) telefono = '52' + telefono;

    const neto = record.sueldo_base + (record.bonificaciones || 0) - (record.deducciones || 0);
    const montoFmt = formatMoney(neto);
    const periodo = record.periodo || 'Reciente';

    // Mensaje personalizado
    const mensaje = `Hola *${emp.nombre_completo.split(' ')[0]}*, buen día.\n\nTe informamos que tu nómina del periodo *${periodo}* ha sido procesada.\n\n💰 Total a recibir: *${montoFmt}*\n\nGracias por tu gran esfuerzo en Agrigarden. 🌱`;

    if (telefono) {
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    } else {
        // Fallback si no tiene teléfono registrado
        if (confirm(`El empleado no tiene teléfono registrado.\n\n¿Abrir WhatsApp Web para seleccionar contacto manualmente?\n\nMensaje:\n${mensaje}`)) {
            const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
        }
    }
}

async function eliminarNomina(id) {
    // Buscamos el registro por ID (comparación flexible por si es string/number)
    const record = nominaCache.find(n => n.id == id);
    if (!record) return;

    const msg = record.estado === 'Pagado'
        ? "¿Estás seguro de eliminar este registro del historial?\n\nADVERTENCIA: Esto eliminará el registro de nómina, pero el gasto contable seguirá existiendo en Finanzas para integridad contable."
        : "¿Estás seguro de eliminar esta nómina pendiente?";

    if (!confirm(msg)) return;

    try {
        if (!sbClient) initNominaClient();
        const { error } = await sbClient.from('rrhh_nomina').delete().eq('id', id);
        if (error) throw error;
        alert("Registro eliminado.");
        cargarNomina();
    } catch (e) { alert(e.message); }
}