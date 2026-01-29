// rrhh_tareas.js - Lógica del Monitor Kanban
let tareasCache = [];

// HARDCODED CREDENTIALS (Proven working pattern)
const SB_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

// Inicializar cliente directamente
let sbClientTareas;
if (window.supabase && window.supabase.createClient) {
    sbClientTareas = window.supabase.createClient(SB_URL, SB_KEY);
    console.log("Supabase Tareas Initialized");
} else {
    console.error("Supabase Lib not found");
}

window.cargarTareas = async function () {
    if (!sbClientTareas) {
        console.error("Client not ready");
        return;
    }

    // Leer filtro
    const filtro = document.getElementById('filtroVista')?.value || 'activas';
    const busqueda = document.getElementById('busquedaTareas')?.value.toLowerCase() || '';

    try {
        let query = sbClientTareas
            .from('rrhh_tareas')
            .select('*, empleados:empleado_id(nombre_completo, foto_url)')
            .order('created_at', { ascending: false });

        // Aplicar filtros de Base de Datos
        if (filtro === 'activas') {
            // Mostrar Pendientes, En Proceso, y Completadas SOLO de los últimos 2 días (para ver lo reciente)
            // Lógica compleja en Supabase: .or('estado.neq.COMPLETADO, and(estado.eq.COMPLETADO, created_at.gt.fecha))
            // Simplificación: Traer solo NO completadas. Si quieres ver completadas, cambia a 'Mes' o 'Todas'.
            query = query.in('estado', ['PENDIENTE', 'PROCESO']);
        } else if (filtro === 'mes') {
            const fechaInicio = new Date();
            fechaInicio.setDate(1); // Primer día del mes
            query = query.gte('created_at', fechaInicio.toISOString());
        } else {
            // 'todas': Limitar a 100 para evitar sobrecarga
            query = query.limit(100);
        }

        const { data: tareas, error } = await query;

        if (error) throw error;

        // Cachear y renderizar (el renderizado aplica el filtro de texto local)
        tareasCache = tareas || [];
        renderizarTablero();
        actualizarKPIsTareas();
    } catch (e) {
        console.error("Error cargando tareas:", e);
    }
};

// ... (renderizarTablero modification required to use 'busqueda' logic from cache)

