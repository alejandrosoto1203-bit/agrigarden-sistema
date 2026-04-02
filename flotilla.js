// HARDCODED CREDENTIALS (Proven working pattern)
const SBF_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SBF_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let sbClientFlotilla;
if (window.supabase && window.supabase.createClient) {
    sbClientFlotilla = window.supabase.createClient(SBF_URL, SBF_KEY);
    console.log("Supabase Flotilla Initialized (Hardcoded)");
} else {
    console.error("Supabase Lib not found");
}

let flotillaCache = [];
let empleadosList = [];

async function cargarEmpleadosSelect() {
    const selects = ['responsable1', 'responsable2', 'uso_empleado_toma'].map(id => document.getElementById(id)).filter(el => el);
    if (!selects.length) return;

    try {
        const { data, error } = await sbClientFlotilla
            .from('empleados')
            .select('nombre_completo')
            .order('nombre_completo');

        if (error) throw error;

        empleadosList = data || [];

        // Populate Selects
        let html = '<option value="">-- Seleccionar Empleado --</option>';
        empleadosList.forEach(emp => {
            html += `<option value="${emp.nombre_completo}">${emp.nombre_completo}</option>`;
        });
        selects.forEach(select => select.innerHTML = html);

    } catch (err) {
        console.error("Error loading employees for select:", err);
        selects.forEach(select => select.innerHTML = '<option value="">Error cargando lista</option>');
    }
}

// UI Toggle Assignation
window.toggleAsignacionUI = function() {
    const tipo = document.getElementById('tipo_asignacion').value;
    if (tipo == '2') {
        document.getElementById('divResponsable2').classList.remove('hidden');
        document.getElementById('lblResp1').innerText = 'Empleado 1';
    } else {
        document.getElementById('divResponsable2').classList.add('hidden');
        document.getElementById('lblResp1').innerText = 'Empleado Responsable';
        document.getElementById('responsable2').value = '';
    }
}

