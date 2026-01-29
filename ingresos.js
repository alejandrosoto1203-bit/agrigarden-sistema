// ingresos.js - Gestión de Ventas y Registro Múltiple

// --- UTILS FALLBACK ---
if (typeof formatMoney === 'undefined') {
    window.formatMoney = (n) => {
        if (n === undefined || n === null) return "$0.00";
        return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };
    console.log("⚠️ ingresos.js: formatMoney defined locally as fallback");
}
// ----------------------

let datosCacheIngresos = [];

// 1. CARGA DE TABLA PRINCIPAL CON LÓGICA DE FILTROS
async function cargarIngresos() {
    const tablaSur = document.getElementById('tablaIngresosSur');
    const tablaNorte = document.getElementById('tablaIngresosNorte');
    if (!tablaSur && !tablaNorte) return;

    // Force reload config to ensure fresh goal & commissions
    if (window.cargarConfiguracionSistema) {
        try { await window.cargarConfiguracionSistema(); } catch (e) { console.error("Config sync failed", e); }
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?select=*&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        datosCacheIngresos = await response.json();
        aplicarFiltrosIngresos();
    } catch (error) { console.error("Error ingresos:", error); }
}

// Export Helper Logic
let currentFilteredIngresos = [];

function aplicarFiltrosIngresos() {
    const busqueda = document.getElementById('inputBusqueda')?.value.toLowerCase() || '';
    const filtroMetodo = document.getElementById('filtroMetodo')?.value || 'Todos';
    const filtroTipo = document.getElementById('filtroTipo')?.value || 'Todos';
    const filtroSucursal = document.getElementById('filtroSucursal')?.value || 'Todos';
    const fechaInicio = document.getElementById('filtroFechaInicio')?.value;
    const fechaFin = document.getElementById('filtroFechaFin')?.value;

    const filtrados = datosCacheIngresos.filter(item => {
        const coincideTxt = (item.nombre_cliente?.toLowerCase().includes(busqueda)) ||
            (item.categoria?.toLowerCase().includes(busqueda)) ||
            (item.notas?.toLowerCase().includes(busqueda));

        const coincideMetodo = filtroMetodo === 'Todos' || item.metodo_pago === filtroMetodo;
        const coincideTipo = filtroTipo === 'Todos' || item.tipo === filtroTipo;
        const coincideSucursal = filtroSucursal === 'Todos' || item.sucursal === filtroSucursal;

        let coincideFecha = true;
        if (fechaInicio && fechaFin) {
            const fItem = item.created_at.split('T')[0];
            coincideFecha = fItem >= fechaInicio && fItem <= fechaFin;
        }

        return coincideTxt && coincideMetodo && coincideTipo && coincideFecha && coincideSucursal;
    });

    // Store for export
    currentFilteredIngresos = filtrados;

    // Calcular KPIs Dinámicos
    actualizarCalculosKPIsIngresos(filtrados);
    renderizarTablaIngresos(filtrados);
    // renderizarGraficoIngresos(filtrados); // This function is not defined in the provided context, so commenting it out.
}

// Global Export Function
window.exportarIngresos = function () {
    exportToExcel(
        currentFilteredIngresos,
        {
            created_at: "Fecha Registro",
            sucursal: "Sucursal",
            nombre_cliente: "Cliente / Concepto",
            categoria: "Categoría",
            metodo_pago: "Método Pago",
            tipo: "Tipo",
            monto: "Monto",
            notas: "Notas",
            estado_cobro: "Estado Cobro"
        },
        `Reporte_Ingresos_${new Date().toISOString().split('T')[0]}`,
        "Ingresos"
    );
}

