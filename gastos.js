// gastos.js - Gestión de Egresos y Registro Múltiple de Gastos

let datosCacheGastos = [];
let mostrarFuturosGastos = false; // Control de vista "Próximos Meses"

// 1. CARGA DE TABLA PRINCIPAL DE GASTOS
async function cargarGastos() {
    const tabla = document.getElementById('tablaGastos');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=*&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        datosCacheGastos = await response.json();
        aplicarFiltrosGastos();
    } catch (error) { console.error("Error gastos:", error); }
}

// NUEVA FUNCIÓN DE FILTRADO PARA MÓDULO DE GASTOS
function aplicarFiltrosGastos() {
    const busqueda = document.getElementById('inputBusquedaGastos')?.value.toLowerCase() || '';
    const filtroMetodo = document.getElementById('filtroMetodoGasto')?.value || 'Todos';
    const filtroCat = document.getElementById('filtroCategoriaGasto')?.value || 'Todos';
    const filtroSub = document.getElementById('filtroSubcategoriaGasto')?.value || 'Todos';
    const filtroSuc = document.getElementById('filtroSucursalGasto')?.value || 'Todos';

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const filtrados = datosCacheGastos.filter(item => {
        const fechaItem = new Date(item.created_at);

        // Lógica de Filtro por Mes Corriente
        if (!mostrarFuturosGastos) {
            const esFuturo = (fechaItem.getFullYear() > añoActual) || (fechaItem.getFullYear() === añoActual && fechaItem.getMonth() > mesActual);
            if (esFuturo) return false;
        }

        const coincideTxt = (item.proveedor?.toLowerCase().includes(busqueda)) ||
            (item.notas?.toLowerCase().includes(busqueda));
        const coincideMetodo = filtroMetodo === 'Todos' || item.metodo_pago === filtroMetodo;
        const coincideCat = filtroCat === 'Todos' || item.categoria === filtroCat;
        const coincideSub = filtroSub === 'Todos' || item.subcategoria === filtroSub;
        const coincideSuc = filtroSuc === 'Todos' || item.sucursal === filtroSuc;

        return coincideTxt && coincideMetodo && coincideCat && coincideSub && coincideSuc;
    });

    currentFilteredGastos = filtrados;
    renderizarTablaGastos(filtrados);
    actualizarKPIsGastos(filtrados);
}

// NUEVA VARIABLE GLOBAL PARA EXPORT
let currentFilteredGastos = [];

window.exportarGastos = function () {
    exportToExcel(
        currentFilteredGastos,
        {
            created_at: "Fecha",
            sucursal: "Sucursal",
            proveedor: "Proveedor",
            categoria: "Categoría",
            subcategoria: "Subcategoría",
            metodo_pago: "Método Pago",
            monto_total: "Monto",
            solicitante: "Solicitante",
            estado_pago: "Estado Pago",
            notas: "Notas"
        },
        `Reporte_Gastos_${new Date().toISOString().split('T')[0]}`,
        "Gastos"
    );
}