window.cargarFlotilla = async function () {
    cargarEmpleadosSelect(); // Load dropdown options independently

    const contenedor = document.getElementById('listaVehiculos');
    if (!contenedor) return;

    // Loading State
    contenedor.innerHTML = `
        <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 gap-4">
            <span class="material-symbols-outlined animate-spin text-3xl">refresh</span>
            <span class="font-bold italic">Cargando flotilla... espere por favor.</span>
        </div>`;

    if (!sbClientFlotilla) {
        contenedor.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-red-500 gap-4">
                <span class="material-symbols-outlined text-4xl">error</span>
                <span class="font-bold text-lg">Error de Configuración</span>
                <p class="text-sm">No se pudo inicializar el cliente de base de datos.</p>
                <button onclick="location.reload()" class="px-4 py-2 bg-black text-white rounded-lg font-bold text-xs mt-2">Recargar Página</button>
            </div>`;
        return;
    }

    try {
        // Timeout check (8s)
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("La conexión tardó demasiado. Verifique su internet.")), 8000)
        );

        const fetchPromise = sbClientFlotilla
            .from('flotilla_vehiculos')
            .select('*')
            .order('marca', { ascending: true });

        const { data, error } = await Promise.race([fetchPromise, timeout]);

        if (error) {
            console.error(error);
            contenedor.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-red-500 gap-4">
                    <span class="material-symbols-outlined text-4xl">dns</span>
                    <span class="font-bold text-lg">Error de Base de Datos</span>
                    <div class="bg-red-50 p-4 rounded-xl border border-red-100 text-center max-w-lg">
                        <p class="font-mono text-xs text-red-800 break-all mb-2">${error.message}</p>
                        <p class="text-xs text-red-600 font-bold">Posible solución: Ejecuta el script SQL en Supabase.</p>
                    </div>
                    <button onclick="cargarFlotilla()" class="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                        <span class="material-symbols-outlined">refresh</span> Reintentar
                    </button>
                </div>`;
            return;
        }

        flotillaCache = data || [];
        renderizarFlotilla(flotillaCache);

    } catch (err) {
        console.error("Error loading fleet:", err);
        contenedor.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 gap-4">
                <span class="material-symbols-outlined text-4xl">wifi_off</span>
                <span class="font-bold text-lg">Problema de Conexión</span>
                <p class="text-sm">${err.message}</p>
                <button onclick="cargarFlotilla()" class="px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <span class="material-symbols-outlined">refresh</span> Reintentar
                </button>
            </div>`;
    }
}

// Render Fleet
function renderizarFlotilla(lista) {
    const contenedor = document.getElementById('listaVehiculos');
    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400 font-bold italic">No hay vehículos registrados.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(v => {
        // Date formatting helpers
        const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '---';

        // Logic for warnings (simplified)
        const today = new Date();
        const proxAceite = v.proximo_cambio_aceite ? new Date(v.proximo_cambio_aceite + 'T00:00:00') : null;

        let oilStatus = `<span class="status-badge status-ok">OK</span>`;
        if (proxAceite) {
            const diffTime = proxAceite - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 0) oilStatus = `<span class="status-badge status-danger">VENCIDO</span>`;
            else if (diffDays <= 30) oilStatus = `<span class="status-badge status-warning">PRÓXIMO</span>`;
        }

        return `
            <div class="card p-6 flex flex-col justify-between h-full group">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-xl font-black text-slate-800">${v.marca} ${v.modelo}</h3>
                                <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">${v.anio}</span>
                            </div>
                            <p class="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">${v.placas} ${v.numero_serie ? `| S/N: ${v.numero_serie}` : ''}</p>
                        </div>
                        <button onclick='abrirModal(${JSON.stringify(v)})' class="text-gray-300 hover:text-black transition-colors">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>

                    <div class="space-y-4 text-sm">
                         <div class="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <div>
                                <p class="text-[10px] font-bold text-emerald-600 uppercase">Kilometraje</p>
                                <p class="font-black text-emerald-800 text-lg">${v.kilometraje_actual || 0} <span class="text-[10px] font-bold uppercase ml-1">km</span></p>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                <span class="material-symbols-outlined text-emerald-600">speed</span>
                            </div>
                        </div>

                         <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Próximo Aceite</p>
                                <p class="font-bold text-slate-800">${formatDate(v.proximo_cambio_aceite)}</p>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                ${oilStatus}
                                <button onclick="confirmarAceite(${v.id})" class="text-[10px] text-blue-600 font-bold hover:underline">CONFIRMAR HOY</button>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Seguro</p>
                                <p class="font-semibold text-slate-700">${formatDate(v.ultimo_pago_seguro)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Verificación</p>
                                <p class="font-semibold text-slate-700">${formatDate(v.ultima_verificacion)}</p>
                            </div>
                        </div>

                         <div class="grid grid-cols-2 gap-4 mt-2">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base ${v.tenencia_pagada ? 'text-green-500' : 'text-gray-300'}">check_circle</span>
                                <span class="text-xs font-bold text-gray-500">Tenencia</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base ${v.se_hizo_cambio_placas ? 'text-green-500' : 'text-gray-300'}">check_circle</span>
                                <span class="text-xs font-bold text-gray-500">Placas Nuevas</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
                     <div class="flex items-start justify-between">
                        <div class="flex items-center gap-2">
                            <div class="size-8 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center shrink-0">
                                 <span class="material-symbols-outlined text-sm text-slate-400">group</span>
                            </div>
                            <div class="flex flex-col overflow-hidden">
                                <span class="text-xs font-bold text-slate-600 truncate max-w-[120px]">${v.tipo_asignacion == 2 ? 'Compartido' : 'Personal'}</span>
                                <span class="text-[9px] font-bold text-slate-400 truncate max-w-[120px]">${v.responsable1 || v.responsable || 'Sin asignar'}${v.tipo_asignacion == 2 && v.responsable2 ? ' / ' + v.responsable2 : ''}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${v.tipo_asignacion == 2 ? `
                                <button onclick='window.abrirModalUsoVehiculo(${JSON.stringify(v).replace(/'/g, "&apos;")})' class="btn-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase"><span class="material-symbols-outlined text-sm">key</span> Turno</button>
                            ` : `
                                <button onclick='window.abrirModalCombustible(${JSON.stringify(v).replace(/'/g, "&apos;")})' class="bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-colors"><span class="material-symbols-outlined text-sm">local_gas_station</span> Combustible</button>
                            `}
                        </div>
                     </div>
                     <button onclick='window.abrirModalRendimiento(${JSON.stringify(v).replace(/'/g, "&apos;")})' class="w-full mt-1 bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-black flex justify-center items-center gap-2 font-bold px-3 py-2 rounded-xl text-xs transition-colors"><span class="material-symbols-outlined text-[16px]">analytics</span> Rendimiento y Bitácora</button>
                </div>
            </div>
        `;
    }).join('');
}

// Save Vehicle
window.guardarVehiculo = async function (e) {
    e.preventDefault();

    const id = document.getElementById('vehiculoId').value;
    const marca = document.getElementById('marca').value;
    const modelo = document.getElementById('modelo').value;
    const anio = document.getElementById('anio').value;
    const placas = document.getElementById('placas').value;
    const numero_serie = document.getElementById('numero_serie').value;
    const kilometraje_actual = document.getElementById('kilometraje_actual').value || 0;
    
    const tipo_asignacion = document.getElementById('tipo_asignacion').value;
    const responsable1 = document.getElementById('responsable1').value;
    const responsable2 = document.getElementById('responsable2').value;

    const ultimo_mantenimiento = document.getElementById('ultimo_mantenimiento').value || null;
    const ultimo_cambio_aceite = document.getElementById('ultimo_cambio_aceite').value || null;
    const ultima_verificacion = document.getElementById('ultima_verificacion').value || null;
    const ultimo_pago_seguro = document.getElementById('ultimo_pago_seguro').value || null;

    const tenencia_pagada = document.getElementById('tenencia_pagada').checked;
    const se_hizo_cambio_placas = document.getElementById('cambio_placas').checked;

    // Calculate Next Oil Change
    // Logic: If ultimo_cambio_aceite is set, add 6 months.
    let proximo_cambio_aceite = null;
    if (ultimo_cambio_aceite) {
        const d = new Date(ultimo_cambio_aceite + 'T00:00:00'); // enforce timezone safety
        d.setMonth(d.getMonth() + 6);
        proximo_cambio_aceite = d.toISOString().split('T')[0];
    }

    const payload = {
        marca, modelo, anio, placas: placas.toUpperCase(), 
        tipo_asignacion: parseInt(tipo_asignacion) || 1, responsable1, responsable2,
        numero_serie: numero_serie.toUpperCase(), kilometraje_actual,
        ultimo_mantenimiento, ultimo_cambio_aceite, proximo_cambio_aceite,
        ultima_verificacion, ultimo_pago_seguro,
        tenencia_pagada, se_hizo_cambio_placas
    };

    try {
        let error;
        if (id) {
            const res = await sbClientFlotilla.from('flotilla_vehiculos').update(payload).eq('id', id);
            error = res.error;
        } else {
            const res = await sbClientFlotilla.from('flotilla_vehiculos').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        cerrarModal();
        cargarFlotilla();

    } catch (err) {
        console.error("Error saving vehicle:", err);
        alert("Error al guardar: " + err.message);
    }
}

// Confirm Oil Change (Quick Action)
window.confirmarAceite = async function (id) {
    if (!confirm("¿Confirmar que se realizó el cambio de aceite HOY? Esto actualizará la fecha del próximo mantenimiento.")) return;

    const today = new Date();
    const strToday = today.toISOString().split('T')[0];

    // +6 months
    const next = new Date(today);
    next.setMonth(next.getMonth() + 6);
    const strNext = next.toISOString().split('T')[0];

    try {
        const { error } = await sbClientFlotilla
            .from('flotilla_vehiculos')
            .update({
                ultimo_cambio_aceite: strToday,
                proximo_cambio_aceite: strNext
            })
            .eq('id', id);

        if (error) throw error;
        cargarFlotilla();

    } catch (err) {
        console.error("Error updating oil change:", err);
        alert("Error al actualizar.");
    }
}

// Delete Vehicle
window.eliminarVehiculo = async function () {
    const id = document.getElementById('vehiculoId').value;
    if (!id || !confirm("¿Estás seguro de ELIMINAR este vehículo? Esta acción no se puede deshacer.")) return;

    try {
        const { error } = await sbClientFlotilla.from('flotilla_vehiculos').delete().eq('id', id);
        if (error) throw error;

        cerrarModal();
        cargarFlotilla();
    } catch (err) {
        console.error("Error deleting vehicle:", err);
        alert("Error al eliminar.");
    }
}

// Historial de Kilometraje
window.abrirBitacoraKilometraje = function () {
    const id = document.getElementById('vehiculoId').value;
    const m = document.getElementById('modalKM');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    cargarLogKM(id);
}

async function cargarLogKM(vehiculoId) {
    const container = document.getElementById('listaKM');
    container.innerHTML = '<p class="text-center py-4 text-xs text-gray-400">Cargando historial...</p>';

    try {
        const { data, error } = await sbClientFlotilla
            .from('flotilla_bitacora_kilometraje')
            .select('*')
            .eq('vehiculo_id', vehiculoId)
            .order('fecha', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = '<p class="text-center py-10 text-xs text-gray-400 font-bold italic">No hay registros previos.</p>';
            return;
        }

        container.innerHTML = data.map(item => `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                    <p class="text-xs font-black text-slate-800">${item.kilometraje} <span class="text-[9px] text-gray-400 ml-1 italic">KM</span></p>
                    <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">${new Date(item.fecha + 'T00:00:00').toLocaleDateString()}</p>
                </div>
                <button onclick="eliminarRegistroKM(${item.id})" class="text-gray-300 hover:text-red-500">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-center py-4 text-xs text-red-500">Error: ${err.message}</p>`;
    }
}

