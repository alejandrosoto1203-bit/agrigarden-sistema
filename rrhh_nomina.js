// rrhh_nomina.js - Lógica del Centro de Gestión de Nómina
let nominaCache = [];
let seleccionados = new Set();
let nominaCacheEmp = []; // Cache de empleados
let sbClient = null; // Cliente local para este módulo

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
            .select('id, nombre_completo, puesto, sucursal, foto_url, telefono');

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
    estadoFiltro = (tab === 'actual') ? 'Pendiente' : 'Pagado';

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
        if (estadoFiltro !== 'Todos' && n.estado !== estadoFiltro) return false;

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
        const estado = det.estado;
        const fecha = det.periodo || '---';

        return `
        <tr class="hover:bg-slate-50/50 transition-all font-bold group">
            <td class="px-8 py-5">
                <div class="flex items-center gap-4">
                    ${estado === 'Pendiente' ? `<input type="checkbox" onchange="toggleSeleccion('${det.empleado_id}')" class="rounded text-primary focus:ring-primary border-slate-300">` : '<div class="size-4"></div>'}
                    <div class="size-10 rounded-full bg-slate-100 overflow-hidden shadow-sm">
                        <img src="${emp.foto_url || 'https://ui-avatars.com/api/?name=' + emp.nombre_completo}" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <p class="text-sm font-black text-slate-900 uppercase tracking-tight">${emp.nombre_completo}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase">ID: ${emp.id.slice(0, 5)} • ${emp.puesto}</p>
                        <p class="text-[9px] font-bold text-blue-500 uppercase mt-1">Periodo: ${fecha}</p>
                    </div>
                </div>
            </td>
            <td class="px-8 py-5"><span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">Quincenal</span></td>
            <td class="px-8 py-5 text-right text-sm text-slate-600">${formatMoney(base)}</td>
            <td class="px-8 py-5 text-center">
                <span class="text-green-500">+${formatMoney(bonos)}</span> / 
                <span class="text-red-400">-${formatMoney(deduc)}</span>
            </td>
            <td class="px-8 py-5 text-right font-black text-slate-900 text-base">${formatMoney(totalNeto)}</td>
            <td class="px-8 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${estado === 'Pagado' ? 'bg-green-100 text-green-700' : (estado === 'Sin Generar' ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-700')}">
                    ${estado}
                </span>
            </td>
            <td class="px-8 py-5 text-center">
                <div class="flex justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    ${estado === 'Pendiente' ? `
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

    const pendientes = datos.filter(n => n.estado === 'Pendiente');

    const totalNeto = pendientes.reduce((s, n) => s + (n.sueldo_base + (n.bonificaciones || 0) - (n.deducciones || 0)), 0);
    const totalBonos = pendientes.reduce((s, n) => s + (n.bonificaciones || 0), 0);
    const totalDeduc = pendientes.reduce((s, n) => s + (n.deducciones || 0), 0);

    // Costo Total Nómina (De lo actual)
    document.getElementById('kpiCostoNomina').innerText = formatMoney(totalNeto);

    // Pagos Pendientes (Mismo que costo total si todo está pendiente, o remanente)
    document.getElementById('kpiPendientes').innerText = formatMoney(totalNeto);
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
        // Buscar nómina pendiente
        let record = nominaCache.find(n => n.empleado_id === id && n.estado === 'Pendiente');
        if (!record) return;

        const emp = nominaCacheEmp.find(e => e.id === id);
        const neto = record.sueldo_base + (record.bonificaciones || 0) - (record.deducciones || 0);
        totalGeneral += neto;

        const tr = document.createElement('tr');
        tr.className = "cursor-pointer hover:bg-slate-50 transition-colors";
        tr.onclick = () => actualizarPreviewRecibo(id);
        tr.innerHTML = `
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-900">${emp ? emp.nombre_completo : 'Empleado'}</p>
                    <input type="text" id="obs_${id}" oninput="actualizarPreviewRecibo('${id}')" placeholder="Observaciones..." class="text-[10px] w-full bg-transparent border-b border-slate-200 focus:border-primary outline-none py-1" onclick="event.stopPropagation()">
                </td>
                <td class="px-6 py-4 text-right font-black">$${neto.toFixed(2)}</td>
                <td class="px-6 py-4">
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input type="number" 
                            id="pago_efectivo_${id}" 
                            data-total="${neto}" 
                            oninput="calcularRestantePago('${id}', 'efectivo')"
                            onclick="event.stopPropagation()"
                            class="w-full bg-slate-50 border-slate-200 rounded-lg pl-6 py-2 font-bold text-slate-700 text-center" 
                            placeholder="0.00" value="0.00">
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input type="number" 
                            id="pago_transferencia_${id}" 
                            data-total="${neto}" 
                            oninput="calcularRestantePago('${id}', 'transferencia')"
                            onclick="event.stopPropagation()"
                            class="w-full bg-blue-50 border-blue-200 rounded-lg pl-6 py-2 font-bold text-blue-700 text-center" 
                            placeholder="0.00" value="${neto.toFixed(2)}">
                    </div>
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

    const record = nominaCache.find(n => n.empleado_id === id && n.estado === 'Pendiente');
    const emp = nominaCacheEmp.find(e => e.id === id);
    if (!record || !emp) return;

    // Obtener valores de controles globales
    const fechaPago = document.getElementById('globalFechaPago').value || new Date().toISOString().split('T')[0];
    const sucursalPago = document.getElementById('globalSucursal').value;
    const frecuenciaPago = document.getElementById('globalFrecuencia').value;
    const pInicio = document.getElementById('globalPeriodoInicio').value;
    const pFin = document.getElementById('globalPeriodoFin').value;

    const neto = record.sueldo_base + (record.bonificaciones || 0) - (record.deducciones || 0);
    const efectivo = parseFloat(document.getElementById(`pago_efectivo_${id}`).value) || 0;
    const transfer = parseFloat(document.getElementById(`pago_transferencia_${id}`).value) || 0;
    const obs = document.getElementById(`obs_${id}`).value;

    // Guardamos datos para referencia
    reciboActualData = { id, record, emp, neto };

    const fechaHoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

    container.innerHTML = `
        <div id="recibo-pdf" class="bg-white p-8 shadow-inner border border-slate-200 max-w-2xl mx-auto text-slate-800 font-sans">
            <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                    <h2 class="text-2xl font-black uppercase tracking-tighter italic">Agrigarden</h2>
                    <p class="text-[10px] font-bold text-slate-500">SISTEMA DE GESTIÓN DE CAPITAL HUMANO</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-black uppercase">Recibo de Nómina</p>
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

            <div class="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p class="text-[9px] font-black uppercase text-slate-400 mb-1 text-center">Detalle de Dispersión</p>
                <div class="flex justify-around text-center">
                    <div>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Efectivo</p>
                        <p class="text-xs font-black" contenteditable="true">${formatMoney(efectivo)}</p>
                    </div>
                    <div>
                        <p class="text-[8px] font-bold text-slate-500 uppercase">Transferencia</p>
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
                        <td class="px-4 py-3 text-right" contenteditable="true">${formatMoney(record.sueldo_base)}</td>
                        <td class="px-4 py-3 text-right">---</td>
                    </tr>
                    <tr>
                        <td class="px-4 py-3">Bonificaciones / Incentivos</td>
                        <td class="px-4 py-3 text-right text-green-600" contenteditable="true">+${formatMoney(record.bonificaciones)}</td>
                        <td class="px-4 py-3 text-right">---</td>
                    </tr>
                    <tr>
                        <td class="px-4 py-3">Deducciones (Impuestos/Préstamos)</td>
                        <td class="px-4 py-3 text-right">---</td>
                        <td class="px-4 py-3 text-right text-red-500" contenteditable="true">-${formatMoney(record.deducciones)}</td>
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

