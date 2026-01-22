// inversiones.js - Gestión de Activos Fijos y Amortización Automática

// Función para mostrar/ocultar campos de crédito (Inversión tipo Financiamiento)
function toggleFinanciamiento(valor) {
    const div = document.getElementById('camposFinanciamiento');
    if (!div) return;
    if (valor === 'Financiamiento' || valor === 'Arrendamiento') {
        div.classList.remove('hidden');
    } else {
        div.classList.add('hidden');
    }
}

// CARGAR DATOS EN TABLA Y ACTUALIZAR KPIs
let datosCacheInversiones = [];

async function cargarInversiones() {
    const tabla = document.getElementById('tablaInversiones');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/inversiones?select=*&order=fecha_adquisicion.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        datosCacheInversiones = await response.json();
        aplicarFiltrosInversiones();
    } catch (error) { console.error("Error inversiones:", error); }
}

function aplicarFiltrosInversiones() {
    const filtroSucursal = document.getElementById('filtroSucursalInversion')?.value || 'Todos';
    const filtrados = datosCacheInversiones.filter(item => {
        const sucursalItem = item.sucursal?.trim() || 'Matriz'; // Normalize defaults
        const sucursalFiltro = filtroSucursal === 'Sucursal Norte' ? 'Sucursal Norte' :
            filtroSucursal === 'Sucursal Sur' ? 'Sucursal Sur' :
                filtroSucursal;

        // Exact match robust check
        if (filtroSucursal === 'Todos') return true;
        // Handle "Norte" vs "Sucursal Norte" descrepancy if any (HTML uses "Sucursal Norte" value for filter, but "Sucursal Norte" in options)
        // Let's check HTML. HTML Options: Matriz, Sucursal Norte, Sucursal Sur.
        // DB Data: "Sucursal Norte", "Matriz".
        // So direct comparison is likely fine.
        return item.sucursal === filtroSucursal;
    });

    currentFilteredInversiones = filtrados;
    renderizarInversiones(filtrados);
}

// Global Export Variable and Function
let currentFilteredInversiones = [];

window.exportarInversiones = function () {
    exportToExcel(
        currentFilteredInversiones,
        {
            fecha_adquisicion: "Fecha Adquisición",
            tipo_inversion: "Tipo",
            descripcion: "Descripción",
            proveedor: "Proveedor",
            sucursal: "Sucursal",
            categoria: "Categoría",
            monto: "Monto Original",
            vida_util: "Vida Útil (Años)",
            estatus: "Estatus"
        },
        `Reporte_Inversiones_${new Date().toISOString().split('T')[0]}`,
        "Inversiones"
    );
}

