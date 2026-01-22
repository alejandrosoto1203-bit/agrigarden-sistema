// dashboard.js - Panel de Control Integral (Finanzas, RRHH, Cobranza)

let chartTendencia = null;
let chartGastos = null;
let chartCobranza = null;


// Cache global para filtrar sin recargar
let dashCache = {
    ingresos: [],
    gastos: [],
    empleados: [],
    inversiones: [],
    tareas: []
};

async function cargarDashboard() {
    try {
        // Fallback robusto para evitar "SUPABASE_URL undefined"
        const SB_URL = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        const SB_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

        // 1. Fetch All Data
        const [resIngresos, resGastos, resEmpleados, resInversiones, resTareas] = await Promise.all([
            fetch(`${SB_URL}/rest/v1/transacciones?select=*`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }),
            fetch(`${SB_URL}/rest/v1/gastos?select=*`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }),
            fetch(`${SB_URL}/rest/v1/empleados?select=id,nombre_completo,foto_url,sueldo_base`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }),
            fetch(`${SB_URL}/rest/v1/inversiones?select=monto,estatus,sucursal`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }),
            fetch(`${SB_URL}/rest/v1/rrhh_tareas?select=empleado_id,estado`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } })
        ]);

        dashCache.ingresos = await resIngresos.json();
        dashCache.gastos = await resGastos.json();
        dashCache.empleados = await resEmpleados.json();
        dashCache.inversiones = await resInversiones.json();
        dashCache.tareas = await resTareas.json();

        aplicarFiltrosDashboard();

    } catch (error) {
        console.error("Error dashboard:", error);
    }
}