window.registrarKM = async function (e) {
    e.preventDefault();
    const vehiculoId = document.getElementById('vehiculoId').value;
    const kilometraje = document.getElementById('inputNuevoKM').value;
    const fecha = new Date().toISOString().split('T')[0];

    try {
        // 1. Insert history
        const { error: err1 } = await sbClientFlotilla
            .from('flotilla_bitacora_kilometraje')
            .insert([{ vehiculo_id: vehiculoId, kilometraje, fecha }]);
        if (err1) throw err1;

        // 2. Update current in main table
        const { error: err2 } = await sbClientFlotilla
            .from('flotilla_vehiculos')
            .update({ kilometraje_actual: kilometraje })
            .eq('id', vehiculoId);
        if (err2) throw err2;

        document.getElementById('inputNuevoKM').value = '';
        document.getElementById('kilometraje_actual').value = kilometraje;
        cargarLogKM(vehiculoId);
        cargarFlotilla();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

window.eliminarRegistroKM = async function (id) {
    if (!confirm("¿Borrar este registro?")) return;
    try {
        const { error } = await sbClientFlotilla.from('flotilla_bitacora_kilometraje').delete().eq('id', id);
        if (error) throw error;
        cargarLogKM(document.getElementById('vehiculoId').value);
    } catch (err) {
        alert("Error al eliminar.");
    }
}

// Bitácora de Fallas
window.abrirBitacoraFallas = function () {
    const id = document.getElementById('vehiculoId').value;
    const m = document.getElementById('modalFallas');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);

    // Default today date
    document.getElementById('fechaFalla').value = new Date().toISOString().split('T')[0];
    cargarLogFallas(id);
}

async function cargarLogFallas(vehiculoId) {
    const container = document.getElementById('listaFallas');
    container.innerHTML = '<p class="text-center py-4 text-xs text-gray-400">Cargando bitácora...</p>';

    try {
        const { data, error } = await sbClientFlotilla
            .from('flotilla_bitacora_fallas')
            .select('*')
            .eq('vehiculo_id', vehiculoId)
            .order('fecha', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = '<p class="text-center py-10 text-xs text-gray-400 font-bold italic">No hay fallas reportadas.</p>';
            return;
        }

        container.innerHTML = data.map(item => {
            let colorClass = 'bg-red-50 text-red-700 border-red-100';
            if (item.estatus === 'Reparada') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
            if (item.estatus === 'En Reparación') colorClass = 'bg-blue-50 text-blue-700 border-blue-100';

            return `
            <div class="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${colorClass}">${item.estatus}</span>
                    <p class="text-[9px] font-bold text-gray-400">${new Date(item.fecha + 'T00:00:00').toLocaleDateString()}</p>
                </div>
                <p class="text-xs font-medium text-slate-700 leading-relaxed">${item.descripcion}</p>
                <div class="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-50">
                    <button onclick="cambiarEstatusFalla(${item.id}, 'En Reparación')" class="text-[9px] font-bold text-blue-500 hover:underline">REPARANDO</button>
                    <button onclick="cambiarEstatusFalla(${item.id}, 'Reparada')" class="text-[9px] font-bold text-emerald-500 hover:underline">REPARADA</button>
                    <button onclick="eliminarFalla(${item.id})" class="text-[9px] font-bold text-slate-300 hover:text-red-500 ml-2">BORRAR</button>
                </div>
            </div>
        `}).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-center py-4 text-xs text-red-500">Error: ${err.message}</p>`;
    }
}

window.registrarFalla = async function (e) {
    e.preventDefault();
    const vehiculoId = document.getElementById('vehiculoId').value;
    const fecha = document.getElementById('fechaFalla').value;
    const estatus = document.getElementById('estatusFalla').value;
    const descripcion = document.getElementById('descFalla').value;

    try {
        const { error } = await sbClientFlotilla
            .from('flotilla_bitacora_fallas')
            .insert([{ vehiculo_id: vehiculoId, fecha, estatus, descripcion }]);

        if (error) throw error;

        document.getElementById('descFalla').value = '';
        cargarLogFallas(vehiculoId);
    } catch (err) {
        alert("Error: " + err.message);
    }
}

window.cambiarEstatusFalla = async function (id, estatus) {
    try {
        const { error } = await sbClientFlotilla
            .from('flotilla_bitacora_fallas')
            .update({ estatus })
            .eq('id', id);
        if (error) throw error;
        cargarLogFallas(document.getElementById('vehiculoId').value);
    } catch (err) {
        alert("Error al actualizar estatus.");
    }
}

window.eliminarFalla = async function (id) {
    if (!confirm("¿Borrar reporte de falla?")) return;
    try {
        const { error } = await sbClientFlotilla.from('flotilla_bitacora_fallas').delete().eq('id', id);
        if (error) throw error;
        cargarLogFallas(document.getElementById('vehiculoId').value);
    } catch (err) {
        alert("Error al eliminar.");
    }
}

// ==========================================
// 🚗 GESTIÓN DE COMBUSTIBLE Y RENDIMIENTO 🚗
// ==========================================

window.abrirModalCombustible = async function(vehiculo) {
    document.getElementById('comb_vehiculo_id').value = vehiculo.id;
    // Si es personal, el empleado es el responsable1
    document.getElementById('comb_empleado_id').value = vehiculo.responsable1 || vehiculo.responsable || '';

    document.getElementById('lblVehiculoCombustible').innerText = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placas})`;
    document.getElementById('formCargaCombustible').reset();
    document.getElementById('comb_fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('comb_km').value = vehiculo.kilometraje_actual || 0;

    // Cargar métodos de pago dinámicos desde PROD
    const selectMetodoComb = document.getElementById('comb_metodo_pago');
    if (selectMetodoComb) {
        try {
            const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
            const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=nombre&activo=eq.true&order=orden.asc`, { headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` } });
            if (r.ok) {
                const metodos = await r.json();
                if (metodos && metodos.length > 0) {
                    selectMetodoComb.innerHTML = metodos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
                }
            }
        } catch(e) {}
    }

    const m = document.getElementById('modalCombustible');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
};

window.guardarCargaCombustible = async function(e, fromEntrega = false, entregaData = null) {
    if (e) e.preventDefault();
    
    // Obtener datos
    const vehiculo_id = fromEntrega ? entregaData.vehiculo_id : document.getElementById('comb_vehiculo_id').value;
    const empleado = fromEntrega ? entregaData.empleado : document.getElementById('comb_empleado_id').value;
    
    const fecha = fromEntrega ? entregaData.fecha : document.getElementById('comb_fecha').value;
    const km = fromEntrega ? entregaData.km : document.getElementById('comb_km').value;
    const monto = fromEntrega ? entregaData.monto : document.getElementById('comb_monto').value;
    const precio_litro = fromEntrega ? entregaData.precio_litro : document.getElementById('comb_precio_litro').value;
    const metodo_pago = fromEntrega ? entregaData.metodo_pago : document.getElementById('comb_metodo_pago').value;
    const sucursal = fromEntrega ? entregaData.sucursal : document.getElementById('comb_sucursal').value;

    const btn = document.getElementById(fromEntrega ? 'btnEntregarTurno' : 'btnGuardarComb');
    if (btn) { btn.disabled = true; btn.innerText = 'Guardando...'; }

    try {
        // 1. Guardar en Gastos Módulo
        const gastoNuevo = {
            created_at: fecha + 'T12:00:00',
            proveedor: 'GASOLINERA',
            categoria: 'Gasto',
            subcategoria: 'Combustible',
            metodo_pago: metodo_pago,
            monto_total: parseFloat(monto),
            sucursal: sucursal,
            estado_pago: 'Pagado',
            saldo_pendiente: 0,
            notas: `FLOTILLA VEHÍCULO ID ${vehiculo_id} - ${empleado}`
        };

        const resGasto = await fetch(`${SBF_URL}/rest/v1/gastos?select=id`, {
            method: 'POST',
            headers: { 'apikey': SBF_KEY, 'Authorization': `Bearer ${SBF_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(gastoNuevo)
        });
        
        if (!resGasto.ok) throw new Error("No se pudo generar el gasto automático.");
        const gastosGuardados = await resGasto.json();
        const gasto_id = gastosGuardados.length > 0 ? gastosGuardados[0].id : null;

        // 2. Calcular Rendimiento y Guardar
        let rendimiento = null;
        // Buscar carga anterior para km/L
        const { data: ultCarga } = await sbClientFlotilla.from('flotilla_cargas_combustible')
            .select('kilometraje').eq('vehiculo_id', vehiculo_id).order('fecha', { ascending: false }).limit(1);
            
        if (ultCarga && ultCarga.length > 0) {
            const kmAnterior = ultCarga[0].kilometraje;
            const litrosComprados = parseFloat(monto) / parseFloat(precio_litro);
            if (litrosComprados > 0 && km > kmAnterior) {
                rendimiento = (km - kmAnterior) / litrosComprados;
            }
        }

        const cargaNuevo = {
            vehiculo_id,
            responsable: empleado,
            fecha,
            kilometraje: km,
            monto,
            precio_litro,
            metodo_pago,
            sucursal,
            gasto_id,
            rendimiento_kml: rendimiento ? rendimiento.toFixed(2) : null
        };

        const { data: nuevaCargaData, error: errCarga } = await sbClientFlotilla.from('flotilla_cargas_combustible').insert([cargaNuevo]).select('id');
        if (errCarga) throw errCarga;

        // Actualizar km general del vehículo
        await sbClientFlotilla.from('flotilla_vehiculos').update({ kilometraje_actual: km }).eq('id', vehiculo_id);

        if (!fromEntrega) {
            cerrarModalLog('modalCombustible');
            cargarFlotilla();
            alert("Carga registrada y gasto generado en sucursal " + sucursal);
        }
        
        return nuevaCargaData[0].id; // Retornamos ID por si es de entrega
    } catch (err) {
        alert("Error al guardar carga: " + err.message);
        throw err;
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = fromEntrega ? 'ENTREGAR' : 'Guardar Carga'; }
    }
};