function renderizarTablaGastos(datos) {
    const tabla = document.getElementById('tablaGastos');
    if (!tabla) return;
    tabla.innerHTML = "";

    // Agrupación para Acordeón (Detectar capital e interés de la misma cuota)
    const grupos = {};
    datos.forEach(item => {
        const esCuota = item.notas && item.notas.includes("CUOTA");
        const llave = esCuota ? item.notas.split(') - ')[1] + item.created_at + item.proveedor : item.id;
        if (!grupos[llave]) grupos[llave] = [];
        grupos[llave].push(item);
    });

    Object.values(grupos).forEach(items => {
        const principal = items[0];
        const esGrupo = items.length > 1;
        const montoTotalGrupo = items.reduce((s, i) => s + (i.monto_total || 0), 0);
        const fecha = new Date(principal.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

        let badgeStyle = 'bg-gray-100 text-gray-700';
        if (principal.categoria === 'Costo') badgeStyle = 'bg-blue-100 text-blue-700';
        if (principal.categoria === 'Gasto Financiero') badgeStyle = 'bg-orange-100 text-orange-700';
        if (principal.categoria === 'Pago de Pasivo') badgeStyle = 'bg-purple-100 text-purple-700';

        const filaId = `fila-${principal.id}`;
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50 font-bold group";

        fila.innerHTML = `
            <td class="px-6 py-6 text-sm text-center text-gray-500">${fecha}</td>
            <td class="px-6 py-6 text-sm text-center text-gray-800 uppercase">
                <div class="flex items-center justify-center gap-2">
                    ${esGrupo ? `<button onclick="toggleAcordeon('${filaId}')" class="text-primary hover:scale-110 transition-transform"><span class="material-symbols-outlined text-sm">keyboard_arrow_down</span></button>` : ''}
                    ${principal.proveedor || 'S/P'}
                </div>
            </td>
            <td class="px-6 py-6 text-center"><span class="px-2 py-1 rounded text-[10px] uppercase ${badgeStyle}">${esGrupo ? 'INVERSIÓN' : principal.categoria}</span></td>
            <td class="px-6 py-6 text-center text-sm text-gray-400">${esGrupo ? 'CUOTA AMORTIZADA' : principal.subcategoria || '-'}</td>
            <td class="px-6 py-6 text-center text-sm text-gray-500">${principal.sucursal}</td>
            <td class="px-6 py-6 text-center text-sm text-gray-600">${principal.metodo_pago || 'Efectivo'}</td>
            <td class="px-6 py-6 text-center text-sm font-black text-blue-600">${principal.metodo_pago === 'Crédito' ? (principal.dias_credito || 0) + ' días' : '-'}</td>
            <td class="px-6 py-6 text-right font-black text-lg ${esGrupo ? 'text-black' : 'text-red-600'}">${formatMoney(montoTotalGrupo)}</td>
            <td class="px-6 py-6 text-center text-sm italic text-gray-400 max-w-[200px] truncate">${principal.notas || ''}</td>
            <td class="px-6 py-6 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick='abrirModalEdicion(${JSON.stringify(principal).replace(/'/g, "&apos;")})' class="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="eliminarGasto('${principal.id}', '${principal.notas}')" class="p-2 bg-gray-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </td>
        `;
        tabla.appendChild(fila);

        if (esGrupo) {
            const filaDetalle = document.createElement('tr');
            filaDetalle.id = filaId;
            filaDetalle.className = "hidden bg-gray-50/50 border-b border-gray-100";
            filaDetalle.innerHTML = `
                <td colspan="10" class="px-10 py-4">
                    <div class="flex flex-col gap-2">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Desglose de Amortización:</p>
                        ${items.map(sub => `
                            <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                                <span class="text-[10px] font-black uppercase text-gray-600">${sub.categoria} (${sub.subcategoria})</span>
                                <span class="text-sm font-black text-slate-800">${formatMoney(sub.monto_total)}</span>
                            </div>
                        `).join('')}
                    </div>
                </td>
            `;
            tabla.appendChild(filaDetalle);
        }
    });

    renderizarBotonVerMas(tabla);
}

function toggleAcordeon(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function renderizarBotonVerMas(tabla) {
    const tfoot = document.createElement('tr');
    tfoot.innerHTML = `
        <td colspan="10" class="p-6 text-center">
            <button onclick="toggleVistaFutura()" class="group flex items-center gap-2 mx-auto bg-gray-100 hover:bg-primary hover:text-black transition-all px-6 py-2 rounded-full text-[10px] font-black uppercase text-gray-500">
                <span class="material-symbols-outlined text-lg transition-transform ${mostrarFuturosGastos ? 'rotate-180' : ''}">expand_more</span>
                ${mostrarFuturosGastos ? 'Ocultar Meses Futuros' : 'Ver Próximos Meses'}
            </button>
        </td>
    `;
    tabla.appendChild(tfoot);
}

function toggleVistaFutura() {
    mostrarFuturosGastos = !mostrarFuturosGastos;
    aplicarFiltrosGastos();
}

// 2. ACTUALIZACIÓN DE MÉTRICAS (KPIs)
function actualizarKPIsGastos(datos) {
    try {
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const añoActual = ahora.getFullYear();
        const hoyStr = ahora.toISOString().split('T')[0];

        const gastosMes = datos.filter(i => {
            const d = new Date(i.created_at);
            return d.getMonth() === mesActual && d.getFullYear() === añoActual && (i.categoria !== 'Pago de Pasivo' || i.subcategoria === 'Abono Capital');
        });

        const totalMes = gastosMes.reduce((s, i) => s + (i.monto_total || 0), 0);
        const totalHoy = datos.filter(i => i.created_at.includes(hoyStr) && (i.categoria !== 'Pago de Pasivo' || i.subcategoria === 'Abono Capital')).reduce((s, i) => s + (i.monto_total || 0), 0);

        if (document.getElementById('kpiGastoMes')) document.getElementById('kpiGastoMes').innerText = formatMoney(totalMes);
        if (document.getElementById('kpiGastoHoy')) document.getElementById('kpiGastoHoy').innerText = formatMoney(totalHoy);

        actualizarProyeccionAnual(datos);

        if (gastosMes.length > 0) {
            const rankingCat = gastosMes.reduce((acc, curr) => { acc[curr.categoria] = (acc[curr.categoria] || 0) + (curr.monto_total || 0); return acc; }, {});
            const topCat = Object.keys(rankingCat).reduce((a, b) => rankingCat[a] > rankingCat[b] ? a : b);
            const elTopCat = document.getElementById('kpiTopCat');
            if (elTopCat) elTopCat.innerText = topCat.toUpperCase();
        } else {
            const elTopCat = document.getElementById('kpiTopCat');
            if (elTopCat) elTopCat.innerText = "-";
        }

        // Top 3 removed from UI for space, but logic kept safe if re-added
        const rankingCont = document.getElementById('historialConceptos');
        if (rankingCont) {
            const rankingSub = gastosMes.reduce((acc, curr) => {
                const sub = curr.subcategoria || "OTROS";
                acc[sub] = (acc[sub] || 0) + (curr.monto_total || 0);
                return acc;
            }, {});
            const sorted = Object.entries(rankingSub).sort(([, a], [, b]) => b - a).slice(0, 3);
            rankingCont.innerHTML = sorted.length ? sorted.map(([name, val], i) => `<p class="flex justify-between text-[11px] font-bold py-1"><span>${i + 1}. ${name.toUpperCase()}</span> <span class="text-red-500">${formatMoney(val)}</span></p>`).join('') : '<p class="text-[10px] italic text-gray-400 font-bold">Sin registros.</p>';
        }
    } catch (e) { console.error("Error KPIs Gastos:", e); }
}

// 4. LÓGICA DE FILTRO ANUAL
let anioSeleccionadoKPI = 'Current';

window.cambiarAnioKPI = function (val) {
    anioSeleccionadoKPI = val;
    // Re-calcular usando los datos en cache
    actualizarProyeccionAnual(datosCacheGastos);
}

function actualizarProyeccionAnual(datos) {
    const ahora = new Date();
    const currentYear = ahora.getFullYear();
    const targetYear = anioSeleccionadoKPI === 'Current' ? currentYear : (currentYear - 1);

    // Si estamos viendo el año pasado, el "mes actual" para promedio es diciembre (12 meses completos)
    // Si es año actual, es el mes que corre.
    const mesDivisor = anioSeleccionadoKPI === 'Current' ? (ahora.getMonth() + 1) : 12;

    const gastosItems = datos.filter(i => {
        const d = new Date(i.created_at);
        return d.getFullYear() === targetYear && (i.categoria !== 'Pago de Pasivo' || i.subcategoria === 'Abono Capital');
    });

    const total = gastosItems.reduce((s, i) => s + (i.monto_total || 0), 0);
    const promedio = mesDivisor > 0 ? total / mesDivisor : 0;

    // Actualizar Textos del Dropdown para feedback visual (opcional)
    const lblFiltro = document.getElementById('filtroAnioKPI');
    // if(lblFiltro) ...

    if (document.getElementById('kpiGastoAnual')) document.getElementById('kpiGastoAnual').innerText = formatMoney(total);
    if (document.getElementById('kpiPromedioAnual')) document.getElementById('kpiPromedioAnual').innerText = formatMoney(promedio);
}

// 3. LÓGICA DE REGISTRO MÚLTIPLE DE GASTOS
function agregarFilaGasto() {
    const tbody = document.getElementById('filasCapturaGastos');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "capture-row group";
    tr.innerHTML = `
        <td class="p-1"><input type="date" class="input-capture row-fecha" value="${new Date().toISOString().split('T')[0]}"></td>
        <td class="p-1"><input type="text" class="input-capture row-proveedor text-center uppercase" placeholder="Proveedor"></td>
        <td class="p-1"><select class="input-capture row-categoria text-center"><option value="Gasto">Gasto</option><option value="Costo">Costo</option><option value="Gasto Financiero">Gasto Financiero</option><option value="Pago de Pasivo">Pago de Pasivo</option></select></td>
        <td class="p-1"><select class="input-capture row-subcat text-center" onchange="verificarExtrasGasto(this)"><option value="Mantenimiento">Mantenimiento</option><option value="Marketing">Marketing</option><option value="Administrativos">Administrativos</option><option value="Mercancia">Mercancia</option><option value="Nomina">Nomina</option><option value="Combustible">Combustible</option><option value="Servicios">Servicios</option><option value="Taller">Taller</option><option value="Limpieza">Limpieza</option><option value="Papeleria">Papeleria</option><option value="Sistemas">Sistemas</option><option value="Renta">Renta</option><option value="Intereses">Intereses Financieros</option><option value="Abono Capital">Abono a Capital</option><option value="otros:">otros:</option></select><input type="text" class="input-capture row-subcat-extra hidden input-others text-center" placeholder="¿Cuál?"></td>
        <td class="p-1">
            <select class="input-capture row-metodo text-center" onchange="verificarExtrasGasto(this); actualizarTotalesGastos()">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia Hey Banco">Transferencia Hey Banco</option>
                <option value="Transferencia BBVA">Transferencia BBVA</option>
                <option value="Tarjeta de Credito BBVA">Tarjeta de Credito BBVA</option>
                <option value="Tarjeta de credito Hey Banco">Tarjeta de credito Hey Banco</option>
                <option value="cuenta Mercado Pago">cuenta Mercado Pago</option>
                <option value="Crédito">Crédito</option>
                <option value="Otros">Otros</option>
            </select>
            <input type="number" class="input-capture row-dias-credito hidden input-credit-days text-center" placeholder="Días crédito">
            <input type="text" class="input-capture row-metodo-otro hidden mt-2 border-red-500 uppercase text-center" placeholder="Escribe método...">
        </td>
        <td class="p-1"><input type="number" step="0.01" class="input-capture text-right row-monto font-black" placeholder="0.00" oninput="actualizarTotalesGastos()"></td>
        <td class="p-1"><select class="input-capture row-sucursal text-center"><option value="Sur">Sur</option><option value="Norte">Norte</option><option value="Matriz">Matriz</option></select></td>
        <td class="p-1"><input type="text" class="input-capture row-nota uppercase" placeholder="Notas..."></td>
        <td class="p-1 text-center"><button onclick="this.parentElement.parentElement.remove(); actualizarTotalesGastos();" class="text-gray-300 hover:text-red-500 transition-colors"><span class="material-symbols-outlined">delete</span></button></td>
    `;
    tbody.appendChild(tr);
    actualizarTotalesGastos();
}

function actualizarTotalesGastos() {
    const filas = document.querySelectorAll('#filasCapturaGastos .capture-row');
    let suma = 0;
    filas.forEach(fila => { suma += parseFloat(fila.querySelector('.row-monto').value) || 0; });
    const montoTotalDoc = document.getElementById('montoTotalGastos');
    const contadorDoc = document.getElementById('contadorGastos');
    if (montoTotalDoc) montoTotalDoc.innerText = formatMoney(suma);
    if (contadorDoc) contadorDoc.innerText = `${filas.length} Items`;
}

async function guardarLoteGastos() {
    const filas = document.querySelectorAll('#filasCapturaGastos .capture-row');
    const datosParaEnviar = [];
    filas.forEach(fila => {
        const monto = parseFloat(fila.querySelector('.row-monto').value) || 0;
        const metodoBase = fila.querySelector('.row-metodo').value;
        const metodoOtro = fila.querySelector('.row-metodo-otro').value;
        const metodoFinal = metodoBase === 'Otros' ? metodoOtro.toUpperCase() : metodoBase;
        const subcatBase = fila.querySelector('.row-subcat').value;
        const subcatExtra = fila.querySelector('.row-subcat-extra').value;
        datosParaEnviar.push({
            created_at: fila.querySelector('.row-fecha').value,
            proveedor: fila.querySelector('.row-proveedor').value.toUpperCase(),
            categoria: fila.querySelector('.row-categoria').value,
            subcategoria: subcatBase === 'otros:' ? subcatExtra.toUpperCase() : subcatBase,
            metodo_pago: metodoFinal,
            monto_total: monto,
            sucursal: fila.querySelector('.row-sucursal').value,
            notas: fila.querySelector('.row-nota').value.toUpperCase(),
            dias_credito: metodoBase === 'Crédito' ? parseInt(fila.querySelector('.row-dias-credito').value) || 0 : null,
            estado_pago: metodoBase === 'Crédito' ? 'Pendiente' : 'Pagado',
            saldo_pendiente: metodoBase === 'Crédito' ? monto : 0
        });
    });
    if (datosParaEnviar.length === 0) return alert("Agrega al menos un gasto para guardar.");
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(datosParaEnviar)
        });
        if (response.ok) { alert("¡Gastos guardados correctamente!"); window.location.href = "gastos.html"; }
    } catch (error) { console.error("Error:", error); }
}

