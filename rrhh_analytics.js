// rrhh_analytics.js - Lógica de Visualización de Capital Humano
let chartRotacion;

async function inicializarAnalytics() {
    await cargarKPIsPrincipales();
    await renderizarGraficoRotacion();
    await renderizarGraficoFormacion();
    await cargarPresupuestoDepartamental();
}

async function cargarKPIsPrincipales() {
    try {
        // En lugar de una vista SQL (que podría no existir), calculamos en JS
        const res = await fetch(`${SUPABASE_URL}/rest/v1/empleados?select=*`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const datos = await res.json();

        const totalHeadcount = datos.length;
        // Calcular promedio antigüedad
        const hoy = new Date();
        let sumaAnios = 0;
        datos.forEach(d => {
            if (d.fecha_ingreso) {
                const ingreso = new Date(d.fecha_ingreso);
                const diffTime = Math.abs(hoy - ingreso);
                const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
                sumaAnios += diffYears;
            }
        });
        const avgAntiguedad = totalHeadcount > 0 ? (sumaAnios / totalHeadcount) : 0;

        // Calcular rotación simple (Activos vs Total, o dummy si no hay historial)
        // Por ahora usamos datos reales de conteo
        const activos = datos.filter(d => d.estatus === 'Activo').length;

        document.getElementById('txtHeadcount').innerText = totalHeadcount;
        document.getElementById('txtAntiguedad').innerText = `${avgAntiguedad.toFixed(1)} años`;

        // Simulación: Vacantes viene de rrhh_vacantes si existiera, usamos placeholder
        document.getElementById('txtVacantes').innerText = "3";
        document.getElementById('txtRotacion').innerText = "2.4%"; // Este dato requeriría tabla de bajas histórica

        // Simulación de pipeline
        document.getElementById('valPostulados').innerText = "12";
        document.getElementById('valEntrevistas').innerText = "5";
        document.getElementById('valPruebas').innerText = "2";
        document.getElementById('valContratados').innerText = "1";
    } catch (e) { console.error("Error KPIs Analytics:", e); }
}

async function renderizarGraficoRotacion() {
    const ctx = document.getElementById('chartRotacion').getContext('2d');

    chartRotacion = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL'],
            datasets: [{
                label: '2026',
                data: [4, 3.5, 5, 4.2, 3.8, 6, 4.2],
                borderColor: '#19e66b',
                backgroundColor: 'rgba(25, 230, 107, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoFormacion() {
    const ctx = document.getElementById('chartFormacion').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [75, 25],
                backgroundColor: ['#19e66b', '#f1f5f9'],
                borderWidth: 0,
                cutout: '85%'
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

function cargarPresupuestoDepartamental() {
    const departamentos = [
        { nombre: 'IT & Tecnología', uso: 85, color: 'bg-primary' },
        { nombre: 'Ventas & Ops', uso: 102, color: 'bg-red-500' },
        { nombre: 'Marketing', uso: 45, color: 'bg-blue-500' },
        { nombre: 'RRHH & Formación', uso: 62, color: 'bg-orange-500' }
    ];

    const container = document.getElementById('containerPresupuesto');
    container.innerHTML = departamentos.map(d => `
        <div class="space-y-2">
            <div class="flex justify-between text-[10px] font-black uppercase">
                <span>${d.nombre}</span>
                <span class="${d.uso > 100 ? 'text-red-500' : 'text-slate-500'}">${d.uso}% Utilizado</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="${d.color} h-full" style="width: ${Math.min(d.uso, 100)}%"></div>
            </div>
        </div>
    `).join('');
}