// ==========================================
// 👥 GESTIÓN DE TURNO (VEHÍCULO COMPARTIDO)
// ==========================================

window.abrirModalUsoVehiculo = async function(vehiculo) {
    document.getElementById('uso_vehiculo_id').value = vehiculo.id;
    document.getElementById('uso_responsable1').value = vehiculo.responsable1 || '';
    document.getElementById('uso_responsable2').value = vehiculo.responsable2 || '';
    
    document.getElementById('lblVehiculoUso').innerText = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placas})`;
    
    const divEstado = document.getElementById('divEstadoUso');
    const formTomar = document.getElementById('formTomarVehiculo');
    const formEntregar = document.getElementById('formEntregarVehiculo');
    
    divEstado.innerHTML = `<span class="material-symbols-outlined animate-spin">refresh</span> Cargando estado...`;
    formTomar.classList.add('hidden');
    formEntregar.classList.add('hidden');

    const m = document.getElementById('modalUsoVehiculo');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);

    // Revisar si hay un uso activo sin regresar
    try {
        const { data, error } = await sbClientFlotilla.from('flotilla_bitacora_uso')
            .select('*').eq('vehiculo_id', vehiculo.id).is('fecha_hora_regreso', null);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Está en uso
            const turnoNormal = data[0];
            divEstado.innerHTML = `
                <div class="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <span class="material-symbols-outlined text-blue-500 text-3xl mb-1">directions_car</span>
                    <p class="text-xs font-bold text-blue-800 uppercase">Vehículo en Uso Por:</p>
                    <p class="text-sm font-black">${turnoNormal.responsable}</p>
                    <p class="text-[10px] text-blue-600 font-bold mt-1">KM Salida: ${turnoNormal.km_salida}</p>
                </div>
            `;
            // Cargar datos para entregar
            document.getElementById('uso_km_regreso').value = turnoNormal.km_salida;
            window.turnoActivoId = turnoNormal.id;
            window.turnoResponsable = turnoNormal.responsable;
            formEntregar.classList.remove('hidden');
            
            // Inyectar HTML temporal para comb extra si no existe
            if (!document.getElementById('uso_comb_extra_fields')) {
                const extras = document.createElement('div');
                extras.id = 'uso_comb_extra_fields';
                extras.className = 'hidden space-y-4 pt-4 border-t border-gray-100 mt-4';
                extras.innerHTML = `
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="label-form text-red-600">Monto ($)</label><input type="number" step="0.01" id="uso_comb_monto" class="input-form bg-red-50 focus:bg-white" placeholder="0.00"></div>
                        <div><label class="label-form">Precio/Lt ($)</label><input type="number" step="0.01" id="uso_comb_preciolitro" class="input-form" placeholder="24.50"></div>
                        <div><label class="label-form">Sucursal</label><select id="uso_comb_sucursal" class="input-form"><option value="Sur">Sur</option><option value="Norte">Norte</option><option value="Matriz">Matriz</option></select></div>
                        <div><label class="label-form">Pago</label><select id="uso_comb_pago" class="input-form"><option value="Efectivo">Efectivo</option></select></div>
                    </div>
                `;
                formEntregar.insertBefore(extras, document.getElementById('btnEntregarTurno'));
                try {
                    const _U = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
                    const _K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
                    const r = await fetch(`${_U}/rest/v1/sys_metodos_pago?select=nombre&activo=eq.true&order=orden.asc`, { headers: { 'apikey': _K, 'Authorization': `Bearer ${_K}` } });
                    if (r.ok) {
                        const metodos = await r.json();
                        if (metodos && metodos.length > 0) {
                            document.getElementById('uso_comb_pago').innerHTML = metodos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
                        }
                    }
                } catch(e) {}
            }
            toggleCombustibleUI();
        } else {
            // Está libre
            divEstado.innerHTML = `
                <div class="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <span class="material-symbols-outlined text-emerald-500 text-3xl mb-1">check_circle</span>
                    <p class="text-xs font-bold text-emerald-800 uppercase">Vehículo Disponible</p>
                </div>
            `;
            document.getElementById('uso_km_salida').value = vehiculo.kilometraje_actual || 0;
            
            // Poner los 2 asignados
            const selToma = document.getElementById('uso_empleado_toma');
            selToma.innerHTML = `
                <option value="${vehiculo.responsable1}">${vehiculo.responsable1 || 'Empleado 1'}</option>
                <option value="${vehiculo.responsable2}">${vehiculo.responsable2 || 'Empleado 2'}</option>
            `;
            formTomar.classList.remove('hidden');
        }
    } catch(e) {
        divEstado.innerHTML = `<p class="text-red-500 text-xs font-bold">Error: ${e.message}</p>`;
    }
};

window.toggleCombustibleUI = function() {
    const cargoElement = document.querySelector('input[name="uso_cargo_comb"]:checked');
    if (!cargoElement) return;
    const cargo = cargoElement.value;
    const f = document.getElementById('uso_comb_extra_fields');
    if (f) {
        if (cargo === 'si') f.classList.remove('hidden');
        else f.classList.add('hidden');
    }
}

window.tomarVehiculo = async function() {
    const vehiculo_id = document.getElementById('uso_vehiculo_id').value;
    const responsable = document.getElementById('uso_empleado_toma').value;
    const km_salida = document.getElementById('uso_km_salida').value;
    
    if(!km_salida) return alert("Ingrese KM de salida");
    
    try {
        const payload = {
            vehiculo_id,
            responsable,
            km_salida,
            fecha_hora_salida: new Date().toISOString()
        };
        const { error } = await sbClientFlotilla.from('flotilla_bitacora_uso').insert([payload]);
        if (error) throw error;
        
        await sbClientFlotilla.from('flotilla_vehiculos').update({ kilometraje_actual: km_salida }).eq('id', vehiculo_id);
        
        cerrarModalLog('modalUsoVehiculo');
        cargarFlotilla();
    } catch(err) {
        alert("Error: " + err.message);
    }
}

window.entregarVehiculo = async function() {
    const vehiculo_id = document.getElementById('uso_vehiculo_id').value;
    const turno_id = window.turnoActivoId;
    const responsable = window.turnoResponsable;
    const km_regreso = document.getElementById('uso_km_regreso').value;
    const cargoElement = document.querySelector('input[name="uso_cargo_comb"]:checked');
    let cargo_comb = cargoElement ? cargoElement.value : 'no';
    
    if(!km_regreso) return alert("Ingrese KM de llegada");
    
    try {
        let carga_combustible_id = null;
        if (cargo_comb === 'si') {
            const monto = document.getElementById('uso_comb_monto').value;
            const precio_litro = document.getElementById('uso_comb_preciolitro').value;
            if(!monto || !precio_litro) return alert("Complete todos los campos del combustible extra");
            
            carga_combustible_id = await guardarCargaCombustible(null, true, {
                vehiculo_id, empleado: responsable, fecha: new Date().toISOString().split('T')[0],
                km: km_regreso, monto, precio_litro, 
                sucursal: document.getElementById('uso_comb_sucursal').value,
                metodo_pago: document.getElementById('uso_comb_pago').value
            });
        }
        
        const payload = {
            km_regreso,
            fecha_hora_regreso: new Date().toISOString(),
            carga_combustible_id
        };
        const { error } = await sbClientFlotilla.from('flotilla_bitacora_uso').update(payload).eq('id', turno_id);
        if (error) throw error;
        
        await sbClientFlotilla.from('flotilla_vehiculos').update({ kilometraje_actual: km_regreso }).eq('id', vehiculo_id);
        
        cerrarModalLog('modalUsoVehiculo');
        cargarFlotilla();
        alert("Vehículo entregado con éxito.");
    } catch(err) {
        console.error(err);
        alert("Error en la entrega: " + err.message);
    }
}

// ==========================================
// 📊 RENDIMIENTO Y PRORRATEO
// ==========================================

window.abrirModalRendimiento = async function(vehiculo) {
    document.getElementById('lblVehiculoRendimiento').innerText = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placas})`;
    const m = document.getElementById('modalRendimiento');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    
    const tablaCargas = document.getElementById('listaCargasCombustible');
    const divProrrateo = document.getElementById('divProrrateoResumen');
    
    tablaCargas.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 italic">Cargando...</td></tr>`;
    divProrrateo.innerHTML = `<p class="text-[10px] text-gray-400 italic bg-gray-50 p-4 rounded-xl">Cargando estadísticas...</p>`;
    
    // Cargas Combustible
    try {
        const { data: cargas } = await sbClientFlotilla.from('flotilla_cargas_combustible')
            .select('*').eq('vehiculo_id', vehiculo.id).order('fecha', { ascending: false });
            
        if (cargas && cargas.length > 0) {
            tablaCargas.innerHTML = cargas.map(c => `
                <tr class="hover:bg-slate-50 border-b border-gray-100">
                    <td class="px-3 py-3 text-slate-800 font-bold">${new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX')}</td>
                    <td class="px-3 py-3 text-slate-500 font-bold max-w-[100px] truncate">${c.responsable}</td>
                    <td class="px-3 py-3 text-right text-slate-600 font-black">${c.kilometraje}</td>
                    <td class="px-3 py-3 text-right text-blue-600 font-bold">${(c.monto/c.precio_litro).toFixed(1)} L</td>
                    <td class="px-3 py-3 text-right text-red-600 font-black">$${Number(c.monto).toLocaleString()}</td>
                    <td class="px-3 py-3 text-center">
                        ${c.rendimiento_kml ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">${c.rendimiento_kml} <span class="text-[8px] uppercase">km/L</span></span>` : '-'}
                    </td>
                </tr>
            `).join('');
        } else {
            tablaCargas.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 italic font-bold">Aún no hay cargas registradas</td></tr>`;
        }
    } catch(e) {
        tablaCargas.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error al cargar.</td></tr>`;
    }
    
    // Prorrateo si es asignacion = 2
    if (vehiculo.tipo_asignacion != 2) {
        divProrrateo.innerHTML = `<p class="text-[10px] text-gray-400 font-bold bg-gray-50 p-4 rounded-xl text-center">No aplica. Vehículo de uso personal.</p>`;
        return;
    }
    
    try {
        const { data: usos } = await sbClientFlotilla.from('flotilla_bitacora_uso')
            .select('*').eq('vehiculo_id', vehiculo.id).not('km_recorridos', 'is', null);
            
        if (usos && usos.length > 0) {
            let kmResp1 = 0, kmResp2 = 0;
            const r1 = vehiculo.responsable1;
            const r2 = vehiculo.responsable2;
            
            usos.forEach(u => {
                if (u.responsable === r1) kmResp1 += Number(u.km_recorridos || 0);
                else if (u.responsable === r2) kmResp2 += Number(u.km_recorridos || 0);
            });
            
            const totalKM = kmResp1 + kmResp2;
            const ptj1 = totalKM ? ((kmResp1/totalKM)*100).toFixed(0) : 0;
            const ptj2 = totalKM ? ((kmResp2/totalKM)*100).toFixed(0) : 0;
            
            divProrrateo.innerHTML = `
                <div class="space-y-4 pt-2">
                    <!-- Resumen Empleado 1 -->
                    <div class="bg-white border text-center border-slate-100 p-4 rounded-xl shadow-sm">
                        <p class="text-xs font-black uppercase text-slate-700 truncate">${r1 || 'Sin asignar 1'}</p>
                        <div class="flex justify-between items-end mt-2">
                            <span class="text-2xl font-black text-emerald-600">${kmResp1} <span class="text-[10px] text-emerald-800">km</span></span>
                            <span class="text-xs font-black text-slate-400">${ptj1}% del uso</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                            <div class="bg-emerald-500 h-2 rounded-full" style="width: ${ptj1}%"></div>
                        </div>
                    </div>
                    
                    <!-- Resumen Empleado 2 -->
                    <div class="bg-white border text-center border-slate-100 p-4 rounded-xl shadow-sm">
                        <p class="text-xs font-black uppercase text-slate-700 truncate">${r2 || 'Sin asignar 2'}</p>
                        <div class="flex justify-between items-end mt-2">
                            <span class="text-2xl font-black text-blue-600">${kmResp2} <span class="text-[10px] text-blue-800">km</span></span>
                            <span class="text-xs font-black text-slate-400">${ptj2}% del uso</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${ptj2}%"></div>
                        </div>
                    </div>
                    
                    <p class="text-[9px] font-bold text-gray-400 uppercase text-center italic mt-4">
                        * Cálculo basado en toma y entrega del vehículo
                    </p>
                </div>
            `;
            
        } else {
            divProrrateo.innerHTML = `<p class="text-[10px] text-gray-400 font-bold bg-gray-50 p-4 rounded-xl text-center">No hay suficientes registros de turnos entregados para calcular porcentaje de uso.</p>`;
        }
    } catch(e) {
        divProrrateo.innerHTML = `<p class="text-red-500 text-xs text-center border border-red-100 p-4 rounded-xl bg-red-50">Error al cargar prorrateo.</p>`;
    }
}