function abrirModalEdicion(gasto) {
    const modal = document.getElementById('modalEditarGasto');
    if (!modal) return;
    document.getElementById('editGastoId').value = gasto.id;
    document.getElementById('editFecha').value = gasto.created_at.split('T')[0];
    document.getElementById('editProveedor').value = gasto.proveedor || '';
    document.getElementById('editCategoria').value = gasto.categoria || 'Gasto';
    document.getElementById('editSucursalGasto').value = gasto.sucursal || 'Matriz';
    document.getElementById('editSubcategoria').value = gasto.subcategoria || '';
    document.getElementById('editMetodo').value = gasto.metodo_pago || 'Efectivo';
    document.getElementById('editMonto').value = gasto.monto_total || 0;
    document.getElementById('editNotas').value = gasto.notas || '';
    const containerDias = document.getElementById('containerDiasCredito');
    if (gasto.metodo_pago === 'Crédito') { containerDias.classList.remove('hidden'); document.getElementById('editDiasCredito').value = gasto.dias_credito || 0; }
    else { containerDias.classList.add('hidden'); }
    modal.classList.remove('hidden');
}

async function actualizarGasto() {
    const id = document.getElementById('editGastoId').value;
    const monto = parseFloat(document.getElementById('editMonto').value);
    const metodo = document.getElementById('editMetodo').value;
    const datos = {
        created_at: document.getElementById('editFecha').value,
        proveedor: document.getElementById('editProveedor').value.toUpperCase(),
        categoria: document.getElementById('editCategoria').value,
        sucursal: document.getElementById('editSucursalGasto').value,
        subcategoria: document.getElementById('editSubcategoria').value.toUpperCase(),
        metodo_pago: metodo,
        monto_total: monto,
        notas: document.getElementById('editNotas').value.toUpperCase(),
        dias_credito: metodo === 'Crédito' ? parseInt(document.getElementById('editDiasCredito').value) || 0 : null
    };
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (res.ok) { cerrarModalEdicion(); cargarGastos(); alert("Gasto actualizado con éxito."); }
    } catch (e) { console.error(e); }
}

function cerrarModalEdicion() { const modal = document.getElementById('modalEditarGasto'); if (modal) modal.classList.add('hidden'); }

async function eliminarGasto(id, notas) {
    // Si el gasto es parte de una inversión, damos la opción de limpiar la serie completa
    if (notas && notas.includes("CUOTA")) {
        const nombreInversion = notas.split(') - ')[1];
        if (confirm(`Este gasto es parte de la inversión "${nombreInversion}". ¿Deseas eliminar TODA la serie de pagos de esta inversión?`)) {
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*${nombreInversion}*`, {
                    method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                if (res.ok) { alert("Serie de pagos eliminada."); cargarGastos(); }
                return;
            } catch (e) { console.error(e); }
        }
    }

    if (!confirm("¿Deseas eliminar este gasto individual?")) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${id}`, {
            method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (res.ok) cargarGastos();
    } catch (e) { console.error(e); }
}