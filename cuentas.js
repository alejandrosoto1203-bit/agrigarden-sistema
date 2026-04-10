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
        metodos_tx: ['Transferencia BBVA NORTE', 'Terminal BBVA NORTE', 'Cheque BBVA NORTE', 'Transferencia BBVA', 'Cheque BBVA Norte'],
        metodos_gasto: ['Transferencia BBVA NORTE', 'Terminal BBVA NORTE', 'Cheque BBVA NORTE', 'Transferencia BBVA', 'Cheque BBVA Norte']
    },
    {
        key: 'hey_banco_sur',
        nombre: 'Hey Banco Sur',
        tipo: 'cuenta',
        banco: 'Hey Banco',
        sucursal: 'Sur',
        colorClase: 'purple',
        metodos_tx: ['Transferencia HEY BANCO SUR', 'Terminal HEY BANCO SUR', 'CHEQUE HEY BANCO SUR', 'Transferencia Hey Banco', 'Cheque Hey Banco Sur'],
        metodos_gasto: ['Transferencia HEY BANCO SUR', 'Terminal HEY BANCO SUR', 'CHEQUE HEY BANCO SUR', 'Transferencia Hey Banco', 'Cheque Hey Banco Sur']
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
        metodos_tx: ['Terminal MERCADO PAGO NO FISCAL NORTE', 'Tarjeta Mercado Pago No Fiscal Norte', 'Tarjeta Mercado Pago'],
        metodos_gasto: ['Terminal MERCADO PAGO NO FISCAL NORTE', 'Tarjeta Mercado Pago No Fiscal Norte', 'Tarjeta Mercado Pago']
    },
    {
        key: 'mp_fiscal_norte',
        nombre: 'Mercado Pago Fiscal',
        tipo: 'billetera',
        banco: 'Mercado Pago',
        sucursal: 'Norte',
        colorClase: 'cyan',
        metodos_tx: ['Terminal Mercado Pago Fiscal Norte', 'Tarjeta Mercado Pago Fiscal Norte'],
        metodos_gasto: ['Terminal Mercado Pago Fiscal Norte', 'Tarjeta Mercado Pago Fiscal Norte']
    },
    {
        key: 'tdc_bbva',
        nombre: 'TDC BBVA',
        nombreCompleto: 'Tarjeta de Crédito BBVA',
        tipo: 'tarjeta_credito',
        banco: 'BBVA',
        sucursal: 'Norte',
        colorClase: 'red',
        metodos_gasto: ['Tarjeta de Credito BBVA Norte', 'Tarjeta BBVA']
    },
    {
        key: 'tdc_hey',
        nombre: 'TDC Hey Banco',
        nombreCompleto: 'Tarjeta de Crédito Hey Banco',
        tipo: 'tarjeta_credito',
        banco: 'Hey Banco',
        sucursal: 'Sur',
        colorClase: 'rose',
        metodos_gasto: ['Tarjeta de credito Hey Banco', 'Tarjeta Hey Banco', 'Tarjeta de crédito HEY BANCO SUR']
    }
];

const CUENTAS_REGULARES = CUENTAS.filter(c => c.tipo !== 'tarjeta_credito');
const CUENTAS_TDC       = CUENTAS.filter(c => c.tipo === 'tarjeta_credito');

const COLOR_MAP = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   icon: 'bg-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', icon: 'bg-purple-600' },
    cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700',   badge: 'bg-cyan-100 text-cyan-700',   icon: 'bg-cyan-600' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    icon: 'bg-red-600' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   badge: 'bg-rose-100 text-rose-700',  icon: 'bg-rose-600' }
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ============================================================
// ESTADO GLOBAL
// ============================================================
let _config = {};
let _balances = {};
let _tdcData  = {};
// Raw data para el detalle de movimientos
let _txAll        = [];
let _gastosAll    = [];
let _traspasosAll = [];
let _pagosAll     = [];

