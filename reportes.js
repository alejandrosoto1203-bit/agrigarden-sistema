// reportes.js - Módulo de Reportes y Métricas por Sucursal
// Dashboard analítico con KPIs, gráficas y comparativos

const SB_URL_REP = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY_REP = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let sbClientRep;
if (window.supabase && window.supabase.createClient) {
    sbClientRep = window.supabase.createClient(SB_URL_REP, SB_KEY_REP);
}

// Chart instances
let chartIngresosDiarios, chartGastosCategoria, chartTendenciaAnual;

// Helpers
const formatMoney = (n) => {
    if (n === undefined || n === null) return "$0.00";
    const absVal = Math.abs(n);
    const formatted = `$${absVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    return n < 0 ? `(${formatted})` : formatted;
};

const formatMoneyShort = (n) => {
    if (n === undefined || n === null) return "$0";
    const absVal = Math.abs(n);
    if (absVal >= 1000000) return `$${(absVal / 1000000).toFixed(1)}M`;
    if (absVal >= 1000) return `$${(absVal / 1000).toFixed(1)}K`;
    return `$${absVal.toFixed(0)}`;
};

// =====================================================
// CARGA PRINCIPAL
// =====================================================

window.cargarReportes = async function () {
    const mes = parseInt(document.getElementById('filtroMes')?.value) || (new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('filtroAnio')?.value) || new Date().getFullYear();

    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0, 23, 59, 59);

    try {
        // Cargar todos los datos en paralelo
        const [ingresos, gastos, inventario, cuentasCobrar] = await Promise.all([
            sbClientRep.from('transacciones').select('*').gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString()),
            sbClientRep.from('gastos').select('*').gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString()),
            sbClientRep.from('inventario_mensual').select('*').eq('mes', mes).eq('anio', anio),
            sbClientRep.from('transacciones').select('*').eq('estado_pago', 'Pendiente')
        ]);

        const datosIngresos = ingresos.data || [];
        const datosGastos = (gastos.data || []).filter(g => g.categoria !== 'Pago de Pasivo');
        const datosInventario = inventario.data || [];
        const datosCxC = cuentasCobrar.data || [];

        // Función para excluir abonos y rentas
        const esExcluido = (i) => i.tipo === 'ABONO' || i.categoria === 'COBRANZA' || (i.categoria && i.categoria.toUpperCase().includes('RENTA'));

        // Separar por sucursal (solo ventas, excluyendo abonos y rentas)
        const ingresosSur = datosIngresos.filter(i => i.sucursal === 'Sur' && !esExcluido(i));
        const ingresosNorte = datosIngresos.filter(i => i.sucursal === 'Norte' && !esExcluido(i));
        const gastosSur = datosGastos.filter(g => g.sucursal === 'Sur');
        const gastosNorte = datosGastos.filter(g => g.sucursal === 'Norte');
        const invSur = datosInventario.find(i => i.sucursal === 'Sur');
        const invNorte = datosInventario.find(i => i.sucursal === 'Norte');
        const cxcSur = datosCxC.filter(c => c.sucursal === 'Sur');
        const cxcNorte = datosCxC.filter(c => c.sucursal === 'Norte');

        // Calcular totales
        const totalIngresosSur = ingresosSur.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
        const totalIngresosNorte = ingresosNorte.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
        const totalGastosSur = gastosSur.reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const totalGastosNorte = gastosNorte.reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        // Calcular costo de ventas
        const comprasMercSur = gastosSur.filter(g => (g.subcategoria || '').toLowerCase() === 'mercancia').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const comprasMercNorte = gastosNorte.filter(g => (g.subcategoria || '').toLowerCase() === 'mercancia').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        const costoVentasSur = (invSur?.monto_inicial || 0) + comprasMercSur - (invSur?.monto_final || 0);
        const costoVentasNorte = (invNorte?.monto_inicial || 0) + comprasMercNorte - (invNorte?.monto_final || 0);

        // Gastos operación (categoria = 'Gasto')
        const gastosOpSur = gastosSur.filter(g => g.categoria === 'Gasto').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const gastosOpNorte = gastosNorte.filter(g => g.categoria === 'Gasto').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        // Utilidades
        const utilidadBrutaSur = totalIngresosSur - costoVentasSur;
        const utilidadBrutaNorte = totalIngresosNorte - costoVentasNorte;
        const utilidadNetaSur = utilidadBrutaSur - gastosOpSur - gastosSur.filter(g => g.categoria === 'Gasto Financiero' || g.categoria === 'Gasto Contable').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const utilidadNetaNorte = utilidadBrutaNorte - gastosOpNorte - gastosNorte.filter(g => g.categoria === 'Gasto Financiero' || g.categoria === 'Gasto Contable').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        // Margen bruto
        const margenSur = totalIngresosSur > 0 ? ((utilidadBrutaSur / totalIngresosSur) * 100).toFixed(1) : 0;
        const margenNorte = totalIngresosNorte > 0 ? ((utilidadBrutaNorte / totalIngresosNorte) * 100).toFixed(1) : 0;

        // CxC
        const totalCxCSur = cxcSur.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
        const totalCxCNorte = cxcNorte.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);

        // =====================================================
        // ACTUALIZAR KPIs COMPARATIVOS
        // =====================================================
        document.getElementById('kpiIngresosSur').textContent = formatMoneyShort(totalIngresosSur);
        document.getElementById('kpiIngresosNorte').textContent = formatMoneyShort(totalIngresosNorte);
        document.getElementById('kpiGastosSur').textContent = formatMoneyShort(totalGastosSur);
        document.getElementById('kpiGastosNorte').textContent = formatMoneyShort(totalGastosNorte);
        document.getElementById('kpiMargenSur').textContent = `${margenSur}%`;
        document.getElementById('kpiMargenNorte').textContent = `${margenNorte}%`;

        const utilSurEl = document.getElementById('kpiUtilidadSur');
        const utilNorteEl = document.getElementById('kpiUtilidadNorte');
        utilSurEl.textContent = formatMoneyShort(utilidadNetaSur);
        utilNorteEl.textContent = formatMoneyShort(utilidadNetaNorte);
        utilSurEl.className = `text-xl font-extrabold mt-2 ${utilidadNetaSur >= 0 ? 'text-emerald-600' : 'text-red-600'}`;
        utilNorteEl.className = `text-xl font-extrabold mt-2 ${utilidadNetaNorte >= 0 ? 'text-emerald-600' : 'text-red-600'}`;

        // =====================================================
        // MÉTRICAS DETALLADAS
        // =====================================================

        // Sur
        document.getElementById('metricTransaccionesSur').textContent = ingresosSur.length;
        document.getElementById('metricTicketSur').textContent = formatMoney(ingresosSur.length > 0 ? totalIngresosSur / ingresosSur.length : 0);
        document.getElementById('metricCostoVentasSur').textContent = formatMoney(costoVentasSur);
        document.getElementById('metricGastosOpSur').textContent = formatMoney(gastosOpSur);
        document.getElementById('metricCxCSur').textContent = formatMoney(totalCxCSur);
        document.getElementById('metricInventarioSur').textContent = formatMoney(invSur?.monto_final || 0);

        // Norte
        document.getElementById('metricTransaccionesNorte').textContent = ingresosNorte.length;
        document.getElementById('metricTicketNorte').textContent = formatMoney(ingresosNorte.length > 0 ? totalIngresosNorte / ingresosNorte.length : 0);
        document.getElementById('metricCostoVentasNorte').textContent = formatMoney(costoVentasNorte);
        document.getElementById('metricGastosOpNorte').textContent = formatMoney(gastosOpNorte);
        document.getElementById('metricCxCNorte').textContent = formatMoney(totalCxCNorte);
        document.getElementById('metricInventarioNorte').textContent = formatMoney(invNorte?.monto_final || 0);

        // =====================================================
        // TOP GASTOS POR SUBCATEGORÍA
        // =====================================================
        renderizarTopGastos('topGastosSur', gastosSur);
        renderizarTopGastos('topGastosNorte', gastosNorte);

        // =====================================================
        // GRÁFICAS
        // =====================================================

        // Gráfica de ingresos diarios
        renderizarGraficaIngresosDiarios(datosIngresos, mes, anio);

        // Gráfica de gastos por categoría
        renderizarGraficaGastosCategoria(datosGastos);

        // Gráfica tendencia anual
        await renderizarGraficaTendenciaAnual(anio);

    } catch (err) {
        console.error('Error cargando reportes:', err);
    }
}

// =====================================================
// RENDERIZADO DE TOP GASTOS
// =====================================================

function renderizarTopGastos(containerId, gastos) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Agrupar por subcategoría
    const porSubcat = gastos.reduce((acc, g) => {
        const sub = g.subcategoria || 'OTROS';
        acc[sub] = (acc[sub] || 0) + (parseFloat(g.monto_total) || 0);
        return acc;
    }, {});

    // Ordenar y tomar top 5
    const sorted = Object.entries(porSubcat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-xs italic">Sin gastos registrados</p>';
        return;
    }

    const maxVal = sorted[0][1];

    container.innerHTML = sorted.map(([subcat, monto]) => {
        const pct = maxVal > 0 ? (monto / maxVal) * 100 : 0;
        return `
            <div class="space-y-1">
                <div class="flex justify-between text-xs">
                    <span class="text-gray-600 font-medium truncate max-w-[150px]">${subcat}</span>
                    <span class="font-bold text-gray-800">${formatMoney(monto)}</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// =====================================================
// GRÁFICAS CON CHART.JS
// =====================================================

function renderizarGraficaIngresosDiarios(ingresos, mes, anio) {
    const ctx = document.getElementById('chartIngresosDiarios');
    if (!ctx) return;

    // Destruir gráfica anterior si existe
    if (chartIngresosDiarios) chartIngresosDiarios.destroy();

    // Agrupar por día y sucursal (excluyendo abonos y rentas)
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const datosSur = new Array(diasEnMes).fill(0);
    const datosNorte = new Array(diasEnMes).fill(0);

    // Función para excluir abonos y rentas
    const esExcluido = (i) => i.tipo === 'ABONO' || i.categoria === 'COBRANZA' || (i.categoria && i.categoria.toUpperCase().includes('RENTA'));

    ingresos.filter(i => !esExcluido(i)).forEach(i => {
        const dia = new Date(i.created_at).getDate() - 1;
        const monto = parseFloat(i.monto) || 0;
        if (i.sucursal === 'Sur') datosSur[dia] += monto;
        if (i.sucursal === 'Norte') datosNorte[dia] += monto;
    });

    const labels = Array.from({ length: diasEnMes }, (_, i) => i + 1);

    chartIngresosDiarios = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Sur',
                    data: datosSur,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                },
                {
                    label: 'Norte',
                    data: datosNorte,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' } } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: val => formatMoneyShort(val),
                        font: { size: 10 }
                    }
                },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

