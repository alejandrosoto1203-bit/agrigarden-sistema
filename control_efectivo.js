// control_efectivo.js - v3 Simplificado
console.log("--> CARGANDO SCRIPT CONTROL_EFECTIVO.JS <--");

// --- UTILS FALLBACK ---
if (typeof formatMoney === 'undefined') {
    window.formatMoney = (n) => {
        if (n === undefined || n === null) return "$0.00";
        return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };
    console.log("⚠️ control_efectivo.js: formatMoney defined locally as fallback");
}
// ----------------------

// 1. Definir Helper de Log Globalmente
window.logMsg = function (msg, isError = false) {
    console.log(msg);
    const consoleDiv = document.getElementById('debugContent');
    if (consoleDiv) {
        if (consoleDiv.innerText.includes('Esperando')) consoleDiv.innerText = '';
        const p = document.createElement('div');
        p.className = isError ? 'text-red-400 font-bold mb-1' : 'text-gray-300 mb-1';
        p.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleDiv.prepend(p);
    }
};

// 2. Definir Función Principal Globalmente
window.cargarControlEfectivo = async function () {
    logMsg("Script iniciado correctamente (Modo Split).");

    // Elementos UI
    const kpiSaldo_Norte = document.getElementById('kpiSaldo_Norte');
    const kpiSaldo_Sur = document.getElementById('kpiSaldo_Sur');

    const tablaNorte = document.getElementById('tablaMovimientos_Norte');
    const tablaSur = document.getElementById('tablaMovimientos_Sur');

    if (tablaNorte) tablaNorte.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400 italic animate-pulse">Cargando...</td></tr>';
    if (tablaSur) tablaSur.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400 italic animate-pulse">Cargando...</td></tr>';

    // DYNAMIC CONFIG FROM GLOBAL SCOPE (Defined in config.js/api.js)
    const API_URL = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const API_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
    const headers = { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

    try {
        logMsg(`1. Obteniendo Saldos Iniciales... [Env: ${window.IS_TEST_ENV ? 'TEST' : 'PROD'}]`);
        let saldoNorte = 0, saldoSur = 0, fechaInicio = null;

        const resConf = await fetch(`${API_URL}/rest/v1/sys_config?select=value&key=eq.cash_control_config`, { headers });
        if (resConf.ok) {
            const data = await resConf.json();
            if (data.length && data[0].value) {
                saldoNorte = parseFloat(data[0].value.saldo_inicial_norte) || 0;
                saldoSur = parseFloat(data[0].value.saldo_inicial_sur) || 0;
                fechaInicio = data[0].value.fecha_inicio || null;
            }
        }
        if (kpiSaldo_Norte) kpiSaldo_Norte.innerText = `$${saldoNorte.toLocaleString('es-MX')}`;
        if (kpiSaldo_Sur) kpiSaldo_Sur.innerText = `$${saldoSur.toLocaleString('es-MX')}`;

        const fechaFilter = fechaInicio ? `&created_at=gte.${fechaInicio}` : '';
        if (fechaInicio) logMsg(`Filtrando desde: ${fechaInicio}`);

        logMsg("2. Obteniendo Movimientos...");

        // Paginación transacciones
        let txs = [];
        let txOffset = 0;
        const PAGE = 1000;
        while (true) {
            const res = await fetch(`${API_URL}/rest/v1/transacciones?select=*&order=created_at.desc${fechaFilter}`, {
                headers: { ...headers, 'Range-Unit': 'items', 'Range': `${txOffset}-${txOffset + PAGE - 1}` }
            });
            if (!res.ok) break;
            const chunk = await res.json();
            txs = txs.concat(chunk);
            if (chunk.length < PAGE) break;
            txOffset += PAGE;
        }

        // Paginación gastos
        let gxs = [];
        let gxOffset = 0;
        while (true) {
            const res = await fetch(`${API_URL}/rest/v1/gastos?select=*&order=created_at.desc${fechaFilter}`, {
                headers: { ...headers, 'Range-Unit': 'items', 'Range': `${gxOffset}-${gxOffset + PAGE - 1}` }
            });
            if (!res.ok) break;
            const chunk = await res.json();
            gxs = gxs.concat(chunk);
            if (chunk.length < PAGE) break;
            gxOffset += PAGE;
        }

        logMsg(`Transacciones: ${txs.length} | Gastos: ${gxs.length}`);

        // MERGE & SPLIT
        // Filter only 'EFECTIVO'
        const efTxs = txs.filter(t => t.metodo_pago && t.metodo_pago.toLowerCase().includes('efectivo'));
        const efGxs = gxs.filter(g => g.metodo_pago && g.metodo_pago.toLowerCase().includes('efectivo'));

        const rowsNorte = [];
        const rowsSur = [];

        // Process Transactions (Ingresos)
        efTxs.forEach(t => {
            const row = { id: t.id, sourceType: 'transaccion', date: new Date(t.created_at), type: 'ENTRADA', amount: t.monto || 0, concept: t.nombre_cliente || 'Venta', sucursal: t.sucursal || 'Norte' };
            if (row.sucursal === 'Norte' || row.sucursal === 'Matriz') rowsNorte.push(row);
            if (row.sucursal === 'Sur') rowsSur.push(row);
        });

        // Process Expenses (Gastos)
        efGxs.forEach(g => {
            const row = { id: g.id, sourceType: 'gasto', date: new Date(g.created_at), type: 'SALIDA', amount: g.monto_total || 0, concept: g.proveedor || 'Gasto', sucursal: g.sucursal || 'Norte' };
            if (row.sucursal === 'Norte' || row.sucursal === 'Matriz') rowsNorte.push(row);
            if (row.sucursal === 'Sur') rowsSur.push(row);
        });

        // RENDER & CALC FUNCTION
        const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const processBranch = (rows, saldoInicial, suffix) => {
            const inTotal = rows.filter(r => r.type === 'ENTRADA').reduce((a, b) => a + b.amount, 0);
            const outTotal = rows.filter(r => r.type === 'SALIDA').reduce((a, b) => a + b.amount, 0);
            const tableEl = document.getElementById(`tablaMovimientos_${suffix}`);

            if (document.getElementById(`kpiEntradas_${suffix}`)) document.getElementById(`kpiEntradas_${suffix}`).innerText = `$${inTotal.toLocaleString('es-MX')}`;
            if (document.getElementById(`kpiSalidas_${suffix}`)) document.getElementById(`kpiSalidas_${suffix}`).innerText = `$${outTotal.toLocaleString('es-MX')}`;
            if (document.getElementById(`kpiDisponible_${suffix}`)) document.getElementById(`kpiDisponible_${suffix}`).innerText = `$${(saldoInicial + inTotal - outTotal).toLocaleString('es-MX')}`;

            if (!tableEl) return;
            if (rows.length === 0) {
                tableEl.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-300 italic">Sin movimientos</td></tr>';
                return;
            }

            // 1. Calcular saldo acumulado en orden ascendente
            const rowsAsc = [...rows].sort((a, b) => a.date - b.date);
            let runBalance = saldoInicial;
            rowsAsc.forEach(r => {
                runBalance += r.type === 'ENTRADA' ? r.amount : -r.amount;
                r.saldo = runBalance;
            });

            // 2. Agrupar por mes y calcular apertura/cierre
            const monthGroups = {};
            rowsAsc.forEach(r => {
                const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
                if (!monthGroups[key]) monthGroups[key] = { rows: [], apertura: 0, cierre: 0 };
                monthGroups[key].rows.push(r);
                monthGroups[key].cierre = r.saldo;
            });

            let prevCierre = saldoInicial;
            Object.keys(monthGroups).sort().forEach(key => {
                monthGroups[key].apertura = prevCierre;
                prevCierre = monthGroups[key].cierre;
            });

            // 3. Renderizar (meses más recientes primero)
            let html = '';
            Object.keys(monthGroups).sort().reverse().forEach(key => {
                const group = monthGroups[key];
                const [year, month] = key.split('-');
                const monthLabel = `${MESES[parseInt(month) - 1]} ${year}`;
                const cierreColor = group.cierre < 0 ? 'text-red-600' : 'text-gray-800';

                html += `<tr class="bg-blue-50/40 border-t-2 border-blue-100">
                    <td colspan="4" class="px-4 py-2">
                        <div class="flex justify-between items-center flex-wrap gap-2">
                            <span class="font-black text-[10px] uppercase text-blue-700 tracking-widest">${monthLabel}</span>
                            <div class="flex gap-4 text-[10px] font-bold">
                                <span class="text-gray-400">Apertura: <span class="text-gray-600">$${group.apertura.toLocaleString('es-MX')}</span></span>
                                <span class="text-gray-400">Cierre: <span class="${cierreColor}">$${group.cierre.toLocaleString('es-MX')}</span></span>
                            </div>
                        </div>
                    </td>
                </tr>`;

                const rowsDesc = [...group.rows].sort((a, b) => b.date - a.date);
                rowsDesc.forEach(r => {
                    const linkUrl = r.sourceType === 'transaccion'
                        ? `ingresos.html?highlight=${r.id}`
                        : `gastos.html?highlight=${r.id}`;
                    const saldoColor = r.saldo < 0 ? 'text-red-500' : 'text-gray-500';

                    html += `<tr class="border-b border-gray-50 hover:bg-yellow-50/50 cursor-pointer transition-colors" onclick="window.location.href='${linkUrl}'">
                        <td class="px-4 py-3 font-bold text-gray-600">${r.date.toLocaleDateString()}</td>
                        <td class="px-4 py-3 uppercase text-gray-800 font-bold max-w-[150px] truncate">${r.concept}</td>
                        <td class="px-4 py-3 text-right font-black ${r.type === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}">
                            ${r.type === 'SALIDA' ? '-' : '+'}$${r.amount.toLocaleString('es-MX')}
                        </td>
                        <td class="px-4 py-3 text-right font-bold ${saldoColor}">$${r.saldo.toLocaleString('es-MX')}</td>
                    </tr>`;
                });
            });
            tableEl.innerHTML = html;
        };

        processBranch(rowsNorte, saldoNorte, 'Norte');
        processBranch(rowsSur, saldoSur, 'Sur');

        logMsg("Proceso Finalizado Exitosamente (Norte & Sur).");

    } catch (e) {
        logMsg("FATAL: " + e.message, true);
    }
};

console.log("--> CARGA FINALIZADA <--");

// =====================================================
// MODAL: TRANSFERIR DINERO ENTRE SUCURSALES
// =====================================================
window.abrirModalTraspaso = function () {
    document.getElementById('modalTraspaso').classList.remove('hidden');
    document.getElementById('traspasoMonto').value = '';
    document.getElementById('traspasoNotas').value = '';
};

window.cerrarModalTraspaso = function () {
    document.getElementById('modalTraspaso').classList.add('hidden');
};

window.actualizarDestinoTraspaso = function () {
    const origen = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino');
    destino.value = origen === 'Norte' ? 'Sur' : 'Norte';
};

window.sugerirMetodoLlegada = function () {
    const metodo = document.getElementById('traspasoMetodo').value;
    document.getElementById('traspasoMetodoDestino').value = metodo;
};

window.ejecutarTraspasoEfectivo = async function () {
    const origen = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino').value;
    const monto = parseFloat(document.getElementById('traspasoMonto').value);
    const metodoSalida = document.getElementById('traspasoMetodo').value;
    const metodoLlegada = document.getElementById('traspasoMetodoDestino').value;
    const notas = document.getElementById('traspasoNotas').value || `Traspaso de ${origen} a ${destino}`;

    if (!monto || monto <= 0) { alert('Ingresa un monto válido.'); return; }

    const API_URL = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const API_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
    const h = { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
    const now = new Date().toISOString();
    const promises = [];

    // SALIDA del origen — solo si el método de salida es efectivo
    if (metodoSalida.toLowerCase().includes('efectivo')) {
        promises.push(fetch(`${API_URL}/rest/v1/gastos`, {
            method: 'POST', headers: h,
            body: JSON.stringify({
                created_at: now,
                proveedor: `TRASPASO → ${destino.toUpperCase()}`,
                categoria: 'Interno',
                subcategoria: 'TRASPASO EFECTIVO',
                metodo_pago: 'Efectivo',
                monto_total: monto,
                sucursal: origen,
                notas: notas,
                estado_pago: 'Pagado'
            })
        }));
    }

    // ENTRADA al destino — solo si el método de llegada es efectivo
    if (metodoLlegada.toLowerCase().includes('efectivo')) {
        promises.push(fetch(`${API_URL}/rest/v1/transacciones`, {
            method: 'POST', headers: h,
            body: JSON.stringify({
                created_at: now,
                categoria: `TRASPASO ← ${origen.toUpperCase()}`,
                tipo: 'Traspaso Interno',
                metodo_pago: 'Efectivo',
                nombre_cliente: `TRASPASO DESDE ${origen.toUpperCase()}`,
                monto: monto,
                comision_bancaria: 0,
                monto_neto: monto,
                sucursal: destino,
                estado_cobro: 'Pagado',
                saldo_pendiente: 0,
                notas: notas,
                fuente: 'TRASPASO_EFECTIVO'
            })
        }));
    }

    const btn = document.getElementById('btnEjecutarTraspaso');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Guardando...';

    await Promise.all(promises);

    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">bolt</span> Confirmar Traspaso';
    cerrarModalTraspaso();
    alert(`✅ Traspaso registrado: $${monto.toLocaleString('es-MX')} de ${origen} → ${destino}`);
    cargarControlEfectivo();
};