window.abrirModalNuevaTarea = async function () {
    // Debug
    console.log("Abriendo modal nueva tarea...");

    if (!sbClientTareas) {
        alert("Error crítico: Sistema no conectado a base de datos.");
        return;
    }

    try {
        const { data: empleados, error } = await sbClientTareas
            .from('empleados')
            .select('id, nombre_completo')
            .eq('estatus', 'Activo')
            .order('nombre_completo');

        if (error) throw error;

        const select = document.getElementById('selectResponsable');
        select.innerHTML = '<option value="">Seleccionar Empleado...</option>';
        empleados.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.nombre_completo}</option>`;
        });

        document.getElementById('modalNuevaTarea').classList.remove('hidden');
    } catch (e) {
        console.error("Error cargando empleados:", e);
        alert("Error cargando lista de empleados.");
    }
};

window.cerrarModalNuevaTarea = function () {
    document.getElementById('modalNuevaTarea').classList.add('hidden');
    document.getElementById('inputTitulo').value = '';
    document.getElementById('inputDescripcion').value = '';
    document.getElementById('inputFecha').value = '';
    document.getElementById('selectResponsable').value = '';
};

window.guardarTarea = async function () {
    const titulo = document.getElementById('inputTitulo').value;
    const categoria = document.getElementById('selectCategoria').value;
    const fecha = document.getElementById('inputFecha').value;
    const responsable = document.getElementById('selectResponsable').value;
    const descripcion = document.getElementById('inputDescripcion').value;

    if (!titulo || !responsable) return alert("Título y Responsable son obligatorios.");

    try {
        if (!sbClientTareas) initTareasClient();

        const { error } = await sbClientTareas
            .from('rrhh_tareas')
            .insert([{
                titulo: titulo.toUpperCase(),
                categoria: categoria,
                fecha_vencimiento: fecha || null,
                empleado_id: responsable, // Cambiado de responsable_id a empleado_id
                descripcion: descripcion,
                estado: 'PENDIENTE',
                prioridad: 'Media'
            }]);

        if (error) throw error;

        alert("Tarea creada exitosamente.");
        window.cerrarModalNuevaTarea();
        window.cargarTareas();
    } catch (e) {
        console.error("Error guardando tarea:", e);
        alert("Error al guardar: " + e.message);
    }
};

window.allowDrop = function (ev) { ev.preventDefault(); };
window.drag = function (ev) { ev.dataTransfer.setData("text", ev.target.id); };
window.drop = async function (ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    if (!data) return;

    const taskId = data.replace('task-', '');
    const col = ev.target.closest('.kanban-column');
    if (!col) return;

    const targetCol = col.id.replace('col-', '');

    // Optimistic UI
    const tarea = tareasCache.find(t => t.id === taskId);
    if (tarea) {
        tarea.estado = targetCol;
        renderizarTablero();
        actualizarKPIsTareas();
    }

    // if (!sbClientTareas) initTareasClient(); // initTareasClient is not defined, assuming sbClientTareas is already initialized

    const { error } = await sbClientTareas
        .from('rrhh_tareas')
        .update({ estado: targetCol })
        .eq('id', taskId);

    if (error) {
        console.error("Error actualizando tarea:", error);
        alert("Error al mover la tarea.");
        window.cargarTareas(); // Revertir
    } else {
        // Registrar en bitácora (silencioso)
        await registrarBitacora(taskId, `Cambio de estado a ${targetCol}`, 'Cambio Estado');

        // Notificación en tiempo real si se completa
        if (targetCol === 'COMPLETADO' && window.NotificationsManager) {
            NotificationsManager.notify("✅ Tarea Completada", `La tarea "${tarea ? tarea.titulo : 'de RRHH'}" ha sido finalizada.`);
        }
    }
};



function renderizarTablero() {
    renderizarRendimientoEmpleados(); // Update sidebar stats

    const term = document.getElementById('busquedaTareas')?.value.toLowerCase() || '';
    const estados = ['PENDIENTE', 'PROCESO', 'COMPLETADO', 'NO_REALIZADA'];

    estados.forEach(estado => {
        const col = document.getElementById(`col-${estado}`);

        let countEl = document.getElementById(`count${estado.charAt(0) + estado.slice(1).toLowerCase()}`);
        if (!countEl && estado === 'PENDIENTE') countEl = document.getElementById('countPendiente');
        if (!countEl && estado === 'PROCESO') countEl = document.getElementById('countProceso');
        if (!countEl && estado === 'COMPLETADO') countEl = document.getElementById('countCompletado');
        if (!countEl && estado === 'NO_REALIZADA') countEl = document.getElementById('countNoRealizada');

        const filtradas = tareasCache.filter(t => {
            const matchEstado = t.estado === estado;
            const matchTexto = !term ||
                t.titulo.toLowerCase().includes(term) ||
                (t.empleados && t.empleados.nombre_completo.toLowerCase().includes(term));
            return matchEstado && matchTexto;
        });

        if (countEl) countEl.innerText = filtradas.length;
        if (!col) return;

        col.innerHTML = filtradas.map(t => {
            const empleado = t.empleados;
            const nombre = empleado ? empleado.nombre_completo : 'Sin Asignar';
            const foto = empleado && empleado.foto_url ? empleado.foto_url : `https://ui-avatars.com/api/?name=${nombre}`;

            let progress = 0;
            if (t.estado === 'PROCESO') progress = 50;
            if (t.estado === 'COMPLETADO') progress = 100;

            const isVencida = t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split('T')[0] && t.estado !== 'COMPLETADO' && t.estado !== 'NO_REALIZADA';

            return `
            <div class="bg-white p-4 rounded-xl shadow-[0_3px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 group relative hover:shadow-lg transition-all cursor-grab active:cursor-grabbing" 
                 draggable="true" ondragstart="drag(event)" id="task-${t.id}">
                
                <div class="flex justify-between items-start mb-2">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${getCategoriaColor(t.categoria)}">${t.categoria}</span>
                    <span class="text-[10px] font-bold text-slate-300">#${t.id.slice(0, 4)}</span>
                </div>
                
                <h4 class="text-sm font-bold text-slate-800 mb-3 leading-snug">${t.titulo}</h4>
                
                <div class="flex items-center gap-2 mb-3">
                    <img src="${foto}" class="size-6 rounded-full object-cover ring-2 ring-white">
                    <p class="text-[10px] font-bold text-slate-500 truncate">${nombre}</p>
                </div>

                <div class="mb-3">
                     <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>Progreso</span>
                        <span>${progress}%</span>
                     </div>
                     <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                     </div>
                </div>

                <div class="flex justify-between items-center pt-3 border-t border-slate-50">
                    <div class="flex items-center gap-1.5 ${isVencida ? 'text-red-500' : 'text-slate-400'}">
                        <span class="material-symbols-outlined text-[14px]">event</span>
                        <span class="text-[10px] font-bold">${t.fecha_vencimiento || 'Sin Fecha'}</span>
                    </div>
                    ${isVencida ? '<span class="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Vencida</span>' : ''}
                </div>

                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg backdrop-blur-sm shadow-sm">
                    <button onclick="event.stopPropagation(); abrirBitacora('${t.id}')" title="Bitácora" class="size-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-100 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">sticky_note_2</span>
                    </button>
                    <button onclick="event.stopPropagation(); editarTarea('${t.id}')" title="Editar" class="size-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-orange-50 hover:text-orange-600 border border-slate-100 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                     <button onclick="event.stopPropagation(); marcarNoRealizada('${t.id}')" title="Marcar No Realizada" class="size-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-100 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">cancel</span>
                    </button>
                    <button onclick="event.stopPropagation(); borrarTarea('${t.id}')" title="Borrar" class="size-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-600 border border-slate-100 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </div>
        `}).join('');
    });
}

