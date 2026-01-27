// inventario.js - Lógica de Gestión de Inventario Mensual

// HARDCODED CREDENTIALS (Proven working pattern)
const SB_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let sbClientInv;
if (window.supabase && window.supabase.createClient) {
    sbClientInv = window.supabase.createClient(SB_URL, SB_KEY);
    console.log("Supabase Inventario Initialized");
} else {
    console.error("Supabase Lib not found");
}

// Helper local para asegurar disponibilidad
const formatMoney = (n) => {
    if (n === undefined || n === null) return "$0.00";
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
};

// =====================================================
// CÁLCULO DE COSTO DE VENTAS
// Fórmula: Inventario Inicial + Compras - Inventario Final
// Compras = suma de gastos con subcategoria 'Mercancia'
// =====================================================
async function obtenerComprasMes(mes, anio, sucursal = null) {
    if (!sbClientInv) return 0;

    try {
        // Construir rango de fechas para el mes
        const primerDia = new Date(anio, mes - 1, 1);
        const ultimoDia = new Date(anio, mes, 0, 23, 59, 59);

        // Case-insensitive match for 'Mercancia' / 'MERCANCIA'
        let query = sbClientInv
            .from('gastos')
            .select('monto_total')
            .ilike('subcategoria', 'mercancia')
            .gte('created_at', primerDia.toISOString())
            .lte('created_at', ultimoDia.toISOString());

        // Filtrar por sucursal si se especifica
        if (sucursal && sucursal !== 'Todos') {
            query = query.eq('sucursal', sucursal);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching compras:', error);
            return 0;
        }

        // Sumar todos los montos
        const total = (data || []).reduce((sum, g) => sum + (parseFloat(g.monto_total) || 0), 0);
        return total;

    } catch (err) {
        console.error('Error en obtenerComprasMes:', err);
        return 0;
    }
}

function calcularCostoVentas(inventarioInicial, compras, inventarioFinal) {
    // Fórmula: Inv. Inicial + Compras - Inv. Final
    return (inventarioInicial || 0) + (compras || 0) - (inventarioFinal || 0);
}

// Global Export Logic
let currentFilteredInventario = [];

window.exportarInventario = function () {
    // We want to export rows similar to the table view (flattened)
    const exportRows = [];
    currentFilteredInventario.forEach(item => {
        if (item.monto_inicial !== null) {
            exportRows.push({
                Mes: item.mes,
                Anio: item.anio,
                Sucursal: item.sucursal || 'Matriz',
                Tipo: 'Inicial',
                Monto: item.monto_inicial,
                MontoFmt: formatMoney(item.monto_inicial)
            });
        }
        if (item.monto_final !== null) {
            exportRows.push({
                Mes: item.mes,
                Anio: item.anio,
                Sucursal: item.sucursal || 'Matriz',
                Tipo: 'Final',
                Monto: item.monto_final,
                MontoFmt: formatMoney(item.monto_final)
            });
        }
    });

    exportToExcel(
        exportRows,
        {
            Mes: "Mes",
            Anio: "Año",
            Sucursal: "Sucursal",
            Tipo: "Tipo Inventario",
            Monto: "Valor ($)"
        },
        `Reporte_Inventario_Mensual_${new Date().getFullYear()}`,
        "Inventario"
    );
}

let inventarioCache = [];
let costoVentasData = []; // Almacena los cálculos de costo de ventas por mes

