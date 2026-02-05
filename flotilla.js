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
    const select = document.getElementById('responsable');
    if (!select) return;

    try {
        const { data, error } = await sbClientFlotilla
            .from('empleados')
            .select('nombre_completo')
            .order('nombre_completo');

        if (error) throw error;

        empleadosList = data || [];

        // Populate Select
        let html = '<option value="">-- Seleccionar Responsable --</option>';
        empleadosList.forEach(emp => {
            html += `<option value="${emp.nombre_completo}">${emp.nombre_completo}</option>`;
        });
        select.innerHTML = html;

    } catch (err) {
        console.error("Error loading employees for select:", err);
        select.innerHTML = '<option value="">Error cargando lista</option>';
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

                <div class="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                     <div class="flex items-center gap-2">
                        <div class="size-6 bg-slate-100 rounded-full flex items-center justify-center">
                             <span class="material-symbols-outlined text-xs text-slate-400">person</span>
                        </div>
                        <span class="text-xs font-bold text-slate-500 truncate max-w-[120px]">${v.responsable || 'Sin asignar'}</span>
                     </div>
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
    const responsable = document.getElementById('responsable').value;

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
        marca, modelo, anio, placas: placas.toUpperCase(), responsable,
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