function renderizarRendimientoEmpleados() {
    const container = document.getElementById('contenedorRendimientoEmpleados');
    if (!container) return;

    // Group by Employee
    const stats = {};
    tareasCache.forEach(t => {
        const emp = t.empleados;
        if (!emp) return;
        const id = emp.id;
        if (!stats[id]) stats[id] = {
            name: emp.nombre_completo,
            photo: emp.foto_url,
            total: 0,
            pend: 0,
            proc: 0,
            comp: 0,
            fail: 0
        };
        stats[id].total++;
        if (t.estado === 'PENDIENTE') stats[id].pend++;
        if (t.estado === 'PROCESO') stats[id].proc++;
        if (t.estado === 'COMPLETADO') stats[id].comp++;
        if (t.estado === 'NO_REALIZADA') stats[id].fail++;
    });

    if (Object.keys(stats).length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center">No hay datos de empleados</p>';
        return;
    }

    container.innerHTML = Object.values(stats).map(s => {
        const max = Math.max(s.total, 1);

        return `
        <div class="bg-slate-50/50 rounded-xl p-3 border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
            <div class="flex items-center gap-3 mb-3 pb-2 border-b border-slate-100">
                <img src="${s.photo || `https://ui-avatars.com/api/?name=${s.name}`}" class="size-8 rounded-full object-cover shadow-sm bg-white ring-2 ring-white">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-black text-slate-800 truncate leading-tight">${s.name}</h4>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">${s.total} Tareas Totales</p>
                </div>
            </div>
            
            <div class="space-y-2.5">
                <!-- Pendiente -->
                <div class="flex items-center gap-2">
                     <span class="text-[9px] font-bold text-slate-400 w-10 text-right uppercase">Pen.</span>
                     <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div class="h-full bg-orange-400 rounded-full" style="width: ${(s.pend / max) * 100}%"></div>
                     </div>
                     <span class="text-[10px] font-black text-orange-600 w-4 text-right">${s.pend}</span>
                </div>
                 <!-- Proceso -->
                <div class="flex items-center gap-2">
                     <span class="text-[9px] font-bold text-slate-400 w-10 text-right uppercase">Pro.</span>
                     <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div class="h-full bg-blue-500 rounded-full" style="width: ${(s.proc / max) * 100}%"></div>
                     </div>
                     <span class="text-[10px] font-black text-blue-600 w-4 text-right">${s.proc}</span>
                </div>
                 <!-- Completado -->
                <div class="flex items-center gap-2">
                     <span class="text-[9px] font-bold text-slate-400 w-10 text-right uppercase">Com.</span>
                     <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div class="h-full bg-emerald-500 rounded-full" style="width: ${(s.comp / max) * 100}%"></div>
                     </div>
                     <span class="text-[10px] font-black text-emerald-600 w-4 text-right">${s.comp}</span>
                </div>
                <!-- No Realizada -->
                <div class="flex items-center gap-2">
                     <span class="text-[9px] font-bold text-slate-400 w-10 text-right uppercase">Fal.</span>
                     <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div class="h-full bg-red-500 rounded-full" style="width: ${(s.fail / max) * 100}%"></div>
                     </div>
                     <span class="text-[10px] font-black text-red-600 w-4 text-right">${s.fail}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.marcarNoRealizada = async function (id) {
    if (!confirm("¿Marcar esta tarea como NO REALIZADA/INCUMPLIDA? Desaparecerá del tablero activo.")) return;
    try {
        const { error } = await sbClientTareas.from('rrhh_tareas').update({ estado: 'NO_REALIZADA' }).eq('id', id);
        if (error) throw error;
        await registrarBitacora(id, "Tarea marcada como NO REALIZADA (Incumplimiento)", "Estado");
        cargarTareas();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

function getCategoriaColor(cat) {
    if (cat === 'Onboarding') return 'bg-blue-50 text-blue-600';
    if (cat === 'Capacitación') return 'bg-emerald-50 text-emerald-600';
    if (cat === 'Legal') return 'bg-purple-50 text-purple-600';
    if (cat === 'General') return 'bg-slate-50 text-slate-600';
    if (cat === 'Nominas') return 'bg-orange-50 text-orange-600';
    return 'bg-slate-50 text-slate-600';
}

function actualizarKPIsTareas() {
    const total = tareasCache.length;
    const pend = tareasCache.filter(t => t.estado === 'PENDIENTE').length;
    const comp = tareasCache.filter(t => t.estado === 'COMPLETADO').length;
    // Vencidas
    const hoy = new Date().toISOString().split('T')[0];
    const vencidas = tareasCache.filter(t => t.fecha_vencimiento && t.fecha_vencimiento < hoy && t.estado !== 'COMPLETADO').length;

    document.getElementById('kpiTotalPendientes').innerText = pend;
    document.getElementById('kpiCompletadas').innerText = comp;
    document.getElementById('kpiVencidas').innerText = vencidas;

    // KPI Cumplimiento
    const cumplimiento = total > 0 ? Math.round((comp / total) * 100) : 0;
    document.getElementById('kpiCumplimiento').innerText = cumplimiento + '%';

    // Contadores Columnas (redundante con render, pero asegura actualización)
    const countPend = document.getElementById('countPendiente');
    const countProc = document.getElementById('countProceso');
    const countComp = document.getElementById('countCompletado');
    if (countPend) countPend.innerText = pend;
    if (countProc) countProc.innerText = tareasCache.filter(t => t.estado === 'PROCESO').length;
    if (countComp) countComp.innerText = comp;
}

// ==========================================
// FUNCIONES CRUD Y BITÁCORA
// ==========================================

window.editarTarea = function (id) {
    const tarea = tareasCache.find(t => t.id === id);
    if (!tarea) return;

    window.abrirModalNuevaTarea().then(() => {
        document.getElementById('modalTitulo').innerText = "Editar Tarea";
        document.getElementById('inputTareaId').value = tarea.id;
        document.getElementById('inputTitulo').value = tarea.titulo;
        document.getElementById('selectCategoria').value = tarea.categoria || 'General';
        document.getElementById('inputFecha').value = tarea.fecha_vencimiento || '';
        document.getElementById('selectResponsable').value = tarea.empleado_id || ''; // Using empleado_id
        document.getElementById('inputDescripcion').value = tarea.descripcion || '';
    });
};

window.borrarTarea = async function (id) {
    if (!confirm("¿Seguro que deseas eliminar esta tarea?")) return;

    try {
        // if (!sbClientTareas) initTareasClient(); // initTareasClient is not defined, assuming sbClientTareas is already initialized
        const { error } = await sbClientTareas.from('rrhh_tareas').delete().eq('id', id);
        if (error) throw error;
        window.cargarTareas();
    } catch (e) {
        alert("Error al borrar: " + e.message);
    }
};

window.abrirBitacora = async function (id) {
    document.getElementById('inputBitacoraTareaId').value = id;
    document.getElementById('inputNotaBitacora').value = '';
    document.getElementById('listaBitacora').innerHTML = '<p class="text-center text-xs text-slate-400 py-4">Cargando...</p>';
    document.getElementById('modalBitacora').classList.remove('hidden');
    cargarBitacora(id);
};

window.cerrarBitacora = function () {
    document.getElementById('modalBitacora').classList.add('hidden');
};
// Alias for consistency with HTML onclick if needed, but HTML calls cerrarModalBitacora?
window.cerrarModalBitacora = window.cerrarBitacora;

async function cargarBitacora(tareaId) {
    // if (!sbClientTareas) initTareasClient(); // initTareasClient is not defined, assuming sbClientTareas is already initialized
    const { data, error } = await sbClientTareas
        .from('rrhh_tarea_bitacora')
        .select('*')
        .eq('tarea_id', tareaId)
        .order('created_at', { ascending: false });

    const container = document.getElementById('listaBitacora');
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-xs text-slate-400 py-4">No hay comentarios aún.</p>';
        return;
    }

    container.innerHTML = data.map(b => `
        <div class="bg-white p-3 rounded-xl border border-slate-100 text-xs">
            <div class="flex justify-between mb-1">
                <span class="font-bold text-slate-700">${b.usuario || 'Sistema'}</span>
                <span class="text-slate-400 text-[10px]">${new Date(b.created_at).toLocaleString()}</span>
            </div>
            <p class="text-slate-600">${b.nota}</p>
        </div>
    `).join('');
}

window.agregarNotaBitacora = async function () {
    const tareaId = document.getElementById('inputBitacoraTareaId').value;
    const nota = document.getElementById('inputNotaBitacora').value;
    if (!nota.trim()) return;

    try {
        const { error } = await registrarBitacora(tareaId, nota, 'Comentario');
        if (error) throw error;

        document.getElementById('inputNotaBitacora').value = '';
        cargarBitacora(tareaId);
    } catch (e) {
        console.error("Error guardando nota:", e);
        if (e.message && (e.code === '42P01' || e.message.includes('relation "rrhh_tarea_bitacora" does not exist'))) {
            alert("Error: Falta crear la tabla de bitácora en la base de datos. Por favor ejecuta el script de creación.");
        } else {
            alert("Error guardando nota: " + (e.message || e));
        }
    }
};

// Helper interno para registrar bitácora
async function registrarBitacora(tareaId, nota, tipo) {
    if (!sbClientTareas) {
        console.error("Cliente Supabase no listo");
        return { error: { message: "Cliente no inicializado" } };
    }

    return await sbClientTareas.from('rrhh_tarea_bitacora').insert([{
        tarea_id: tareaId,
        nota: nota,
        tipo: tipo || 'Comentario',
        usuario: 'Usuario' // Idealmente el usuario logueado
    }]);
}

// Update cerrar function to clear edit ID
const oldCerrar = window.cerrarModalNuevaTarea;
window.cerrarModalNuevaTarea = function () {
    oldCerrar();
    document.getElementById('inputTareaId').value = ''; // Reset ID
    document.getElementById('modalTitulo').innerText = "Nueva Tarea"; // Reset Title
};

window.marcarNoRealizada = async function (id) {
    if (!confirm("¿Marcar esta tarea como NO REALIZADA/INCUMPLIDA? Se moverá a la columna de 'No Realizada'.")) return;
    try {
        const { error } = await sbClientTareas.from('rrhh_tareas').update({ estado: 'NO_REALIZADA' }).eq('id', id);
        if (error) throw error;
        await registrarBitacora(id, "Tarea marcada como NO REALIZADA (Incumplimiento)", "Estado");
        cargarTareas();
    } catch (e) {
        alert("Error: " + e.message);
    }
};