window.cargarInventario = async function () {
    if (!sbClientInv) return;

    const anio = document.getElementById('filtroYear')?.value || new Date().getFullYear();
    const filtroSucursal = document.getElementById('filtroSucursal')?.value || 'Todos';
    const tbody = document.getElementById('tablaInventario');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-400 italic">Cargando...</td></tr>`;

    try {
        const { data, error } = await sbClientInv
            .from('inventario_mensual')
            .select('*')
            .eq('anio', anio)
            .order('mes', { ascending: true });

        if (error) {
            console.error(error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Error de Base de Datos: <br><span class="text-xs font-normal">${error.message}</span></td></tr>`;
            return;
        }

        inventarioCache = data || [];
        const filtrados = inventarioCache.filter(item => filtroSucursal === 'Todos' || item.sucursal === filtroSucursal);

        currentFilteredInventario = filtrados;

        // Calcular Costo de Ventas para cada mes que tenga ambos inventarios
        costoVentasData = [];
        for (const item of filtrados) {
            if (item.monto_inicial !== null && item.monto_final !== null) {
                const compras = await obtenerComprasMes(item.mes, item.anio, item.sucursal);
                const costoVentas = calcularCostoVentas(item.monto_inicial, compras, item.monto_final);
                costoVentasData.push({
                    mes: item.mes,
                    anio: item.anio,
                    sucursal: item.sucursal,
                    inventarioInicial: item.monto_inicial,
                    compras: compras,
                    inventarioFinal: item.monto_final,
                    costoVentas: costoVentas
                });
            }
        }

        renderizarTabla(filtrados);
        renderizarCostoVentas();

    } catch (err) {
        console.error("Error fetching inventory:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Error Inesperado: <br><span class="text-xs font-normal">${err.message}</span></td></tr>`;
    }
}

// Renderizar sección de Costo de Ventas - Separado por Sucursal
function renderizarCostoVentas() {
    const container = document.getElementById('costoVentasContainer');
    if (!container) return;

    if (costoVentasData.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 text-gray-400 italic text-sm col-span-full">
                Para ver el Costo de Ventas, registra el inventario inicial y final de un mes.
            </div>`;
        return;
    }

    const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Separar por sucursal
    const dataSur = costoVentasData.filter(cv => cv.sucursal === 'Sur');
    const dataNorte = costoVentasData.filter(cv => cv.sucursal === 'Norte');
    const dataMatriz = costoVentasData.filter(cv => cv.sucursal === 'Matriz' || !cv.sucursal);

    // Función para generar tarjeta
    const generarTarjeta = (cv, colorClass = 'from-slate-900 to-slate-800') => `
        <div class="bg-gradient-to-br ${colorClass} text-white rounded-2xl p-5 shadow-xl">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="text-base font-black uppercase">${meses[cv.mes]} ${cv.anio}</h4>
                </div>
                <span class="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-[9px] font-black uppercase">Costo Ventas</span>
            </div>
            <div class="space-y-1 text-xs">
                <div class="flex justify-between">
                    <span class="text-slate-400">Inv. Inicial</span>
                    <span class="font-bold">${formatMoney(cv.inventarioInicial)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-400">(+) Compras</span>
                    <span class="font-bold text-blue-400">${formatMoney(cv.compras)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-400">(-) Inv. Final</span>
                    <span class="font-bold">${formatMoney(cv.inventarioFinal)}</span>
                </div>
                <div class="border-t border-slate-700 pt-2 mt-2">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-300 font-bold text-[10px]">(=) TOTAL</span>
                        <span class="text-xl font-black ${cv.costoVentas >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatMoney(cv.costoVentas)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 col-span-full">';

    // Columna Izquierda - Sur
    html += `<div class="space-y-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-blue-500"></span> Sucursal Sur
        </h4>
        <div class="space-y-3">
            ${dataSur.length > 0
            ? dataSur.map(cv => generarTarjeta(cv, 'from-blue-900 to-slate-800')).join('')
            : '<p class="text-gray-400 text-xs italic p-4 bg-gray-50 rounded-xl">Sin datos de costo de ventas</p>'}
        </div>
    </div>`;

    // Columna Derecha - Norte
    html += `<div class="space-y-4">
        <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-purple-500"></span> Sucursal Norte
        </h4>
        <div class="space-y-3">
            ${dataNorte.length > 0
            ? dataNorte.map(cv => generarTarjeta(cv, 'from-purple-900 to-slate-800')).join('')
            : '<p class="text-gray-400 text-xs italic p-4 bg-gray-50 rounded-xl">Sin datos de costo de ventas</p>'}
        </div>
    </div>`;

    html += '</div>';

    // Matriz (si hay datos) - abajo de todo
    if (dataMatriz.length > 0) {
        html += `<div class="col-span-full mt-4 space-y-4">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-500"></span> Matriz
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${dataMatriz.map(cv => generarTarjeta(cv, 'from-emerald-900 to-slate-800')).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

function renderizarTabla(lista) {
    const container = document.getElementById('historicoContainer');
    if (!container) {
        // Fallback to old tbody if new container doesn't exist
        const tbody = document.getElementById('tablaInventario');
        if (tbody) renderizarTablaSingle(lista, tbody);
        return;
    }

    const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Flatten list
    const rows = [];
    lista.forEach(item => {
        if (item.monto_inicial !== null && item.monto_inicial !== undefined) {
            rows.push({
                ...item,
                tipo: 'Inicial',
                monto: item.monto_inicial,
                key: 'inicial'
            });
        }
        if (item.monto_final !== null && item.monto_final !== undefined) {
            rows.push({
                ...item,
                tipo: 'Final',
                monto: item.monto_final,
                key: 'final'
            });
        }
    });

    // Separar por sucursal
    const rowsSur = rows.filter(r => r.sucursal === 'Sur');
    const rowsNorte = rows.filter(r => r.sucursal === 'Norte');
    const rowsMatriz = rows.filter(r => r.sucursal === 'Matriz' || !r.sucursal);

    // Función para generar fila
    const generarFila = (row) => {
        const badgeColor = row.key === 'inicial' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100';
        return `
            <tr class="hover:bg-gray-50/50 transition-colors group border-b border-gray-100">
                <td class="p-3 pl-4">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${meses[row.mes] || 'Desconocido'}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${row.anio}</p>
                    </div>
                </td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase border ${badgeColor}">
                        ${row.tipo}
                    </span>
                </td>
                <td class="p-3 text-right font-mono text-slate-900 font-bold text-sm">${formatMoney(row.monto)}</td>
                <td class="p-3 text-center">
                    <button onclick="editarRegistro(${row.id}, '${row.key}')" class="text-gray-400 hover:text-black transition-colors p-1.5 rounded-full hover:bg-gray-100">
                        <span class="material-symbols-outlined text-base">edit_square</span>
                    </button>
                </td>
            </tr>
        `;
    };

    // Función para generar tabla de sucursal
    const generarTablaSucursal = (filas, titulo, colorDot, emptyMsg) => {
        if (filas.length === 0) {
            return `
                <div class="card p-4 bg-gray-50/50">
                    <p class="text-gray-400 text-xs italic text-center">${emptyMsg}</p>
                </div>
            `;
        }
        return `
            <div class="card overflow-hidden shadow-sm">
                <table class="w-full text-left">
                    <thead class="bg-gray-50 text-gray-400 font-black text-[9px] uppercase tracking-wider">
                        <tr>
                            <th class="p-3 pl-4">Mes</th>
                            <th class="p-3">Tipo</th>
                            <th class="p-3 text-right">Monto</th>
                            <th class="p-3 text-center w-16">Acc.</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50 text-sm">
                        ${filas.map(generarFila).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

    // Columna Izquierda - Sur
    html += `<div class="space-y-3">
        <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-blue-500"></span> Sucursal Sur
        </h4>
        ${generarTablaSucursal(rowsSur, 'Sur', 'bg-blue-500', 'Sin registros de inventario')}
    </div>`;

    // Columna Derecha - Norte
    html += `<div class="space-y-3">
        <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-purple-500"></span> Sucursal Norte
        </h4>
        ${generarTablaSucursal(rowsNorte, 'Norte', 'bg-purple-500', 'Sin registros de inventario')}
    </div>`;

    html += '</div>';

    // Matriz (si hay datos)
    if (rowsMatriz.length > 0) {
        html += `<div class="mt-6 space-y-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-emerald-500"></span> Matriz
            </h4>
            ${generarTablaSucursal(rowsMatriz, 'Matriz', 'bg-emerald-500', 'Sin registros')}
        </div>`;
    }

    container.innerHTML = html;
}

let currentEditItem = null;

window.setTipo = function (tipo) {
    const btnInicial = document.getElementById('btnTipoInicial');
    const btnFinal = document.getElementById('btnTipoFinal');
    const lblMonto = document.getElementById('lblMonto');
    const inputMonto = document.getElementById('invMonto');
    const inputTipo = document.getElementById('invTipo');

    inputTipo.value = tipo;

    if (tipo === 'inicial') {
        btnInicial.className = "py-2 rounded-lg text-xs font-black uppercase transition-all bg-white shadow-sm text-black border border-gray-100";
        btnFinal.className = "py-2 rounded-lg text-xs font-black uppercase transition-all text-gray-400 hover:text-gray-600";
        lblMonto.innerText = "Monto Inventario Inicial ($)";
        if (currentEditItem) inputMonto.value = currentEditItem.monto_inicial !== null ? currentEditItem.monto_inicial : '';
    } else {
        btnFinal.className = "py-2 rounded-lg text-xs font-black uppercase transition-all bg-white shadow-sm text-black border border-gray-100";
        btnInicial.className = "py-2 rounded-lg text-xs font-black uppercase transition-all text-gray-400 hover:text-gray-600";
        lblMonto.innerText = "Monto Inventario Final ($)";
        if (currentEditItem) inputMonto.value = currentEditItem.monto_final !== null ? currentEditItem.monto_final : '';
    }
}

window.editarRegistro = function (id, tipo = 'inicial') {
    const item = inventarioCache.find(i => i.id === id);
    if (item) {
        currentEditItem = item;
        abrirModal(item);
        setTipo(tipo);
    }
}

window.guardarInventario = async function (e) {
    e.preventDefault();

    // Values
    const id = document.getElementById('invId').value; // Might be empty if creating new but logic below handles it via Mes/Anio check
    const mes = parseInt(document.getElementById('invMes').value);
    const anio = parseInt(document.getElementById('invAnio').value);
    const monto = parseFloat(document.getElementById('invMonto').value);
    const tipo = document.getElementById('invTipo').value;
    const sucursal = document.getElementById('invSucursal').value;

    if (isNaN(monto)) {
        alert("Ingresa un monto válido");
        return;
    }

    try {
        // 1. Check if record exists for this Month/Year
        const { data: existing, error: findError } = await sbClientInv
            .from('inventario_mensual')
            .select('*')
            .eq('mes', mes)
            .eq('anio', anio)
            .eq('sucursal', sucursal)
            .maybeSingle();

        if (findError) throw findError;

        let error;
        if (existing) {
            // UPDATE existing record
            const payload = {};
            if (tipo === 'inicial') payload.monto_inicial = monto;
            else payload.monto_final = monto;

            const res = await sbClientInv
                .from('inventario_mensual')
                .update(payload)
                .eq('id', existing.id);
            error = res.error;
        } else {
            // INSERT new record
            const payload = {
                mes,
                anio,
                sucursal,
                monto_inicial: tipo === 'inicial' ? monto : null,
                monto_final: tipo === 'final' ? monto : null
            };
            const res = await sbClientInv
                .from('inventario_mensual')
                .insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        cerrarModal();
        cargarInventario();
        currentEditItem = null;

    } catch (err) {
        console.error("Error saving inventory:", err);
        alert("Error al guardar. " + err.message);
    }
}

window.eliminarRegistro = async function () {
    const id = document.getElementById('invId').value;
    const tipo = document.getElementById('invTipo').value; // 'inicial' or 'final'

    if (!id || !confirm(`¿Seguro que deseas eliminar este registro de inventario ${tipo}?`)) return;

    try {
        const payload = {};
        if (tipo === 'inicial') payload.monto_inicial = null;
        else payload.monto_final = null;

        const { error } = await sbClientInv
            .from('inventario_mensual')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        cerrarModal();
        cargarInventario();
    } catch (err) {
        console.error("Error deleting:", err);
        alert("No se pudo eliminar.");
    }
}
