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

window.cargarInventario = async function () {
    if (!sbClientInv) return;

    const anio = document.getElementById('filtroYear')?.value || new Date().getFullYear();
    const tbody = document.getElementById('tablaInventario');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-400 italic">Cargando...</td></tr>`;

    try {
        const { data, error } = await sbClientInv
            .from('inventario_mensual')
            .select('*')
            .eq('anio', anio)
            .order('mes', { ascending: true }); // Order by month (1-12)

        if (error) {
            console.error(error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Error de Base de Datos: <br><span class="text-xs font-normal">${error.message}</span></td></tr>`;
            return;
        }

        inventarioCache = data || [];
        const filtroSucursal = document.getElementById('filtroSucursal')?.value || 'Todos';
        const filtrados = inventarioCache.filter(item => filtroSucursal === 'Todos' || item.sucursal === filtroSucursal);

        currentFilteredInventario = filtrados; // store for export
        renderizarTabla(filtrados);

    } catch (err) {
        console.error("Error fetching inventory:", err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-red-500 font-bold">Error Inesperado: <br><span class="text-xs font-normal">${err.message}</span></td></tr>`;
    }
}

function renderizarTabla(lista) {
    const tbody = document.getElementById('tablaInventario');
    if (!tbody) return;

    // Filter out rows where both are null just in case, or list generation handles it.

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

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-400 font-bold italic">No hay registros visualizables.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const badgeColor = row.key === 'inicial' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100';

        return `
            <tr class="hover:bg-gray-50/50 transition-colors group">
                <td class="p-4 pl-6">
                    <div>
                        <p class="font-bold text-slate-800">${meses[row.mes] || 'Desconocido'}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${row.anio}</p>
                    </div>
                </td>
                <td class="p-4">
                    <span class="text-xs font-bold uppercase text-gray-500">
                        ${row.sucursal === 'Norte' ? 'SUCURSAL NORTE' : (row.sucursal === 'Sur' ? 'SUCURSAL SUR' : (row.sucursal || 'MATRIZ'))}
                    </span>
                </td>
                <td class="p-4">
                    <span class="px-3 py-1 rounded-full text-xs font-black uppercase border ${badgeColor}">
                        Inventario ${row.tipo}
                    </span>
                </td>
                <td class="p-4 text-right font-mono text-slate-900 font-bold cursor-default">${formatMoney(row.monto)}</td>
                <td class="p-4 text-center">
                    <button onclick="editarRegistro(${row.id}, '${row.key}')" class="text-gray-400 hover:text-black transition-colors p-2 rounded-full hover:bg-gray-100">
                        <span class="material-symbols-outlined text-lg">edit_square</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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
