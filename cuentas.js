// cuentas.js — Módulo de Cuentas Bancarias
// Hardcoded PROD credentials for reliability
const SB_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
const FECHA_INICIO = '2026-04-01';

// ============================================================
// DEFINICIÓN DE CUENTAS
// ============================================================
const CUENTAS = [
    {
        key: 'bbva_norte',
        nombre: 'BBVA Norte',
        tipo: 'cuenta',
        banco: 'BBVA',
        sucursal: 'Norte',
        colorClase: 'blue',
        metodos_tx: ['Transferencia BBVA NORTE', 'Terminal BBVA NORTE', 'Cheque BBVA NORTE'],
        metodos_gasto: ['Transferencia BBVA NORTE', 'Terminal BBVA NORTE', 'Cheque BBVA NORTE']
    },
    {
        key: 'hey_banco_sur',
        nombre: 'Hey Banco Sur',
        tipo: 'cuenta',
        banco: 'Hey Banco',
        sucursal: 'Sur',
        colorClase: 'purple',
        metodos_tx: ['Transferencia HEY BANCO SUR', 'Terminal HEY BANCO SUR', 'CHEQUE HEY BANCO SUR'],
        metodos_gasto: ['Transferencia HEY BANCO SUR', 'Terminal HEY BANCO SUR', 'CHEQUE HEY BANCO SUR']
    },
    {
        key: 'bbva_sur',
        nombre: 'BBVA Sur',
        tipo: 'cuenta',
        banco: 'BBVA',
        sucursal: 'Sur',
        colorClase: 'blue',
        metodos_tx: ['Terminal BBVA Pyme Sur'],
        metodos_gasto: ['Terminal BBVA Pyme Sur']
    },
    {
        key: 'mp_nofiscal_norte',
        nombre: 'Mercado Pago No Fiscal',
        tipo: 'billetera',
        banco: 'Mercado Pago',
        sucursal: 'Norte',
        colorClase: 'cyan',
        metodos_tx: ['Terminal MERCADO PAGO NO FISCAL NORTE'],
        metodos_gasto: ['Terminal MERCADO PAGO NO FISCAL NORTE']
    },
    {
        key: 'mp_fiscal_norte',
        nombre: 'Mercado Pago Fiscal',
        tipo: 'billetera',
        banco: 'Mercado Pago',
        sucursal: 'Norte',
        colorClase: 'cyan',
        metodos_tx: ['Terminal Mercado Pago Fiscal Norte'],
        metodos_gasto: ['Terminal Mercado Pago Fiscal Norte']
    },
    {
        key: 'tdc_bbva',
        nombre: 'TDC BBVA',
        nombreCompleto: 'Tarjeta de Crédito BBVA',
        tipo: 'tarjeta_credito',
        banco: 'BBVA',
        sucursal: 'Norte',
        colorClase: 'red',
        metodos_gasto: ['Tarjeta de Credito BBVA Norte']
    },
    {
        key: 'tdc_hey',
        nombre: 'TDC Hey Banco',
        nombreCompleto: 'Tarjeta de Crédito Hey Banco',
        tipo: 'tarjeta_credito',
        banco: 'Hey Banco',
        sucursal: 'Sur',
        colorClase: 'rose',
        metodos_gasto: ['Tarjeta de credito Hey Banco']
    }
];

const CUENTAS_REGULARES = CUENTAS.filter(c => c.tipo !== 'tarjeta_credito');
const CUENTAS_TDC       = CUENTAS.filter(c => c.tipo === 'tarjeta_credito');

// Colores por colorClase
const COLOR_MAP = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   icon: 'bg-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', icon: 'bg-purple-600' },
    cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700',   icon: 'bg-cyan-600' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    icon: 'bg-red-600' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700',  icon: 'bg-rose-600' }
};

// ============================================================
// ESTADO GLOBAL
// ============================================================
let _config = {};
let _balances = {}; // { key: { entradas, salidas, traspaso_in, traspaso_out, tdc_out, saldo } }
let _tdcData  = {}; // { key: { gastos, pagos, deuda, disponible } }

// ============================================================
// CLIENTE SUPABASE
// ============================================================
function getSB() {
    if (window.supabase) return window.supabase.createClient(SB_URL, SB_KEY);
    return null;
}

