// prestamos.js - Motor de Amortización y Gestión de Deuda Agrigarden

let datosCachePrestamos = [];
let prestamoSeleccionado = null;

// 1. CARGA INICIAL Y MONITOREO DE ESTATUS
let cacheGastosVinculados = [];

async function cargarPrestamos() {
    const tabla = document.getElementById('tablaPrestamos');
    if (!tabla) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/prestamos?select=*&order=fecha_obtencion.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        datosCachePrestamos = await response.json();

        // Consultar todos los gastos vinculados para KPIs reales
        const resGastos = await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*PRÉSTAMO:*`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        cacheGastosVinculados = await resGastos.json();

        aplicarFiltrosPrestamos();

    } catch (e) { console.error("Error Préstamos:", e); }
}

function aplicarFiltrosPrestamos() {
    const filtroSucursal = document.getElementById('filtroSucursalPrestamo')?.value || 'Todos';
    const filtrados = datosCachePrestamos.filter(p => filtroSucursal === 'Todos' || p.sucursal === filtroSucursal);
    currentFilteredPrestamos = filtrados;
    renderizarTablaPrestamos(filtrados);
}

// Export Logic
let currentFilteredPrestamos = [];

window.exportarPrestamos = function () {
    // Flatten logic for export? Maybe just basic fields first.
    // For loans, simple table export is usually enough.
    exportToExcel(
        currentFilteredPrestamos,
        {
            fecha_obtencion: "Fecha Obtención",
            prestamista: "Prestamista",
            descripcion: "Descripción",
            sucursal: "Sucursal",
            capital: "Capital Original",
            tasa_anual: "Tasa Anual (%)",
            plazo: "Plazo",
            periodicidad: "Periodicidad",
            mensualidad: "Mensualidad",
            estatus: "Estatus"
        },
        `Reporte_Prestamos_${new Date().toISOString().split('T')[0]}`,
        "Prestamos"
    );
}

function renderizarTablaPrestamos(datos) {
    const tabla = document.getElementById('tablaPrestamos');
    if (!tabla) return;
    tabla.innerHTML = "";

    const hoy = new Date();
    let sumaCapitalPendienteTotal = 0;
    let sumaInteresPendienteTotal = 0;
    let proximaFechaVencimiento = null;

    datos.forEach(p => {
        // Filtrar gastos específicos de este préstamo usando cache global
        const gastosEstePrestamo = cacheGastosVinculados.filter(g => g.notas.includes(p.descripcion));

        // Cuotas Vencidas
        const cuotasVencidas = gastosEstePrestamo.filter(g => {
            const fl = new Date(g.created_at);
            fl.setDate(fl.getDate() + (g.dias_credito || 0));
            return g.estado_pago === 'Pendiente' && hoy > fl;
        });

        // Calcular Capital Pendiente REAL (Solo lo que no se ha pagado)
        const capitalPagado = gastosEstePrestamo
            .filter(g => g.estado_pago === 'Pagado' && g.subcategoria === 'Abono Capital')
            .reduce((s, g) => s + parseFloat(g.monto_total), 0);

        const capitalRestante = p.capital - capitalPagado;

        // Intereses por pagar
        const interesesRestantes = gastosEstePrestamo
            .filter(g => g.estado_pago === 'Pendiente' && g.subcategoria === 'Intereses')
            .reduce((s, g) => s + parseFloat(g.monto_total), 0);

        if (p.estatus !== 'Liquidado') {
            sumaCapitalPendienteTotal += capitalRestante;
            sumaInteresPendienteTotal += interesesRestantes;

            // Detectar el vencimiento más próximo
            const proxGasto = gastosEstePrestamo
                .filter(g => g.estado_pago === 'Pendiente')
                .map(g => new Date(g.created_at))
                .sort((a, b) => a - b)[0];

            if (proxGasto && (!proximaFechaVencimiento || proxGasto < proximaFechaVencimiento)) {
                proximaFechaVencimiento = proxGasto;
            }
        }

        const esVigente = cuotasVencidas.length === 0 && p.estatus !== 'Liquidado';

        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all border-b border-gray-50 font-bold";
        fila.innerHTML = `
            <td class="px-6 py-5 text-xs text-gray-500">${new Date(p.fecha_obtencion).toLocaleDateString('es-MX')}</td>
            <td class="px-6 py-5 text-gray-800 uppercase text-xs">${p.prestamista}</td>
            <td class="px-6 py-5 text-black">
                <div class="flex flex-col">
                    <span class="text-sm font-black uppercase tracking-tight">${p.descripcion}</span>
                    <span class="text-[9px] text-primary font-bold uppercase">• ${p.sucursal}</span>
                </div>
            </td>
            <td class="px-6 py-5 text-right font-black text-slate-800">${formatMoney(p.capital)}</td>
            <td class="px-6 py-5 text-right text-xs text-blue-600">${p.tasa_anual}%</td>
            <td class="px-6 py-5 text-center text-xs text-gray-400">${p.plazo} (${p.periodicidad})</td>
            <td class="px-6 py-5 text-right text-emerald-600 font-black">${formatMoney(p.mensualidad)}</td>
            <td class="px-6 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[8px] font-black uppercase ${p.estatus === 'Liquidado' ? 'bg-gray-100 text-gray-400' : (esVigente ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}">
                    ${p.estatus === 'Liquidado' ? 'Liquidado' : (esVigente ? 'Vigente' : 'Mensualidad Vencida')}
                </span>
            </td>
            <td class="px-6 py-5 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick='abrirAvancePrestamo(${JSON.stringify(p)})' class="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Ver Avance">
                        <span class="material-symbols-outlined text-sm">query_stats</span>
                    </button>
                    ${p.estatus !== 'Liquidado' ? `
                        <button onclick='prepararEdicionPrestamo(${JSON.stringify(p)})' class="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-200 transition-all shadow-sm" title="Editar">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick='prepararLiquidacion(${JSON.stringify(p)})' class="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Liquidación Anticipada">
                            <span class="material-symbols-outlined text-sm">auto_delete</span>
                        </button>
                    ` : ''}
                    <button onclick="eliminarPrestamo('${p.id}', '${p.descripcion}')" class="p-2 bg-gray-50 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar KPIs
    if (document.getElementById('kpiCapitalPendiente')) document.getElementById('kpiCapitalPendiente').innerText = formatMoney(sumaCapitalPendienteTotal);
    if (document.getElementById('kpiInteresAcumulado')) document.getElementById('kpiInteresAcumulado').innerText = formatMoney(sumaInteresPendienteTotal);
    if (document.getElementById('kpiProximoPago')) document.getElementById('kpiProximoPago').innerText = proximaFechaVencimiento ? proximaFechaVencimiento.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '-- / --';
}

