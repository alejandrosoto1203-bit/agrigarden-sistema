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

    if (tablaNorte) tablaNorte.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400 italic animate-pulse">Cargando...</td></tr>';
    if (tablaSur) tablaSur.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400 italic animate-pulse">Cargando...</td></tr>';

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
            const row = { id: t.id, sourceType: 'transaccion', date: new Date(t.created_at), type: 'ENTRADA', amount: t.monto || 0, concept: t.nombre_cliente || 'Venta', txn: t.categoria || '', sucursal: t.sucursal || 'Norte' };
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
            const ahora = new Date();
            const mesActual = ahora.getMonth();
            const añoActual = ahora.getFullYear();
            const rowsMes = rows.filter(r => { const d = new Date(r.date); return d.getMonth() === mesActual && d.getFullYear() === añoActual; });
            const inTotal  = rowsMes.filter(r => r.type === 'ENTRADA').reduce((a, b) => a + b.amount, 0);
            const outTotal = rowsMes.filter(r => r.type === 'SALIDA').reduce((a, b) => a + b.amount, 0);
            const inTotalAll  = rows.filter(r => r.type === 'ENTRADA').reduce((a, b) => a + b.amount, 0);
            const outTotalAll = rows.filter(r => r.type === 'SALIDA').reduce((a, b) => a + b.amount, 0);
            const tableEl = document.getElementById(`tablaMovimientos_${suffix}`);

            const mesLabel = MESES[mesActual];
            [`kpiMesLabel_${suffix}`, `kpiMesLabel2_${suffix}`].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = mesLabel; });
            if (document.getElementById(`kpiEntradas_${suffix}`)) document.getElementById(`kpiEntradas_${suffix}`).innerText = `$${inTotal.toLocaleString('es-MX')}`;
            if (document.getElementById(`kpiSalidas_${suffix}`)) document.getElementById(`kpiSalidas_${suffix}`).innerText = `$${outTotal.toLocaleString('es-MX')}`;
            if (document.getElementById(`kpiDisponible_${suffix}`)) document.getElementById(`kpiDisponible_${suffix}`).innerText = `$${(saldoInicial + inTotalAll - outTotalAll).toLocaleString('es-MX')}`;

            if (!tableEl) return;
            if (rows.length === 0) {
                tableEl.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-300 italic">Sin movimientos</td></tr>';
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
                    <td colspan="5" class="px-4 py-2">
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

                    html += `<tr class="border-b border-gray-50 hover:bg-yellow-50/50 cursor-pointer transition-colors" onclick="window.open('${linkUrl}', '_blank')">
                        <td class="px-4 py-3 font-bold text-gray-600">${r.date.toLocaleDateString()}</td>
                        <td class="px-4 py-3 uppercase text-gray-800 font-bold max-w-[150px] truncate">${r.concept}</td>
                        <td class="px-4 py-3 font-mono text-[10px] text-gray-400">${r.txn || '—'}</td>
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

        // Guardar datos para exportación Excel
        window._efectivoData = {
            Norte: { rows: rowsNorte, saldoInicial: saldoNorte },
            Sur: { rows: rowsSur, saldoInicial: saldoSur }
        };

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

// =====================================================
// EXPORTAR EXCEL POR SUCURSAL
// =====================================================
window.descargarExcelSucursal = async function (sucursal) {
    if (typeof ExcelJS === 'undefined') {
        alert('La librería de Excel aún no ha cargado. Espera unos segundos e intenta de nuevo.');
        return;
    }
    const data = window._efectivoData && window._efectivoData[sucursal];
    if (!data) {
        alert('Los datos no están disponibles todavía. Espera a que cargue el reporte.');
        return;
    }

    const { rows, saldoInicial } = data;
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const WB = new ExcelJS.Workbook();
    WB.creator = 'Agrigarden Financial Systems';
    WB.created = new Date();

    const WS = WB.addWorksheet(`Efectivo ${sucursal}`, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    WS.columns = [
        { key: 'a', width: 13 },
        { key: 'b', width: 33 },
        { key: 'c', width: 13 },
        { key: 'd', width: 11 },
        { key: 'e', width: 19 },
        { key: 'f', width: 19 },
    ];

    const fillRow = (row, argb) => {
        for (let c = 1; c <= 6; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    };

    // ── FILA 1: TÍTULO PRINCIPAL ────────────────────────────────────
    WS.mergeCells('A1:F1');
    WS.getRow(1).height = 38;
    const c1 = WS.getCell('A1');
    c1.value = '  AGRIGARDEN  —  CONTROL DE EFECTIVO';
    c1.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    c1.alignment = { vertical: 'middle', horizontal: 'left' };

    // ── FILA 2: SUBTÍTULO ───────────────────────────────────────────
    WS.getRow(2).height = 24;
    WS.mergeCells('A2:C2');
    const c2a = WS.getCell('A2');
    c2a.value = `  SUCURSAL ${sucursal.toUpperCase()}`;
    c2a.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1e3a8a' } };
    c2a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
    c2a.alignment = { vertical: 'middle', horizontal: 'left' };
    WS.mergeCells('D2:F2');
    const c2d = WS.getCell('D2');
    c2d.value = `Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}  `;
    c2d.font = { name: 'Calibri', size: 9, color: { argb: 'FF4b5563' } };
    c2d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
    c2d.alignment = { vertical: 'middle', horizontal: 'right' };

    // ── FILA 3: SEPARADOR ───────────────────────────────────────────
    WS.getRow(3).height = 10;
    fillRow(WS.getRow(3), 'FFFFFFFF');

    // ── FILAS 4-6: RESUMEN KPI ──────────────────────────────────────
    const entradas = rows.filter(r => r.type === 'ENTRADA').reduce((a, b) => a + b.amount, 0);
    const salidas = rows.filter(r => r.type === 'SALIDA').reduce((a, b) => a + b.amount, 0);
    const disponible = saldoInicial + entradas - salidas;

    WS.mergeCells('A4:F4');
    WS.getRow(4).height = 18;
    const c4 = WS.getCell('A4');
    c4.value = '  RESUMEN DE CAJA';
    c4.font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF6b7280' } };
    c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf3f4f6' } };
    c4.alignment = { vertical: 'middle', horizontal: 'left' };
    c4.border = { top: { style: 'thin', color: { argb: 'FFe5e7eb' } } };

    const r5 = WS.getRow(5);
    r5.height = 16;
    [['Saldo Inicial', 1], ['', 2], ['Total Entradas', 3], ['', 4], ['Total Salidas', 5], ['Disponible Real', 6]].forEach(([label, col]) => {
        const cell = r5.getCell(col);
        cell.value = label;
        cell.font = { name: 'Calibri', size: 7, bold: true, color: { argb: 'FF9ca3af' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 6 ? 'right' : 'left', indent: 1 };
    });

    const r6 = WS.getRow(6);
    r6.height = 30;
    [[1, saldoInicial, 'FF374151'], [3, entradas, 'FF16a34a'], [5, salidas, 'FFdc2626'], [6, disponible, disponible < 0 ? 'FFdc2626' : 'FF16a34a']].forEach(([col, val, argb]) => {
        const cell = r6.getCell(col);
        cell.value = val;
        cell.numFmt = '"$"#,##0.00';
        cell.font = { name: 'Calibri', size: 15, bold: true, color: { argb } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 6 ? 'right' : 'left', indent: 1 };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } } };
    });
    [2, 4].forEach(col => {
        const cell = r6.getCell(col);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } } };
    });

    // ── FILA 7: SEPARADOR ───────────────────────────────────────────
    WS.getRow(7).height = 10;
    fillRow(WS.getRow(7), 'FFFFFFFF');

    // ── FILA 8: ENCABEZADOS DE COLUMNA ──────────────────────────────
    const r8 = WS.getRow(8);
    r8.height = 22;
    const colHeaders = ['FECHA', 'CONCEPTO / CLIENTE', 'TXN #', 'TIPO', 'MONTO', 'SALDO'];
    const colAligns = ['left', 'left', 'left', 'center', 'right', 'right'];
    colHeaders.forEach((label, i) => {
        const cell = r8.getCell(i + 1);
        cell.value = label;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1f2937' } };
        cell.alignment = { vertical: 'middle', horizontal: colAligns[i], indent: 1 };
    });

    // Congelar desde la fila 9
    WS.views = [{ state: 'frozen', ySplit: 8 }];

    // ── RECALCULAR SALDOS Y AGRUPAR POR MES ─────────────────────────
    const rowsAsc = [...rows].sort((a, b) => a.date - b.date);
    let runBalance = saldoInicial;
    rowsAsc.forEach(r => {
        runBalance += r.type === 'ENTRADA' ? r.amount : -r.amount;
        r.saldo = runBalance;
    });
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

    // ── FILAS DE DATOS ───────────────────────────────────────────────
    let rowIdx = 9;
    let alt = false;

    Object.keys(monthGroups).sort().reverse().forEach(key => {
        const group = monthGroups[key];
        const [year, month] = key.split('-');
        const monthLabel = `  ${MESES[parseInt(month) - 1].toUpperCase()} ${year}`;

        // Cabecera de mes
        const mNum = rowIdx++;
        WS.mergeCells(`A${mNum}:D${mNum}`);
        const mRow = WS.getRow(mNum);
        mRow.height = 19;

        const mA = WS.getCell(`A${mNum}`);
        mA.value = monthLabel;
        mA.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1e40af' } };
        mA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
        mA.alignment = { vertical: 'middle', horizontal: 'left' };
        mA.border = { top: { style: 'thin', color: { argb: 'FFbfdbfe' } }, bottom: { style: 'thin', color: { argb: 'FFbfdbfe' } } };

        const mE = WS.getCell(`E${mNum}`);
        mE.value = `Apertura  $${group.apertura.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        mE.font = { name: 'Calibri', size: 8, color: { argb: 'FF4b5563' } };
        mE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
        mE.alignment = { vertical: 'middle', horizontal: 'right' };
        mE.border = { top: { style: 'thin', color: { argb: 'FFbfdbfe' } }, bottom: { style: 'thin', color: { argb: 'FFbfdbfe' } } };

        const mF = WS.getCell(`F${mNum}`);
        mF.value = `Cierre  $${group.cierre.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        mF.font = { name: 'Calibri', size: 8, bold: true, color: { argb: group.cierre < 0 ? 'FFdc2626' : 'FF374151' } };
        mF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
        mF.alignment = { vertical: 'middle', horizontal: 'right' };
        mF.border = { top: { style: 'thin', color: { argb: 'FFbfdbfe' } }, bottom: { style: 'thin', color: { argb: 'FFbfdbfe' } } };

        // Filas de transacciones (más reciente primero)
        [...group.rows].sort((a, b) => b.date - a.date).forEach(r => {
            alt = !alt;
            const bg = alt ? 'FFFFFFFF' : 'FFfafafa';
            const tNum = rowIdx++;
            const tRow = WS.getRow(tNum);
            tRow.height = 17;

            const set = (col, value, font = {}, align = {}, numFmt = null) => {
                const cell = tRow.getCell(col);
                cell.value = value;
                cell.font = { name: 'Calibri', size: 9, ...font };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { vertical: 'middle', ...align };
                cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
                if (numFmt) cell.numFmt = numFmt;
            };

            set(1, r.date, { color: { argb: 'FF6b7280' } }, { horizontal: 'left', indent: 1 }, 'DD/MM/YYYY');
            set(2, (r.concept || '').toUpperCase(), { bold: true, color: { argb: 'FF111827' } }, { horizontal: 'left', indent: 1 });
            set(3, r.txn || '', { name: 'Courier New', size: 8, color: { argb: 'FF6b7280' } }, { horizontal: 'left', indent: 1 });
            set(4, r.type, { bold: true, size: 8, color: { argb: r.type === 'ENTRADA' ? 'FF16a34a' : 'FFdc2626' } }, { horizontal: 'center' });
            set(5, r.type === 'SALIDA' ? -r.amount : r.amount, { bold: true, color: { argb: r.type === 'ENTRADA' ? 'FF16a34a' : 'FFdc2626' } }, { horizontal: 'right', indent: 1 }, '"$"#,##0.00');
            set(6, r.saldo, { bold: true, color: { argb: r.saldo < 0 ? 'FFdc2626' : 'FF374151' } }, { horizontal: 'right', indent: 1 }, '"$"#,##0.00');
        });
    });

    // ── PIE DE PÁGINA ────────────────────────────────────────────────
    const footerNum = rowIdx + 1;
    WS.mergeCells(`A${footerNum}:F${footerNum}`);
    WS.getRow(footerNum).height = 16;
    const footerCell = WS.getCell(`A${footerNum}`);
    footerCell.value = `  © ${new Date().getFullYear()} Agrigarden Financial Systems — ${new Date().toLocaleDateString('es-MX')}`;
    footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF9ca3af' } };
    footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'left' };
    footerCell.border = { top: { style: 'thin', color: { argb: 'FFe5e7eb' } } };

    // ── DESCARGAR ────────────────────────────────────────────────────
    const buffer = await WB.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Agrigarden_Efectivo_${sucursal}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