async function sbFetch(path) {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${path}`);
    return res.json();
}

// ============================================================
// CARGA PRINCIPAL
// ============================================================
window.cargarDatos = async function () {
    mostrarSkeletons();
    try {
        // 1. Configuración de cuentas
        const cfgRows = await sbFetch(`sys_config?key=eq.banking_accounts_config&select=value`);
        _config = cfgRows?.[0]?.value || {};

        const fechaFiltro = _config.fecha_inicio || FECHA_INICIO;

        // 2. Transacciones (ingresos)
        const txAll = await sbFetch(
            `transacciones?select=metodo_pago,monto&created_at=gte.${fechaFiltro}T00:00:00`
        );

        // 3. Gastos
        const gastos = await sbFetch(
            `gastos?select=metodo_pago,monto_total&created_at=gte.${fechaFiltro}T00:00:00`
        );

        // 4. Traspasos entre cuentas bancarias
        let traspasos = [];
        try {
            traspasos = await sbFetch(
                `traspasos_cuentas_bancarias?select=cuenta_origen,cuenta_destino,monto&fecha=gte.${fechaFiltro}`
            );
        } catch (e) {
            console.warn('Tabla traspasos_cuentas_bancarias no encontrada aún. Ejecuta el SQL primero.');
        }

        // 5. Pagos de tarjeta
        let pagosTDC = [];
        try {
            pagosTDC = await sbFetch(
                `pagos_tarjeta_credito?select=tarjeta,cuenta_origen,monto&fecha=gte.${fechaFiltro}`
            );
        } catch (e) {
            console.warn('Tabla pagos_tarjeta_credito no encontrada aún. Ejecuta el SQL primero.');
        }

        // 6. Calcular balances
        calcularBalances(txAll, gastos, traspasos, pagosTDC);

        // 7. Render
        renderKPIs();
        renderCuentasReguares();
        renderTarjetas();

    } catch (e) {
        console.error('Error cargando datos de cuentas:', e);
        document.getElementById('gridCuentas').innerHTML =
            `<div class="col-span-full bg-red-50 p-4 rounded-xl border border-red-100">
                <p class="text-red-800 font-bold text-sm">Error al cargar datos</p>
                <p class="text-red-500 text-xs font-mono mt-1">${e.message}</p>
             </div>`;
    }
};

function calcularBalances(txAll, gastos, traspasos, pagosTDC) {
    // Precalcular índices de sumas por metodo_pago
    const sumaTx = {};
    for (const t of txAll) {
        const m = t.metodo_pago;
        if (!m) continue;
        sumaTx[m] = (sumaTx[m] || 0) + (parseFloat(t.monto) || 0);
    }
    const sumaGastos = {};
    for (const g of gastos) {
        const m = g.metodo_pago;
        if (!m) continue;
        sumaGastos[m] = (sumaGastos[m] || 0) + (parseFloat(g.monto_total) || 0);
    }

    for (const cuenta of CUENTAS) {
        const cfg = _config[cuenta.key] || {};

        if (cuenta.tipo === 'tarjeta_credito') {
            // Deuda = saldo_inicio + gastos acumulados - pagos
            const gastoAcum = (cuenta.metodos_gasto || []).reduce((s, m) => s + (sumaGastos[m] || 0), 0);
            const pagosAcum = pagosTDC
                .filter(p => p.tarjeta === cuenta.key)
                .reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const saldoInicio = parseFloat(cfg.saldo_inicio) || 0;
            const limite = parseFloat(cfg.limite) || 0;
            const deuda = saldoInicio + gastoAcum - pagosAcum;
            _tdcData[cuenta.key] = {
                gastos: gastoAcum,
                pagos: pagosAcum,
                saldoInicio,
                deuda: Math.max(deuda, 0),
                limite,
                disponible: Math.max(limite - deuda, 0),
                cfg
            };
        } else {
            // Cuenta regular
            const entradas = (cuenta.metodos_tx || []).reduce((s, m) => s + (sumaTx[m] || 0), 0);
            const salidas  = (cuenta.metodos_gasto || []).reduce((s, m) => s + (sumaGastos[m] || 0), 0);

            const traspaso_in  = traspasos
                .filter(t => t.cuenta_destino === cuenta.key)
                .reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
            const traspaso_out = traspasos
                .filter(t => t.cuenta_origen === cuenta.key)
                .reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);

            // Pagos de TDC salientes desde esta cuenta
            const tdcPagosOut = pagosTDC
                .filter(p => p.cuenta_origen === cuenta.key)
                .reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

            const saldoInicial = parseFloat(cfg.saldo_inicial) || 0;
            const saldo = saldoInicial + entradas - salidas + traspaso_in - traspaso_out - tdcPagosOut;

            _balances[cuenta.key] = { saldoInicial, entradas, salidas, traspaso_in, traspaso_out, tdcPagosOut, saldo };
        }
    }
}

// ============================================================
// RENDER KPIs
// ============================================================
function renderKPIs() {
    const totalCuentas = CUENTAS_REGULARES.reduce((s, c) => s + (_balances[c.key]?.saldo || 0), 0);
    const totalDeudaTDC = CUENTAS_TDC.reduce((s, c) => s + (_tdcData[c.key]?.deuda || 0), 0);
    const totalDisponTDC = CUENTAS_TDC.reduce((s, c) => s + (_tdcData[c.key]?.disponible || 0), 0);
    const posicion = totalCuentas - totalDeudaTDC;

    document.getElementById('kpiSection').innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Total en Cuentas</p>
            <p class="text-2xl font-black ${totalCuentas >= 0 ? 'text-gray-900' : 'text-red-600'}">${fmt(totalCuentas)}</p>
            <p class="text-[10px] text-gray-400 mt-1">5 cuentas y billeteras</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Deuda TDC Total</p>
            <p class="text-2xl font-black text-red-600">${fmt(totalDeudaTDC)}</p>
            <p class="text-[10px] text-gray-400 mt-1">2 tarjetas de crédito</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Crédito Disponible</p>
            <p class="text-2xl font-black text-green-600">${fmt(totalDisponTDC)}</p>
            <p class="text-[10px] text-gray-400 mt-1">Límite no utilizado</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p class="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Posición Neta</p>
            <p class="text-2xl font-black ${posicion >= 0 ? 'text-gray-900' : 'text-red-600'}">${fmt(posicion)}</p>
            <p class="text-[10px] text-gray-400 mt-1">Cuentas - Deuda TDC</p>
        </div>
    `;
}

