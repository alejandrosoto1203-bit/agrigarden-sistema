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
                            <p class="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">${v.placas}</p>
                        </div>
                        <button onclick='abrirModal(${JSON.stringify(v)})' class="text-gray-300 hover:text-black transition-colors">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>

                    <div class="space-y-4 text-sm">
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