function renderizarInversiones(datos) {
    const tabla = document.getElementById('tablaInversiones');
    if (!tabla) return;

    tabla.innerHTML = "";
    let sumaInvertida = 0;
    let sumaDepreciacionMensual = 0;

    datos.forEach(item => {
        const esActivo = item.estatus === 'Activo';
        if (esActivo) {
            sumaInvertida += parseFloat(item.monto || 0);
            const años = parseInt(item.vida_util) || 1;
            const depMensual = parseFloat(item.monto) / (años * 12);
            sumaDepreciacionMensual += depMensual;
        }

        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all border-b border-gray-50 font-bold";
        fila.innerHTML = `
            <td class="px-6 py-5 text-xs text-gray-500">${new Date(item.fecha_adquisicion).toLocaleDateString('es-MX')}</td>
            <td class="px-6 py-5 text-black">
                <div class="flex flex-col">
                    <span class="text-sm font-black uppercase tracking-tight">${item.descripcion}</span>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[9px] text-gray-400 font-bold uppercase">${item.tipo_inversion}</span>
                        <span class="text-[9px] text-primary font-bold uppercase">• ${item.sucursal || 'Matriz'}</span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5 text-xs text-gray-700 uppercase">${item.proveedor || 'No especificado'}</td>
            <td class="px-6 py-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-600">${item.categoria}</span>
            </td>
            <td class="px-6 py-5 text-right font-black text-slate-800">${formatMoney(item.monto)}</td>
            <td class="px-6 py-5 text-center text-xs font-bold text-gray-400">${item.vida_util} años</td>
            <td class="px-6 py-5 text-center">
                <span class="px-2 py-1 rounded-md text-[8px] font-black uppercase ${esActivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${item.estatus || 'Activo'}
                </span>
            </td>
            <td class="px-6 py-5 text-center">
                <button onclick="eliminarInversion('${item.id}', '${item.descripcion}')" class="text-gray-300 hover:text-red-500 transition-all">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });

    if (document.getElementById('totalInvertido')) document.getElementById('totalInvertido').innerText = formatMoney(sumaInvertida);
    if (document.getElementById('itemsActivos')) document.getElementById('itemsActivos').innerText = datos.filter(i => i.estatus === 'Activo').length;
    if (document.getElementById('depreciacionEst')) document.getElementById('depreciacionEst').innerText = `-${formatMoney(sumaDepreciacionMensual)}`;
}

// GUARDAR NUEVA INVERSIÓN CON AMORTIZACIÓN
document.getElementById('formInversion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";

    const syncGasto = document.getElementById('syncGasto').checked;
    const tipo = document.getElementById('tipoInversion').value;

    const inversion = {
        fecha_adquisicion: document.getElementById('fechaInversion').value,
        tipo_inversion: tipo,
        descripcion: document.getElementById('descInversion').value.toUpperCase(),
        proveedor: document.getElementById('proveedorInversion')?.value.toUpperCase() || "PROVEEDOR ACTIVO FIJO",
        monto: parseFloat(document.getElementById('montoInversion').value) || 0,
        vida_util: parseInt(document.getElementById('vidaInversion').value) || 0,
        categoria: document.getElementById('catInversion').value,
        sucursal: document.getElementById('sucursalInversion').value,
        tasa_interes: parseFloat(document.getElementById('tasaInversion').value) || 0,
        plazo_meses: parseInt(document.getElementById('plazoInversion').value) || 0,
        pago_mensual: parseFloat(document.getElementById('pagoMensualInversion').value) || 0,
        estatus: 'Activo',
        notas: document.getElementById('notasInversion').value.toUpperCase()
    };

    try {
        const resInv = await fetch(`${SUPABASE_URL}/rest/v1/inversiones`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(inversion)
        });

        if (resInv.ok) {
            if (syncGasto) {
                if (tipo === 'Compra Directa') {
                    const syncData = {
                        proveedor: inversion.proveedor,
                        metodo: document.getElementById('metodoPagoSync').value,
                        diasCredito: parseInt(document.getElementById('diasCreditoSync').value) || 0
                    };
                    await crearGastoAutomatico(inversion, syncData);
                }
                else if (tipo === 'Financiamiento' || tipo === 'Arrendamiento') {
                    // Lógica de Amortización Automática
                    await generarAmortizacionLote(inversion);
                }
            }
            alert("¡Inversión registrada y plan de pagos generado!");
            e.target.reset();
            document.getElementById('camposFinanciamiento').classList.add('hidden');
            document.getElementById('containerConfigSync').classList.add('hidden');
            cargarInversiones();
        } else {
            alert("Error al guardar en base de datos.");
        }
    } catch (error) {
        console.error(error);
        alert("Error en la operación.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Inversión";
    }
});

// FUNCIÓN PARA CREAR REGISTRO EN GASTOS (COMPRA DIRECTA)
async function crearGastoAutomatico(inv, sync) {
    const gasto = {
        created_at: inv.fecha_adquisicion,
        proveedor: sync.proveedor,
        categoria: 'Costo',
        subcategoria: 'Mercancia',
        metodo_pago: sync.metodo,
        monto_total: inv.monto,
        saldo_pendiente: sync.metodo === 'Crédito' ? inv.monto : 0,
        estado_pago: sync.metodo === 'Crédito' ? 'Pendiente' : 'Pagado',
        dias_credito: sync.diasCredito,
        sucursal: inv.sucursal,
        notas: `ADQUISICIÓN ACTIVO: ${inv.descripcion}`
    };

    return fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(gasto)
    });
}

// NUEVA FUNCIÓN: GENERAR AMORTIZACIÓN EN LOTE
async function generarAmortizacionLote(inv) {
    const mensualidades = [];
    const proveedor = inv.proveedor || "ACREEDOR FINANCIERO";
    const fechaBase = new Date(inv.fecha_adquisicion);

    const capitalMensual = inv.monto / inv.plazo_meses;
    const tasaMensual = (inv.tasa_interes / 100) / 12;

    for (let i = 1; i <= inv.plazo_meses; i++) {
        // Calcular fecha de cada pago (mismo día cada mes)
        const fechaPago = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + i, fechaBase.getDate());
        const interesMes = (inv.monto - (capitalMensual * (i - 1))) * tasaMensual;
        const montoCuota = capitalMensual + interesMes;

        // Registro de Capital (Afecta Balance/Cuentas por Pagar)
        mensualidades.push({
            created_at: fechaPago.toISOString(),
            proveedor: proveedor,
            categoria: 'Pago de Pasivo',
            subcategoria: 'Abono Capital',
            metodo_pago: 'Crédito',
            monto_total: capitalMensual,
            saldo_pendiente: capitalMensual,
            estado_pago: 'Pendiente',
            dias_credito: 0,
            sucursal: inv.sucursal,
            notas: `CUOTA ${i}/${inv.plazo_meses} (CAPITAL) - ${inv.descripcion}`
        });

        // Registro de Interés (Afecta Estado de Resultados)
        if (interesMes > 0) {
            mensualidades.push({
                created_at: fechaPago.toISOString(),
                proveedor: proveedor,
                categoria: 'Gasto Financiero',
                subcategoria: 'Intereses',
                metodo_pago: 'Crédito',
                monto_total: interesMes,
                saldo_pendiente: interesMes,
                estado_pago: 'Pendiente',
                dias_credito: 0,
                sucursal: inv.sucursal,
                notas: `CUOTA ${i}/${inv.plazo_meses} (INTERÉS) - ${inv.descripcion}`
            });
        }
    }

    // Envío de todo el lote a Supabase en una sola petición
    return fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(mensualidades)
    });
}

async function eliminarInversion(id, descripcion) {
    if (!confirm(`¿Estás seguro de eliminar el activo "${descripcion}"? Esto también borrará todos los gastos y cobros programados vinculados.`)) return;
    try {
        // 1. Borrar de la tabla de Gastos (Cualquier nota que contenga la descripción de la inversión)
        await fetch(`${SUPABASE_URL}/rest/v1/gastos?notas=ilike.*${descripcion}*`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        // 2. Borrar de la tabla de Transacciones (Cuentas por Cobrar vinculadas)
        await fetch(`${SUPABASE_URL}/rest/v1/transacciones?notas=ilike.*${descripcion}*`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        // 3. Borrar el registro de Inversión principal
        await fetch(`${SUPABASE_URL}/rest/v1/inversiones?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        alert("Activo y registros vinculados eliminados correctamente.");
        cargarInversiones();
    } catch (e) {
        console.error(e);
        alert("Ocurrió un error al intentar eliminar el registro.");
    }
}