// ── Anotaciones del estado de cuenta (persisten en localStorage) ──────────────
function _getAnotacion(sourceType, id) {
    try { return JSON.parse(localStorage.getItem(`annot_${sourceType}_${id}`) || '{}'); } catch { return {}; }
}
function _saveAnotacion(sourceType, id, field, value) {
    const key = `annot_${sourceType}_${id}`;
    const cur = _getAnotacion(sourceType, id);
    cur[field] = value;
    localStorage.setItem(key, JSON.stringify(cur));
}

// Variables para exportación del detalle abierto
let _detalleRowsExport  = [];
let _detalleCuentaExport = null;

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
        const cfgRows = await sbFetch(`sys_config?key=eq.banking_accounts_config&select=value`);
        _config = cfgRows?.[0]?.value || {};

        const fechaFiltro = _config.fecha_inicio || FECHA_INICIO;

        // Transacciones con campos completos para detalle
        _txAll = await sbFetch(
            `transacciones?select=id,created_at,metodo_pago,monto,nombre_cliente,categoria&created_at=gte.${fechaFiltro}T00:00:00`
        );

        // Gastos con campos completos para detalle
        _gastosAll = await sbFetch(
            `gastos?select=id,created_at,metodo_pago,monto_total,proveedor,categoria&created_at=gte.${fechaFiltro}T00:00:00`
        );

        // Traspasos entre cuentas bancarias
        _traspasosAll = [];
        try {
            _traspasosAll = await sbFetch(
                `traspasos_cuentas_bancarias?select=id,cuenta_origen,cuenta_destino,monto,fecha,notas&fecha=gte.${fechaFiltro}`
            );
        } catch (e) {
            console.warn('Tabla traspasos_cuentas_bancarias no encontrada. Ejecuta el SQL primero.');
        }

        // Pagos de tarjeta
        _pagosAll = [];
        try {
            _pagosAll = await sbFetch(
                `pagos_tarjeta_credito?select=id,tarjeta,cuenta_origen,monto,fecha,notas&fecha=gte.${fechaFiltro}`
            );
        } catch (e) {
            console.warn('Tabla pagos_tarjeta_credito no encontrada. Ejecuta el SQL primero.');
        }

        calcularBalances(_txAll, _gastosAll, _traspasosAll, _pagosAll);
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
            const gastoAcum = (cuenta.metodos_gasto || []).reduce((s, m) => s + (sumaGastos[m] || 0), 0);
            const pagosAcum = pagosTDC
                .filter(p => p.tarjeta === cuenta.key)
                .reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const saldoInicio = parseFloat(cfg.saldo_inicio) || 0;
            const limite = parseFloat(cfg.limite) || 0;
            const deuda = saldoInicio + gastoAcum - pagosAcum;
            _tdcData[cuenta.key] = { gastos: gastoAcum, pagos: pagosAcum, saldoInicio, deuda: Math.max(deuda, 0), limite, disponible: Math.max(limite - deuda, 0), cfg };
        } else {
            const entradas = (cuenta.metodos_tx || []).reduce((s, m) => s + (sumaTx[m] || 0), 0);
            const salidas  = (cuenta.metodos_gasto || []).reduce((s, m) => s + (sumaGastos[m] || 0), 0);
            const traspaso_in  = traspasos.filter(t => t.cuenta_destino === cuenta.key).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
            const traspaso_out = traspasos.filter(t => t.cuenta_origen  === cuenta.key).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
            const tdcPagosOut  = pagosTDC.filter(p => p.cuenta_origen   === cuenta.key).reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
            const saldoInicial = parseFloat(cfg.saldo_inicial) || 0;
            _balances[cuenta.key] = { saldoInicial, entradas, salidas, traspaso_in, traspaso_out, tdcPagosOut, saldo: saldoInicial + entradas - salidas + traspaso_in - traspaso_out - tdcPagosOut };
        }
    }
}