// Función expuesta globalmente para el oninput
window.calcularRestantePago = function (id, source) {
    const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
    const inputTransfer = document.getElementById(`pago_transferencia_${id}`);
    const total = parseFloat(inputEfectivo.getAttribute('data-total'));

    let efectivo = parseFloat(inputEfectivo.value) || 0;
    let transfer = parseFloat(inputTransfer.value) || 0;

    if (source === 'efectivo') {
        // Si cambio efectivo, el resto va a transferencia
        transfer = Math.max(0, total - efectivo);
        inputTransfer.value = transfer.toFixed(2);
    } else {
        // Si cambio transferencia, el resto va a efectivo? 
        // Usualmente es mejor priorizar uno. Vamos a dejar que sean libres pero validar?
        // Mejor: Si edito transf, ajusto efectivo.
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
    let nominaIdsToUpdate = [];

    // 1. Recolectar datos y validar
    for (const id of ids) {
        const inputEfectivo = document.getElementById(`pago_efectivo_${id}`);
        if (!inputEfectivo) continue; // Si no se renderizó

        // Obtener registro de nómina
        let record = nominaCache.find(n => n.empleado_id === id && n.estado === 'Pendiente');
        if (!record) continue;

        // Obtener empleado para sucursal
        const emp = nominaCacheEmp.find(e => e.id === id);

        const total = parseFloat(inputEfectivo.getAttribute('data-total'));
        const efectivo = parseFloat(document.getElementById(`pago_efectivo_${id}`).value) || 0;
        const transfer = parseFloat(document.getElementById(`pago_transferencia_${id}`).value) || 0;
        const obs = document.getElementById(`obs_${id}`).value;
        const sucursalPago = document.getElementById('globalSucursal').value;
        const frecuenciaPago = document.getElementById('globalFrecuencia').value;
        const fechaPagoGasto = document.getElementById('globalFechaPago').value || fechaHoy;
        const pInicio = document.getElementById('globalPeriodoInicio').value;
        const pFin = document.getElementById('globalPeriodoFin').value;

        if (Math.abs((efectivo + transfer) - total) > 1.0) { // Tolerancia $1
            return alert(`Error en la distribución de pago para un empleado.\nLa suma no coincide con el total. Verifica los campos en rojo.`);
        }

        nominaIdsToUpdate.push(id);

        // Generar payload GASTOS - EFECTIVO
        if (efectivo > 0) {
            gastosPayload.push({
                created_at: fechaPagoGasto,
                proveedor: 'NOMINA EMPLEADOS',
                categoria: 'Costo',
                subcategoria: 'NOMINA',
                metodo_pago: 'Efectivo',
                monto_total: efectivo,
                sucursal: sucursalPago,
                notas: `PAGO NOMINA ${frecuenciaPago.toUpperCase()} (${pInicio} AL ${pFin}) (EFECTIVO) ID: ${id} | ${obs}`,
                estado_pago: 'Pagado'
            });
        }

        // Generar payload GASTOS - TRANSFERENCIA
        if (transfer > 0) {
            gastosPayload.push({
                created_at: fechaPagoGasto,
                proveedor: 'NOMINA EMPLEADOS',
                categoria: 'Costo',
                subcategoria: 'NOMINA',
                metodo_pago: 'Transferencia',
                monto_total: transfer,
                sucursal: sucursalPago,
                notas: `PAGO NOMINA ${frecuenciaPago.toUpperCase()} (${pInicio} AL ${pFin}) (TRANSF) ID: ${id} | ${obs}`,
                estado_pago: 'Pagado'
            });
        }
    }

    if (!confirm(`¿Confirmar pagos?\nSe crearán ${gastosPayload.length} registros de gasto.`)) return;

    try {
        if (!sbClient) initNominaClient();

        // A. Actualizar nóminas a Pagado
        const { error: errNomina } = await sbClient
            .from('rrhh_nomina')
            .update({ estado: 'Pagado', fecha_pago: fechaHoy })
            .in('empleado_id', nominaIdsToUpdate)
            .eq('estado', 'Pendiente');

        if (errNomina) throw errNomina;

        // B. Insertar Gastos
        if (gastosPayload.length > 0) {
            const { error: errGasto } = await sbClient.from('gastos').insert(gastosPayload);
            if (errGasto) console.error("Error insertando gastos:", errGasto);
        }

        // C. Generar y Descargar PDFs
        alert("Pagos y gastos registrados. Iniciando descarga de recibos...");
        for (const id of ids) {
            actualizarPreviewRecibo(id); // Forzar que el preview sea el de este empleado
            await generarYDescargarPDF(id);
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

    // Filtrar empleados que NO tengan ya una nómina PENDIENTE
    const empleadosDisponibles = nominaCacheEmp.filter(emp => {
        return !nominaCache.some(n => n.empleado_id === emp.id && n.estado === 'Pendiente');
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
            const sueldoMensual = parseFloat(emp.sueldo_base) || 0;
            const sueldoQuincenal = sueldoMensual / 2;

            return {
                empleado_id: emp.id,
                periodo: fechaHoy,
                periodo_inicio: fechaInicio,
                periodo_fin: fechaFin,
                sueldo_base: sueldoQuincenal,
                bonificaciones: 0,
                deducciones: 0,
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
    let record = nominaCache.find(n => n.empleado_id === id && n.estado === 'Pendiente');
    if (!record) record = nominaCache.find(n => n.empleado_id === id); // El primero que encuentre si no hay pendiente

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