function aplicarFiltrosDashboard() {
    const sucursal = document.getElementById('filtroSucursalDash')?.value || 'Todos';
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();

    // FILTRADO BASE (Solo afecta transacciones, gastos e inversiones por ahora)
    const ingresos = dashCache.ingresos.filter(i => sucursal === 'Todos' || i.sucursal === sucursal);
    const gastos = dashCache.gastos.filter(g => sucursal === 'Todos' || g.sucursal === sucursal);
    const inversiones = dashCache.inversiones.filter(i => sucursal === 'Todos' || i.sucursal === sucursal);

    // RRHH No tiene sucursal asociada directamente en API empleados aún, se muestra global
    const empleados = dashCache.empleados;
    const tareas = dashCache.tareas;

    // ----------------------------------------------------------------
    // 2. Financial KPIs
    // ----------------------------------------------------------------
    const ingresosMes = ingresos.filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === mesActual && d.getFullYear() === añoActual && i.tipo !== 'ABONO' && i.categoria !== 'COBRANZA';
    }).reduce((s, i) => s + (i.monto || 0), 0);

    const gastosMes = gastos.filter(g => {
        const d = new Date(g.created_at);
        return d.getMonth() === mesActual && d.getFullYear() === añoActual && (g.categoria !== 'Pago de Pasivo' || g.subcategoria === 'Abono Capital');
    }).reduce((s, g) => s + (g.monto_total || 0), 0);

    updateText('dashIngresosMes', formatMoney(ingresosMes));
    updateText('dashGastosMes', formatMoney(gastosMes));

    // ----------------------------------------------------------------
    // 3. HR Performance KPIs (Best/Worst) - GLOBAL (No filtrado por sucursal aun)
    // ----------------------------------------------------------------
    if (tareas.length > 0 && empleados.length > 0) {
        const stats = {};

        tareas.forEach(t => {
            if (!t.empleado_id) return;
            if (!stats[t.empleado_id]) stats[t.empleado_id] = { total: 0, completed: 0, empId: t.empleado_id };
            stats[t.empleado_id].total++;
            if (t.estado === 'COMPLETADO') stats[t.empleado_id].completed++;
        });

        const results = Object.values(stats).map(s => {
            s.rate = (s.completed / s.total) * 100;
            s.pendingRate = 100 - s.rate;
            return s;
        });

        // Best Performer (Max Completion Rate, then Max Total Tasks)
        const best = results.sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
        // Worst Performer (Max Pending Rate, then Max Total Tasks. Must have tasks)
        const worst = results.sort((a, b) => b.pendingRate - a.pendingRate || b.total - a.total)[0];

        if (best) renderEmployeeCard('hrBest', best, empleados);
        else resetEmployeeCard('hrBest');

        if (worst) renderEmployeeCard('hrWorst', worst, empleados, true);
        else resetEmployeeCard('hrWorst');
    }

    // ----------------------------------------------------------------
    // 4. Collections Analytics (Cobranza)
    // ----------------------------------------------------------------
    const cuentasPorCobrar = ingresos.filter(i => i.metodo_pago === 'Crédito' || i.estado_cobro === 'Pendiente');
    const hoyMs = new Date().getTime();

    let saldoVigente = 0;
    let saldoVencido = 0;
    const morosos = {};

    cuentasPorCobrar.forEach(txn => {
        const saldo = txn.saldo_pendiente !== undefined ? txn.saldo_pendiente : (txn.estado_cobro === 'Pendiente' ? txn.monto : 0);
        if (saldo <= 0) return;

        const fechaTxn = new Date(txn.created_at).getTime();
        const diasAntiguedad = (hoyMs - fechaTxn) / (24 * 60 * 60 * 1000);

        if (diasAntiguedad > 30) {
            saldoVencido += saldo;
            // Add to Morosos Analysis
            const cliente = txn.nombre_cliente || 'Desconocido';
            if (!morosos[cliente]) morosos[cliente] = { monto: 0, oldest: fechaTxn, count: 0 };
            morosos[cliente].monto += saldo;
            morosos[cliente].count++;
            if (fechaTxn < morosos[cliente].oldest) morosos[cliente].oldest = fechaTxn;
        } else {
            saldoVigente += saldo;
        }
    });

    // Update Text
    updateText('dashPorCobrar', formatMoney(saldoVigente + saldoVencido));
    updateText('txtCobranzaVigente', formatMoney(saldoVigente));
    updateText('txtCobranzaVencida', formatMoney(saldoVencido));

    // Render Chart
    renderChartCobranza(saldoVigente, saldoVencido);

    // Top 3 Delinquent List
    const listaMorosos = Object.entries(morosos)
        .sort(([, a], [, b]) => a.oldest - b.oldest)
        .slice(0, 3);

    const divMorosos = document.getElementById('listMorosos');
    if (divMorosos) {
        if (listaMorosos.length === 0) divMorosos.innerHTML = '<p class="text-xs text-gray-400 italic font-bold">Sin cuentas vencidas.</p>';
        else {
            divMorosos.innerHTML = listaMorosos.map(([name, data], i) => {
                const days = Math.floor((hoyMs - data.oldest) / (24 * 60 * 60 * 1000));
                return `
                    <div class="flex justify-between items-center bg-red-50 p-2 rounded-lg border border-red-100">
                        <div>
                            <p class="text-[10px] font-black uppercase text-slate-700">${i + 1}. ${name}</p>
                            <p class="text-[9px] text-red-400 font-bold">${days} DÍAS VENCIDO</p>
                        </div>
                        <span class="text-xs font-black text-red-600">${formatMoney(data.monto)}</span>
                    </div>
                `;
            }).join('');
        }
    }

    // ----------------------------------------------------------------
    // 5. Operational Status (Debts, Assets, HR)
    // ----------------------------------------------------------------
    const gastosPendientes = gastos.filter(g => (g.metodo_pago === 'Crédito' || g.estado_pago === 'Pendiente'));

    // Deuda Capital
    const deudaCapital = gastosPendientes
        .filter(g => g.categoria === 'Pago de Pasivo' || g.subcategoria === 'Abono Capital')
        .reduce((s, g) => s + (g.saldo_pendiente !== undefined ? g.saldo_pendiente : g.monto_total), 0);

    // Por Pagar Operativo
    const porPagar = gastosPendientes
        .filter(g => g.categoria !== 'Pago de Pasivo' && g.subcategoria !== 'Abono Capital')
        .reduce((s, g) => s + (g.saldo_pendiente !== undefined ? g.saldo_pendiente : g.monto_total), 0);

    // Activos Fijos
    const totalInversiones = inversiones
        .filter(i => i.estatus === 'Activo')
        .reduce((s, i) => s + (i.monto || 0), 0);

    // HR Stats (Globales) - Filrar Solo Activos
    const empleadosActivos = empleados.filter(e => e.estatus === 'Activo');
    const totalEmpleados = empleadosActivos.length;
    const nominaEst = empleadosActivos.reduce((s, e) => s + (e.sueldo_base || 0), 0);

    updateText('dashPorPagar', formatMoney(porPagar));
    updateText('dashDeudaTotal', formatMoney(deudaCapital));
    updateText('dashInversiones', formatMoney(totalInversiones));
    updateText('dashEmpleados', totalEmpleados);
    updateText('dashNomina', formatMoney(nominaEst));

    // ----------------------------------------------------------------
    // 6. Charts
    // ----------------------------------------------------------------
    renderChartsLegacy(ingresos, gastos, ahora);
}

