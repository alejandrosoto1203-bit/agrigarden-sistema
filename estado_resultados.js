// estado_resultados.js - Módulo de Estado de Resultados
// Calcula y muestra P&L mensual/anual por sucursal

const SB_URL_ER = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY_ER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let sbClientER;
if (window.supabase && window.supabase.createClient) {
    sbClientER = window.supabase.createClient(SB_URL_ER, SB_KEY_ER);
}

// Helpers
const formatMoney = (n) => {
    if (n === undefined || n === null) return "$0.00";
    const absVal = Math.abs(n);
    const formatted = `$${absVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    return n < 0 ? `(${formatted})` : formatted;
};

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let mesSeleccionado = new Date().getMonth() + 1;
let anioSeleccionado = new Date().getFullYear();
let mesesCerrados = [];

// =====================================================
// CÁLCULO DEL ESTADO DE RESULTADOS
// =====================================================

async function calcularEstadoMes(mes, anio, sucursal) {
    if (!sbClientER) return null;

    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0, 23, 59, 59);

    try {
        // 1. INGRESOS - desde transacciones (excluyendo abonos y rentas)
        const { data: ingresos } = await sbClientER
            .from('transacciones')
            .select('tipo, monto, categoria')
            .eq('sucursal', sucursal)
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        // Filtrar: excluir ABONO, COBRANZA y RENTA
        const ingresosLimpios = (ingresos || []).filter(i =>
            i.tipo !== 'ABONO' &&
            i.tipo !== 'TRASPASO' &&
            i.categoria !== 'COBRANZA' &&
            !(i.categoria && i.categoria.toUpperCase().includes('RENTA'))
        );

        const ingresosVentas = ingresosLimpios
            .filter(i => i.tipo === 'Venta Directa')
            .reduce((sum, i) => sum + (parseFloat(i.monto) || 0), 0);

        const ingresosServicios = ingresosLimpios
            .filter(i => i.tipo === 'Servicio')
            .reduce((sum, i) => sum + (parseFloat(i.monto) || 0), 0);

        const totalIngresos = ingresosVentas + ingresosServicios;

        // 2. COSTO DE VENTAS - desde inventario + compras mercancía
        const { data: inventario } = await sbClientER
            .from('inventario_mensual')
            .select('monto_inicial, monto_final')
            .eq('mes', mes)
            .eq('anio', anio)
            .eq('sucursal', sucursal)
            .maybeSingle();

        const invInicial = inventario?.monto_inicial || 0;
        const invFinal = inventario?.monto_final || 0;

        // Compras de Mercancía (case-insensitive)
        const { data: compras } = await sbClientER
            .from('gastos')
            .select('monto_total')
            .ilike('subcategoria', 'mercancia')
            .eq('sucursal', sucursal)
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        const totalCompras = (compras || []).reduce((sum, g) => sum + (parseFloat(g.monto_total) || 0), 0);
        const costoVentas = invInicial + totalCompras - invFinal;
        const utilidadBruta = totalIngresos - costoVentas;

        // 3. GASTOS DE OPERACIÓN (categoria = 'Gasto')
        const { data: gastosOp } = await sbClientER
            .from('gastos')
            .select('monto_total')
            .eq('categoria', 'Gasto')
            .eq('sucursal', sucursal)
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        const gastosOperacion = (gastosOp || []).reduce((sum, g) => sum + (parseFloat(g.monto_total) || 0), 0);
        const utilidadOperacion = utilidadBruta - gastosOperacion;

        // 4. GASTOS FINANCIEROS (categoria = 'Gasto Financiero')
        const { data: gastosFin } = await sbClientER
            .from('gastos')
            .select('monto_total')
            .eq('categoria', 'Gasto Financiero')
            .eq('sucursal', sucursal)
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        const gastosFinancieros = (gastosFin || []).reduce((sum, g) => sum + (parseFloat(g.monto_total) || 0), 0);

        // 5. GASTOS CONTABLES (categoria = 'Gasto Contable')
        const { data: gastosCont } = await sbClientER
            .from('gastos')
            .select('monto_total')
            .eq('categoria', 'Gasto Contable')
            .eq('sucursal', sucursal)
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        const gastosContables = (gastosCont || []).reduce((sum, g) => sum + (parseFloat(g.monto_total) || 0), 0);

        const utilidadNeta = utilidadOperacion - gastosFinancieros - gastosContables;

        return {
            mes,
            anio,
            sucursal,
            ingresosVentas,
            ingresosServicios,
            totalIngresos,
            costoVentas,
            utilidadBruta,
            gastosOperacion,
            utilidadOperacion,
            gastosFinancieros,
            gastosContables,
            utilidadNeta
        };

    } catch (err) {
        console.error('Error calculando estado:', err);
        return null;
    }
}

// =====================================================
// RENDERIZADO
// =====================================================

function generarTarjetaEstado(estado, colorClass = 'border-gray-200') {
    if (!estado) return '<div class="card p-8 text-center text-gray-400 italic">Sin datos disponibles</div>';

    const esPositivo = (val) => val >= 0;

    return `
        <div class="card overflow-hidden ${colorClass}">
            <div class="p-5 border-b border-gray-100 bg-gray-50/50">
                <h4 class="font-extrabold uppercase tracking-widest text-sm text-gray-600">Sucursal ${estado.sucursal}</h4>
                <p class="text-[10px] text-gray-400 font-bold uppercase">${MESES[estado.mes]} ${estado.anio}</p>
            </div>
            <div class="p-5 space-y-4 text-sm">
                <!-- INGRESOS -->
                <div>
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ingresos</p>
                    <div class="statement-row">
                        <span class="text-gray-600">Ventas Directas</span>
                        <span class="font-bold">${formatMoney(estado.ingresosVentas)}</span>
                    </div>
                    <div class="statement-row">
                        <span class="text-gray-600">Servicios</span>
                        <span class="font-bold">${formatMoney(estado.ingresosServicios)}</span>
                    </div>
                    <div class="statement-subtotal flex justify-between">
                        <span class="font-black text-gray-700">= TOTAL INGRESOS</span>
                        <span class="font-black text-emerald-600">${formatMoney(estado.totalIngresos)}</span>
                    </div>
                </div>

                <!-- COSTO DE VENTAS -->
                <div>
                    <div class="statement-row">
                        <span class="text-gray-600">(-) Costo de Ventas</span>
                        <span class="font-bold text-red-500">${formatMoney(-estado.costoVentas)}</span>
                    </div>
                    <div class="statement-subtotal flex justify-between">
                        <span class="font-black text-gray-700">= UTILIDAD BRUTA</span>
                        <span class="font-black ${esPositivo(estado.utilidadBruta) ? 'text-emerald-600' : 'text-red-600'}">${formatMoney(estado.utilidadBruta)}</span>
                    </div>
                </div>

                <!-- GASTOS OPERACIÓN -->
                <div>
                    <div class="statement-row">
                        <span class="text-gray-600">(-) Gastos de Operación</span>
                        <span class="font-bold text-red-500">${formatMoney(-estado.gastosOperacion)}</span>
                    </div>
                    <div class="statement-subtotal flex justify-between">
                        <span class="font-black text-gray-700">= UTILIDAD DE OPERACIÓN</span>
                        <span class="font-black ${esPositivo(estado.utilidadOperacion) ? 'text-emerald-600' : 'text-red-600'}">${formatMoney(estado.utilidadOperacion)}</span>
                    </div>
                </div>

                <!-- OTROS GASTOS -->
                <div>
                    <div class="statement-row">
                        <span class="text-gray-600">(-) Gastos Financieros</span>
                        <span class="font-bold text-orange-500">${formatMoney(-estado.gastosFinancieros)}</span>
                    </div>
                    <div class="statement-row">
                        <span class="text-gray-600">(-) Gastos Contables</span>
                        <span class="font-bold text-purple-500">${formatMoney(-estado.gastosContables)}</span>
                    </div>
                </div>

                <!-- UTILIDAD NETA -->
                <div class="statement-total flex justify-between items-center">
                    <span class="font-black uppercase tracking-wider">= UTILIDAD NETA</span>
                    <span class="text-2xl font-black ${esPositivo(estado.utilidadNeta) ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(estado.utilidadNeta)}</span>
                </div>
            </div>
        </div>
    `;
}

// =====================================================
// CARGA PRINCIPAL
// =====================================================

window.cargarEstadoResultados = async function () {
    anioSeleccionado = parseInt(document.getElementById('filtroAnio')?.value) || new Date().getFullYear();

    // Cargar meses cerrados
    await cargarMesesCerrados();

    // Renderizar tabs de meses
    renderizarTabsMeses();

    // Cargar estado del mes seleccionado
    await cargarEstadoMes(mesSeleccionado);

    // Cargar resumen anual
    await cargarResumenAnual();
}

async function cargarMesesCerrados() {
    if (!sbClientER) return;

    const { data } = await sbClientER
        .from('estados_resultados')
        .select('mes, sucursal')
        .eq('anio', anioSeleccionado)
        .eq('cerrado', true);

    mesesCerrados = data || [];
}

function renderizarTabsMeses() {
    const container = document.getElementById('monthTabs');
    if (!container) return;

    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();

    let html = '<div class="text-xs text-gray-400 font-bold uppercase tracking-widest self-center mr-2">Mes:</div>';

    for (let m = 1; m <= 12; m++) {
        const esMesActual = m === mesActual && anioSeleccionado === anioActual;
        const estaCerrado = mesesCerrados.some(mc => mc.mes === m);
        const esSeleccionado = m === mesSeleccionado;

        let classes = 'month-tab';
        if (esSeleccionado) classes += ' active';
        else if (estaCerrado) classes += ' closed';

        const label = MESES[m].substring(0, 3).toUpperCase();
        const icon = estaCerrado ? '<span class="material-symbols-outlined text-xs align-middle">check_circle</span> ' : '';

        html += `<button class="${classes}" onclick="seleccionarMes(${m})">${icon}${label}</button>`;
    }

    container.innerHTML = html;

    // Mostrar/ocultar botón de cerrar mes
    const btnCerrar = document.getElementById('btnCerrarMes');
    const mesActualSeleccionado = mesSeleccionado === mesActual && anioSeleccionado === anioActual;
    const yaEstaCerrado = mesesCerrados.some(mc => mc.mes === mesSeleccionado);

    if (btnCerrar) {
        btnCerrar.classList.toggle('hidden', !mesActualSeleccionado || yaEstaCerrado);
    }
}

window.seleccionarMes = async function (mes) {
    mesSeleccionado = mes;
    renderizarTabsMeses();
    await cargarEstadoMes(mes);
}

async function cargarEstadoMes(mes) {
    const container = document.getElementById('estadoContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-20 text-gray-400 italic col-span-full">Calculando estado de resultados...</div>';

    // Verificar si el mes está cerrado - cargar desde DB
    const cerradoSur = mesesCerrados.find(mc => mc.mes === mes && mc.sucursal === 'Sur');
    const cerradoNorte = mesesCerrados.find(mc => mc.mes === mes && mc.sucursal === 'Norte');

    let estadoSur, estadoNorte;

    if (cerradoSur || cerradoNorte) {
        // Cargar desde tabla de estados cerrados
        const { data } = await sbClientER
            .from('estados_resultados')
            .select('*')
            .eq('mes', mes)
            .eq('anio', anioSeleccionado);

        const dataSur = data?.find(d => d.sucursal === 'Sur');
        const dataNorte = data?.find(d => d.sucursal === 'Norte');

        if (dataSur) {
            estadoSur = {
                mes: dataSur.mes,
                anio: dataSur.anio,
                sucursal: dataSur.sucursal,
                ingresosVentas: dataSur.ingresos_ventas,
                ingresosServicios: dataSur.ingresos_servicios,
                totalIngresos: dataSur.total_ingresos,
                costoVentas: dataSur.costo_ventas,
                utilidadBruta: dataSur.utilidad_bruta,
                gastosOperacion: dataSur.gastos_operacion,
                utilidadOperacion: dataSur.utilidad_operacion,
                gastosFinancieros: dataSur.gastos_financieros,
                gastosContables: dataSur.gastos_contables,
                utilidadNeta: dataSur.utilidad_neta
            };
        }

        if (dataNorte) {
            estadoNorte = {
                mes: dataNorte.mes,
                anio: dataNorte.anio,
                sucursal: dataNorte.sucursal,
                ingresosVentas: dataNorte.ingresos_ventas,
                ingresosServicios: dataNorte.ingresos_servicios,
                totalIngresos: dataNorte.total_ingresos,
                costoVentas: dataNorte.costo_ventas,
                utilidadBruta: dataNorte.utilidad_bruta,
                gastosOperacion: dataNorte.gastos_operacion,
                utilidadOperacion: dataNorte.utilidad_operacion,
                gastosFinancieros: dataNorte.gastos_financieros,
                gastosContables: dataNorte.gastos_contables,
                utilidadNeta: dataNorte.utilidad_neta
            };
        }
    }

    // Calcular en tiempo real si no está cerrado
    if (!estadoSur) estadoSur = await calcularEstadoMes(mes, anioSeleccionado, 'Sur');
    if (!estadoNorte) estadoNorte = await calcularEstadoMes(mes, anioSeleccionado, 'Norte');

    // Renderizar
    container.innerHTML = `
        <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500"></span> Sucursal Sur
                ${cerradoSur ? '<span class="text-emerald-600 text-[10px]">✓ CERRADO</span>' : '<span class="text-amber-500 text-[10px]">EN VIVO</span>'}
            </h4>
            ${generarTarjetaEstado(estadoSur, 'border-l-4 border-blue-500')}
        </div>
        <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-purple-500"></span> Sucursal Norte
                ${cerradoNorte ? '<span class="text-emerald-600 text-[10px]">✓ CERRADO</span>' : '<span class="text-amber-500 text-[10px]">EN VIVO</span>'}
            </h4>
            ${generarTarjetaEstado(estadoNorte, 'border-l-4 border-purple-500')}
        </div>
    `;
}

// =====================================================
// CIERRE DE MES
// =====================================================

window.cerrarMesActual = function () {
    document.getElementById('modalCerrar')?.classList.remove('hidden');
}

window.cerrarModalCierre = function () {
    document.getElementById('modalCerrar')?.classList.add('hidden');
}

window.confirmarCierreMes = async function () {
    cerrarModalCierre();

    const mes = mesSeleccionado;
    const anio = anioSeleccionado;

    // Calcular estados finales
    const estadoSur = await calcularEstadoMes(mes, anio, 'Sur');
    const estadoNorte = await calcularEstadoMes(mes, anio, 'Norte');

    // Guardar en base de datos
    const guardarEstado = async (estado) => {
        if (!estado) return;

        const payload = {
            mes: estado.mes,
            anio: estado.anio,
            sucursal: estado.sucursal,
            ingresos_ventas: estado.ingresosVentas,
            ingresos_servicios: estado.ingresosServicios,
            total_ingresos: estado.totalIngresos,
            costo_ventas: estado.costoVentas,
            utilidad_bruta: estado.utilidadBruta,
            gastos_operacion: estado.gastosOperacion,
            utilidad_operacion: estado.utilidadOperacion,
            gastos_financieros: estado.gastosFinancieros,
            gastos_contables: estado.gastosContables,
            utilidad_neta: estado.utilidadNeta,
            cerrado: true
        };

        await sbClientER
            .from('estados_resultados')
            .upsert(payload, { onConflict: 'mes,anio,sucursal' });
    };

    await guardarEstado(estadoSur);
    await guardarEstado(estadoNorte);

    alert(`✅ Mes de ${MESES[mes]} ${anio} cerrado exitosamente.`);

    // Recargar
    await cargarEstadoResultados();
}

// =====================================================
// RESUMEN ANUAL
// =====================================================

async function cargarResumenAnual() {
    const container = document.getElementById('resumenAnualContainer');
    if (!container) return;

    // Cargar todos los estados cerrados del año
    const { data } = await sbClientER
        .from('estados_resultados')
        .select('*')
        .eq('anio', anioSeleccionado)
        .eq('cerrado', true);

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-center p-10 text-gray-400 italic col-span-full">No hay meses cerrados para este año</div>';
        return;
    }

    // Acumular por sucursal
    const acumuladoSur = data.filter(d => d.sucursal === 'Sur').reduce((acc, d) => {
        acc.ingresosVentas += parseFloat(d.ingresos_ventas) || 0;
        acc.ingresosServicios += parseFloat(d.ingresos_servicios) || 0;
        acc.totalIngresos += parseFloat(d.total_ingresos) || 0;
        acc.costoVentas += parseFloat(d.costo_ventas) || 0;
        acc.utilidadBruta += parseFloat(d.utilidad_bruta) || 0;
        acc.gastosOperacion += parseFloat(d.gastos_operacion) || 0;
        acc.utilidadOperacion += parseFloat(d.utilidad_operacion) || 0;
        acc.gastosFinancieros += parseFloat(d.gastos_financieros) || 0;
        acc.gastosContables += parseFloat(d.gastos_contables) || 0;
        acc.utilidadNeta += parseFloat(d.utilidad_neta) || 0;
        return acc;
    }, { mes: 0, anio: anioSeleccionado, sucursal: 'Sur', ingresosVentas: 0, ingresosServicios: 0, totalIngresos: 0, costoVentas: 0, utilidadBruta: 0, gastosOperacion: 0, utilidadOperacion: 0, gastosFinancieros: 0, gastosContables: 0, utilidadNeta: 0 });

    const acumuladoNorte = data.filter(d => d.sucursal === 'Norte').reduce((acc, d) => {
        acc.ingresosVentas += parseFloat(d.ingresos_ventas) || 0;
        acc.ingresosServicios += parseFloat(d.ingresos_servicios) || 0;
        acc.totalIngresos += parseFloat(d.total_ingresos) || 0;
        acc.costoVentas += parseFloat(d.costo_ventas) || 0;
        acc.utilidadBruta += parseFloat(d.utilidad_bruta) || 0;
        acc.gastosOperacion += parseFloat(d.gastos_operacion) || 0;
        acc.utilidadOperacion += parseFloat(d.utilidad_operacion) || 0;
        acc.gastosFinancieros += parseFloat(d.gastos_financieros) || 0;
        acc.gastosContables += parseFloat(d.gastos_contables) || 0;
        acc.utilidadNeta += parseFloat(d.utilidad_neta) || 0;
        return acc;
    }, { mes: 0, anio: anioSeleccionado, sucursal: 'Norte', ingresosVentas: 0, ingresosServicios: 0, totalIngresos: 0, costoVentas: 0, utilidadBruta: 0, gastosOperacion: 0, utilidadOperacion: 0, gastosFinancieros: 0, gastosContables: 0, utilidadNeta: 0 });

    // Cambiar mes a "Anual" para display
    acumuladoSur.mes = 0;
    acumuladoNorte.mes = 0;

    const mesesCerradosSur = data.filter(d => d.sucursal === 'Sur').length;
    const mesesCerradosNorte = data.filter(d => d.sucursal === 'Norte').length;

    container.innerHTML = `
        <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500"></span> Sur - Acumulado Anual
                <span class="text-[10px] text-gray-400">(${mesesCerradosSur} meses)</span>
            </h4>
            ${generarTarjetaEstadoAnual(acumuladoSur, 'border-l-4 border-blue-500')}
        </div>
        <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-purple-500"></span> Norte - Acumulado Anual
                <span class="text-[10px] text-gray-400">(${mesesCerradosNorte} meses)</span>
            </h4>
            ${generarTarjetaEstadoAnual(acumuladoNorte, 'border-l-4 border-purple-500')}
        </div>
    `;
}

function generarTarjetaEstadoAnual(estado, colorClass = 'border-gray-200') {
    if (!estado || estado.totalIngresos === 0) return '<div class="card p-8 text-center text-gray-400 italic">Sin datos acumulados</div>';

    const esPositivo = (val) => val >= 0;

    return `
        <div class="card overflow-hidden ${colorClass} bg-gradient-to-br from-slate-50 to-white">
            <div class="p-5 border-b border-gray-100 bg-slate-100/50">
                <h4 class="font-extrabold uppercase tracking-widest text-sm text-gray-700">Sucursal ${estado.sucursal}</h4>
                <p class="text-[10px] text-gray-500 font-bold uppercase">ACUMULADO ${estado.anio}</p>
            </div>
            <div class="p-5 space-y-3 text-sm">
                <div class="flex justify-between py-2 border-b border-gray-100">
                    <span class="text-gray-600 font-medium">Total Ingresos</span>
                    <span class="font-black text-emerald-600">${formatMoney(estado.totalIngresos)}</span>
                </div>
                <div class="flex justify-between py-2 border-b border-gray-100">
                    <span class="text-gray-600 font-medium">Utilidad Bruta</span>
                    <span class="font-bold ${esPositivo(estado.utilidadBruta) ? 'text-emerald-600' : 'text-red-600'}">${formatMoney(estado.utilidadBruta)}</span>
                </div>
                <div class="flex justify-between py-2 border-b border-gray-100">
                    <span class="text-gray-600 font-medium">Utilidad Operación</span>
                    <span class="font-bold ${esPositivo(estado.utilidadOperacion) ? 'text-emerald-600' : 'text-red-600'}">${formatMoney(estado.utilidadOperacion)}</span>
                </div>
                <div class="statement-total flex justify-between items-center mt-4">
                    <span class="font-black uppercase tracking-wider">UTILIDAD NETA ANUAL</span>
                    <span class="text-2xl font-black ${esPositivo(estado.utilidadNeta) ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(estado.utilidadNeta)}</span>
                </div>
            </div>
        </div>
    `;
}
