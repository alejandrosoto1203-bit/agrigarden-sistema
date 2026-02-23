// reportes.js - Módulo de Reportes y Métricas por Sucursal

const SB_URL_REP = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY_REP = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let sbClientRep;
if (window.supabase && window.supabase.createClient) {
    sbClientRep = window.supabase.createClient(SB_URL_REP, SB_KEY_REP);
}

// Chart instances
let chartIngresosDiarios, chartGastosCategoria, chartTendenciaAnual;

// ── HELPERS ──────────────────────────────────────────────────────────────────

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

// Excluir abonos y rentas de las ventas reales
const esExcluido = (i) =>
    i.tipo === 'ABONO' || i.categoria === 'COBRANZA' ||
    (i.categoria && i.categoria.toUpperCase().includes('RENTA'));

// Fetch helper (Raw REST, consistent with cobranza.js pattern)
async function repFetch(endpoint) {
    const res = await fetch(`${SB_URL_REP}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': SB_KEY_REP,
            'Authorization': `Bearer ${SB_KEY_REP}`,
            'Content-Type': 'application/json'
        }
    });
    return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

window.cargarReportes = async function () {
    const mes = parseInt(document.getElementById('filtroMes')?.value) || (new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('filtroAnio')?.value) || new Date().getFullYear();

    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0, 23, 59, 59);

    try {
        const [ingresos, gastos, inventario, cuentasCobrar] = await Promise.all([
            sbClientRep.from('transacciones').select('*')
                .gte('created_at', primerDia.toISOString())
                .lte('created_at', ultimoDia.toISOString()),
            sbClientRep.from('gastos').select('*')
                .gte('created_at', primerDia.toISOString())
                .lte('created_at', ultimoDia.toISOString()),
            sbClientRep.from('inventario_mensual').select('*').eq('mes', mes).eq('anio', anio),
            sbClientRep.from('transacciones').select('*').eq('estado_cobro', 'Pendiente')
        ]);

        const datosIngresos = ingresos.data || [];
        const datosGastos = (gastos.data || []).filter(g => g.categoria !== 'Pago de Pasivo');
        const datosInventario = inventario.data || [];
        const datosCxC = cuentasCobrar.data || [];

        // Separar por sucursal
        const ingresosSur = datosIngresos.filter(i => i.sucursal === 'Sur' && !esExcluido(i));
        const ingresosNorte = datosIngresos.filter(i => i.sucursal === 'Norte' && !esExcluido(i));
        const gastosSur = datosGastos.filter(g => g.sucursal === 'Sur');
        const gastosNorte = datosGastos.filter(g => g.sucursal === 'Norte');
        const invSur = datosInventario.find(i => i.sucursal === 'Sur');
        const invNorte = datosInventario.find(i => i.sucursal === 'Norte');
        const cxcSur = datosCxC.filter(c => c.sucursal === 'Sur');
        const cxcNorte = datosCxC.filter(c => c.sucursal === 'Norte');

        // Totales
        const totalIngresosSur = ingresosSur.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
        const totalIngresosNorte = ingresosNorte.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
        const totalGastosSur = gastosSur.reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const totalGastosNorte = gastosNorte.reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        // Costo de ventas
        const compMercSur = gastosSur.filter(g => (g.subcategoria || '').toLowerCase() === 'mercancia').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const compMercNorte = gastosNorte.filter(g => (g.subcategoria || '').toLowerCase() === 'mercancia').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const costoVentasSur = (invSur?.monto_inicial || 0) + compMercSur - (invSur?.monto_final || 0);
        const costoVentasNorte = (invNorte?.monto_inicial || 0) + compMercNorte - (invNorte?.monto_final || 0);

        // Gastos operación
        const gastosOpSur = gastosSur.filter(g => g.categoria === 'Gasto').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);
        const gastosOpNorte = gastosNorte.filter(g => g.categoria === 'Gasto').reduce((s, g) => s + (parseFloat(g.monto_total) || 0), 0);

        // CxC
        const totalCxCSur = cxcSur.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
        const totalCxCNorte = cxcNorte.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);

        // ── KPIs COMPARATIVOS ──────────────────────────────────────────────
        document.getElementById('kpiIngresosSur').textContent = formatMoneyShort(totalIngresosSur);
        document.getElementById('kpiIngresosNorte').textContent = formatMoneyShort(totalIngresosNorte);
        document.getElementById('kpiGastosSur').textContent = formatMoneyShort(totalGastosSur);
        document.getElementById('kpiGastosNorte').textContent = formatMoneyShort(totalGastosNorte);

        // ── MÉTRICAS DETALLADAS ────────────────────────────────────────────
        document.getElementById('metricTransaccionesSur').textContent = ingresosSur.length;
        document.getElementById('metricTicketSur').textContent = formatMoney(ingresosSur.length > 0 ? totalIngresosSur / ingresosSur.length : 0);
        document.getElementById('metricCostoVentasSur').textContent = formatMoney(costoVentasSur);
        document.getElementById('metricGastosOpSur').textContent = formatMoney(gastosOpSur);
        document.getElementById('metricCxCSur').textContent = formatMoney(totalCxCSur);

        document.getElementById('metricTransaccionesNorte').textContent = ingresosNorte.length;
        document.getElementById('metricTicketNorte').textContent = formatMoney(ingresosNorte.length > 0 ? totalIngresosNorte / ingresosNorte.length : 0);
        document.getElementById('metricCostoVentasNorte').textContent = formatMoney(costoVentasNorte);
        document.getElementById('metricGastosOpNorte').textContent = formatMoney(gastosOpNorte);
        document.getElementById('metricCxCNorte').textContent = formatMoney(totalCxCNorte);

        // ── TOP GASTOS ─────────────────────────────────────────────────────
        renderizarTopGastos('topGastosSur', gastosSur);
        renderizarTopGastos('topGastosNorte', gastosNorte);

        // ── GRÁFICAS ───────────────────────────────────────────────────────
        renderizarGraficaIngresosDiarios(datosIngresos, mes, anio);
        renderizarGraficaGastosCategoria(datosGastos);
        await renderizarGraficaTendenciaAnual(anio);

        // ── NUEVOS KPIs (en paralelo, independientes) ─────────────────────
        cargarKpiCxP();
        cargarKpiAvanceVentas(mes, anio, totalIngresosSur, totalIngresosNorte);
        cargarKpiVsAnterior(mes, anio);

    } catch (err) {
        console.error('Error cargando reportes:', err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// NUEVO KPI 1: CUENTAS POR PAGAR
// ─────────────────────────────────────────────────────────────────────────────

async function cargarKpiCxP() {
    try {
        const datos = await repFetch(`gastos?metodo_pago=eq.Cr%C3%A9dito&estado_pago=neq.Pagado&select=saldo_pendiente,monto_total,sucursal`);
        const calcSaldo = (g) => parseFloat(g.saldo_pendiente !== null ? g.saldo_pendiente : g.monto_total) || 0;
        const totalSur = (datos || []).filter(g => g.sucursal === 'Sur').reduce((s, g) => s + calcSaldo(g), 0);
        const totalNorte = (datos || []).filter(g => g.sucursal === 'Norte').reduce((s, g) => s + calcSaldo(g), 0);
        document.getElementById('kpiCxPSur').textContent = formatMoneyShort(totalSur);
        document.getElementById('kpiCxPNorte').textContent = formatMoneyShort(totalNorte);
    } catch (e) {
        console.error('Error CxP:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// NUEVO KPI 2: AVANCE DE VENTAS VS META
// ─────────────────────────────────────────────────────────────────────────────

async function cargarKpiAvanceVentas(mes, anio, ventasSur, ventasNorte) {
    try {
        const metas = await repFetch(`sys_metas_ingresos?anio=eq.${anio}&mes=eq.${mes}&select=sucursal,monto_meta`);
        const metaSur = parseFloat((metas || []).find(m => m.sucursal === 'Sur')?.monto_meta || 0);
        const metaNorte = parseFloat((metas || []).find(m => m.sucursal === 'Norte')?.monto_meta || 0);

        const calcPct = (ventas, meta) => meta > 0 ? Math.min((ventas / meta) * 100, 999).toFixed(1) : '0.0';
        const barColor = (pct) => pct >= 100 ? '#10b981' : pct >= 70 ? '#3b82f6' : '#f59e0b';

        // Sur
        const pctSur = parseFloat(calcPct(ventasSur, metaSur));
        document.getElementById('kpiAvancePctSur').textContent = `${pctSur.toFixed(1)}%`;
        document.getElementById('kpiAvanceBarSur').style.width = `${Math.min(pctSur, 100)}%`;
        document.getElementById('kpiAvanceBarSur').style.background = barColor(pctSur);

        // Norte
        const pctNorte = parseFloat(calcPct(ventasNorte, metaNorte));
        document.getElementById('kpiAvancePctNorte').textContent = `${pctNorte.toFixed(1)}%`;
        document.getElementById('kpiAvanceBarNorte').style.width = `${Math.min(pctNorte, 100)}%`;
        document.getElementById('kpiAvanceBarNorte').style.background = barColor(pctNorte);

        document.getElementById('kpiAvanceDetalle').textContent =
            `Meta Sur: ${formatMoneyShort(metaSur)} · Norte: ${formatMoneyShort(metaNorte)}`;
    } catch (e) {
        console.error('Error avance ventas:', e);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// NUEVO KPI 3: VENTAS VS MES ANTERIOR (HASTA MISMA FECHA)
// ─────────────────────────────────────────────────────────────────────────────

async function cargarKpiVsAnterior(mes, anio) {
    try {
        const hoy = new Date();
        const diaHoy = hoy.getDate();

        const inicioActual = new Date(anio, mes - 1, 1);
        const finActual = new Date(anio, mes - 1, diaHoy, 23, 59, 59);

        const mesAnt = mes === 1 ? 12 : mes - 1;
        const anioAnt = mes === 1 ? anio - 1 : anio;
        const diasEnMesAnt = new Date(anioAnt, mesAnt, 0).getDate();
        const diaComp = Math.min(diaHoy, diasEnMesAnt);
        const inicioAnt = new Date(anioAnt, mesAnt - 1, 1);
        const finAnt = new Date(anioAnt, mesAnt - 1, diaComp, 23, 59, 59);

        const [rawActual, rawAnterior] = await Promise.all([
            sbClientRep.from('transacciones').select('monto,tipo,categoria,sucursal')
                .gte('created_at', inicioActual.toISOString())
                .lte('created_at', finActual.toISOString()),
            sbClientRep.from('transacciones').select('monto,tipo,categoria,sucursal')
                .gte('created_at', inicioAnt.toISOString())
                .lte('created_at', finAnt.toISOString())
        ]);

        const datosActual = (rawActual.data || []).filter(i => !esExcluido(i));
        const datosAnterior = (rawAnterior.data || []).filter(i => !esExcluido(i));

        const sum = (arr, suc) => arr.filter(i => i.sucursal === suc).reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);

        const actSur = sum(datosActual, 'Sur');
        const actNorte = sum(datosActual, 'Norte');
        const antSur = sum(datosAnterior, 'Sur');
        const antNorte = sum(datosAnterior, 'Norte');

        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        // Ventas actuales
        document.getElementById('kpiVentasActualSur').textContent = formatMoneyShort(actSur);
        document.getElementById('kpiVentasActualNorte').textContent = formatMoneyShort(actNorte);
        document.getElementById('kpiVentasActualFecha').textContent = `Del 1 al ${diaHoy} de ${mesesNombres[mes - 1]}`;

        // Ventas anteriores
        document.getElementById('kpiVentasAnteriorSur').textContent = formatMoneyShort(antSur);
        document.getElementById('kpiVentasAnteriorNorte').textContent = formatMoneyShort(antNorte);
        document.getElementById('kpiVentasAnteriorLabel').textContent = `Del 1 al ${diaComp} de ${mesesNombres[mesAnt - 1]}`;

        // Diferencia helper
        const applyDif = (sufijo, actual, anterior) => {
            const dif = actual - anterior;
            const pct = anterior > 0 ? ((dif / anterior) * 100).toFixed(1) : null;
            const el = document.getElementById(`kpiDifVentas${sufijo}`);
            const icon = document.getElementById(`kpiDifIcon${sufijo}`);
            const pctEl = document.getElementById(`kpiDifPct${sufijo}`);

            el.textContent = formatMoneyShort(Math.abs(dif));
            if (dif > 0) {
                el.className = 'text-lg font-extrabold text-emerald-600';
                icon.textContent = 'trending_up';
                icon.className = 'material-symbols-outlined text-sm text-emerald-500';
            } else if (dif < 0) {
                el.className = 'text-lg font-extrabold text-red-600';
                icon.textContent = 'trending_down';
                icon.className = 'material-symbols-outlined text-sm text-red-500';
            } else {
                el.className = 'text-lg font-extrabold text-gray-600';
                icon.textContent = 'remove';
                icon.className = 'material-symbols-outlined text-sm text-gray-400';
            }
            pctEl.textContent = pct !== null
                ? `${dif >= 0 ? '+' : ''}${pct}% vs ant.`
                : 'Sin datos';
        };

        applyDif('Sur', actSur, antSur);
        applyDif('Norte', actNorte, antNorte);

    } catch (e) {
        console.error('Error vs anterior:', e);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// COBRANZA POR MES (solo meses con < 100% recuperado)
// ─────────────────────────────────────────────────────────────────────────────

window.cargarCobranzaPorMes = async function () {
    const seccion = document.getElementById('seccionCobranzaMeses');
    const filtroSuc = document.getElementById('filtroCobranzaSucursal')?.value || 'Todos';
    seccion.innerHTML = `<p class="text-gray-400 italic text-sm col-span-full text-center py-6">Cargando...</p>`;

    try {
        // Todos los créditos, sin límite de fecha — para ver el estado histórico por mes
        let endpoint = `transacciones?metodo_pago=ilike.Cr%25dito*&order=created_at.asc&select=id,created_at,monto,saldo_pendiente,estado_cobro,sucursal`;
        const datos = await repFetch(endpoint);

        // Filtrar por sucursal
        const filtrados = (datos || []).filter(i =>
            filtroSuc === 'Todos' || i.sucursal === filtroSuc
        );

        // Agrupar por año-mes
        const porMes = {};
        filtrados.forEach(item => {
            const d = new Date(item.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!porMes[key]) porMes[key] = [];
            porMes[key].push(item);
        });

        // Calcular métricas por mes y filtrar solo los < 100%
        const mesesIncompletos = Object.entries(porMes)
            .map(([key, items]) => {
                const [anioStr, mesStr] = key.split('-');
                const otorgado = items.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
                const recuperado = items.reduce((s, i) => {
                    const saldo = i.saldo_pendiente !== null ? i.saldo_pendiente : i.monto;
                    return s + Math.max(0, (parseFloat(i.monto) || 0) - (parseFloat(saldo) || 0));
                }, 0);
                const pendiente = otorgado - recuperado;
                const pctRec = otorgado > 0 ? (recuperado / otorgado) * 100 : 0;
                const numCreditos = items.length;
                const pagados = items.filter(i => i.estado_cobro === 'Pagado').length;
                const faltantes = numCreditos - pagados;

                return { key, anio: anioStr, mes: mesStr, otorgado, recuperado, pendiente, pctRec, numCreditos, pagados, faltantes };
            })
            .filter(m => m.pctRec < 100)
            .sort((a, b) => a.key.localeCompare(b.key));

        if (!mesesIncompletos.length) {
            seccion.innerHTML = `<div class="col-span-full card p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-emerald-400 block mb-2">task_alt</span>
                <p class="font-black text-gray-700">¡Cobranza al 100%!</p>
                <p class="text-sm text-gray-400">Todos los meses tienen recuperación completa.</p>
            </div>`;
            return;
        }

        const mesesNombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        seccion.innerHTML = mesesIncompletos.map(m => {
            const pctDisplay = m.pctRec.toFixed(1);
            const barColor = m.pctRec >= 80 ? '#10b981' : m.pctRec >= 50 ? '#f59e0b' : '#ef4444';
            return `
            <div class="card p-5">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="text-xs font-black text-gray-800 uppercase">${mesesNombres[parseInt(m.mes)]} ${m.anio}</p>
                        <p class="text-[10px] text-gray-400 font-bold">${m.numCreditos} crédito${m.numCreditos !== 1 ? 's' : ''} otorgado${m.numCreditos !== 1 ? 's' : ''}</p>
                    </div>
                    <span class="text-lg font-extrabold" style="color:${barColor}">${pctDisplay}%</span>
                </div>

                <div class="progress-bar mb-4">
                    <div class="progress-fill" style="width:${m.pctRec}%;background:${barColor}"></div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    <div class="bg-gray-50 rounded-lg p-2">
                        <p class="text-gray-400 font-bold">Otorgado</p>
                        <p class="font-extrabold text-gray-800 text-xs">${formatMoneyShort(m.otorgado)}</p>
                    </div>
                    <div class="bg-emerald-50 rounded-lg p-2">
                        <p class="text-emerald-500 font-bold">Recuperado</p>
                        <p class="font-extrabold text-emerald-700 text-xs">${formatMoneyShort(m.recuperado)}</p>
                    </div>
                    <div class="bg-red-50 rounded-lg p-2">
                        <p class="text-red-400 font-bold">Pendiente</p>
                        <p class="font-extrabold text-red-600 text-xs">${formatMoneyShort(m.pendiente)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-2">
                        <p class="text-gray-400 font-bold">Pagados / Total</p>
                        <p class="font-extrabold text-gray-800 text-xs">${m.pagados} / ${m.numCreditos}</p>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('Error cobranza por mes:', e);
        seccion.innerHTML = `<p class="col-span-full text-red-500 text-sm text-center py-4">Error al cargar cobranza: ${e.message}</p>`;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DETALLE DE CRÉDITOS
// ─────────────────────────────────────────────────────────────────────────────

window.cargarDetalleCreditos = async function () {
    const tbody = document.getElementById('tablaDetalleCreditos');
    const resumen = document.getElementById('resumenCreditos');
    const filtroSuc = document.getElementById('filtroCredSucursal')?.value || 'Todos';
    const filtroEst = document.getElementById('filtroCredEstado')?.value || 'Pendiente';

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400 italic text-sm">Cargando créditos...</td></tr>`;

    try {
        let endpoint = `transacciones?metodo_pago=ilike.Cr%25dito*&order=created_at.desc`;
        if (filtroEst === 'Pendiente') endpoint += `&estado_cobro=neq.Pagado`;
        if (filtroSuc !== 'Todos') endpoint += `&sucursal=eq.${filtroSuc}`;

        const datos = await repFetch(endpoint);

        if (!datos || !datos.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400 italic text-sm">No hay créditos con los filtros seleccionados.</td></tr>`;
            resumen.classList.add('hidden');
            return;
        }

        let sumTotal = 0, sumRecuperado = 0, sumPendiente = 0;

        tbody.innerHTML = datos.map(item => {
            const monto = parseFloat(item.monto) || 0;
            const saldo = item.saldo_pendiente !== null ? parseFloat(item.saldo_pendiente) : monto;
            const recuperado = Math.max(0, monto - saldo);
            const pct = monto > 0 ? (recuperado / monto) * 100 : 0;
            const barColor = pct >= 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#ef4444';
            const estadoBadge = item.estado_cobro === 'Pagado'
                ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">Pagado</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">Pendiente</span>`;

            sumTotal += monto;
            sumRecuperado += recuperado;
            sumPendiente += saldo;

            const fecha = new Date(item.created_at).toLocaleDateString('es-MX');

            return `
            <tr class="credito-row">
                <td class="px-5 py-3 text-xs text-gray-500">${fecha}</td>
                <td class="px-5 py-3">
                    <p class="text-xs font-black text-gray-800 uppercase">${item.nombre_cliente || '—'}</p>
                    <p class="text-[10px] text-gray-400">${item.categoria || ''}</p>
                </td>
                <td class="px-5 py-3 text-center">
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full
                        ${item.sucursal === 'Norte' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}">
                        ${item.sucursal || '—'}
                    </span>
                </td>
                <td class="px-5 py-3 text-right text-xs font-bold text-gray-600">${formatMoney(monto)}</td>
                <td class="px-5 py-3 text-right text-xs font-black text-emerald-600">${formatMoney(recuperado)}</td>
                <td class="px-5 py-3 text-right text-xs font-black text-red-500">${formatMoney(saldo)}</td>
                <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                        <div class="progress-bar flex-1" style="height:6px">
                            <div class="progress-fill" style="width:${Math.min(pct, 100)}%;background:${barColor}"></div>
                        </div>
                        <span class="text-[10px] font-black w-9 text-right" style="color:${barColor}">${pct.toFixed(0)}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Resumen footer
        const pctTotal = sumTotal > 0 ? ((sumRecuperado / sumTotal) * 100).toFixed(1) : 0;
        document.getElementById('resumenTotal').textContent = formatMoney(sumTotal);
        document.getElementById('resumenRecuperado').textContent = formatMoney(sumRecuperado);
        document.getElementById('resumenPendiente').textContent = formatMoney(sumPendiente);
        document.getElementById('resumenPct').textContent = `${pctTotal}%`;
        resumen.classList.remove('hidden');

    } catch (e) {
        console.error('Error detalle créditos:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500 font-bold text-sm">Error: ${e.message}</td></tr>`;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO DE TOP GASTOS
// ─────────────────────────────────────────────────────────────────────────────

function renderizarTopGastos(containerId, gastos) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const porSubcat = gastos.reduce((acc, g) => {
        const sub = g.subcategoria || 'OTROS';
        acc[sub] = (acc[sub] || 0) + (parseFloat(g.monto_total) || 0);
        return acc;
    }, {});

    const sorted = Object.entries(porSubcat).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (!sorted.length) {
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
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// GRÁFICAS
// ─────────────────────────────────────────────────────────────────────────────

function renderizarGraficaIngresosDiarios(ingresos, mes, anio) {
    const ctx = document.getElementById('chartIngresosDiarios');
    if (!ctx) return;
    if (chartIngresosDiarios) chartIngresosDiarios.destroy();

    const diasEnMes = new Date(anio, mes, 0).getDate();
    const datosSur = new Array(diasEnMes).fill(0);
    const datosNorte = new Array(diasEnMes).fill(0);

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
                { label: 'Sur', data: datosSur, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 2 },
                { label: 'Norte', data: datosNorte, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.4, pointRadius: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' } } } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => formatMoneyShort(v), font: { size: 10 } } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

function renderizarGraficaGastosCategoria(gastos) {
    const ctx = document.getElementById('chartGastosCategoria');
    if (!ctx) return;
    if (chartGastosCategoria) chartGastosCategoria.destroy();

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
        data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { font: { size: 10, weight: 'bold' }, padding: 10 } } }
        }
    });
}

async function renderizarGraficaTendenciaAnual(anio) {
    const ctx = document.getElementById('chartTendenciaAnual');
    if (!ctx) return;
    if (chartTendenciaAnual) chartTendenciaAnual.destroy();

    const primerDia = new Date(anio, 0, 1);
    const ultimoDia = new Date(anio, 11, 31, 23, 59, 59);

    const [ingresos, gastos] = await Promise.all([
        sbClientRep.from('transacciones').select('sucursal,monto,created_at,tipo,categoria')
            .gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString()),
        sbClientRep.from('gastos').select('sucursal,monto_total,created_at,categoria')
            .gte('created_at', primerDia.toISOString()).lte('created_at', ultimoDia.toISOString())
    ]);

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresosSurMes = new Array(12).fill(0);
    const ingresosNorteMes = new Array(12).fill(0);
    const gastosSurMes = new Array(12).fill(0);
    const gastosNorteMes = new Array(12).fill(0);

    (ingresos.data || []).filter(i => !esExcluido(i)).forEach(i => {
        const m = new Date(i.created_at).getMonth();
        const v = parseFloat(i.monto) || 0;
        if (i.sucursal === 'Sur') ingresosSurMes[m] += v;
        if (i.sucursal === 'Norte') ingresosNorteMes[m] += v;
    });

    (gastos.data || []).filter(g => g.categoria !== 'Pago de Pasivo').forEach(g => {
        const m = new Date(g.created_at).getMonth();
        const v = parseFloat(g.monto_total) || 0;
        if (g.sucursal === 'Sur') gastosSurMes[m] += v;
        if (g.sucursal === 'Norte') gastosNorteMes[m] += v;
    });

    chartTendenciaAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                { label: 'Ingresos Sur', data: ingresosSurMes, backgroundColor: 'rgba(59,130,246,0.8)', stack: 'sur' },
                { label: 'Gastos Sur', data: gastosSurMes.map(v => -v), backgroundColor: 'rgba(59,130,246,0.3)', stack: 'sur' },
                { label: 'Ingresos Norte', data: ingresosNorteMes, backgroundColor: 'rgba(139,92,246,0.8)', stack: 'norte' },
                { label: 'Gastos Norte', data: gastosNorteMes.map(v => -v), backgroundColor: 'rgba(139,92,246,0.3)', stack: 'norte' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' } } } },
            scales: {
                y: { ticks: { callback: v => formatMoneyShort(Math.abs(v)), font: { size: 10 } } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}