// ============================================================
// RENDER CUENTAS REGULARES
// ============================================================
function renderCuentasReguares() {
    const grid = document.getElementById('gridCuentas');
    grid.innerHTML = CUENTAS_REGULARES.map(cuenta => {
        const b = _balances[cuenta.key] || {};
        const c = COLOR_MAP[cuenta.colorClase] || COLOR_MAP.blue;
        const tipoLabel = cuenta.tipo === 'billetera' ? 'Billetera Digital' : 'Cuenta Bancaria';

        return `
        <div class="cuenta-card bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden">
            <div class="${c.bg} px-5 pt-5 pb-4">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <p class="badge-tipo ${c.badge} px-2 py-0.5 rounded-full inline-block mb-2">${tipoLabel} · ${cuenta.sucursal}</p>
                        <h4 class="text-lg font-black ${c.text} leading-tight">${cuenta.nombre}</h4>
                        <p class="text-xs text-gray-500 font-medium">${cuenta.banco}</p>
                    </div>
                    <div class="${c.icon} text-white rounded-xl p-2">
                        <span class="material-symbols-outlined text-xl">${cuenta.tipo === 'billetera' ? 'wallet' : 'account_balance'}</span>
                    </div>
                </div>
                <div>
                    <p class="text-[10px] font-bold uppercase text-gray-400 mb-0.5">Saldo Actual</p>
                    <p class="text-3xl font-black ${b.saldo >= 0 ? 'text-gray-900' : 'text-red-600'}">${fmt(b.saldo || 0)}</p>
                </div>
            </div>
            <div class="px-5 py-4 grid grid-cols-3 gap-2 border-t border-gray-100">
                <div class="text-center">
                    <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Entradas</p>
                    <p class="text-xs font-black text-green-600">+${fmt(b.entradas || 0)}</p>
                </div>
                <div class="text-center border-x border-gray-100">
                    <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Salidas</p>
                    <p class="text-xs font-black text-red-500">-${fmt(b.salidas || 0)}</p>
                </div>
                <div class="text-center">
                    <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Saldo Inicial</p>
                    <p class="text-xs font-bold text-gray-500">${fmt(b.saldoInicial || 0)}</p>
                </div>
            </div>
            ${(b.traspaso_in > 0 || b.traspaso_out > 0 || b.tdcPagosOut > 0) ? `
            <div class="px-5 pb-4 flex flex-wrap gap-2">
                ${b.traspaso_in  > 0 ? `<span class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+${fmt(b.traspaso_in)} traspasos</span>` : ''}
                ${b.traspaso_out > 0 ? `<span class="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">-${fmt(b.traspaso_out)} traspasos</span>` : ''}
                ${b.tdcPagosOut  > 0 ? `<span class="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">-${fmt(b.tdcPagosOut)} pago TDC</span>` : ''}
            </div>` : ''}
        </div>`;
    }).join('');
}