function renderizarTablaIngresos(datos) {
    const tablaSur = document.getElementById('tablaIngresosSur');
    const tablaNorte = document.getElementById('tablaIngresosNorte');
    const contadorSur = document.getElementById('contadorSur');
    const contadorNorte = document.getElementById('contadorNorte');

    if (!tablaSur || !tablaNorte) return;

    // Separar por sucursal - excluyendo ABONOS de los KPIs
    const datosSur = datos.filter(i => i.sucursal === 'Sur');
    const datosNorte = datos.filter(i => i.sucursal === 'Norte');

    // Filtrar ventas para KPIs (excluyendo abonos y rentas)
    const esExcluido = (i) => i.tipo === 'ABONO' || i.categoria === 'COBRANZA' || (i.categoria && i.categoria.toUpperCase().includes('RENTA'));
    const ventasSur = datosSur.filter(i => !esExcluido(i));
    const ventasNorte = datosNorte.filter(i => !esExcluido(i));

    // Actualizar contadores
    if (contadorSur) contadorSur.textContent = `(${datosSur.length} registros)`;
    if (contadorNorte) contadorNorte.textContent = `(${datosNorte.length} registros)`;

    // Calcular y mostrar KPIs por sucursal
    const totalSur = ventasSur.reduce((sum, i) => sum + (i.monto || 0), 0);
    const totalNorte = ventasNorte.reduce((sum, i) => sum + (i.monto || 0), 0);
    const ticketSur = ventasSur.length > 0 ? totalSur / ventasSur.length : 0;
    const ticketNorte = ventasNorte.length > 0 ? totalNorte / ventasNorte.length : 0;

    // Actualizar KPIs Sur
    const kpiTotalSur = document.getElementById('kpiTotalSur');
    const kpiTicketSur = document.getElementById('kpiTicketSur');
    const kpiTxnSur = document.getElementById('kpiTxnSur');
    if (kpiTotalSur) kpiTotalSur.textContent = formatMoney(totalSur);
    if (kpiTicketSur) kpiTicketSur.textContent = formatMoney(ticketSur);
    if (kpiTxnSur) kpiTxnSur.textContent = ventasSur.length;

    // Actualizar KPIs Norte
    const kpiTotalNorte = document.getElementById('kpiTotalNorte');
    const kpiTicketNorte = document.getElementById('kpiTicketNorte');
    const kpiTxnNorte = document.getElementById('kpiTxnNorte');
    if (kpiTotalNorte) kpiTotalNorte.textContent = formatMoney(totalNorte);
    if (kpiTicketNorte) kpiTicketNorte.textContent = formatMoney(ticketNorte);
    if (kpiTxnNorte) kpiTxnNorte.textContent = ventasNorte.length;

    // Función para generar fila compacta
    const generarFila = (item) => {
        const fecha = new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        const esAbono = item.tipo === 'ABONO' || item.categoria === 'COBRANZA';
        const tipoBadge = esAbono
            ? 'bg-purple-100 text-purple-700'
            : 'bg-green-50 text-green-700';
        const tipoLabel = esAbono ? 'Abono' : (item.tipo === 'Venta Directa' ? 'Venta' : item.tipo);

        return `
            <tr class="hover:bg-gray-50/80 transition-all border-b border-gray-50 font-bold ${esAbono ? 'bg-purple-50/30' : ''}">
                <td class="px-4 py-3 text-gray-600">${fecha}</td>
                <td class="px-4 py-3 text-center text-xs text-gray-400 font-mono">#${item.categoria || 'S/N'}</td>
                <td class="px-4 py-3 text-center"><span class="${tipoBadge} px-2 py-0.5 rounded text-[9px] font-black uppercase">${tipoLabel}</span></td>
                <td class="px-4 py-3 text-center text-gray-500">${item.metodo_pago}</td>
                <td class="px-4 py-3 text-center text-gray-600 truncate max-w-[100px]" title="${item.nombre_cliente || ''}">${item.nombre_cliente || '-'}</td>
                <td class="px-4 py-3 text-right ${esAbono ? 'text-purple-600' : 'text-primary'} font-black">${formatMoney(item.monto)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        <button onclick='abrirModalEditarIngreso(${JSON.stringify(item).replace(/'/g, "&apos;")})' class="p-1.5 bg-gray-50 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="eliminarIngreso('${item.id}')" class="p-1.5 bg-gray-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    };

    // Renderizar Sur
    tablaSur.innerHTML = datosSur.length > 0
        ? datosSur.map(generarFila).join('')
        : '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400 italic">Sin registros</td></tr>';

    // Renderizar Norte
    tablaNorte.innerHTML = datosNorte.length > 0
        ? datosNorte.map(generarFila).join('')
        : '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400 italic">Sin registros</td></tr>';
}

// 2. EDICIÓN Y ELIMINACIÓN (CORREGIDO)
function abrirModalEditarIngreso(ingreso) {
    const modal = document.getElementById('modalEditarIngreso');
    if (!modal) return;

    document.getElementById('editIngresoId').value = ingreso.id;
    document.getElementById('editFecha').value = ingreso.created_at.split('T')[0];
    document.getElementById('editCategoria').value = ingreso.categoria || '';
    document.getElementById('editTipo').value = ingreso.tipo;
    document.getElementById('editMetodo').value = ingreso.metodo_pago;
    document.getElementById('editCliente').value = ingreso.nombre_cliente || '';
    document.getElementById('editMonto').value = ingreso.monto;
    document.getElementById('editSucursal').value = ingreso.sucursal || 'Norte';

    // Soporte para notas si existe el campo
    const inputNotas = document.getElementById('editNotas');
    if (inputNotas) inputNotas.value = ingreso.notas || '';

    modal.classList.remove('hidden');
}

async function actualizarIngreso() {
    const id = document.getElementById('editIngresoId').value;
    const monto = parseFloat(document.getElementById('editMonto').value);
    const metodo = document.getElementById('editMetodo').value;

    const datos = {
        created_at: new Date(document.getElementById('editFecha').value + 'T12:00:00').toISOString(),
        categoria: document.getElementById('editCategoria').value.toUpperCase(),
        tipo: document.getElementById('editTipo').value,
        metodo_pago: metodo,
        nombre_cliente: document.getElementById('editCliente').value.toUpperCase(),
        monto: monto,
        comision_bancaria: 0,
        monto_neto: monto, // Ingreso íntegro, sin restar comisión
        sucursal: document.getElementById('editSucursal').value,
        notas: document.getElementById('editNotas')?.value.toUpperCase() || ""
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (res.ok) {
            document.getElementById('modalEditarIngreso')?.classList.add('hidden');
            cargarIngresos();
            alert("Ingreso actualizado con éxito.");
        }
    } catch (e) { console.error(e); }
}

async function eliminarIngreso(id) {
    if (!confirm("¿Estás seguro de eliminar este ingreso permanentemente?")) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (res.ok) {
            cargarIngresos();
            alert("Registro eliminado.");
        }
    } catch (e) { console.error(e); }
}

// 3. CÁLCULOS DE KPIs
async function actualizarCalculosKPIsIngresos(datos) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const ingresosHoyArr = datos.filter(i => i.created_at.includes(hoyStr) && i.tipo !== 'ABONO' && i.categoria !== 'COBRANZA');
    const totalHoy = ingresosHoyArr.reduce((s, i) => s + (i.monto || 0), 0);

    if (document.getElementById('kpiHoy')) document.getElementById('kpiHoy').innerText = formatMoney(totalHoy);

    const ticketPromDiario = ingresosHoyArr.length > 0 ? totalHoy / ingresosHoyArr.length : 0;
    if (document.getElementById('kpiTicketDiario')) document.getElementById('kpiTicketDiario').innerText = formatMoney(ticketPromDiario);

    // Filtrar abonos también para el promedio general y el total del mes
    const datosSinAbonos = datos.filter(i => i.tipo !== 'ABONO' && i.categoria !== 'COBRANZA');

    const ticketPromGral = datosSinAbonos.length > 0 ? datosSinAbonos.reduce((s, i) => s + (i.monto || 0), 0) / datosSinAbonos.length : 0;
    if (document.getElementById('kpiTicket')) document.getElementById('kpiTicket').innerText = formatMoney(ticketPromGral);

    const totalFiltrado = datosSinAbonos.reduce((s, i) => s + (i.monto || 0), 0);
    if (document.getElementById('kpiMes')) document.getElementById('kpiMes').innerText = formatMoney(totalFiltrado);

    // LIVE GOAL FETCH (Direct REST API)
    let meta = CONFIG_NEGOCIO.metaMensual || 300000;

    try {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-12

        const response = await fetch(`${SUPABASE_URL}/rest/v1/sys_metas_ingresos?select=monto_meta&anio=eq.${year}&mes=eq.${month}&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const dataAPI = await response.json();
            if (dataAPI && dataAPI.length > 0) {
                meta = parseFloat(dataAPI[0].monto_meta);
                // Update global config cache if successful
                if (window.CONFIG_NEGOCIO) window.CONFIG_NEGOCIO.metaMensual = meta;
            }
        }
    } catch (e) {
        console.warn("Meta Fetch Error (using fallback):", e);
    }

    const porcentajeMeta = meta > 0 ? Math.min((totalFiltrado / meta) * 100, 100) : 0;
    const barraMeta = document.getElementById('barraMeta');
    const textoMeta = document.getElementById('percentMeta');

    if (barraMeta) barraMeta.style.width = `${porcentajeMeta}%`;
    if (textoMeta) textoMeta.innerText = `${porcentajeMeta.toFixed(1)}%`;
}