// NUEVA FUNCIÓN: VER AVANCE DE PRÉSTAMO
async function abrirAvancePrestamo(p) {
    document.getElementById('txtAvanceTitulo').innerText = `Avance: ${p.descripcion}`;
    const contenedor = document.getElementById('cuerpoAvanceHistorial');
    contenedor.innerHTML = '<tr><td colspan="5" class="py-10 text-center animate-pulse text-gray-400">Consultando historial real...</td></tr>';

    document.getElementById('modalAvancePrestamo').classList.remove('hidden');

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*PRÉSTAMO: ${p.descripcion}*&order=created_at.asc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const gastos = await res.json();
        const hoy = new Date();

        // Agrupar por cuota (Capital + Interés de la misma fecha)
        const cuotasMap = {};
        gastos.forEach(g => {
            const numCuota = g.notas.split(' ')[1];
            if (!cuotasMap[numCuota]) cuotasMap[numCuota] = { capital: 0, interes: 0, fecha: g.created_at, estado: g.estado_pago };
            if (g.subcategoria === 'Abono Capital') cuotasMap[numCuota].capital = g.monto_total;
            else cuotasMap[numCuota].interes = g.monto_total;
            // Si uno de los dos está pendiente, la cuota está pendiente
            if (g.estado_pago === 'Pendiente') cuotasMap[numCuota].estado = 'Pendiente';
        });

        contenedor.innerHTML = "";
        let pagadas = 0;
        let totalCuotas = Object.keys(cuotasMap).length;

        Object.keys(cuotasMap).forEach(num => {
            const c = cuotasMap[num];
            const fVenc = new Date(c.fecha);
            const esVencida = c.estado === 'Pendiente' && hoy > fVenc;
            if (c.estado === 'Pagado') pagadas++;

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-50";
            tr.innerHTML = `
                <td class="py-4 px-4 text-gray-400">Cuota ${num}</td>
                <td class="py-4 px-4">${new Date(c.fecha).toLocaleDateString('es-MX')}</td>
                <td class="py-4 px-4 text-right">${formatMoney(c.capital)}</td>
                <td class="py-4 px-4 text-right">${formatMoney(c.interes)}</td>
                <td class="py-4 px-4 text-center">
                    <span class="px-3 py-1 rounded-full text-[8px] font-black uppercase ${c.estado === 'Pagado' ? 'bg-blue-100 text-blue-600' : (esVencida ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600')}">
                        ${c.estado === 'Pagado' ? '✅ Pagada' : (esVencida ? '🔴 Vencida' : '⏳ Pendiente')}
                    </span>
                </td>
            `;
            contenedor.appendChild(tr);
        });

        // Actualizar Barra de Progreso y Textos
        const porcentaje = totalCuotas > 0 ? Math.round((pagadas / totalCuotas) * 100) : 0;
        document.getElementById('txtPorcentajeLiq').innerText = `${porcentaje}%`;
        document.getElementById('barraProgresoLiq').style.width = `${porcentaje}%`;
        document.getElementById('txtCuotasPagadas').innerText = `${pagadas} DE ${totalCuotas} CUOTAS PAGADAS`;

        const capitalRestante = gastos
            .filter(g => g.estado_pago === 'Pendiente' && g.subcategoria === 'Abono Capital')
            .reduce((s, g) => s + parseFloat(g.monto_total), 0);
        document.getElementById('txtCapitalRestante').innerText = `CAPITAL RESTANTE: ${formatMoney(capitalRestante)}`;

    } catch (e) { console.error(e); }
}