function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function renderEmployeeCard(prefix, stat, empleados, isWorst = false) {
    const emp = empleados.find(e => e.id === stat.empId);
    if (!emp) return;

    const elName = document.getElementById(`${prefix}Name`);
    const elRate = document.getElementById(`${prefix}Rate`);
    const elAvatar = document.getElementById(`${prefix}Avatar`);

    if (elName) elName.innerText = emp.nombre_completo.split(' ')[0]; // First name
    if (elRate) elRate.innerText = isWorst
        ? `${stat.pendingRate.toFixed(0)}% PENDIENTES`
        : `${stat.rate.toFixed(0)}% COMPLETADO`;

    if (elAvatar) {
        if (emp.foto_url) {
            elAvatar.innerHTML = `<img src="${emp.foto_url}" class="w-full h-full object-cover rounded-full">`;
        } else {
            elAvatar.innerText = emp.nombre_completo.charAt(0);
        }
    }
}

function renderChartCobranza(vigente, vencido) {
    const ctx = document.getElementById('chartCobranza')?.getContext('2d');
    if (!ctx) return;
    if (chartCobranza) chartCobranza.destroy();

    const empty = vigente === 0 && vencido === 0;

    chartCobranza = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Vigente', 'Vencido (>30d)'],
            datasets: [{
                data: empty ? [1] : [vigente, vencido],
                backgroundColor: empty ? ['#f3f4f6'] : ['#3b82f6', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: { legend: { display: false }, tooltip: { enabled: !empty } }
        }
    });
}

function renderChartsLegacy(ingresos, gastos, ahora) {
    const months = [];
    const dataIng = [];
    const dataGas = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const mIdx = d.getMonth();
        const y = d.getFullYear();
        const monthName = d.toLocaleDateString('es-MX', { month: 'short' });

        const ingM = ingresos.filter(t => {
            const td = new Date(t.created_at);
            return td.getMonth() === mIdx && td.getFullYear() === y && t.tipo !== 'ABONO' && t.categoria !== 'COBRANZA';
        }).reduce((s, t) => s + (t.monto || 0), 0);

        const gasM = gastos.filter(g => {
            const gd = new Date(g.created_at);
            return gd.getMonth() === mIdx && gd.getFullYear() === y && g.categoria !== 'Pago de Pasivo';
        }).reduce((s, g) => s + (g.monto_total || 0), 0);

        months.push(monthName);
        dataIng.push(ingM);
        dataGas.push(gasM);
    }

    // Tendencia
    const ctxT = document.getElementById('chartTendencia')?.getContext('2d');
    if (ctxT) {
        if (chartTendencia) chartTendencia.destroy();
        chartTendencia = new Chart(ctxT, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    { label: 'Ingresos', data: dataIng, borderColor: '#19e66b', backgroundColor: 'rgba(25, 230, 107, 0.1)', borderWidth: 3, tension: 0.4, fill: true },
                    { label: 'Gastos', data: dataGas, borderColor: '#ef4444', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, borderDash: [5, 5] }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } } }
        });
    }

    // Pie Gastos Mes
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();
    const gastosMesCats = gastos.filter(g => {
        const d = new Date(g.created_at);
        return d.getMonth() === mesActual && d.getFullYear() === añoActual && (g.categoria !== 'Pago de Pasivo' || g.subcategoria === 'Abono Capital');
    });

    const catTotals = {};
    gastosMesCats.forEach(g => {
        const cat = g.categoria || 'Otros';
        catTotals[cat] = (catTotals[cat] || 0) + (g.monto_total || 0);
    });

    const ctxG = document.getElementById('chartGastos')?.getContext('2d');
    if (ctxG) {
        if (chartGastos) chartGastos.destroy();
        const labels = Object.keys(catTotals);
        const data = Object.values(catTotals);
        const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'];

        chartGastos = new Chart(ctxG, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sin Datos'],
                datasets: [{ data: data.length ? data : [1], backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } } } }
        });

        // NEW: Chart Breakdown by SubCategory (Concepto)
        const subCatTotals = {};
        gastosMesCats.forEach(g => {
            const sub = g.subcategoria ? g.subcategoria.toUpperCase() : 'OTROS';
            subCatTotals[sub] = (subCatTotals[sub] || 0) + (g.monto_total || 0);
        });

        // Sort by amount desc
        const sortedSub = Object.entries(subCatTotals).sort(([, a], [, b]) => b - a).slice(0, 10); // Top 10
        const lblsS = sortedSub.map(([k]) => k);
        const valsS = sortedSub.map(([, v]) => v);

        const ctxSub = document.getElementById('chartGastosSub')?.getContext('2d');
        if (ctxSub) {
            // Destroy existing if needed (needs tracking variable)
            if (window.chartGastosSubInstance) window.chartGastosSubInstance.destroy();

            window.chartGastosSubInstance = new Chart(ctxSub, {
                type: 'bar',
                data: {
                    labels: lblsS,
                    datasets: [{
                        label: 'Monto ($)',
                        data: valsS,
                        backgroundColor: '#6366f1',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { grid: { display: false }, ticks: { font: { size: 9 } } } }
                }
            });
        }
    }
}