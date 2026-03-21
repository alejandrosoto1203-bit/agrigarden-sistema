// gastos.js - Gestión de Egresos y Registro Múltiple de Gastos

// --- UTILS FALLBACK ---
if (typeof formatMoney === 'undefined') {
    window.formatMoney = (n) => {
        if (n === undefined || n === null) return "$0.00";
        return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };
    console.log("⚠️ gastos.js: formatMoney defined locally as fallback");
}
// ----------------------

let datosCacheGastos = [];
let mostrarFuturosGastos = false; // Control de vista "Próximos Meses"

// 1. CARGA DE TABLA PRINCIPAL DE GASTOS
async function cargarGastos() {
    const tablaSur = document.getElementById('tablaGastosSur');
    const tablaNorte = document.getElementById('tablaGastosNorte');
    if (!tablaSur && !tablaNorte) return;
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
    const tablaSur = document.getElementById('tablaGastosSur');
    const tablaNorte = document.getElementById('tablaGastosNorte');
    const contadorSur = document.getElementById('contadorGastosSur');
    const contadorNorte = document.getElementById('contadorGastosNorte');

    if (!tablaSur || !tablaNorte) return;

    tablaSur.innerHTML = "";
    tablaNorte.innerHTML = "";

    // Separar por sucursal
    const datosSur = datos.filter(i => i.sucursal === 'Sur');
    const datosNorte = datos.filter(i => i.sucursal === 'Norte' || !i.sucursal);

    // Actualizar contadores
    if (contadorSur) contadorSur.textContent = `(${datosSur.length} items)`;
    if (contadorNorte) contadorNorte.textContent = `(${datosNorte.length} items)`;

    // Función helper para renderizar en una tabla específica
    const renderizarEnTabla = (datosTabla, contenedor) => {
        // Agrupación para Acordeón
        const grupos = {};
        datosTabla.forEach(item => {
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
            if (principal.categoria === 'Gasto Contable') badgeStyle = 'bg-red-100 text-red-700';
            if (principal.categoria === 'Pago de Pasivo') badgeStyle = 'bg-purple-100 text-purple-700';

            const filaId = `fila-${principal.id}`;
            const fila = document.createElement('tr');
            fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50 font-bold group";

            fila.innerHTML = `
                <td class="px-2 py-3 text-center text-gray-500">${fecha}</td>
                <td class="px-2 py-3 text-center text-gray-800 uppercase truncate max-w-[80px]" title="${principal.proveedor || ''}">
                    ${esGrupo ? `<button onclick="toggleAcordeon('${filaId}')" class="text-primary hover:scale-110 transition-transform mr-1"><span class="material-symbols-outlined text-xs">keyboard_arrow_down</span></button>` : ''}
                    ${principal.proveedor || 'S/P'}
                </td>
                <td class="px-2 py-3 text-center"><span class="px-1 py-0.5 rounded text-[8px] uppercase ${badgeStyle}">${esGrupo ? 'INV' : principal.categoria?.substring(0, 5) || '-'}</span></td>
                <td class="px-2 py-3 text-center text-gray-400 truncate max-w-[60px]" title="${principal.subcategoria || ''}">${esGrupo ? 'CUOTA' : principal.subcategoria?.substring(0, 8) || '-'}</td>
                <td class="px-2 py-3 text-center text-gray-600 truncate max-w-[50px]">${principal.metodo_pago?.substring(0, 6) || 'Efect.'}</td>
                <td class="px-2 py-3 text-center font-bold text-blue-600">${principal.metodo_pago === 'Crédito' ? (principal.dias_credito || 0) + 'd' : '-'}</td>
                <td class="px-2 py-3 text-right font-black ${esGrupo ? 'text-black' : 'text-red-600'}">${formatMoney(montoTotalGrupo)}</td>
                <td class="px-2 py-3 text-center text-gray-400 truncate max-w-[50px] italic" title="${principal.notas || ''}">${principal.notas?.substring(0, 8) || '-'}</td>
                <td class="px-2 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        ${principal.categoria === 'Costo' && (principal.subcategoria || '').toUpperCase().includes('MERCANCIA') ? `
                        <button onclick="verDetalleCompra('${principal.id}')" class="p-1 bg-gray-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-all" title="Ver Detalle de Mercancía">
                            <span class="material-symbols-outlined text-xs">visibility</span>
                        </button>` : ''}
                        <button onclick='abrirModalEdicion(${JSON.stringify(principal).replace(/'/g, "&apos;")})' class="p-1 bg-gray-50 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button onclick="eliminarGasto('${principal.id}', '${principal.notas}')" class="p-1 bg-gray-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all">
                            <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                    </div>
                </td>
            `;
            contenedor.appendChild(fila);

            if (esGrupo) {
                const filaDetalle = document.createElement('tr');
                filaDetalle.id = filaId;
                filaDetalle.className = "hidden bg-gray-50/50 border-b border-gray-100";
                filaDetalle.innerHTML = `
                                        <td colspan="9" class="px-6 py-3">
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
                contenedor.appendChild(filaDetalle);
            }
        });

        if (datosTabla.length === 0) {
            contenedor.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-gray-400 italic text-xs">Sin registros</td></tr>';
        }
    };

    // Renderizar ambas tablas
    renderizarEnTabla(datosSur, tablaSur);
    renderizarEnTabla(datosNorte, tablaNorte);

    // --- BARRA DE TOTALES FILTRADOS ---
    const totalSurVal = datosSur.reduce((s, i) => s + (i.monto_total || 0), 0);
    const totalNorteVal = datosNorte.reduce((s, i) => s + (i.monto_total || 0), 0);
    const totalGen = totalSurVal + totalNorteVal;
    const totalTxn = datos.length;

    const elS = document.getElementById('totalGastosSur');
    const elN = document.getElementById('totalGastosNorte');
    const elG = document.getElementById('totalGastosGeneral');
    const elT = document.getElementById('totalGastosTxn');
    if (elS) elS.textContent = formatMoney(totalSurVal);
    if (elN) elN.textContent = formatMoney(totalNorteVal);
    if (elG) elG.textContent = formatMoney(totalGen);
    if (elT) elT.textContent = totalTxn.toLocaleString('es-MX') + ' reg.';
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

    // Actualizar Tabla Mensual
    actualizarTablaMensualGastos(datos, targetYear);
}

function actualizarTablaMensualGastos(datos, targetYear) {
    const filaNorte = document.getElementById('filaKpiNorte');
    const filaSur = document.getElementById('filaKpiSur');
    if (!filaNorte || !filaSur) return;

    const totales = { 'Norte': Array(12).fill(0), 'Sur': Array(12).fill(0) };

    datos.forEach(item => {
        const d = new Date(item.created_at);
        if (d.getFullYear() === targetYear) {
            const mes = d.getMonth();
            const sucursal = item.sucursal === 'Norte' || !item.sucursal ? 'Norte' : item.sucursal; // Handle null/empty as Norte like in renderizarTablaGastos
            if (totales[sucursal] !== undefined) {
                if (item.categoria !== 'Pago de Pasivo' || item.subcategoria === 'Abono Capital') {
                    totales[sucursal][mes] += (item.monto_total || 0);
                }
            }
        }
    });

    const actualizarFila = (fila, montos) => {
        const celdas = fila.querySelectorAll('td[data-month]');
        celdas.forEach(td => {
            const mes = parseInt(td.getAttribute('data-month'));
            const monto = montos[mes];
            td.innerText = monto > 0 ? formatMoney(monto) : '$0';
            td.className = monto > 0 ? "px-2 py-3 text-center text-slate-800 font-black" : "px-2 py-3 text-center text-gray-300 font-medium";
        });
    };

    actualizarFila(filaNorte, totales['Norte']);
    actualizarFila(filaSur, totales['Sur']);
}

function mostrarModalGasto() {
    window.location.href = "registro_gastos.html";
}

// 3. LÓGICA DE REGISTRO MÚLTIPLE DE GASTOS
let proveedoresCargados = [];
let productosVentaCache = [];

async function initGastosRegistro() {
    // Cargar proveedores para autocompletado
    try {
        const resP = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=id,nombre,rfc&order=nombre.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const dataP = await resP.json();
        proveedoresCargados = Array.isArray(dataP) ? dataP : [];
    } catch (e) {
        console.error('Error cargando proveedores:', e);
        proveedoresCargados = [];
    }

    // Cargar productos para SKU typeahead y autocompletar descripcion/costo
    try {
        const resProd = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=id,sku,nombre,costo_promedio&order=nombre.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const dataProd = await resProd.json();
        productosVentaCache = Array.isArray(dataProd) ? dataProd : [];
    } catch (e) {
        console.error('Error cargando productos:', e);
        productosVentaCache = [];
    }
}

// Inicializar si estamos en la vista de registro
if (window.location.pathname.includes('registro_gastos.html')) {
    initGastosRegistro().then(() => {
        // Remove the existing empty row that may have loaded sync
        const tbody = document.getElementById('filasCapturaGastos');
        if (tbody) tbody.innerHTML = '';
        rowIdCounter = 0;
        agregarFilaGasto();
    });
}

let rowIdCounter = 0;

function agregarFilaGasto() {
    const tbody = document.getElementById('filasCapturaGastos');
    if (!tbody) return;
    rowIdCounter++;
    const rId = `gasto-row-${rowIdCounter}`;

    const tr = document.createElement('tr');
    tr.className = "capture-row group align-top";
    tr.id = rId;

    tr.innerHTML = `
        <td class="p-1"><input type="date" class="input-capture row-fecha" value="${new Date().toISOString().split('T')[0]}"></td>
        <td class="p-1 relative">
            <div class="flex items-center gap-1">
                <input type="text" class="input-capture row-proveedor uppercase flex-1 text-center" placeholder="Buscar Proveedor..." list="datalistProveedores" oninput="validarProveedorSeleccionado(this)" data-pid="">
                <button type="button" onclick="abrirModalNuevoProveedorRapido(this)" class="p-1 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors shrink-0" title="Alta Rápida"><span class="material-symbols-outlined text-sm">person_add</span></button>
            </div>
            <datalist id="datalistProveedores">
                ${proveedoresCargados.map(p => `<option value="${p.nombre}"></option>`).join('')}
            </datalist>
        </td>
        <td class="p-1"><select class="input-capture row-categoria text-center" onchange="verificarMercanciaToggle('${rId}')"><option value="Gasto">Gasto</option><option value="Costo">Costo</option><option value="Gasto Financiero">Gasto Financiero</option><option value="Gasto Contable">Gasto Contable</option><option value="Pago de Pasivo">Pago de Pasivo</option></select></td>
        <td class="p-1"><select class="input-capture row-subcat text-center" onchange="verificarExtrasGasto(this); verificarMercanciaToggle('${rId}')"><option value="Mantenimiento">Mantenimiento</option><option value="Marketing">Marketing</option><option value="Administrativos">Administrativos</option><option value="Mercancia">Mercancia</option><option value="Nomina">Nomina</option><option value="Combustible">Combustible</option><option value="Servicios">Servicios</option><option value="Taller">Taller</option><option value="Limpieza">Limpieza</option><option value="Papeleria">Papeleria</option><option value="Sistemas">Sistemas</option><option value="Renta">Renta</option><option value="Intereses">Intereses Financieros</option><option value="Abono Capital">Abono a Capital</option><option value="Comisión Tarjeta">Comisión Tarjeta</option><option value="Depreciación">Depreciación</option><option value="otros:">otros:</option></select><input type="text" class="input-capture row-subcat-extra hidden input-others text-center" placeholder="¿Cuál?"></td>
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
        <td class="p-1"><input type="number" step="0.01" class="input-capture text-right row-monto font-black focus:bg-red-50 focus:text-red-600" placeholder="0.00" oninput="actualizarTotalesGastos()"></td>
        <td class="p-1"><select class="input-capture row-sucursal text-center"><option value="Sur">Sur</option><option value="Norte">Norte</option><option value="Matriz">Matriz</option></select></td>
        <td class="p-1"><input type="text" class="input-capture row-nota uppercase" placeholder="Notas..."></td>
        <td class="p-1 text-center"><button type="button" onclick="eliminarFilaGasto('${rId}')" class="text-gray-300 hover:text-red-500 transition-colors pt-2"><span class="material-symbols-outlined">delete</span></button></td>
    `;
    tbody.appendChild(tr);

    // Fila oculta para tabla de mercancia
    const trItems = document.createElement('tr');
    trItems.id = `${rId}-items-row`;
    trItems.className = "hidden bg-blue-50/30";
    trItems.innerHTML = `
        <td colspan="9" class="p-4 border-b border-blue-100">
            <div class="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-xs font-black uppercase tracking-widest text-blue-800 flex items-center gap-2"><span class="material-symbols-outlined text-sm">inventory_2</span> Detalle de Mercancía</h4>
                    <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">El monto total se calculará basado en estos artículos</span>
                </div>
                <table class="w-full text-xs text-left mb-3">
                    <thead class="bg-blue-50/50 text-blue-600 font-bold uppercase tracking-wider text-[9px]">
                        <tr>
                            <th class="py-2 px-2 w-[20%]">SKU / Producto</th>
                            <th class="py-2 px-2 w-[10%] text-center">Cantidad</th>
                            <th class="py-2 px-2 w-[40%]">Descripción (Auto)</th>
                            <th class="py-2 px-2 w-[12%] text-right">Costo Unit.</th>
                            <th class="py-2 px-2 w-[13%] text-right text-blue-800">Subtotal</th>
                            <th class="py-2 px-1 w-[5%]"></th>
                        </tr>
                    </thead>
                    <tbody id="${rId}-items-body">
                    </tbody>
                </table>
                <button type="button" id="${rId}-btn-add-mercancia" class="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"><span class="material-symbols-outlined text-sm">add</span> Añadir Artículo</button>
            </div>
        </td>
    `;
    tbody.appendChild(trItems);

    // Adjuntar evento de click explicitamente para evitar fallas silenciosas del DOM
    const btnAdd = document.getElementById(`${rId}-btn-add-mercancia`);
    if (btnAdd) {
        btnAdd.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            agregarFilaMercancia(rId);
        });
    }

    actualizarTotalesGastos();
}

function eliminarFilaGasto(rId) {
    document.getElementById(rId)?.remove();
    document.getElementById(`${rId}-items-row`)?.remove();
    actualizarTotalesGastos();
}

// ==========================================
// PROVEEDOR AUTOCOMPLETE & ALTA RAPIDA
// ==========================================
function validarProveedorSeleccionado(inputNode) {
    const val = inputNode.value.toUpperCase();
    inputNode.value = val;
    // Intentar buscar el ID
    const encontrado = proveedoresCargados.find(p => (p.nombre || '').toUpperCase() === val);
    if (encontrado) {
        inputNode.dataset.pid = encontrado.id;
        inputNode.classList.add('bg-green-50');
        inputNode.classList.remove('bg-gray-50');
    } else {
        inputNode.dataset.pid = "";
        inputNode.classList.remove('bg-green-50');
        inputNode.classList.add('bg-gray-50');
    }
}

let inputProveedorObjetivo = null;

function abrirModalNuevoProveedorRapido(btnNode) {
    // Buscar el input hermano
    const div = btnNode.closest('div');
    inputProveedorObjetivo = div.querySelector('.row-proveedor');

    document.getElementById('formProveedorRapido').reset();
    document.getElementById('modalFormularioProveedorRapido').classList.remove('hidden');
    document.getElementById('modalFormularioProveedorRapido').classList.add('flex');
}

function cerrarModalNuevoProveedorRapido() {
    document.getElementById('modalFormularioProveedorRapido').classList.add('hidden');
    document.getElementById('modalFormularioProveedorRapido').classList.remove('flex');
    inputProveedorObjetivo = null;
}

async function guardarProveedorRapido(e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarProvRapido');
    btn.disabled = true; btn.innerHTML = 'Guardando...';

    const data = {
        nombre: document.getElementById('formProvRapidoNombre').value.trim().toUpperCase(),
        telefono: document.getElementById('formProvRapidoTelefono').value.trim(),
        rfc: document.getElementById('formProvRapidoRfc').value.trim().toUpperCase(),
        regimen_fiscal: document.getElementById('formProvRapidoRegimen').value.trim(),
        direccion: document.getElementById('formProvRapidoDireccion').value.trim(),
        codigo_postal: document.getElementById('formProvRapidoCP').value.trim()
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=id,nombre,rfc`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al guardar proveedor');
        const nuevoprov = await res.json();

        // Agregar al cache local y al datalist
        proveedoresCargados.push(nuevoprov[0]);
        const dlist = document.getElementById('datalistProveedores');
        if (dlist) dlist.innerHTML += `<option value="${nuevoprov[0].nombre}"></option>`;

        // Auto-asignar en el front
        if (inputProveedorObjetivo) {
            inputProveedorObjetivo.value = nuevoprov[0].nombre;
            inputProveedorObjetivo.dataset.pid = nuevoprov[0].id;
            inputProveedorObjetivo.classList.add('bg-green-50');
        }

        cerrarModalNuevoProveedorRapido();
        alert('Proveedor registrado exitosamente.');
    } catch (err) {
        console.error(err);
        alert('Error registrando proveedor.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> Guardar';
    }
}

// ==========================================
// TABLA DINAMICA MERCANCIA
// ==========================================
function verificarMercanciaToggle(rId) {
    const tr = document.getElementById(rId);
    const cat = tr.querySelector('.row-categoria').value;
    const sub = tr.querySelector('.row-subcat').value;
    const rowItems = document.getElementById(`${rId}-items-row`);
    const inputMonto = tr.querySelector('.row-monto');

    if (cat === 'Costo' && sub === 'Mercancia') {
        rowItems.classList.remove('hidden');
        inputMonto.readOnly = true;
        inputMonto.classList.add('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
        // Si el body está vacío, agregar primera fila
        const tbd = document.getElementById(`${rId}-items-body`);
        if (tbd && tbd.children.length === 0) agregarFilaMercancia(rId);
    } else {
        rowItems.classList.add('hidden');
        inputMonto.readOnly = false;
        inputMonto.classList.remove('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
    }
    calcularTotalMercancia(rId);
}

function agregarFilaMercancia(gastoRowId) {
    const tbody = document.getElementById(`${gastoRowId}-items-body`);
    if (!tbody) { console.error("Body de mercancia no encontrado para id: ", gastoRowId); return; }
    const mid = `merc-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const tr = document.createElement('tr');
    tr.id = mid;
    tr.dataset.gastoRowId = gastoRowId;
    tr.className = "mercancia-item group border-b border-blue-50/50";

    tr.innerHTML = `
        <td class="p-1 relative">
            <input type="text" autocomplete="off"
                class="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs item-sku"
                placeholder="SKU o Nombre"
                oninput="buscarProductoSugerencias('${mid}')"
                onblur="setTimeout(()=>{ const d=document.getElementById('${mid}-sugs'); if(d) d.classList.add('hidden'); },150)">
            <div id="${mid}-sugs"
                class="hidden absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto mt-0.5 left-0 text-left"
                style="max-height:200px;min-width:320px"></div>
        </td>
        <td class="p-1"><input type="number" min="1" step="0.01" class="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-center item-qty" placeholder="0" value="1" oninput="calcularSubtotalMercancia('${mid}', '${gastoRowId}')"></td>
        <td class="p-1"><input type="text" class="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1.5 text-xs text-gray-600 item-desc" placeholder="Descripción extraida del SKU" readonly></td>
        <td class="p-1"><input type="number" min="0" step="0.01" class="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-right font-bold item-costo" placeholder="0.00" oninput="calcularSubtotalMercancia('${mid}', '${gastoRowId}')"></td>
        <td class="p-1"><input type="number" class="w-full bg-blue-50/30 border-none font-black text-right text-blue-700 px-2 py-1.5 text-xs item-subtotal" readonly value="0.00"></td>
        <td class="p-1 text-center"><button type="button" id="${mid}-btn-close" class="text-gray-300 hover:text-red-500"><span class="material-symbols-outlined text-sm pt-1">close</span></button></td>
    `;
    tbody.appendChild(tr);

    const btnClose = document.getElementById(`${mid}-btn-close`);
    if (btnClose) {
        btnClose.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById(mid)?.remove();
            calcularTotalMercancia(gastoRowId);
        });
    }
}

function buscarProductoSugerencias(mid) {
    const tr = document.getElementById(mid);
    const gastoRowId = tr.dataset.gastoRowId;
    const query = tr.querySelector('.item-sku').value.trim().toUpperCase();
    const sugsDiv = document.getElementById(`${mid}-sugs`);

    if (!query) { sugsDiv.classList.add('hidden'); return; }

    const matches = productosVentaCache.filter(p =>
        (p.sku && p.sku.toUpperCase().includes(query)) ||
        (p.nombre && p.nombre.toUpperCase().includes(query))
    ).slice(0, 10);

    if (!matches.length) { sugsDiv.classList.add('hidden'); return; }

    sugsDiv.innerHTML = matches.map(p => {
        const sku = (p.sku || '').replace(/'/g, "\\'");
        const nombre = (p.nombre || '').replace(/'/g, "\\'");
        const costo = p.costo_promedio || 0;
        return `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer flex gap-3 items-center border-b border-gray-50 last:border-0"
                    onmousedown="seleccionarProductoMercancia('${mid}','${gastoRowId}','${sku}','${nombre}',${costo})">
                    <span class="font-black text-gray-800 text-[11px] shrink-0 w-16">${p.sku || '—'}</span>
                    <span class="text-gray-500 text-[11px] truncate">${p.nombre || ''}</span>
                </div>`;
    }).join('');

    sugsDiv.classList.remove('hidden');
}

function seleccionarProductoMercancia(mid, gastoRowId, sku, nombre, costo) {
    const tr = document.getElementById(mid);
    tr.querySelector('.item-sku').value = sku || nombre;
    tr.querySelector('.item-desc').value = nombre;
    tr.querySelector('.item-costo').value = costo;
    document.getElementById(`${mid}-sugs`).classList.add('hidden');
    calcularSubtotalMercancia(mid, gastoRowId);
}

function autocompletarProducto(mid) {
    const tr = document.getElementById(mid);
    if (!tr) return;
    const inputStr = tr.querySelector('.item-sku').value;
    const prod = productosVentaCache.find(p =>
        (p.sku && p.sku.toUpperCase() === inputStr.toUpperCase()) ||
        (p.nombre && p.nombre.toUpperCase() === inputStr.toUpperCase())
    );
    if (prod) {
        tr.querySelector('.item-desc').value = prod.nombre || '';
        tr.querySelector('.item-costo').value = prod.costo_promedio || 0;
        if (prod.sku) tr.querySelector('.item-sku').value = prod.sku;
    } else {
        tr.querySelector('.item-desc').value = '';
    }
    const tbody = tr.parentElement;
    const gastoRowId = tbody.id.replace('-items-body', '');
    calcularSubtotalMercancia(mid, gastoRowId);
}

function calcularSubtotalMercancia(mid, gastoRowId) {
    const tr = document.getElementById(mid);
    if (!tr) return;
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const cost = parseFloat(tr.querySelector('.item-costo').value) || 0;
    tr.querySelector('.item-subtotal').value = (qty * cost).toFixed(2);

    calcularTotalMercancia(gastoRowId);
}

function calcularTotalMercancia(gastoRowId) {
    const tbody = document.getElementById(`${gastoRowId}-items-body`);
    if (!tbody) return;
    let suma = 0;
    tbody.querySelectorAll('.item-subtotal').forEach(inp => {
        suma += parseFloat(inp.value) || 0;
    });

    const inputMontoGasto = document.querySelector(`#${gastoRowId} .row-monto`);
    if (inputMontoGasto) {
        inputMontoGasto.value = suma.toFixed(2);
    }
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
    const mercanciaParaEnviar = []; // Tabla anidada

    filas.forEach(fila => {
        const monto = parseFloat(fila.querySelector('.row-monto').value) || 0;
        const metodoBase = fila.querySelector('.row-metodo').value;
        const subcatBase = fila.querySelector('.row-subcat').value;
        const subcatExtra = fila.querySelector('.row-subcat-extra').value;
        const metodoOtro = fila.querySelector('.row-metodo-otro').value;

        const cat = fila.querySelector('.row-categoria').value;
        const subcategoria = subcatBase === 'otros:' ? subcatExtra.toUpperCase() : subcatBase;
        const sucursalSel = fila.querySelector('.row-sucursal').value;
        const proveedorInput = fila.querySelector('.row-proveedor');

        // Extraer temporalmente un ID interno único si es mercancia para luego enlazar foreign key
        const internalId = `gasto_${Date.now()}_${Math.random()}`;

        const gastoNuevo = {
            id_referencia_temp: internalId, // Atributo inventado para cruzar localmente si aplica
            created_at: fila.querySelector('.row-fecha').value + 'T12:00:00',
            proveedor: proveedorInput.value.toUpperCase(),
            proveedor_id: proveedorInput.dataset.pid ? parseInt(proveedorInput.dataset.pid) : null,
            categoria: cat,
            subcategoria: subcategoria,
            metodo_pago: metodoBase === 'Otros' ? metodoOtro.toUpperCase() : metodoBase,
            monto_total: monto,
            sucursal: sucursalSel,
            notas: fila.querySelector('.row-nota').value.toUpperCase(),
            dias_credito: metodoBase === 'Crédito' ? parseInt(fila.querySelector('.row-dias-credito').value) || 0 : null,
            estado_pago: metodoBase === 'Crédito' ? 'Pendiente' : 'Pagado',
            saldo_pendiente: metodoBase === 'Crédito' ? monto : 0
        };

        datosParaEnviar.push(gastoNuevo);

        // Si es mercancia, recopilar items
        if (cat === 'Costo' && subcategoria === 'Mercancia') {
            const tbodyItems = document.getElementById(`${fila.id}-items-body`);
            if (tbodyItems) {
                tbodyItems.querySelectorAll('.mercancia-item').forEach(trItem => {
                    const sku = trItem.querySelector('.item-sku').value;
                    const qty = parseFloat(trItem.querySelector('.item-qty').value) || 0;
                    const costoUnit = parseFloat(trItem.querySelector('.item-costo').value) || 0;
                    if (sku && qty > 0) {
                        mercanciaParaEnviar.push({
                            gasto_ref: internalId,
                            sku: sku,
                            cantidad: qty,
                            costo_unitario: costoUnit,
                            total: qty * costoUnit,
                            sucursal_destino: sucursalSel
                        });
                    }
                });
            }
        }
    });

    if (datosParaEnviar.length === 0) return alert("Agrega al menos un gasto para guardar.");

    // Validar mercancias huerfanas (Costos sin articulos declarados)
    const costosMercancia = datosParaEnviar.filter(g => g.categoria === 'Costo' && g.subcategoria === 'Mercancia');
    if (costosMercancia.length > 0 && mercanciaParaEnviar.length === 0) {
        return alert("Has especificado gastos de Mercancía, pero no has añadido ningún artículo. Por favor, especifica el SKU y cantidad en el detalle o cambia la subcategoría.");
    }

    try {
        const btn = document.querySelector('button[onclick="guardarLoteGastos()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }

        // Mapear gastos reales despues de insert
        // Para poder hacer los inserts correspondientes a compras_items, tenemos que guardar 1 a 1 los gastos que llevan mercancia,
        // o guardar todos los gastos, que nos devuelvan el ID (requires `Prefer: return=representation`), y luego insertar la mercancía.
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=id,categoria,subcategoria`, {
            method: 'POST',
            // OJO: no se usan campos inventados, asi que lo borro temporalmente. Modificar map:
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(datosParaEnviar.map(g => { const raw = { ...g }; delete raw.id_referencia_temp; return raw; }))
        });

        if (!res.ok) throw new Error("Fallo la creación de gastos.");
        const gastosDB = await res.json();

        // Match them back. Assumption: The array comes back in exactly the same order based on the POST array. 
        // We will insert items now
        const itemsInsert = [];
        gastosDB.forEach((gDB, i) => {
            const gLocal = datosParaEnviar[i];
            const items = mercanciaParaEnviar.filter(itm => itm.gasto_ref === gLocal.id_referencia_temp);
            items.forEach(itm => {
                itemsInsert.push({
                    gasto_id: gDB.id, // el uuid db
                    sku: itm.sku,
                    cantidad: itm.cantidad,
                    costo_unitario: itm.costo_unitario,
                    total: itm.total,
                    sucursal_destino: itm.sucursal_destino
                });
            });
        });

        // Push items a compras_items en un batch
        if (itemsInsert.length > 0) {
            const resItems = await fetch(`${SUPABASE_URL}/rest/v1/compras_items`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(itemsInsert)
            });
            if (!resItems.ok) throw new Error("Error creando items de mercancía.");

            // Logica de actualizacion de STOCK en base a items comprados (llamada tipo batch a rpc o iterada)
            // Ya que compras_items tiene trigger? No, dijimos "Implementar lógica para sumar inventario en destino".
            // Para simplificar, llamo a supabase para que por cada sku le sume a stock_sucursal_X.
            for (const itm of itemsInsert) {
                const stockCol = itm.sucursal_destino === 'Norte' ? 'stock_norte' : (itm.sucursal_destino === 'Sur' ? 'stock_sur' : 'stock_matriz');
                // Supabase doesn't easily allow + math in pure REST without RPC, but since user didn't mention an RPC we created,
                // First Fetch the product `id` and current stock
                const prRes = await fetch(`${SUPABASE_URL}/rest/v1/productos?sku=eq.${itm.sku}&select=id,${stockCol}`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const prList = await prRes.json();
                if (prList && prList.length > 0) {
                    const currentStock = prList[0][stockCol] || 0;
                    const bdy = {};
                    bdy[stockCol] = currentStock + itm.cantidad;
                    // Promediar costo (Opción simplificada o no)

                    await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${prList[0].id}`, {
                        method: 'PATCH',
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(bdy)
                    });
                }
            }
        }

        alert("¡Gastos guardados correctamente!");
        window.location.href = "gastos.html";

    } catch (error) {
        console.error("Error al guardar lote:", error);
        alert("Ocurrió un error general guardando. Verifica conexión. " + error.message);
    }
}

async function abrirModalEdicion(gasto) {
    const modal = document.getElementById('modalEditarGasto');
    if (!modal) return;
    document.getElementById('editGastoId').value = gasto.id;
    document.getElementById('editFecha').value = gasto.created_at.split('T')[0];
    document.getElementById('editProveedor').value = gasto.proveedor || '';
    document.getElementById('editCategoria').value = gasto.categoria || 'Gasto';
    document.getElementById('editSucursalGasto').value = gasto.sucursal || 'Matriz';
    document.getElementById('editSubcategoria').value = gasto.subcategoria || '';
    document.getElementById('editMonto').value = gasto.monto_total || 0;
    document.getElementById('editNotas').value = gasto.notas || '';
    const containerDias = document.getElementById('containerDiasCredito');
    if (gasto.metodo_pago === 'Crédito') { containerDias.classList.remove('hidden'); document.getElementById('editDiasCredito').value = gasto.dias_credito || 0; }
    else { containerDias.classList.add('hidden'); }
    // Cargar métodos de pago dinámicos desde PROD
    const selectMetodo = document.getElementById('editMetodo');
    if (selectMetodo) {
        try {
            const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
            const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=nombre&activo=eq.true&order=orden.asc`, { headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` } });
            if (r.ok) {
                const metodos = await r.json();
                if (metodos && metodos.length > 0) {
                    selectMetodo.innerHTML = metodos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
                }
            }
        } catch(e) {}
    }
    if (selectMetodo && gasto.metodo_pago) selectMetodo.value = gasto.metodo_pago;
    modal.classList.remove('hidden');
}