// 4. LÓGICA DE REGISTRO MÚLTIPLE
function agregarFila() {
    const tbody = document.getElementById('filasCaptura');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "capture-row group";
    tr.innerHTML = `
        <td class="p-1"><input type="date" class="input-capture row-fecha" value="${new Date().toLocaleDateString('en-CA')}"></td>
        <td class="p-1"><input type="text" class="input-capture row-txn font-mono italic uppercase" placeholder="#TXN-000"></td>
        <td class="p-1"><select class="input-capture row-tipo"><option value="Venta Directa">Venta Directa</option><option value="Servicio">Servicio</option></select></td>
        <td class="p-1">
            <select class="input-capture row-metodo" onchange="verificarMetodoIngreso(this); actualizarCalculosTotales()">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia Hey Banco">Transferencia Hey Banco</option>
                <option value="Transferencia BBVA">Transferencia BBVA</option>
                <option value="Tarjeta Hey Banco">Tarjeta Hey Banco</option>
                <option value="Tarjeta BBVA">Tarjeta BBVA</option>
                <option value="Tarjeta Mercado Pago">Tarjeta Mercado Pago</option>
                <option value="Crédito">Crédito</option>
                <option value="Cheque">Cheque</option>
                <option value="Otros">Otros</option>
            </select>
            <input type="text" class="input-capture row-metodo-otro hidden mt-2 border-primary" placeholder="¿Cuál método?">
        </td>
        <td class="p-1"><input type="text" class="input-capture row-nombre bg-gray-100 opacity-50 uppercase font-black" placeholder="Nombre..." disabled></td>
        <td class="p-1"><input type="tel" class="input-capture row-tel bg-gray-100 opacity-50" placeholder="Teléfono..." disabled></td>
        <td class="p-1"><input type="number" step="0.01" class="input-capture text-right row-monto font-black" placeholder="0.00" oninput="actualizarCalculosTotales()"></td>
        <td class="p-1"><select class="input-capture row-sucursal"><option value="Sur">Sur</option><option value="Norte">Norte</option><option value="Matriz">Matriz</option></select></td>
        <td class="p-1"><input type="text" class="input-capture row-notas uppercase" placeholder="Notas / Descripción"></td>
        <td class="p-1 text-center"><button onclick="this.parentElement.parentElement.remove(); actualizarCalculosTotales();" class="text-gray-300 hover:text-red-500 transition-colors"><span class="material-symbols-outlined">delete</span></button></td>
    `;
    tbody.appendChild(tr);
    actualizarCalculosTotales();
}