// ============================================================
// RENDER TARJETAS DE CRÉDITO
// ============================================================
function renderTarjetas() {
    const grid = document.getElementById('gridTarjetas');
    grid.innerHTML = CUENTAS_TDC.map(cuenta => {
        const t = _tdcData[cuenta.key] || {};
        const c = COLOR_MAP[cuenta.colorClase] || COLOR_MAP.red;
        const pctUsado = t.limite > 0 ? Math.min((t.deuda / t.limite) * 100, 100) : 0;

        // Calcular fechas de corte / pago
        let corteLabel = '—';
        let pagoLabel  = '—';
        const diaCorte = t.cfg?.dia_corte;
        const diasPago = t.cfg?.dias_pago;
        if (diaCorte) {
            const proxCorte = proximaFechaConDia(diaCorte);
            corteLabel = proxCorte.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            if (diasPago) {
                const fechaPago = new Date(proxCorte);
                fechaPago.setDate(fechaPago.getDate() + diasPago);
                pagoLabel = fechaPago.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            }
        }

        const barColor = pctUsado >= 90 ? 'bg-red-600' : pctUsado >= 70 ? 'bg-orange-500' : 'bg-green-500';

        return `
        <div class="cuenta-card bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden">
            <div class="${c.bg} px-5 pt-5 pb-4">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <p class="badge-tipo ${c.badge} px-2 py-0.5 rounded-full inline-block mb-2">Tarjeta de Crédito · ${cuenta.sucursal}</p>
                        <h4 class="text-lg font-black ${c.text} leading-tight">${cuenta.nombreCompleto || cuenta.nombre}</h4>
                        <p class="text-xs text-gray-500 font-medium">${cuenta.banco}</p>
                    </div>
                    <div class="${c.icon} text-white rounded-xl p-2">
                        <span class="material-symbols-outlined text-xl">credit_card</span>
                    </div>
                </div>

                <!-- Barra de uso -->
                <div class="mb-3">
                    <div class="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                        <span>Uso del crédito</span>
                        <span>${pctUsado.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="${barColor} h-2 rounded-full transition-all" style="width: ${pctUsado}%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Deuda Actual</p>
                        <p class="text-base font-black text-red-600">${fmt(t.deuda || 0)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Disponible</p>
                        <p class="text-base font-black text-green-600">${fmt(t.disponible || 0)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Límite</p>
                        <p class="text-base font-bold text-gray-500">${fmt(t.limite || 0)}</p>
                    </div>
                </div>
            </div>

            <!-- Desglose y fechas -->
            <div class="px-5 py-4 space-y-3 border-t border-gray-100">
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Inicio Mar</p>
                        <p class="text-xs font-bold text-gray-600">${fmt(t.saldoInicio || 0)}</p>
                    </div>
                    <div class="border-x border-gray-100">
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Acumulado</p>
                        <p class="text-xs font-black text-red-500">+${fmt(t.gastos || 0)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Pagado</p>
                        <p class="text-xs font-black text-green-600">-${fmt(t.pagos || 0)}</p>
                    </div>
                </div>

                <!-- Fechas de corte y pago -->
                <div class="flex gap-4">
                    <div class="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Próx. Corte</p>
                        <p class="text-xs font-black text-gray-700">${corteLabel}</p>
                    </div>
                    <div class="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Límite de Pago</p>
                        <p class="text-xs font-black text-gray-700">${pagoLabel}</p>
                    </div>
                </div>

                <button onclick="abrirModalPagoTDC('${cuenta.key}', '${cuenta.nombreCompleto || cuenta.nombre}')"
                    class="w-full py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-sm">payments</span> Registrar Pago
                </button>
            </div>
        </div>`;
    }).join('');
}

// ============================================================
// MODAL: TRASPASO
// ============================================================
window.abrirModalTraspaso = function () {
    // Poblar selects con cuentas regulares
    const opts = CUENTAS_REGULARES.map(c => `<option value="${c.key}">${c.nombre}</option>`).join('');
    document.getElementById('traspasoOrigen').innerHTML  = '<option value="">Seleccionar...</option>' + opts;
    document.getElementById('traspasoDestino').innerHTML = '<option value="">Seleccionar...</option>' + opts;

    // Fecha de hoy por defecto
    document.getElementById('traspasoFecha').value  = hoy();
    document.getElementById('traspasoMonto').value  = '';
    document.getElementById('traspasoNotas').value  = '';

    document.getElementById('modalTraspaso').classList.remove('hidden');
};