async function actualizarGasto() {
    const id = document.getElementById('editGastoId').value;
    const monto = parseFloat(document.getElementById('editMonto').value);
    const metodo = document.getElementById('editMetodo').value;
    const datos = {
        created_at: document.getElementById('editFecha').value + 'T12:00:00',
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

    if (!confirm("¿Deseas eliminar este registro de gasto? Si contiene mercancía, se restará del inventario de su sucursal.")) return;
    try {
        // Verificar si existen compras_items vinculados a este gasto
        const resItems = await fetch(`${SUPABASE_URL}/rest/v1/compras_items?gasto_id=eq.${id}&select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const items = await resItems.json();

        if (items && items.length > 0) {
            // Revertir el inventario 
            for (const itm of items) {
                const stockCol = itm.sucursal_destino === 'Norte' ? 'stock_norte' : (itm.sucursal_destino === 'Sur' ? 'stock_sur' : 'stock_matriz');

                const prRes = await fetch(`${SUPABASE_URL}/rest/v1/productos?sku=eq.${itm.sku}&select=id,${stockCol}`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const prList = await prRes.json();

                if (prList && prList.length > 0) {
                    const currentStock = prList[0][stockCol] || 0;
                    const bdy = {};
                    bdy[stockCol] = Math.max(0, currentStock - itm.cantidad); // Restar

                    await fetch(`${SUPABASE_URL}/rest/v1/productos?id=eq.${prList[0].id}`, {
                        method: 'PATCH',
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(bdy)
                    });
                }
            }
        }

        // Eliminar el Gasto principal (la mercancía conectada por llave foránea cascade debería eliminarse,
        // pero de cualquier manera supabase la elimina en cascada si está configurado así, sino borrarla también)
        if (items && items.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/compras_items?gasto_id=eq.${id}`, {
                method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
        }

        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?id=eq.${id}`, {
            method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (res.ok) cargarGastos();
    } catch (e) { console.error(e); }
}

async function verDetalleCompra(gasto_id) {
    const modal = document.getElementById('modalDetalleCompra');
    const tbody = document.getElementById('tbodyDetalleCompra');
    if (!modal || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400 text-xs">Cargando detalles...</td></tr>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/compras_items?gasto_id=eq.${gasto_id}&select=*,productos(nombre)`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const items = await res.json();

        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400 text-xs italic">No hay artículos registrados para esta compra.</td></tr>';
            return;
        }

        let total = 0;
        tbody.innerHTML = items.map(itm => {
            total += (itm.total || 0);
            return `
                <tr class="border-b border-gray-50">
                    <td class="px-2 py-2 text-xs font-bold text-gray-700">${itm.sku} - ${itm.productos?.nombre || ''}</td>
                    <td class="px-2 py-2 text-xs text-center">${itm.cantidad}</td>
                    <td class="px-2 py-2 text-xs text-right font-medium">${formatMoney(itm.costo_unitario)}</td>
                    <td class="px-2 py-2 text-xs text-right font-black text-emerald-600">${formatMoney(itm.total)}</td>
                </tr>
            `;
        }).join('');

        // Fila de total
        tbody.innerHTML += `
            <tr class="bg-gray-50/50">
                <td colspan="3" class="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">Total Importe Artículos:</td>
                <td class="px-2 py-3 text-right text-sm font-black text-red-500">${formatMoney(total)}</td>
            </tr>
        `;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-400 text-xs">Error cargando información.</td></tr>';
    }
}

function cerrarModalDetalleCompra() {
    const modal = document.getElementById('modalDetalleCompra');
    if (modal) modal.classList.add('hidden');
}

// Ensure all dynamic inner-html bound functions are accessible globally
window.agregarFilaGasto = agregarFilaGasto;
window.eliminarFilaGasto = eliminarFilaGasto;
window.validarProveedorSeleccionado = validarProveedorSeleccionado;
window.abrirModalNuevoProveedorRapido = abrirModalNuevoProveedorRapido;
window.cerrarModalNuevoProveedorRapido = cerrarModalNuevoProveedorRapido;
window.guardarProveedorRapido = guardarProveedorRapido;
window.verificarMercanciaToggle = verificarMercanciaToggle;
window.agregarFilaMercancia = agregarFilaMercancia;
window.buscarProductoSugerencias = buscarProductoSugerencias;
window.seleccionarProductoMercancia = seleccionarProductoMercancia;
window.autocompletarProducto = autocompletarProducto;
window.calcularSubtotalMercancia = calcularSubtotalMercancia;
window.calcularTotalMercancia = calcularTotalMercancia;
window.actualizarTotalesGastos = actualizarTotalesGastos;
window.guardarLoteGastos = guardarLoteGastos;