// 2. MOTOR DE AMORTIZACIÓN DINÁMICO (ACTUALIZADO PARA PAGO MANUAL)
function simularAmortizacion() {
    const capital = parseFloat(document.getElementById('capitalPrestamo').value) || 0;
    const tasaAnual = parseFloat(document.getElementById('tasaPrestamo').value) || 0;
    const plazoOriginal = parseInt(document.getElementById('plazoPrestamo').value) || 0;
    const periodicidad = document.getElementById('periodicidad').value;
    const rawFecha = document.getElementById('fechaPrestamo').value;

    console.log("Simulando:", { capital, tasaAnual, plazoOriginal, periodicidad, rawFecha });

    const tbody = document.getElementById('cuerpoAmortizacion');
    const txtTotalPagar = document.getElementById('txtTotalPagar');
    const inputManual = document.getElementById('inputMensualidad');
    const alerta = document.getElementById('alertaInteres');

    let missing = [];
    if (!rawFecha) missing.push("Fecha");
    if (capital <= 0) missing.push("Capital");
    if (plazoOriginal <= 0) missing.push("Plazo");
    if (tasaAnual <= 0) missing.push("Tasa");

    if (missing.length > 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-gray-300 italic font-bold">Faltan datos: ${missing.join(', ')}</td></tr>`;
        if (txtTotalPagar) txtTotalPagar.innerText = "$0.00";
        return;
    }

    // Attempt various date fixers
    let fechaBase = new Date(rawFecha + 'T12:00:00');
    if (isNaN(fechaBase.getTime())) {
        fechaBase = new Date(rawFecha.replace(/-/g, '/')); // Fallback
    }

    if (isNaN(fechaBase.getTime())) {
        console.error("Fecha inválida:", rawFecha);
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-red-400 font-bold">La fecha ingresada no es válida</td></tr>';
        return;
    }

    let numPagos = plazoOriginal;
    if (periodicidad === 'Semanal') { numPagos = plazoOriginal * 4; }
    if (periodicidad === 'Diario') { numPagos = plazoOriginal * 30; }

    const tasaPeriodo = tasaAnual > 0 ? (tasaAnual / 100) / (12 * (numPagos / plazoOriginal)) : 0;

    if (tasaPeriodo > 0 && (!inputManual.value || inputManual.value == 0)) {
        try {
            const mensualidadSugerida = (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numPagos));
            inputManual.value = isFinite(mensualidadSugerida) ? mensualidadSugerida.toFixed(2) : "0.00";
        } catch (err) {
            console.error("Error calculando sugerencia:", err);
        }
    }

    const pagoFijo = parseFloat(inputManual.value) || 0;
    if (txtTotalPagar) txtTotalPagar.innerText = formatMoney(pagoFijo * numPagos);

    tbody.innerHTML = "";

    let saldoRestante = capital;
    let alertaActivada = false;

    if (pagoFijo <= 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-gray-300 italic font-bold">Mensualidad inválida</td></tr>';
        return;
    }

    for (let i = 1; i <= numPagos; i++) {
        const interes = saldoRestante * tasaPeriodo;
        if (pagoFijo <= interes) alertaActivada = true;

        const abonoCapital = pagoFijo - interes;
        saldoRestante -= abonoCapital;

        const fechaPago = new Date(fechaBase);
        if (periodicidad === 'Mensual') fechaPago.setMonth(fechaBase.getMonth() + i);
        if (periodicidad === 'Semanal') fechaPago.setDate(fechaBase.getDate() + (i * 7));
        if (periodicidad === 'Diario') fechaPago.setDate(fechaBase.getDate() + i);

        // Security check for toISOString() RangeError
        const strFecha = isNaN(fechaPago.getTime()) ? rawFecha : fechaPago.toISOString().split('T')[0];

        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 hover:bg-white";
        tr.innerHTML = `
            <td class="py-3 px-2 text-gray-400 font-bold">${i}</td>
            <td class="py-3 px-2"><input type="date" class="input-table row-fecha" value="${strFecha}"></td>
            <td class="py-3 px-2"><input type="number" step="0.01" class="input-table row-capital text-blue-600" value="${abonoCapital.toFixed(2)}"></td>
            <td class="py-3 px-2"><input type="number" step="0.01" class="input-table row-interes text-orange-600" value="${interes.toFixed(2)}"></td>
            <td class="py-3 px-2 text-gray-900 font-black">${formatMoney(pagoFijo)}</td>
        `;
        tbody.appendChild(tr);
    }

    if (alerta) alerta.classList.toggle('hidden', !alertaActivada);
}