function renderizarGraficaGastosCategoria(gastos) {
    const ctx = document.getElementById('chartGastosCategoria');
    if (!ctx) return;

    if (chartGastosCategoria) chartGastosCategoria.destroy();

    // Agrupar por categoría
    const porCategoria = gastos.reduce((acc, g) => {
        const cat = g.categoria || 'Otros';
        acc[cat] = (acc[cat] || 0) + (parseFloat(g.monto_total) || 0);
        return acc;
    }, {});

    const labels = Object.keys(porCategoria);
    const data = Object.values(porCategoria);
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'];

    chartGastosCategoria = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 10, weight: 'bold' }, padding: 10 }
                }
            }
        }
    });
}

async function renderizarGraficaTendenciaAnual(anio) {
    const ctx = document.getElementById('chartTendenciaAnual');
    if (!ctx) return;

    if (chartTendenciaAnual) chartTendenciaAnual.destroy();

    // Obtener datos de todo el año
    const primerDia = new Date(anio, 0, 1);
    const ultimoDia = new Date(anio, 11, 31, 23, 59, 59);

    const [ingresos, gastos] = await Promise.all([
        sbClientRep.from('transacciones').select('sucursal, monto, created_at').gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString()),
        sbClientRep.from('gastos').select('sucursal, monto_total, created_at, categoria').gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString())
    ]);

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const ingresosSurMes = new Array(12).fill(0);
    const ingresosNorteMes = new Array(12).fill(0);
    const gastosSurMes = new Array(12).fill(0);
    const gastosNorteMes = new Array(12).fill(0);

    // Función para excluir abonos y rentas
    const esExcluido = (i) => i.tipo === 'ABONO' || i.categoria === 'COBRANZA' || (i.categoria && i.categoria.toUpperCase().includes('RENTA'));

    (ingresos.data || []).filter(i => !esExcluido(i)).forEach(i => {
        const m = new Date(i.created_at).getMonth();
        const monto = parseFloat(i.monto) || 0;
        if (i.sucursal === 'Sur') ingresosSurMes[m] += monto;
        if (i.sucursal === 'Norte') ingresosNorteMes[m] += monto;
    });

    (gastos.data || []).filter(g => g.categoria !== 'Pago de Pasivo').forEach(g => {
        const m = new Date(g.created_at).getMonth();
        const monto = parseFloat(g.monto_total) || 0;
        if (g.sucursal === 'Sur') gastosSurMes[m] += monto;
        if (g.sucursal === 'Norte') gastosNorteMes[m] += monto;
    });

    chartTendenciaAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Ingresos Sur',
                    data: ingresosSurMes,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    stack: 'sur'
                },
                {
                    label: 'Gastos Sur',
                    data: gastosSurMes.map(v => -v),
                    backgroundColor: 'rgba(59, 130, 246, 0.3)',
                    stack: 'sur'
                },
                {
                    label: 'Ingresos Norte',
                    data: ingresosNorteMes,
                    backgroundColor: 'rgba(139, 92, 246, 0.8)',
                    stack: 'norte'
                },
                {
                    label: 'Gastos Norte',
                    data: gastosNorteMes.map(v => -v),
                    backgroundColor: 'rgba(139, 92, 246, 0.3)',
                    stack: 'norte'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' } } }
            },
            scales: {
                y: {
                    ticks: {
                        callback: val => formatMoneyShort(Math.abs(val)),
                        font: { size: 10 }
                    }
                },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}