// ============================================================
// RENDER KPIs
// ============================================================
function renderKPIs() {
    const totalCuentas  = CUENTAS_REGULARES.reduce((s, c) => s + (_balances[c.key]?.saldo || 0), 0);
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
        <div class="cuenta-card bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden cursor-pointer"
             onclick="abrirDetalleCuenta('${cuenta.key}')">
            <div class="${c.bg} px-5 pt-5 pb-4">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <p class="badge-tipo ${c.badge} px-2 py-0.5 rounded-full inline-block mb-2">${tipoLabel} · ${cuenta.sucursal}</p>
                        <h4 class="text-lg font-black ${c.text} leading-tight">${cuenta.nombre}</h4>
                        <p class="text-xs text-gray-500 font-medium">${cuenta.banco}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="${c.icon} text-white rounded-xl p-2">
                            <span class="material-symbols-outlined text-xl">${cuenta.tipo === 'billetera' ? 'wallet' : 'account_balance'}</span>
                        </div>
                        <span class="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[11px]">open_in_full</span> Ver detalle
                        </span>
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

        let corteLabel = '—', pagoLabel = '—';
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
            <!-- Cabecera clickeable para ver movimientos -->
            <div class="${c.bg} px-5 pt-5 pb-4 cursor-pointer" onclick="abrirDetalleCuenta('${cuenta.key}')">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <p class="badge-tipo ${c.badge} px-2 py-0.5 rounded-full inline-block mb-2">Tarjeta de Crédito · ${cuenta.sucursal}</p>
                        <h4 class="text-lg font-black ${c.text} leading-tight">${cuenta.nombreCompleto || cuenta.nombre}</h4>
                        <p class="text-xs text-gray-500 font-medium">${cuenta.banco}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <div class="${c.icon} text-white rounded-xl p-2">
                            <span class="material-symbols-outlined text-xl">credit_card</span>
                        </div>
                        <span class="text-[9px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[11px]">open_in_full</span> Ver detalle
                        </span>
                    </div>
                </div>
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

            <div class="px-5 py-4 space-y-3 border-t border-gray-100">
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Inicio Abr</p>
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
// DETALLE DE MOVIMIENTOS
// ============================================================
window.abrirDetalleCuenta = function (cuentaKey) {
    const cuenta = CUENTAS.find(c => c.key === cuentaKey);
    if (!cuenta) return;

    const rows = [];

    if (cuenta.tipo === 'tarjeta_credito') {
        // Cargos (gastos con ese método de pago)
        const metodos = cuenta.metodos_gasto || [];
        _gastosAll
            .filter(g => metodos.includes(g.metodo_pago))
            .forEach(g => rows.push({
                id: g.id, sourceType: 'gasto',
                date: new Date(g.created_at),
                type: 'CARGO',
                amount: parseFloat(g.monto_total) || 0,
                concept: g.proveedor || 'Cargo',
                ref: g.categoria || ''
            }));

        // Pagos recibidos a la tarjeta
        _pagosAll
            .filter(p => p.tarjeta === cuentaKey)
            .forEach(p => rows.push({
                id: p.id, sourceType: 'pago_tdc',
                date: new Date(p.fecha + 'T12:00:00'),
                type: 'PAGO',
                amount: parseFloat(p.monto) || 0,
                concept: 'Pago TDC' + (p.notas ? ' — ' + p.notas : ''),
                ref: ''
            }));

        const saldoInicio = _tdcData[cuentaKey]?.saldoInicio || 0;
        _renderDetalleModal(cuenta, rows, saldoInicio, 'tdc');

    } else {
        // Entradas: transacciones
        const metodosTx = cuenta.metodos_tx || [];
        _txAll
            .filter(t => metodosTx.includes(t.metodo_pago))
            .forEach(t => rows.push({
                id: t.id, sourceType: 'transaccion',
                date: new Date(t.created_at),
                type: 'ENTRADA',
                amount: parseFloat(t.monto) || 0,
                concept: t.nombre_cliente || 'Venta',
                ref: t.categoria || ''
            }));

        // Salidas: gastos
        const metodosGasto = cuenta.metodos_gasto || [];
        _gastosAll
            .filter(g => metodosGasto.includes(g.metodo_pago))
            .forEach(g => rows.push({
                id: g.id, sourceType: 'gasto',
                date: new Date(g.created_at),
                type: 'SALIDA',
                amount: parseFloat(g.monto_total) || 0,
                concept: g.proveedor || 'Gasto',
                ref: g.categoria || ''
            }));

        // Traspasos entrantes
        _traspasosAll
            .filter(t => t.cuenta_destino === cuentaKey)
            .forEach(t => {
                const origenNombre = CUENTAS.find(c => c.key === t.cuenta_origen)?.nombre || t.cuenta_origen;
                rows.push({
                    id: t.id, sourceType: 'traspaso',
                    date: new Date(t.fecha + 'T12:00:00'),
                    type: 'ENTRADA',
                    amount: parseFloat(t.monto) || 0,
                    concept: `Traspaso desde ${origenNombre}`,
                    ref: t.notas || 'TRASPASO'
                });
            });

        // Traspasos salientes
        _traspasosAll
            .filter(t => t.cuenta_origen === cuentaKey)
            .forEach(t => {
                const destinoNombre = CUENTAS.find(c => c.key === t.cuenta_destino)?.nombre || t.cuenta_destino;
                rows.push({
                    id: t.id, sourceType: 'traspaso',
                    date: new Date(t.fecha + 'T12:00:00'),
                    type: 'SALIDA',
                    amount: parseFloat(t.monto) || 0,
                    concept: `Traspaso a ${destinoNombre}`,
                    ref: t.notas || 'TRASPASO'
                });
            });

        // Pagos de TDC realizados desde esta cuenta
        _pagosAll
            .filter(p => p.cuenta_origen === cuentaKey)
            .forEach(p => {
                const tarjetaNombre = CUENTAS.find(c => c.key === p.tarjeta)?.nombreCompleto || p.tarjeta;
                rows.push({
                    id: p.id, sourceType: 'pago_tdc',
                    date: new Date(p.fecha + 'T12:00:00'),
                    type: 'SALIDA',
                    amount: parseFloat(p.monto) || 0,
                    concept: `Pago ${tarjetaNombre}`,
                    ref: p.notas || 'PAGO TDC'
                });
            });

        const saldoInicial = _balances[cuentaKey]?.saldoInicial || 0;
        _renderDetalleModal(cuenta, rows, saldoInicial, 'cuenta');
    }
};

function _renderDetalleModal(cuenta, rows, saldoInicial, modo) {
    const c = COLOR_MAP[cuenta.colorClase] || COLOR_MAP.blue;

    // Guardar para exportación
    _detalleCuentaExport = cuenta;

    // Header del modal
    document.getElementById('detalleNombre').textContent = cuenta.nombreCompleto || cuenta.nombre;
    document.getElementById('detalleBanco').textContent  = cuenta.banco + ' · ' + cuenta.sucursal;

    // Calcular saldo corriente (ascendente)
    const rowsAsc = [...rows].sort((a, b) => a.date - b.date);
    let runBalance = saldoInicial;
    rowsAsc.forEach(r => {
        if (modo === 'tdc') {
            runBalance += r.type === 'CARGO' ? r.amount : -r.amount;
        } else {
            runBalance += r.type === 'ENTRADA' ? r.amount : -r.amount;
        }
        r.saldo = runBalance;
    });

    // Totales para KPIs del modal
    const totalEntradas = rows.filter(r => r.type === 'ENTRADA' || r.type === 'PAGO').reduce((s, r) => s + r.amount, 0);
    const totalSalidas  = rows.filter(r => r.type === 'SALIDA' || r.type === 'CARGO').reduce((s, r) => s + r.amount, 0);
    const saldoFinal    = rowsAsc.length > 0 ? rowsAsc[rowsAsc.length - 1].saldo : saldoInicial;

    if (modo === 'tdc') {
        document.getElementById('detalleKPIs').innerHTML = `
            <div class="text-center">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Inicio Abr.</p>
                <p class="text-sm font-black text-gray-700">${fmt(saldoInicial)}</p>
            </div>
            <div class="text-center border-x border-gray-200 px-4">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Cargos</p>
                <p class="text-sm font-black text-red-600">+${fmt(totalSalidas)}</p>
            </div>
            <div class="text-center px-4 border-r border-gray-200">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Pagos</p>
                <p class="text-sm font-black text-green-600">-${fmt(totalEntradas)}</p>
            </div>
            <div class="text-center">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Deuda Actual</p>
                <p class="text-sm font-black ${saldoFinal > 0 ? 'text-red-600' : 'text-gray-700'}">${fmt(Math.max(saldoFinal, 0))}</p>
            </div>`;
    } else {
        document.getElementById('detalleKPIs').innerHTML = `
            <div class="text-center">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Saldo Inicial</p>
                <p class="text-sm font-black text-gray-700">${fmt(saldoInicial)}</p>
            </div>
            <div class="text-center border-x border-gray-200 px-4">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Entradas</p>
                <p class="text-sm font-black text-green-600">+${fmt(totalEntradas)}</p>
            </div>
            <div class="text-center px-4 border-r border-gray-200">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Salidas</p>
                <p class="text-sm font-black text-red-500">-${fmt(totalSalidas)}</p>
            </div>
            <div class="text-center">
                <p class="text-[9px] font-black uppercase text-gray-400 mb-0.5">Saldo Actual</p>
                <p class="text-sm font-black ${saldoFinal >= 0 ? 'text-gray-900' : 'text-red-600'}">${fmt(saldoFinal)}</p>
            </div>`;
    }

    // Agrupar por mes (meses desc, rows desc dentro)
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

    // Guardar rows ordenados para exportación
    _detalleRowsExport = rowsAsc;

    const tabla = document.getElementById('detalleTabla');

    if (rows.length === 0) {
        tabla.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-gray-300 italic">Sin movimientos en este período</td></tr>`;
    } else {
        let html = '';
        Object.keys(monthGroups).sort().reverse().forEach(key => {
            const group = monthGroups[key];
            const [year, month] = key.split('-');
            const monthLabel = `${MESES[parseInt(month) - 1]} ${year}`;
            const cierreColor = (modo === 'tdc' ? group.cierre > 0 : group.cierre < 0) ? 'text-red-600' : 'text-gray-800';

            html += `<tr class="bg-blue-50/40 border-t-2 border-blue-100">
                <td colspan="7" class="px-4 py-2">
                    <div class="flex justify-between items-center flex-wrap gap-2">
                        <span class="font-black text-[10px] uppercase text-blue-700 tracking-widest">${monthLabel}</span>
                        <div class="flex gap-4 text-[10px] font-bold">
                            <span class="text-gray-400">Apertura: <span class="text-gray-600">${fmt(group.apertura)}</span></span>
                            <span class="text-gray-400">Cierre: <span class="${cierreColor}">${fmt(group.cierre)}</span></span>
                        </div>
                    </div>
                </td>
            </tr>`;

            [...group.rows].sort((a, b) => b.date - a.date).forEach(r => {
                const linkUrl = r.sourceType === 'transaccion'
                    ? `ingresos.html?highlight=${r.id}`
                    : r.sourceType === 'gasto'
                        ? `gastos.html?highlight=${r.id}`
                        : null;

                const clickAttr = linkUrl
                    ? `onclick="window.open('${linkUrl}', '_blank')" style="cursor:pointer"`
                    : '';

                const isPositivo = r.type === 'ENTRADA' || r.type === 'PAGO';
                const amountColor = isPositivo ? 'text-green-600' : 'text-red-600';
                const sign = isPositivo ? '+' : '-';
                const saldoColor = (modo === 'tdc' ? r.saldo > 0 : r.saldo < 0) ? 'text-red-500' : 'text-gray-500';

                const typeLabels = {
                    ENTRADA: { label: 'ENTRADA', cls: 'bg-green-100 text-green-700' },
                    SALIDA:  { label: 'SALIDA',  cls: 'bg-red-100 text-red-700' },
                    CARGO:   { label: 'CARGO',   cls: 'bg-red-100 text-red-700' },
                    PAGO:    { label: 'PAGO',    cls: 'bg-green-100 text-green-700' }
                };
                const tl = typeLabels[r.type] || { label: r.type, cls: 'bg-gray-100 text-gray-600' };

                // Leer anotaciones guardadas
                const annot = _getAnotacion(r.sourceType, r.id);
                const factura = (annot.num_factura || '').replace(/"/g, '&quot;');
                const conceptoEdc = (annot.concepto_banco || '').replace(/"/g, '&quot;');

                html += `<tr class="border-b border-gray-50 hover:bg-yellow-50/50 transition-colors" ${clickAttr}>
                    <td class="px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">
                        ${r.date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td class="px-4 py-3 max-w-[200px]">
                        <p class="font-bold text-gray-800 text-sm truncate">${r.concept}</p>
                        ${r.ref ? `<p class="text-[10px] text-gray-400 font-mono truncate">${r.ref}</p>` : ''}
                    </td>
                    <td class="px-4 py-3">
                        <span class="badge-tipo px-2 py-0.5 rounded-full ${tl.cls}">${tl.label}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-black text-sm ${amountColor} whitespace-nowrap">
                        ${sign}${fmt(r.amount)}
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-sm ${saldoColor} whitespace-nowrap">
                        ${fmt(r.saldo)}
                    </td>
                    <td class="px-2 py-2" onclick="event.stopPropagation()">
                        <input type="text" value="${factura}" placeholder="Ej. F-001"
                            class="w-28 text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 bg-emerald-50/40 placeholder-gray-300 transition-all"
                            onblur="_saveAnotacion('${r.sourceType}','${r.id}','num_factura',this.value)"
                            onkeydown="if(event.key==='Enter') this.nextElementSibling?.focus()">
                    </td>
                    <td class="px-2 py-2" onclick="event.stopPropagation()">
                        <input type="text" value="${conceptoEdc}" placeholder="Concepto banco..."
                            class="w-44 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 bg-emerald-50/40 placeholder-gray-300 transition-all"
                            onblur="_saveAnotacion('${r.sourceType}','${r.id}','concepto_banco',this.value)">
                    </td>
                </tr>`;
            });
        });
        tabla.innerHTML = html;
    }

    // Mostrar modal
    document.getElementById('modalDetalleCuenta').classList.remove('hidden');
    document.getElementById('modalDetalleCuenta').scrollTop = 0;
}

window.cerrarDetalleCuenta = function () {
    document.getElementById('modalDetalleCuenta').classList.add('hidden');
};

// ── Exportar detalle de cuenta a Excel ───────────────────────────────────────
window.exportarDetalleExcel = function () {
    if (!_detalleRowsExport.length || !_detalleCuentaExport) {
        alert('No hay movimientos para exportar.');
        return;
    }

    const cuenta  = _detalleCuentaExport;
    const nombre  = cuenta.nombreCompleto || cuenta.nombre;
    const periodo = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const ahora   = new Date().toLocaleString('es-MX');

    // Construir filas del reporte
    const filas = [];

    // ── Encabezado ──
    filas.push(['AGRIGARDEN', '', '', '', '', '', '']);
    filas.push([`Estado de Cuenta — ${nombre}`, '', '', '', '', '', '']);
    filas.push([`Banco: ${cuenta.banco}  ·  Sucursal: ${cuenta.sucursal}  ·  Período: ${periodo}`, '', '', '', '', '', '']);
    filas.push([`Generado: ${ahora}`, '', '', '', '', '', '']);
    filas.push(['', '', '', '', '', '', '']);

    // ── KPIs ──
    const totalEntradas = _detalleRowsExport.filter(r => r.type === 'ENTRADA' || r.type === 'PAGO').reduce((s, r) => s + r.amount, 0);
    const totalSalidas  = _detalleRowsExport.filter(r => r.type === 'SALIDA' || r.type === 'CARGO').reduce((s, r) => s + r.amount, 0);
    const saldoFinal    = _detalleRowsExport[_detalleRowsExport.length - 1]?.saldo ?? 0;
    filas.push(['RESUMEN', '', '', '', '', '', '']);
    filas.push(['Entradas / Pagos', totalEntradas, 'Salidas / Cargos', totalSalidas, 'Saldo Final', saldoFinal, '']);
    filas.push(['', '', '', '', '', '', '']);

    // ── Encabezados de columnas ──
    filas.push(['Fecha', 'Nombre / Concepto', 'Referencia / Folio', 'Tipo', 'Monto', 'Saldo', '# Factura', 'Concepto Edo. Cta.']);

    // ── Datos ──
    [..._detalleRowsExport].sort((a, b) => b.date - a.date).forEach(r => {
        const annot       = _getAnotacion(r.sourceType, r.id);
        const signo       = (r.type === 'ENTRADA' || r.type === 'PAGO') ? r.amount : -r.amount;
        filas.push([
            r.date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            r.concept,
            r.ref || '',
            r.type,
            signo,
            r.saldo,
            annot.num_factura || '',
            annot.concepto_banco || ''
        ]);
    });

    // ── Crear workbook ──
    const ws = XLSX.utils.aoa_to_sheet(filas);

    // Anchos de columna
    ws['!cols'] = [
        { wch: 14 }, // Fecha
        { wch: 30 }, // Nombre
        { wch: 18 }, // Referencia
        { wch: 10 }, // Tipo
        { wch: 14 }, // Monto
        { wch: 14 }, // Saldo
        { wch: 16 }, // # Factura
        { wch: 30 }, // Concepto Edo
    ];

    // Combinar celdas del header
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 7 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombre.substring(0, 31));

    const fechaArchivo = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `EstadoCuenta_${nombre.replace(/\s+/g, '_')}_${fechaArchivo}.xlsx`);
};

// ============================================================
// MODAL: TRASPASO
// ============================================================
window.abrirModalTraspaso = function () {
    const opts = CUENTAS_REGULARES.map(c => `<option value="${c.key}">${c.nombre}</option>`).join('');
    document.getElementById('traspasoOrigen').innerHTML  = '<option value="">Seleccionar...</option>' + opts;
    document.getElementById('traspasoDestino').innerHTML = '<option value="">Seleccionar...</option>' + opts;
    document.getElementById('traspasoFecha').value  = hoy();
    document.getElementById('traspasoMonto').value  = '';
    document.getElementById('traspasoNotas').value  = '';
    document.getElementById('modalTraspaso').classList.remove('hidden');
};

window.cerrarModalTraspaso = function () {
    document.getElementById('modalTraspaso').classList.add('hidden');
};

window.guardarTraspaso = async function () {
    const origen  = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino').value;
    const monto   = parseFloat(document.getElementById('traspasoMonto').value) || 0;
    const fecha   = document.getElementById('traspasoFecha').value;
    const notas   = document.getElementById('traspasoNotas').value.trim();

    if (!origen)            return alert('Selecciona la cuenta origen.');
    if (!destino)           return alert('Selecciona la cuenta destino.');
    if (origen === destino) return alert('La cuenta origen y destino no pueden ser la misma.');
    if (monto <= 0)         return alert('El monto debe ser mayor a 0.');
    if (!fecha)             return alert('Selecciona una fecha.');

    try {
        const res = await fetch(`${SB_URL}/rest/v1/traspasos_cuentas_bancarias`, {
            method: 'POST',
            headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ cuenta_origen: origen, cuenta_destino: destino, monto, fecha, notas: notas || null })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `Error ${res.status}`); }
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
    document.getElementById('pagoTarjetaKey').value = tarjetaKey;
    document.getElementById('subtitlePagoTDC').textContent = tarjetaNombre;
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
            headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ tarjeta, cuenta_origen: cuentaOrigen, monto, fecha, notas: notas || null })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `Error ${res.status}`); }
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
    return '$' + (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoy() {
    return new Date().toISOString().split('T')[0];
}

function proximaFechaConDia(dia) {
    const hoyFecha = new Date();
    let fecha = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth(), dia);
    if (fecha <= hoyFecha) fecha = new Date(hoyFecha.getFullYear(), hoyFecha.getMonth() + 1, dia);
    return fecha;
}

function mostrarSkeletons() {
    document.getElementById('kpiSection').innerHTML  = [1,2,3,4].map(() => '<div class="skeleton h-20"></div>').join('');
    document.getElementById('gridCuentas').innerHTML  = [1,2,3].map(() => '<div class="skeleton h-40"></div>').join('');
    document.getElementById('gridTarjetas').innerHTML = [1,2].map(() => '<div class="skeleton h-56"></div>').join('');
}