// 3. GUARDADO EN CASCADA (PRÉSTAMO + GASTOS)
async function guardarPrestamo() {
    // Get the button element reliably (can be the target or its parent)
    const btn = document.querySelector('#modalNuevoPrestamo button[onclick="guardarPrestamo()"]') ||
        (event ? event.currentTarget : null);

    if (btn) {
        btn.disabled = true;
        btn.innerText = "PROCESANDO...";
    }

    const capital = parseFloat(document.getElementById('capitalPrestamo').value);
    const mensualidad = parseFloat(document.getElementById('inputMensualidad').value);
    const descripcion = document.getElementById('descPrestamo').value.toUpperCase();
    const prestamista = document.getElementById('prestamista').value.toUpperCase();

    const prestamo = {
        fecha_obtencion: document.getElementById('fechaPrestamo').value,
        prestamista: prestamista,
        descripcion: descripcion,
        capital: capital,
        tasa_anual: parseFloat(document.getElementById('tasaPrestamo').value),
        plazo: parseInt(document.getElementById('plazoPrestamo').value),
        periodicidad: document.getElementById('periodicidad').value,
        mensualidad: mensualidad,
        sucursal: document.getElementById('sucursalPrestamo').value,
        estatus: 'Activo'
    };

    try {
        const resP = await fetch(`${SUPABASE_URL}/rest/v1/prestamos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(prestamo)
        });

        if (resP.ok) {
            const filas = document.querySelectorAll('#cuerpoAmortizacion tr');

            // Check if there are any rows with the necessary inputs
            if (filas.length === 0 || !filas[0].querySelector('.row-fecha')) {
                throw new Error("No se ha generado la tabla de amortización. Verifique los datos del préstamo.");
            }

            const gastosLote = [];

            filas.forEach((fila, index) => {
                const fPago = fila.querySelector('.row-fecha').value;
                const cap = parseFloat(fila.querySelector('.row-capital').value);
                const int = parseFloat(fila.querySelector('.row-interes').value);

                gastosLote.push({
                    created_at: fPago,
                    proveedor: prestamista,
                    categoria: 'Pago de Pasivo',
                    subcategoria: 'Abono Capital',
                    metodo_pago: 'Crédito',
                    monto_total: cap,
                    saldo_pendiente: cap,
                    estado_pago: 'Pendiente',
                    sucursal: prestamo.sucursal,
                    notas: `CUOTA ${index + 1} (CAPITAL) - PRÉSTAMO: ${descripcion}`
                });

                if (int > 0) {
                    gastosLote.push({
                        created_at: fPago,
                        proveedor: prestamista,
                        categoria: 'Gasto Financiero',
                        subcategoria: 'Intereses',
                        metodo_pago: 'Crédito',
                        monto_total: int,
                        saldo_pendiente: int,
                        estado_pago: 'Pendiente',
                        sucursal: prestamo.sucursal,
                        notas: `CUOTA ${index + 1} (INTERÉS) - PRÉSTAMO: ${descripcion}`
                    });
                }
            });

            await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(gastosLote)
            });

            // NUEVO: Registrar Ingreso del Capital (Entrada de Dinero al Banco/Caja)
            await fetch(`${SUPABASE_URL}/rest/v1/transacciones`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'INGRESO',
                    categoria: 'PRÉSTAMO',
                    monto: capital,
                    monto_neto: capital, // El capital entra íntegro
                    metodo_pago: 'Transferencia', // Asumimos transferencia por defecto en préstamos
                    nombre_cliente: prestamista, // En este caso el cliente es el prestamista (origen)
                    sucursal: prestamo.sucursal,
                    notas: `CAPITAL PRÉSTAMO RECIBIDO: ${descripcion}`
                })
            });

            alert("Préstamo registrado y gastos proyectados con éxito.");
            cerrarModalNuevoPrestamo();
            cargarPrestamos();
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = "Confirmar y Generar Gastos"; }
}

// 4. LÓGICA DE LIQUIDACIÓN ANTICIPADA (LIMPIEZA AUTOMÁTICA)
function prepararLiquidacion(p) {
    prestamoSeleccionado = p;
    document.getElementById('txtLiquidarInfo').innerText = `LIQUIDAR: ${p.descripcion} (${p.prestamista})`;
    document.getElementById('fechaLiquidacion').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalLiquidarPrestamo').classList.remove('hidden');
}

async function confirmarLiquidacion() {
    const fechaLiq = document.getElementById('fechaLiquidacion').value;
    const mCap = parseFloat(document.getElementById('liqCapital').value) || 0;
    const mInt = parseFloat(document.getElementById('liqInteres').value) || 0;
    const metodo = document.getElementById('metodoLiquidacion').value;

    if (!confirm("¿Confirmas la liquidación anticipada? Esto eliminará todos los gastos futuros proyectados.")) return;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*PRÉSTAMO: ${prestamoSeleccionado.descripcion}*&estado_pago=eq.Pendiente`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        await fetch(`${SUPABASE_URL}/rest/v1/prestamos?id=eq.${prestamoSeleccionado.id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ estatus: 'Liquidado' })
        });

        const pagoLiq = {
            created_at: fechaLiq,
            proveedor: prestamoSeleccionado.prestamista,
            categoria: 'Pago de Pasivo',
            subcategoria: 'Liquidación Anticipada',
            metodo_pago: metodo,
            monto_total: mCap + mInt,
            estado_pago: 'Pagado',
            saldo_pendiente: 0,
            sucursal: prestamoSeleccionado.sucursal,
            notas: `LIQUIDACIÓN ANTICIPADA TOTAL - PRÉSTAMO: ${prestamoSeleccionado.descripcion}`
        };

        const resLiq = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(pagoLiq)
        });

        const nuevoGasto = await resLiq.json();

        await fetch(`${SUPABASE_URL}/rest/v1/bitacora_proveedores`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gasto_id: nuevoGasto[0].id,
                nota: `LIQUIDACIÓN TOTAL EFECTUADA EL ${new Date(fechaLiq).toLocaleDateString()}. CAPITAL: ${formatMoney(mCap)} + INTERÉS: ${formatMoney(mInt)} VIA ${metodo}`
            })
        });

        alert("Deuda liquidada y registros proyectados eliminados.");
        document.getElementById('modalLiquidarPrestamo').classList.add('hidden');
        cargarPrestamos();

    } catch (e) { console.error(e); }
}

async function eliminarPrestamo(id, descripcion) {
    if (!confirm(`¿Eliminar préstamo "${descripcion}"? Esto borrará TODO rastro en Gastos y Cuentas por Pagar.`)) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*PRÉSTAMO: ${descripcion}*`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        await fetch(`${SUPABASE_URL}/rest/v1/prestamos?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        cargarPrestamos();
    } catch (e) { console.error(e); }
}

// 5. NUEVAS FUNCIONES PARA EDICIÓN Y REGENERACIÓN

function prepararEdicionPrestamo(p) {
    prestamoSeleccionado = p;
    document.getElementById('fechaPrestamo').value = p.fecha_obtencion;
    document.getElementById('prestamista').value = p.prestamista;
    document.getElementById('descPrestamo').value = p.descripcion;
    document.getElementById('capitalPrestamo').value = p.capital;
    document.getElementById('tasaPrestamo').value = p.tasa_anual;
    document.getElementById('plazoPrestamo').value = p.plazo;
    document.getElementById('periodicidad').value = p.periodicidad;
    document.getElementById('sucursalPrestamo').value = p.sucursal;
    document.getElementById('inputMensualidad').value = p.mensualidad;

    const btnGuardar = document.querySelector('#modalNuevoPrestamo button[onclick="guardarPrestamo()"]');
    if (btnGuardar) {
        btnGuardar.innerText = "ACTUALIZAR Y REGENERAR CUOTAS";
        btnGuardar.setAttribute("onclick", "actualizarPrestamo()");
    }

    simularAmortizacion();
    document.getElementById('modalNuevoPrestamo').classList.remove('hidden');
}

async function actualizarPrestamo() {
    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "REGENERANDO...";

    const idOriginal = prestamoSeleccionado.id;
    const descOriginal = prestamoSeleccionado.descripcion;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*PRÉSTAMO: ${descOriginal}*&estado_pago=eq.Pendiente`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        const capital = parseFloat(document.getElementById('capitalPrestamo').value);
        const mensualidad = parseFloat(document.getElementById('inputMensualidad').value);
        const nuevaDesc = document.getElementById('descPrestamo').value.toUpperCase();
        const prestamista = document.getElementById('prestamista').value.toUpperCase();

        const prestamoActualizado = {
            fecha_obtencion: document.getElementById('fechaPrestamo').value,
            prestamista: prestamista,
            descripcion: nuevaDesc,
            capital: capital,
            tasa_anual: parseFloat(document.getElementById('tasaPrestamo').value),
            plazo: parseInt(document.getElementById('plazoPrestamo').value),
            periodicidad: document.getElementById('periodicidad').value,
            mensualidad: mensualidad,
            sucursal: document.getElementById('sucursalPrestamo').value
        };

        const resP = await fetch(`${SUPABASE_URL}/rest/v1/prestamos?id=eq.${idOriginal}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(prestamoActualizado)
        });

        if (resP.ok) {
            const filas = document.querySelectorAll('#cuerpoAmortizacion tr');
            const nuevosGastos = [];

            filas.forEach((fila, index) => {
                const fPago = fila.querySelector('.row-fecha').value;
                const cap = parseFloat(fila.querySelector('.row-capital').value);
                const int = parseFloat(fila.querySelector('.row-interes').value);

                nuevosGastos.push({
                    created_at: fPago,
                    proveedor: prestamista,
                    categoria: 'Pago de Pasivo',
                    subcategoria: 'Abono Capital',
                    metodo_pago: 'Crédito',
                    monto_total: cap,
                    saldo_pendiente: cap,
                    estado_pago: 'Pendiente',
                    sucursal: prestamoActualizado.sucursal,
                    notas: `CUOTA ${index + 1} (CAPITAL) - PRÉSTAMO: ${nuevaDesc}`
                });

                if (int > 0) {
                    nuevosGastos.push({
                        created_at: fPago,
                        proveedor: prestamista,
                        categoria: 'Gasto Financiero',
                        subcategoria: 'Intereses',
                        metodo_pago: 'Crédito',
                        monto_total: int,
                        saldo_pendiente: int,
                        estado_pago: 'Pendiente',
                        sucursal: prestamoActualizado.sucursal,
                        notas: `CUOTA ${index + 1} (INTERÉS) - PRÉSTAMO: ${nuevaDesc}`
                    });
                }
            });

            await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevosGastos)
            });

            alert("Préstamo y plan de pagos actualizados correctamente.");
            cerrarModalNuevoPrestamo();
            cargarPrestamos();
        }
    } catch (e) {
        console.error(e);
        alert("Error al intentar actualizar el préstamo.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirmar y Generar Gastos";
        btn.setAttribute("onclick", "guardarPrestamo()");
    }
}