window.cerrarModalTraspaso = function () {
    document.getElementById('modalTraspaso').classList.add('hidden');
};

window.guardarTraspaso = async function () {
    const origen   = document.getElementById('traspasoOrigen').value;
    const destino  = document.getElementById('traspasoDestino').value;
    const monto    = parseFloat(document.getElementById('traspasoMonto').value) || 0;
    const fecha    = document.getElementById('traspasoFecha').value;
    const notas    = document.getElementById('traspasoNotas').value.trim();

    if (!origen)        return alert('Selecciona la cuenta origen.');
    if (!destino)       return alert('Selecciona la cuenta destino.');
    if (origen === destino) return alert('La cuenta origen y destino no pueden ser la misma.');
    if (monto <= 0)     return alert('El monto debe ser mayor a 0.');
    if (!fecha)         return alert('Selecciona una fecha.');

    try {
        const res = await fetch(`${SB_URL}/rest/v1/traspasos_cuentas_bancarias`, {
            method: 'POST',
            headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${SB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ cuenta_origen: origen, cuenta_destino: destino, monto, fecha, notas: notas || null })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Error ${res.status}`);
        }

        cerrarModalTraspaso();
        cargarDatos();
        alert('Traspaso registrado correctamente.');
    } catch (e) {
        console.error(e);
        alert('Error al guardar traspaso: ' + e.message);
    }
};

// ============================================================
// MODAL: PAGO TARJETA DE CRÉDITO
// ============================================================
window.abrirModalPagoTDC = function (tarjetaKey, tarjetaNombre) {
    document.getElementById('pagoTarjetaKey').value    = tarjetaKey;
    document.getElementById('subtitlePagoTDC').textContent = tarjetaNombre;

    // Poblar select de cuentas origen (solo regulares)
    const opts = CUENTAS_REGULARES.map(c => `<option value="${c.key}">${c.nombre}</option>`).join('');
    document.getElementById('pagoCuentaOrigen').innerHTML = '<option value="">Seleccionar cuenta...</option>' + opts;

    document.getElementById('pagoFecha').value  = hoy();
    document.getElementById('pagoMonto').value  = '';
    document.getElementById('pagoNotas').value  = '';

    document.getElementById('modalPagoTDC').classList.remove('hidden');
};

window.cerrarModalPagoTDC = function () {
    document.getElementById('modalPagoTDC').classList.add('hidden');
};

window.guardarPagoTDC = async function () {
    const tarjeta      = document.getElementById('pagoTarjetaKey').value;
    const cuentaOrigen = document.getElementById('pagoCuentaOrigen').value;
    const monto        = parseFloat(document.getElementById('pagoMonto').value) || 0;
    const fecha        = document.getElementById('pagoFecha').value;
    const notas        = document.getElementById('pagoNotas').value.trim();

    if (!cuentaOrigen) return alert('Selecciona la cuenta que realiza el pago.');
    if (monto <= 0)    return alert('El monto debe ser mayor a 0.');
    if (!fecha)        return alert('Selecciona una fecha.');

    try {
        const res = await fetch(`${SB_URL}/rest/v1/pagos_tarjeta_credito`, {
            method: 'POST',
            headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${SB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ tarjeta, cuenta_origen: cuentaOrigen, monto, fecha, notas: notas || null })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Error ${res.status}`);
        }

        cerrarModalPagoTDC();
        cargarDatos();
        alert('Pago registrado correctamente.');
    } catch (e) {
        console.error(e);
        alert('Error al guardar pago: ' + e.message);
    }
};

// ============================================================
// UTILIDADES
// ============================================================
function fmt(n) {
    const num = parseFloat(n) || 0;
    return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoy() {
    return new Date().toISOString().split('T')[0];
}

function proximaFechaConDia(dia) {
    const hoyFecha = new Date();
    let fecha = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth(), dia);
    if (fecha <= hoyFecha) {
        fecha = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth() + 1, dia);
    }
    return fecha;
}

function mostrarSkeletons() {
    document.getElementById('kpiSection').innerHTML = [1,2,3,4].map(() =>
        '<div class="skeleton h-20"></div>').join('');
    document.getElementById('gridCuentas').innerHTML = [1,2,3].map(() =>
        '<div class="skeleton h-40"></div>').join('');
    document.getElementById('gridTarjetas').innerHTML = [1,2].map(() =>
        '<div class="skeleton h-56"></div>').join('');
}