function verificarMetodoIngreso(select) {
    const row = select.closest('tr');
    const inputNombre = row.querySelector('.row-nombre');
    const inputTel = row.querySelector('.row-tel');
    const inputOtro = row.querySelector('.row-metodo-otro');
    if (select.value === 'Crédito') {
        [inputNombre, inputTel].forEach(i => { i.disabled = false; i.classList.remove('bg-gray-100', 'opacity-50'); });
    } else {
        [inputNombre, inputTel].forEach(i => { i.disabled = true; i.value = ''; i.classList.add('bg-gray-100', 'opacity-50'); });
    }
    if (select.value === 'Otros') inputOtro.classList.remove('hidden');
    else { inputOtro.classList.add('hidden'); inputOtro.value = ''; }
}

function actualizarCalculosTotales() {
    const filas = document.querySelectorAll('#filasCaptura .capture-row');
    let suma = 0;
    filas.forEach(fila => { suma += parseFloat(fila.querySelector('.row-monto').value) || 0; });
    if (document.getElementById('montoTotalVisual')) document.getElementById('montoTotalVisual').innerText = formatMoney(suma);
    if (document.getElementById('contadorFilas')) document.getElementById('contadorFilas').innerText = `${filas.length} Ingresos`;
}

async function procesarLote() {
    const filas = document.querySelectorAll('#filasCaptura .capture-row');
    const datosParaEnviar = [];

    filas.forEach(fila => {
        const monto = parseFloat(fila.querySelector('.row-monto').value) || 0;
        const metodoBase = fila.querySelector('.row-metodo').value;
        const metodoOtro = fila.querySelector('.row-metodo-otro').value;
        const metodoFinal = metodoBase === 'Otros' ? metodoOtro.toUpperCase() : metodoBase;

        datosParaEnviar.push({
            created_at: new Date(fila.querySelector('.row-fecha').value + 'T12:00:00').toISOString(),
            categoria: fila.querySelector('.row-txn').value.toUpperCase(),
            tipo: fila.querySelector('.row-tipo').value,
            metodo_pago: metodoFinal,
            nombre_cliente: fila.querySelector('.row-nombre').value.toUpperCase(),
            telefono_cliente: fila.querySelector('.row-tel').value,
            monto: monto,
            comision_bancaria: 0,
            monto_neto: monto, // Ingreso íntegro
            sucursal: fila.querySelector('.row-sucursal').value,
            notas: fila.querySelector('.row-notas').value.toUpperCase(),
            estado_cobro: metodoBase === 'Crédito' ? 'Pendiente' : 'Pagado',
            saldo_pendiente: metodoBase === 'Crédito' ? monto : 0
        });
    });

    if (datosParaEnviar.length === 0) return alert("Agrega al menos un ingreso.");

    try {
        const btn = document.getElementById('btnProcesar');
        if (btn) { btn.disabled = true; btn.innerText = "Guardando..."; }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(datosParaEnviar)
        });

        if (response.ok) {
            alert("¡Ingresos guardados correctamente!");
            window.location.href = "ingresos.html";
        }
    } catch (error) { alert("Error al guardar."); }
}