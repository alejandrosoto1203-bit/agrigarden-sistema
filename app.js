// --- CONFIGURACIÓN MAESTRA ---
const SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_urdujDBeZyl8UjjTizpLkg_ffmYoO31'; 

const CONFIG_NEGOCIO = {
    metaMensual: 300000, 
    tasasComision: {
        "Efectivo": 0,
        "Transferencia": 0,
        "Tarjeta Mercado Pago": 0.035, 
        "Tarjeta Hey Banco": 0.021,    
        "Tarjeta BBVA": 0.025,         
        "Cheque": 0,
        "Otro": 0,
        "Crédito": 0
    }
};

// ==========================================
// 1. SEGURIDAD Y ACCESO
// ==========================================
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if(email === "admin@agrigarden.com" && pass === "Maestro2024*") {
        sessionStorage.setItem('isLoggedIn', 'true');
        window.location.href = "dashboard.html";
    } else {
        alert("Credenciales incorrectas.");
    }
});

const protectedPages = ['dashboard.html', 'ingresos.html', 'gastos.html', 'registro_multiple.html', 'registro_gastos.html', 'cuentas_por_cobrar.html', 'cuentas_por_pagar.html'];
const currentPage = window.location.pathname.split("/").pop();

if (protectedPages.includes(currentPage)) {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = "index.html";
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

// ==========================================
// 2. MÓDULO DASHBOARD (GENERAL)
// ==========================================
async function cargarDashboard() {
    try {
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const añoActual = ahora.getFullYear();

        const resIngresos = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?select=monto,created_at`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const ingresos = await resIngresos.json();

        const resGastos = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=monto_total,created_at`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const gastos = await resGastos.json();

        const ingMes = ingresos.filter(i => {
            const d = new Date(i.created_at);
            return d.getMonth() === mesActual && d.getFullYear() === añoActual;
        }).reduce((s, i) => s + (i.monto || 0), 0);

        const ingAnual = ingresos.filter(i => new Date(i.created_at).getFullYear() === añoActual)
                                 .reduce((s, i) => s + (i.monto || 0), 0);

        const gastMes = gastos.filter(g => {
            const d = new Date(g.created_at);
            return d.getMonth() === mesActual && d.getFullYear() === añoActual;
        }).reduce((s, g) => s + (g.monto_total || 0), 0);

        const gastAnual = gastos.filter(g => new Date(g.created_at).getFullYear() === añoActual)
                                .reduce((s, g) => s + (g.monto_total || 0), 0);

        const format = (n) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        
        if(document.getElementById('dashIngresosMes')) document.getElementById('dashIngresosMes').innerText = format(ingMes);
        if(document.getElementById('dashGastosMes')) document.getElementById('dashGastosMes').innerText = format(gastMes);
        if(document.getElementById('dashIngresosAnual')) document.getElementById('dashIngresosAnual').innerText = format(ingAnual);
        if(document.getElementById('dashGastosAnual')) document.getElementById('dashGastosAnual').innerText = format(gastAnual);

    } catch (error) {
        console.error("Error dashboard:", error);
    }
}

// ==========================================
// 3. MÓDULO DE INGRESOS (CLIENTES)
// ==========================================
async function cargarIngresos() {
    const tabla = document.getElementById('tablaIngresos');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?select=*&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        const datos = await response.json();
        tabla.innerHTML = "";
        datos.forEach(item => {
            const fecha = new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
            const comision = item.comision_bancaria || 0;
            const neto = item.monto_neto || (item.monto - comision);
            
            const clienteInfo = item.nombre_cliente 
                ? `<div class="flex flex-col"><span class="text-black font-black uppercase text-[11px]">${item.nombre_cliente}</span><span class="text-[10px] text-gray-400">${item.telefono_cliente || 'Sin tel'}</span></div>`
                : '<span class="text-gray-300 italic">-</span>';

            const fila = document.createElement('tr');
            fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50 font-bold";
            fila.innerHTML = `
                <td class="px-6 py-6 text-sm text-gray-600">${fecha}</td>
                <td class="px-6 py-6 text-sm text-gray-800 text-center">${item.categoria || '#S/N'}</td>
                <td class="px-6 py-6 text-center"><span class="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase">${item.tipo}</span></td>
                <td class="px-6 py-6 text-sm text-gray-500 text-center">${item.metodo_pago}</td>
                <td class="px-6 py-6 text-center">${clienteInfo}</td>
                <td class="px-6 py-6 text-right text-xs text-red-400">-$${comision.toFixed(2)}</td>
                <td class="px-6 py-6 text-right text-gray-400">$${item.monto.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                <td class="px-6 py-6 text-right text-lg text-primary font-black">$${neto.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                <td class="px-6 py-6 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="abrirModalEditarIngreso(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="eliminarIngreso('${item.id}')" class="p-2 bg-gray-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tabla.appendChild(fila);
        });
        actualizarCalculosKPIsIngresos(datos);
    } catch (error) { console.error("Error ingresos:", error); }
}

function abrirModalEditarIngreso(ingreso) {
    document.getElementById('editIngresoId').value = ingreso.id;
    document.getElementById('editFecha').value = ingreso.created_at.split('T')[0];
    document.getElementById('editCategoria').value = ingreso.categoria || '';
    document.getElementById('editTipo').value = ingreso.tipo;
    document.getElementById('editMetodo').value = ingreso.metodo_pago;
    document.getElementById('editCliente').value = ingreso.nombre_cliente || '';
    document.getElementById('editMonto').value = ingreso.monto;
    document.getElementById('modalEditarIngreso')?.classList.remove('hidden');
}

async function actualizarIngreso() {
    const id = document.getElementById('editIngresoId').value;
    const monto = parseFloat(document.getElementById('editMonto').value);
    const metodo = document.getElementById('editMetodo').value;
    const comision = monto * (CONFIG_NEGOCIO.tasasComision[metodo] || 0);

    const datos = {
        created_at: document.getElementById('editFecha').value,
        categoria: document.getElementById('editCategoria').value.toUpperCase(),
        tipo: document.getElementById('editTipo').value,
        metodo_pago: metodo,
        nombre_cliente: document.getElementById('editCliente').value.toUpperCase(),
        monto: monto,
        comision_bancaria: comision,
        monto_neto: monto - comision
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if(res.ok) {
            document.getElementById('modalEditarIngreso')?.classList.add('hidden');
            cargarIngresos();
            cargarDashboard();
            alert("Ingreso actualizado con éxito.");
        }
    } catch (e) { console.error(e); }
}

async function eliminarIngreso(id) {
    if(!confirm("¿Estás seguro de eliminar este ingreso permanentemente?")) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if(res.ok) {
            cargarIngresos();
            cargarDashboard();
            alert("Registro eliminado.");
        }
    } catch (e) { console.error(e); }
}

function actualizarCalculosKPIsIngresos(datos) {
    const hoy = new Date().toISOString().split('T')[0];
    const ingresosHoyArr = datos.filter(i => i.created_at.includes(hoy));
    const totalHoy = ingresosHoyArr.reduce((s, i) => s + (i.monto || 0), 0);
    
    if(document.getElementById('kpiHoy')) document.getElementById('kpiHoy').innerText = `$${totalHoy.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    
    const ticketPromDiario = ingresosHoyArr.length > 0 ? totalHoy / ingresosHoyArr.length : 0;
    if(document.getElementById('kpiTicketDiario')) document.getElementById('kpiTicketDiario').innerText = `$${ticketPromDiario.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();
    const ingresosMesArr = datos.filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === mesActual && d.getFullYear() === añoActual;
    });
    const totalMes = ingresosMesArr.reduce((s, i) => s + (i.monto || 0), 0);
    if(document.getElementById('kpiMes')) document.getElementById('kpiMes').innerText = `$${totalMes.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

    const totalGeneral = datos.reduce((s, i) => s + (i.monto || 0), 0);
    const ticketGeneral = datos.length > 0 ? totalGeneral / datos.length : 0;
    if(document.getElementById('kpiTicket')) document.getElementById('kpiTicket').innerText = `$${ticketGeneral.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

    const meta = CONFIG_NEGOCIO.metaMensual;
    const porcentajeMeta = Math.min((totalMes / meta) * 100, 100);
    const barraMeta = document.getElementById('barraMeta');
    const textoMeta = document.getElementById('percentMeta');
    
    if(barraMeta) barraMeta.style.width = `${porcentajeMeta}%`;
    if(textoMeta) textoMeta.innerText = `${porcentajeMeta.toFixed(1)}%`;
}

// ==========================================
// 4. MÓDULO DE CUENTAS POR COBRAR
// ==========================================
let pestañaActualCobros = 'pendiente';
let datosCacheCobros = []; 

function cambiarPestaña(tipo) {
    pestañaActualCobros = tipo;
    const tabPendiente = document.getElementById('tabPendiente');
    const tabPagado = document.getElementById('tabPagado');
    if(tabPendiente) tabPendiente.className = tipo === 'pendiente' ? 'pb-4 text-xs font-black uppercase tracking-widest tab-active transition-all' : 'pb-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all';
    if(tabPagado) tabPagado.className = tipo === 'pagado' ? 'pb-4 text-xs font-black uppercase tracking-widest tab-active transition-all' : 'pb-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all';
    aplicarFiltrosCobros();
}

function aplicarFiltrosCobros() {
    const busqInput = document.querySelector('input[placeholder*="Buscar"]');
    const busqueda = busqInput ? busqInput.value.toLowerCase() : '';
    const hoy = new Date();

    const datosFiltrados = datosCacheCobros.filter(item => {
        const pagado = item.estado_cobro === 'Pagado';
        const coincideBusqueda = item.nombre_cliente?.toLowerCase().includes(busqueda) || item.categoria?.toLowerCase().includes(busqueda);
        if (pestañaActualCobros === 'pendiente' && pagado) return false;
        if (pestañaActualCobros === 'pagado' && !pagado) return false;
        return coincideBusqueda;
    });
    renderizarTablaCobros(datosFiltrados);
}

async function cargarCuentasPorCobrar() {
    const tabla = document.getElementById('tablaCobranza');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?metodo_pago=eq.Crédito&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        datosCacheCobros = await response.json();
        const hoy = new Date();
        let totalOutstanding = 0; let totalVencidoSuma = 0; let totalRecuperado = 0;
        datosCacheCobros.forEach(item => {
            const montoOriginal = item.monto || 0;
            const saldoPendiente = (item.saldo_pendiente !== null) ? item.saldo_pendiente : montoOriginal;
            const estadoActual = item.estado_cobro || 'Pendiente';
            const fechaVencimiento = new Date(item.created_at); fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
            if(estadoActual === 'Pendiente') {
                totalOutstanding += saldoPendiente;
                if(hoy > fechaVencimiento) totalVencidoSuma += saldoPendiente;
            }
            totalRecuperado += (montoOriginal - saldoPendiente);
        });
        if(document.getElementById('totalPorCobrar')) document.getElementById('totalPorCobrar').innerText = `$${totalOutstanding.toLocaleString()}`;
        if(document.getElementById('totalVencido')) document.getElementById('totalVencido').innerText = `$${totalVencidoSuma.toLocaleString()}`;
        if(document.getElementById('cuentasVencidas')) document.getElementById('cuentasVencidas').innerText = datosCacheCobros.filter(i => (hoy > new Date(new Date(i.created_at).setDate(new Date(i.created_at).getDate() + 30))) && (i.estado_cobro !== 'Pagado')).length;
        if(document.getElementById('recuperadoMes')) document.getElementById('recuperadoMes').innerText = `$${totalRecuperado.toLocaleString()}`;
        aplicarFiltrosCobros(); 
    } catch (error) { console.error("Error cobranza:", error); }
}

function renderizarTablaCobros(datosFiltrados) {
    const tabla = document.getElementById('tablaCobranza');
    if (!tabla) return;
    tabla.innerHTML = "";
    const hoy = new Date();
    datosFiltrados.forEach(item => {
        const montoOriginal = item.monto || 0;
        const saldoPendiente = (item.saldo_pendiente !== null) ? item.saldo_pendiente : montoOriginal;
        const estadoActual = item.estado_cobro || 'Pendiente';
        const fechaCompra = new Date(item.created_at);
        const fechaVencimiento = new Date(item.created_at); fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
        const esVencido = hoy > fechaVencimiento;
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50";
        fila.innerHTML = `
            <td class="px-8 py-5 text-sm font-medium text-gray-600">${fechaCompra.toLocaleDateString()}</td>
            <td class="px-8 py-5"><div class="flex flex-col"><span class="text-black font-black uppercase text-xs">${item.nombre_cliente}</span><span class="text-[10px] text-gray-400">${item.telefono_cliente || ''}</span></div></td>
            <td class="px-8 py-5 text-xs font-bold text-gray-500 text-center">${item.categoria || '#S/N'}</td>
            <td class="px-8 py-5 text-right font-bold text-gray-400">$${montoOriginal.toLocaleString()}</td>
            <td class="px-8 py-5 text-right font-black text-gray-800">$${saldoPendiente.toLocaleString()}</td>
            <td class="px-8 py-5 text-center text-xs font-bold ${esVencido && estadoActual !== 'Pagado' ? 'text-red-500' : 'text-blue-500'} italic">${fechaVencimiento.toLocaleDateString()}</td>
            <td class="px-8 py-5 text-center"><span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${estadoActual === 'Pagado' ? 'bg-blue-50 text-blue-600' : (esVencido ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600')}">${estadoActual === 'Pagado' ? 'Cobrado' : (esVencido ? 'Vencido' : 'Vigente')}</span></td>
            <td class="px-8 py-5 text-center"><div class="flex justify-center gap-2">${estadoActual !== 'Pagado' ? `<button onclick="prepararAbonoPago('${item.id}', '${item.nombre_cliente}', ${saldoPendiente}, 'abono')" class="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-black transition-all"><span class="material-symbols-outlined text-sm">payments</span></button><button onclick="prepararAbonoPago('${item.id}', '${item.nombre_cliente}', ${saldoPendiente}, 'liquidacion')" class="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><span class="material-symbols-outlined text-sm">check_circle</span></button>` : ''}<button onclick="abrirBitacora(${item.id}, '${item.nombre_cliente}')" class="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-black hover:text-white transition-all"><span class="material-symbols-outlined text-sm">event_note</span></button></div></td>
        `;
        tabla.appendChild(fila);
    });
}

function prepararAbonoPago(id, nombre, saldo, modo) {
    idTransaccionAbono = id; saldoMaximoAbono = saldo;
    const infoAbono = document.getElementById('abonoCliente');
    const inputMonto = document.getElementById('montoAbono');
    const titulo = document.getElementById('tituloModalAbono');
    if(infoAbono) infoAbono.innerText = `CLIENTE: ${nombre} (Saldo: $${saldo.toLocaleString()})`;
    if(inputMonto) { inputMonto.value = modo === 'liquidacion' ? saldo : ''; inputMonto.readOnly = modo === 'liquidacion'; }
    if(titulo) titulo.innerText = modo === 'liquidacion' ? 'Liquidar Cuenta' : 'Registrar Abono';
    document.getElementById('modalAbono')?.classList.remove('hidden');
}

async function guardarAbono() {
    const monto = parseFloat(document.getElementById('montoAbono')?.value || 0);
    const metodo = document.getElementById('metodoPagoCobro')?.value || 'Efectivo';
    if(!monto || monto <= 0 || monto > saldoMaximoAbono) return alert("Monto no válido.");
    try {
        const nuevoSaldo = saldoMaximoAbono - monto;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/transacciones?id=eq.${idTransaccionAbono}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldo_pendiente: nuevoSaldo, estado_cobro: nuevoSaldo <= 0 ? 'Pagado' : 'Pendiente' })
        });
        if(res.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaccion_id: idTransaccionAbono, nota: `PAGO: $${monto.toLocaleString('es-MX', {minimumFractionDigits: 2})} via ${metodo}` })
            });
            document.getElementById('modalAbono')?.classList.add('hidden');
            cargarCuentasPorCobrar();
        }
    } catch (e) { alert("Error."); }
}

async function abrirBitacora(id, nombre) {
    currentTransaccionId = id;
    if(document.getElementById('clienteBitacora')) document.getElementById('clienteBitacora').innerText = `CLIENTE: ${nombre}`;
    document.getElementById('modalBitacora')?.classList.remove('hidden');
    cargarHistorialNotas(id);
}

async function cargarHistorialNotas(id) {
    const contenedor = document.getElementById('historialNotas');
    if(!contenedor) return;
    contenedor.innerHTML = '<p class="text-[10px] font-bold text-gray-300 animate-pulse">Cargando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_cobranza?transaccion_id=eq.${id}&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const notas = await res.json();
        contenedor.innerHTML = notas.length ? notas.map(n => `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-2 font-bold"><p class="text-xs text-gray-700">${n.nota}</p><div class="flex justify-between items-center mt-2"><span class="text-[9px] font-black text-primary uppercase">${n.fecha_promesa ? 'Promesa: '+n.fecha_promesa : 'Seguimiento'}</span><span class="text-[9px] text-gray-300 font-bold">${new Date(n.created_at).toLocaleDateString()}</span></div></div>
        `).join('') : '<p class="text-[10px] italic text-gray-400">Sin historial.</p>';
    } catch (e) { console.error("Error cargando notas:", e); }
}

// ==========================================
// 5. MÓDULO DE GASTOS (BLINDADO)
// ==========================================
async function cargarGastos() {
    const tabla = document.getElementById('tablaGastos');
    if (!tabla) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=*&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
        });
        const datos = await response.json();
        tabla.innerHTML = "";
        datos.forEach(item => {
            const fecha = new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
            const fila = document.createElement('tr');
            fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-50 font-bold";
            fila.innerHTML = `
                <td class="px-6 py-6 text-sm text-center text-gray-500">${fecha}</td>
                <td class="px-6 py-6 text-sm text-center text-gray-800 uppercase">${item.proveedor || 'S/P'}</td>
                <td class="px-6 py-6 text-center"><span class="px-2 py-1 rounded text-[10px] uppercase ${item.categoria === 'Costo' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">${item.categoria}</span></td>
                <td class="px-6 py-6 text-center text-sm text-gray-400">${item.subcategoria || '-'}</td>
                <td class="px-6 py-6 text-center text-sm text-gray-500">${item.sucursal}</td>
                <td class="px-6 py-6 text-center text-sm text-gray-600">${item.metodo_pago || 'Efectivo'}</td>
                <td class="px-6 py-6 text-center text-sm font-black text-blue-600">${item.metodo_pago === 'Crédito' ? (item.dias_credito || 0) + ' días' : '-'}</td>
                <td class="px-6 py-6 text-right font-black text-lg text-red-600">$${(item.monto_total || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                <td class="px-6 py-6 text-center text-sm italic text-gray-400 max-w-[200px] truncate">${item.notas || ''}</td>
                <td class="px-6 py-6 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="abrirModalEdicion(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="eliminarGasto('${item.id}')" class="p-2 bg-gray-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tabla.appendChild(fila);
        });
        actualizarKPIsGastos(datos);
    } catch (error) { console.error("Error gastos:", error); }
}

function actualizarKPIsGastos(datos) {
    try {
        const ahora = new Date(); 
        const mesActual = ahora.getMonth(); 
        const añoActual = ahora.getFullYear(); 
        const hoyStr = ahora.toISOString().split('T')[0];

        const gastosMes = datos.filter(i => { 
            const d = new Date(i.created_at); 
            return d.getMonth() === mesActual && d.getFullYear() === añoActual; 
        });

        const totalMes = gastosMes.reduce((s, i) => s + (i.monto_total || 0), 0);
        const totalHoy = datos.filter(i => i.created_at.includes(hoyStr)).reduce((s, i) => s + (i.monto_total || 0), 0);

        if(document.getElementById('kpiGastoMes')) document.getElementById('kpiGastoMes').innerText = `$${totalMes.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpiGastoHoy')) document.getElementById('kpiGastoHoy').innerText = `$${totalHoy.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

        // Lógica de Categoría TOP
        if(gastosMes.length > 0) {
            const rankingCat = gastosMes.reduce((acc, curr) => { acc[curr.categoria] = (acc[curr.categoria] || 0) + (curr.monto_total || 0); return acc; }, {});
            const topCat = Object.keys(rankingCat).reduce((a, b) => rankingCat[a] > rankingCat[b] ? a : b);
            const elTopCat = document.getElementById('kpiTopCat');
            if(elTopCat) elTopCat.innerText = topCat.toUpperCase();
        }

        // Lógica de Ranking (Top 3 Conceptos)
        const rankingCont = document.getElementById('historialConceptos');
        if(rankingCont) {
            const rankingSub = gastosMes.reduce((acc, curr) => { 
                const sub = curr.subcategoria || "OTROS";
                acc[sub] = (acc[sub] || 0) + (curr.monto_total || 0); 
                return acc; 
            }, {});
            const sorted = Object.entries(rankingSub).sort(([,a], [,b]) => b - a).slice(0, 3);
            rankingCont.innerHTML = sorted.length ? sorted.map(([name, val], i) => `<p class="flex justify-between text-[11px] font-bold py-1"><span>${i+1}. ${name.toUpperCase()}</span> <span class="text-red-500">$${val.toLocaleString('es-MX')}</span></p>`).join('') : '<p class="text-[10px] italic text-gray-400 font-bold">Sin registros.</p>';
        }
    } catch (e) { console.error("Error blindado KPIs Gastos:", e); }
}

// ==========================================
// 6. MÓDULO DE GASTOS (REGISTRO MÚLTIPLE)
// ==========================================
function agregarFilaGasto() {
    const tbody = document.getElementById('filasCapturaGastos');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "capture-row group";
    tr.innerHTML = `
        <td class="p-1"><input type="date" class="input-capture row-fecha" value="${new Date().toISOString().split('T')[0]}"></td>
        <td class="p-1"><input type="text" class="input-capture row-proveedor text-center uppercase" placeholder="Proveedor"></td>
        <td class="p-1"><select class="input-capture row-categoria text-center"><option value="Gasto">Gasto</option><option value="Costo">Costo</option></select></td>
        <td class="p-1"><select class="input-capture row-subcat text-center" onchange="verificarExtrasGasto(this)"><option value="Mantenimiento">Mantenimiento</option><option value="Marketing">Marketing</option><option value="Administrativos">Administrativos</option><option value="Mercancia">Mercancia</option><option value="Nomina">Nomina</option><option value="Combustible">Combustible</option><option value="Servicios">Servicios</option><option value="Taller">Taller</option><option value="Limpieza">Limpieza</option><option value="Papeleria">Papeleria</option><option value="Sistemas">Sistemas</option><option value="Renta">Renta</option><option value="otros:">otros:</option></select><input type="text" class="input-capture row-subcat-extra hidden input-others text-center" placeholder="¿Cuál?"></td>
        <td class="p-1"><select class="input-capture row-metodo text-center" onchange="verificarExtrasGasto(this)"><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta BBVA">Tarjeta BBVA</option><option value="Crédito">Crédito</option></select><input type="number" class="input-capture row-dias-credito hidden input-credit-days text-center" placeholder="Días crédito"></td>
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
    if(montoTotalDoc) montoTotalDoc.innerText = `$${suma.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    if(contadorDoc) contadorDoc.innerText = `${filas.length} Items`;
}

async function guardarLoteGastos() {
    const filas = document.querySelectorAll('#filasCapturaGastos .capture-row');
    const datosParaEnviar = [];
    filas.forEach(fila => {
        const monto = parseFloat(fila.querySelector('.row-monto').value) || 0;
        const metodo = fila.querySelector('.row-metodo').value;
        const subcatBase = fila.querySelector('.row-subcat').value;
        const subcatExtra = fila.querySelector('.row-subcat-extra').value;
        datosParaEnviar.push({
            created_at: fila.querySelector('.row-fecha').value,
            proveedor: fila.querySelector('.row-proveedor').value.toUpperCase(),
            categoria: fila.querySelector('.row-categoria').value,
            subcategoria: subcatBase === 'otros:' ? subcatExtra.toUpperCase() : subcatBase,
            metodo_pago: metodo,
            monto_total: monto,
            sucursal: fila.querySelector('.row-sucursal').value,
            notas: fila.querySelector('.row-nota').value.toUpperCase(),
            dias_credito: metodo === 'Crédito' ? parseInt(fila.querySelector('.row-dias-credito').value) || 0 : null,
            estado_pago: metodo === 'Crédito' ? 'Pendiente' : 'Pagado',
            saldo_pendiente: metodo === 'Crédito' ? monto : 0
        });
    });
    if (datosParaEnviar.length === 0) return alert("Agrega al menos un gasto.");
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(datosParaEnviar)
        });
        if (response.ok) window.location.href = "gastos.html";
        else alert("Error al guardar.");
    } catch (error) { console.error(error); }
}

// ==========================================
// 7. MÓDULO DE CUENTAS POR PAGAR (RESTAURADO PROFESIONAL)
// ==========================================
async function cargarCuentasPorPagar() {
    const tabla = document.getElementById('tablaCuentasPagar');
    if (!tabla) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?metodo_pago=eq.Crédito&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const datos = await res.json();
        
        // Actualizar KPIs de Pagar
        const hoy = new Date();
        const totalPagar = datos.filter(i => i.estado_pago !== 'Pagado').reduce((s, i) => s + (i.saldo_pendiente || 0), 0);
        const vencido = datos.filter(i => i.estado_pago !== 'Pagado' && new Date(i.created_at) < hoy).reduce((s, i) => s + (i.saldo_pendiente || 0), 0);
        
        if(document.getElementById('kpiTotalPagar')) document.getElementById('kpiTotalPagar').innerText = `$${totalPagar.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpiMontoVencido')) document.getElementById('kpiMontoVencido').innerText = `$${vencido.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;

        tabla.innerHTML = "";
        datos.forEach(item => {
            const fecha = new Date(item.created_at).toLocaleDateString();
            const saldo = item.saldo_pendiente || 0;
            const fila = document.createElement('tr');
            fila.className = "hover:bg-gray-50/80 transition-all border-b border-gray-100";
            fila.innerHTML = `
                <td class="px-6 py-5 text-xs font-medium text-gray-500">${fecha}</td>
                <td class="px-6 py-5">
                    <span class="text-sm font-black text-gray-800 uppercase">${item.proveedor}</span>
                </td>
                <td class="px-6 py-5 text-center text-xs font-bold text-gray-400">$${(item.monto_total || 0).toLocaleString()}</td>
                <td class="px-6 py-5 text-center">
                    <span class="text-sm font-black text-emerald-600">$${saldo.toLocaleString()}</span>
                </td>
                <td class="px-6 py-5 text-center text-xs font-bold italic text-blue-500">${fecha}</td>
                <td class="px-6 py-5 text-center">
                    <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.estado_pago === 'Pagado' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}">
                        ${item.estado_pago}
                    </span>
                </td>
                <td class="px-6 py-5 text-center text-xs font-bold text-gray-500">${item.sucursal}</td>
                <td class="px-6 py-5 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="marcarComoPagadoProv(${item.id})" class="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm">payments</span>
                        </button>
                    </div>
                </td>
            `;
            tabla.appendChild(fila);
        });
    } catch (e) { console.error("Error Cuentas Pagar:", e); }
}

// ==========================================
// 8. MÓDULO DE REGISTRO MÚLTIPLE (INGRESOS)
// ==========================================
function agregarFila() {
    const tbody = document.getElementById('filasCaptura');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = "capture-row group";
    tr.innerHTML = `
        <td class="p-1"><input type="date" class="input-capture row-fecha" value="${new Date().toISOString().split('T')[0]}"></td>
        <td class="p-1"><input type="text" class="input-capture row-txn font-mono italic" placeholder="#TXN-000"></td>
        <td class="p-1"><select class="input-capture row-tipo"><option value="Venta Directa">Venta Directa</option><option value="Servicio">Servicio</option></select></td>
        <td class="p-1"><select class="input-capture row-metodo" onchange="verificarMetodo(this); actualizarCalculosTotales()"><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta BBVA">Tarjeta BBVA</option><option value="Crédito">Crédito</option></select></td>
        <td class="p-1"><input type="text" class="input-capture row-nombre bg-gray-100 opacity-50 uppercase font-black" placeholder="Nombre..." disabled></td>
        <td class="p-1"><input type="tel" class="input-capture row-tel bg-gray-100 opacity-50" placeholder="Teléfono..." disabled></td>
        <td class="p-1"><input type="number" step="0.01" class="input-capture text-right row-monto font-black" placeholder="0.00" oninput="actualizarCalculosTotales()"></td>
        <td class="p-1"><select class="input-capture row-sucursal"><option value="Sur">Sur</option><option value="Norte">Norte</option><option value="Matriz">Matriz</option></select></td>
        <td class="p-1 text-center"><button onclick="this.parentElement.parentElement.remove(); actualizarCalculosTotales();" class="text-gray-300 hover:text-red-500 transition-colors"><span class="material-symbols-outlined">delete</span></button></td>
    `;
    tbody.appendChild(tr);
    actualizarCalculosTotales();
}

function verificarMetodo(select) {
    const row = select.parentElement.parentElement;
    const inputNombre = row.querySelector('.row-nombre');
    const inputTel = row.querySelector('.row-tel');
    if (select.value === 'Crédito') {
        [inputNombre, inputTel].forEach(input => { input.disabled = false; input.classList.remove('bg-gray-100', 'opacity-50'); });
        inputNombre.focus();
    } else {
        [inputNombre, inputTel].forEach(input => { input.disabled = true; input.value = ''; input.classList.add('bg-gray-100', 'opacity-50'); });
    }
}

function actualizarCalculosTotales() {
    const filas = document.querySelectorAll('#filasCaptura .capture-row');
    let suma = 0;
    filas.forEach(fila => { suma += parseFloat(fila.querySelector('.row-monto').value) || 0; });
    if(document.getElementById('montoTotalVisual')) document.getElementById('montoTotalVisual').innerText = `$${suma.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    if(document.getElementById('contadorIngresos')) document.getElementById('contadorIngresos').innerText = `${filas.length} Ingresos`;
}

// ==========================================
// 9. INICIALIZACIÓN GLOBAL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarDashboard();
    cargarIngresos();
    cargarGastos();
    cargarCuentasPorCobrar(); 
    cargarCuentasPorPagar();
    if(document.getElementById('filasCaptura')) {
        if(document.querySelectorAll('#filasCaptura .capture-row').length === 0) agregarFila();
    }
    if(document.getElementById('filasCapturaGastos')) {
        agregarFilaGasto();
    }
    const selectEstado = document.querySelector('select[class*="focus:ring-primary"]');
    if(selectEstado) selectEstado.addEventListener('change', aplicarFiltrosCobros);
    const inputBusqueda = document.querySelector('input[placeholder*="Buscar"]');
    if(inputBusqueda) inputBusqueda.addEventListener('input', aplicarFiltrosCobros);
});