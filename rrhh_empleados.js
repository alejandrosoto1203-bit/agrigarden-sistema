// rrhh_empleados.js - Gestión de Personal Agrigarden
let empleadosCache = [];
let pasoActual = 1;
let globalFotoUrl = null;
let currentEmpleadoSeleccionado = null;

async function cargarEmpleados() {
    // Fallback de emergencia por si api.js no carga
    if (!window.SUPABASE_URL) {
        console.warn("api.js no cargó variables globales. Usando fallback.");
        window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
    }

    const urlConsulta = `${window.SUPABASE_URL}/rest/v1/empleados?select=*&order=nombre_completo.asc`;

    try {
        const res = await fetch(urlConsulta, {
            method: 'GET',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`Error ${res.status}: ${errData.message || res.statusText}`);
        }

        empleadosCache = await res.json();
        renderizarGridEmpleados(empleadosCache);
        if (empleadosCache.length === 0) alert("Conexión exitosa, pero no se encontraron empleados en la base de datos.");

    } catch (e) {
        console.error("Error RRHH:", e);
        alert(`ERROR CRÍTICO AL CARGAR EMPLEADOS:\n\nURL intentada: ${urlConsulta}\n\nMensaje: ${e.message}\n\nSi dice "Failed to fetch" o "404", verifica tu conexión a internet y que la tabla 'empleados' exista en Supabase.`);
    }
}

// Export logic
window.exportarRRHH = function () {
    exportToExcel(
        empleadosCache,
        {
            nombre_completo: "Nombre Completo",
            puesto: "Puesto",
            departamento: "Departamento",
            sueldo_base: "Sueldo Base",
            fecha_ingreso: "Fecha Ingreso",
            telefono: "Teléfono",
            correo: "Correo",
            curp: "CURP",
            nss: "NSS",
            rfc: "RFC",
            estatus: "Estatus"
        },
        `Directorio_Empleados_${new Date().toISOString().split('T')[0]}`,
        "Empleados"
    );
}

function renderizarGridEmpleados(datos) {
    const grid = document.getElementById('gridEmpleados');
    if (!grid) return;
    grid.innerHTML = datos.map(emp => {
        const fotoFinal = emp.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre_completo)}&background=19e66b&color=000&bold=true`;

        const isInactive = emp.estatus !== 'Activo';
        const inactiveClass = isInactive ? 'opacity-60 grayscale' : '';
        const badgeClass = isInactive ? 'bg-slate-400' : 'bg-primary';

        return `
        <div class="emp-card p-9 flex flex-col items-center text-center ${inactiveClass} transition-all duration-300 relative group-card">
            ${isInactive ? `<div class="absolute top-4 right-4 bg-slate-200 text-slate-500 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">BAJA: ${emp.motivo_baja || 'N/A'}</div>` : ''}
            
            <div class="avatar-container">
                <img src="${fotoFinal}" class="avatar-img shadow-lg" onerror="this.src='https://ui-avatars.com/api/?name=Error&background=f1f5f9&color=94a3b8'">
                <div class="status-badge ${badgeClass}"></div>
            </div>
            <h3 class="font-black text-slate-900 uppercase text-base leading-tight mb-2 tracking-tight">${emp.nombre_completo}</h3>
            <p class="text-xs font-extrabold text-primary uppercase tracking-[0.15em] mb-7">${emp.puesto || 'PUESTO NO ASIGNADO'}</p>
            
            <div class="w-full space-y-3 mb-9 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left border-t border-slate-50 pt-5">
                <div class="flex justify-between"><span>Branch:</span> <span class="text-slate-700 font-black">${emp.sucursal || 'Matriz'}</span></div>
                <div class="flex justify-between"><span>ID:</span> <span class="text-slate-700 font-black">${emp.id.slice(0, 5).toUpperCase()}</span></div>
            </div>

            <button onclick="verExpediente('${emp.id}')" class="w-full py-4.5 bg-slate-50 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group shadow-sm mb-2">
                <span class="material-symbols-outlined text-lg group-hover:text-primary">visibility</span> View File
            </button>
            <button onclick="eliminarEmpleado('${emp.id}')" class="w-full py-2 text-red-300 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">
                 Eliminar
            </button>
        </div>`;
    }).join('');
}

function verExpediente(id) {
    const emp = empleadosCache.find(e => e.id === id);
    if (!emp) return;
    currentEmpleadoSeleccionado = emp;

    const header = document.getElementById('headerExpediente');
    const fotoExpe = emp.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre_completo)}&background=19e66b&color=000&bold=true`;

    header.innerHTML = `
        <div class="avatar-container mb-0 shadow-xl">
            <img src="${fotoExpe}" class="avatar-img border-0 shadow-none">
            <div class="status-badge ${emp.estatus === 'Activo' ? 'bg-primary' : 'bg-red-400'}"></div>
        </div>
        <div class="flex-1">
            <h3 class="font-black text-slate-900 uppercase text-2xl leading-tight tracking-tighter">${emp.nombre_completo}</h3>
            <p class="text-sm font-black text-primary uppercase mt-1 tracking-widest">${emp.puesto || 'Employee'}</p>
            <div class="flex gap-2 mt-4">
                <span class="px-4 py-1.5 bg-green-50 text-[10px] font-black rounded-lg text-green-600 uppercase border border-green-100">${emp.estatus}</span>
                <span class="px-4 py-1.5 bg-slate-50 text-[10px] font-black rounded-lg text-slate-400 uppercase border border-slate-100">${emp.sucursal}</span>
            </div>
        </div>
    `;

    document.getElementById('btnEditarCompleto').onclick = () => prepararEdicion(emp);
    cambiarTabExpediente('personal');
    document.getElementById('slideExpediente').classList.add('active');
}

function calcularAntiguedad(fecha) {
    if (!fecha) return "0 Años";
    const ingreso = new Date(fecha);
    const hoy = new Date();
    let diff = hoy.getFullYear() - ingreso.getFullYear();
    const m = hoy.getMonth() - ingreso.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < ingreso.getDate())) diff--;
    return `${diff} Años`;
}

function cambiarTabExpediente(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const cont = document.getElementById('detalleExpediente');
    const emp = currentEmpleadoSeleccionado;

    if (tabId === 'personal') {
        cont.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Información de Contacto</h4>
                <div class="bg-slate-50 p-7 rounded-[2rem] space-y-6 border border-slate-100 shadow-sm font-bold uppercase">
                    <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Email</p><p class="text-base text-slate-800 lowercase font-black">${emp.correo_electronico || 'N/A'}</p></div>
                    <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Phone</p><p class="text-base text-slate-800 font-black">${emp.telefono || 'N/A'}</p></div>
                    <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Address</p><p class="text-base text-slate-800 font-black leading-relaxed">${emp.direccion_completa || 'N/A'}</p></div>
                </div></div>
                <div><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Datos Generales</h4>
                <div class="grid grid-cols-2 gap-5 uppercase font-black text-center text-base">
                    <div class="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100"><p class="text-[9px] font-black text-slate-400 uppercase mb-2">Status</p><p class="text-slate-800">${emp.estado_civil || '-'}</p></div>
                    <div class="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100"><p class="text-[9px] font-black text-slate-400 uppercase mb-2">Age</p><p class="text-slate-800">${emp.edad || '0'} Años</p></div>
                    <div class="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 col-span-2"><p class="text-[9px] font-black text-slate-400 uppercase mb-2">National</p><p class="text-slate-800">MEXICANA</p></div>
                </div></div>
            </div>`;
    } else if (tabId === 'empleo') {
        const antiguedad = calcularAntiguedad(emp.fecha_ingreso);
        cont.innerHTML = `
            </div>`;
        renderizarModuloEmpleo(emp, cont);
    } else if (tabId === 'expediente') {
        cont.innerHTML = `
            <div class="flex justify-between items-center animate-in fade-in duration-300">
                <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Documentos Digitales</h4>
                <div class="relative">
                    <input type="file" id="inputDocExpediente" class="hidden" onchange="subirDocumentoExpediente(this)">
                    <button onclick="document.getElementById('inputDocExpediente').click()" class="text-primary font-black text-[11px] uppercase hover:underline flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">cloud_upload</span> + Subir
                    </button>
                </div>
            </div>
            <div id="listaDocumentos" class="space-y-4 pt-6">
                <p class="text-center text-slate-300 py-4 text-xs font-bold animate-pulse">Cargando documentos...</p>
            </div>`;
        cargarDocumentosExpediente(emp.id);
        cargarDocumentosExpediente(emp.id);
    } else if (tabId === 'nomina') {
        renderizarModuloNominaExpediente(emp);
    } else { cont.innerHTML = `<p class="text-center text-slate-300 py-16 font-black uppercase text-sm animate-pulse tracking-widest">Información próximamente disponible</p>`; }
}

function calcularDiasCorrespondientes(añosAntiguedad) {
    // Regla: 1 año=12, 2=14, 3=16, 4=18, 5+=20
    if (añosAntiguedad < 1) return 0; // Menos de un año
    if (añosAntiguedad === 1) return 12;
    if (añosAntiguedad === 2) return 14;
    if (añosAntiguedad === 3) return 16;
    if (añosAntiguedad === 4) return 18;
    return 20; // 5 años o más
}

async function renderizarModuloEmpleo(emp, container) {
    const antiguedadStr = calcularAntiguedad(emp.fecha_ingreso); // "X Años"
    const añosNum = parseInt(antiguedadStr.split(' ')[0]) || 0;

    // Calcular días totales por antigüedad (si tiene 0 años, le damos chance de adelantar sobre los 12 futuros? 
    // El requerimiento dice: "si no tiene un año y tiene 0 dias disponibles y le autorizamos un adelanto... el contador baje a -1".
    // Asumiremos base 0 si < 1 año, pero permitimos registrar vacaciones.

    const diasPorLey = calcularDiasCorrespondientes(añosNum);

    // Obtener historial de vacaciones usadas
    let diasUsados = 0;
    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const resVacs = await fetch(`${sbUrl}/rest/v1/rrhh_vacaciones?select=dias_tomados&empleado_id=eq.${emp.id}`, {
            headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
        });
        if (resVacs.ok) {
            const vacs = await resVacs.json();
            diasUsados = vacs.reduce((s, v) => s + v.dias_tomados, 0);
        }
    } catch (e) { console.error("Error vacs", e); }

    const diasDisponibles = diasPorLey - diasUsados;

    container.innerHTML = `
        <div class="space-y-8 animate-in fade-in duration-300">
            <!-- Info Contractual -->
            <div class="bg-slate-50 p-7 rounded-[2rem] space-y-6 border border-slate-100 font-black uppercase shadow-sm text-base">
                <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Modalidad Contrato</p><p class="text-slate-800 font-black">${emp.tipo_contrato || '-'}</p></div>
                <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Fecha de Ingreso</p><p class="text-slate-800 font-black">${emp.fecha_ingreso || '-'}</p></div>
                <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Antigüedad</p><p class="text-slate-800 font-black">${antiguedadStr}</p></div>
                <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                     <div class="bg-primary/5 p-4 rounded-xl border border-primary/10">
                        <p class="text-[9px] font-black text-primary uppercase mb-1">Sueldo Mensual</p>
                        <p class="text-lg text-slate-900 font-black">$${(emp.sueldo_base || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            <!-- VACACIONES -->
            <div>
                <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Vacaciones</h4>
                <div class="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 relative overflow-hidden">
                    <div class="relative z-10">
                         <div class="flex justify-between items-end mb-6">
                            <div>
                                <p class="text-xs font-black text-blue-400 uppercase mb-1">Días Disponibles</p>
                                <h3 class="text-4xl font-black text-blue-900 ${diasDisponibles < 0 ? 'text-red-500' : ''}">${diasDisponibles}</h3>
                                <p class="text-[10px] font-bold text-blue-300 mt-1">De ${diasPorLey} correspondientes</p>
                            </div>
                            <button onclick="registrarVacacionesUI('${emp.id}')" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform">
                                + Registrar
                            </button>
                        </div>
                        <div class="w-full bg-blue-200/50 h-3 rounded-full overflow-hidden">
                            <div class="bg-blue-500 h-full rounded-full" style="width: ${(Math.max(0, diasDisponibles) / Math.max(1, diasPorLey)) * 100}%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bajar Empleado -->
             ${emp.estatus === 'Activo' ? `
             <div class="pt-8 border-t border-slate-100">
                <button onclick="iniciarBajaEmpleado('${emp.id}')" class="w-full py-4 border-2 border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-xs hover:border-red-200 hover:text-red-400 hover:bg-red-50 transition-all">
                    Dar de Baja Empleado
                </button>
             </div>` : `
             <div class="pt-8 border-t border-slate-100 text-center">
                <p class="text-red-400 font-black uppercase text-sm">EMPLEADO INACTIVO</p>
                <p class="text-xs font-bold text-slate-400 uppercase">Motivo: ${emp.motivo_baja || 'Desconocido'}</p>
                <button onclick="reactivarEmpleado('${emp.id}')" class="mt-4 text-primary font-black uppercase text-xs hover:underline">Reactivar</button>
             </div>
             `}
        </div>
    `;
}

async function renderizarModuloNominaExpediente(emp) {
    const cont = document.getElementById('detalleExpediente');
    cont.innerHTML = '<p class="text-center py-10 animate-pulse text-xs font-black text-slate-300">Cargando historial...</p>';

    // Fetch historial nómina
    let historialHtml = '';
    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const resNom = await fetch(`${sbUrl}/rest/v1/rrhh_nomina?select=*&empleado_id=eq.${emp.id}&order=id.desc&limit=10`, {
            headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
        });

        if (resNom.ok) {
            const nominas = await resNom.json();
            if (nominas && nominas.length > 0) {
                historialHtml = nominas.map(n => `
                    <div class="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                        <div>
                            <p class="text-xs font-black text-slate-700 uppercase">${n.periodo || 'Periodo'}</p>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded ${n.estado === 'Pagado' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} uppercase">${n.estado}</span>
                        </div>
                        <p class="text-sm font-black text-slate-900">$${(n.sueldo_base + (n.bonificaciones || 0) - (n.deducciones || 0)).toFixed(2)}</p>
                    </div>
                `).join('');
            } else {
                historialHtml = '<p class="text-center py-4 text-xs font-bold text-slate-300 italic">Sin historial de pagos.</p>';
            }
        }
    } catch (e) { console.error(e); }

    cont.innerHTML = `
         <div class="space-y-8 animate-in fade-in duration-300">
            <div><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Datos Bancarios</h4>
            <div class="bg-slate-50 p-7 rounded-[2rem] space-y-6 border border-slate-100 font-bold uppercase shadow-sm">
                 <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Banco</p><p class="text-base text-slate-800 font-black">${emp.banco || 'NO REGISTRADO'}</p></div>
                 <div><p class="text-[10px] font-black text-slate-400 uppercase mb-1">Cuenta / CLABE</p><p class="text-base text-slate-800 font-black tracking-widest">${emp.cuenta_banco || 'NO REGISTRADO'}</p></div>
            </div></div>

            <div><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5">Últimos Pagos</h4>
            <div class="bg-white border boundary-slate-100 rounded-[2rem] px-6 shadow-sm">
                ${historialHtml}
            </div></div>
         </div>
    `;
}

async function registrarVacacionesUI(id) {
    const dias = prompt("¿Cuántos días va a tomar?");
    if (!dias) return;
    const num = parseInt(dias);
    if (isNaN(num) || num <= 0) return alert("Número inválido");

    const inicio = prompt("Fecha inicio (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!inicio) return;

    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const res = await fetch(`${sbUrl}/rest/v1/rrhh_vacaciones`, {
            method: 'POST',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                empleado_id: id,
                fecha_inicio: inicio,
                fecha_fin: inicio,
                dias_tomados: num,
                comentarios: 'Registrado desde Expediente'
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        alert("Vacaciones registradas.");
        cambiarTabExpediente('empleo');
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function iniciarBajaEmpleado(id) {
    const motivo = prompt("Motivo de la baja (escribe 'Renuncia' o 'Despido'):");
    if (!motivo) return;

    if (!confirm("¿Seguro que deseas dar de baja a este empleado? Pasará a inactivo.")) return;

    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const res = await fetch(`${sbUrl}/rest/v1/empleados?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ estatus: 'Inactivo', motivo_baja: motivo.toUpperCase() })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        alert("Empleado dado de baja.");
        cargarEmpleados();
        cerrarExpediente();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function reactivarEmpleado(id) {
    if (!confirm("¿Reactivar empleado?")) return;

    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const res = await fetch(`${sbUrl}/rest/v1/empleados?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ estatus: 'Activo', motivo_baja: null })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        alert("Reactivado.");
        cargarEmpleados();
        cerrarExpediente();
    } catch (e) { alert(e.message); }
}

async function eliminarEmpleado(id) {
    if (!confirm("PELIGRO: ¿Eliminar definitivamente a este empleado y toda su información historic? Esta acción no se puede deshacer.")) return;

    // Fallback vars
    const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
    const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

    try {
        const res = await fetch(`${sbUrl}/rest/v1/empleados?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        alert("Empleado eliminado.");
        cargarEmpleados();
    } catch (e) { alert(e.message); }
}

async function cargarDocumentosExpediente(empleadoId) {
    const lista = document.getElementById('listaDocumentos');
    if (!lista) return;

    try {
        // Fallback vars just in case
        const sbUrl = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        const sbKey = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

        // Using FETCH for listing files (REST API)
        const res = await fetch(`${sbUrl}/storage/v1/object/list/rrhh_documentos`, {
            method: 'POST',
            headers: {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prefix: `${empleadoId}/`,
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' }
            })
        });

        if (!res.ok) {
            console.error("Error listing docs:", res.status, res.statusText);
            lista.innerHTML = `<p class="text-center text-red-300 py-4 text-xs font-bold">Error obteniendo lista de archivos.</p>`;
            return;
        }

        const data = await res.json();

        if (!data || data.length === 0) {
            lista.innerHTML = `<p class="text-center text-slate-300 py-4 text-xs font-bold italic">No hay documentos subidos.</p>`;
            return;
        }

        lista.innerHTML = data.map(doc => {
            const url = `${sbUrl}/storage/v1/object/public/rrhh_documentos/${empleadoId}/${doc.name}`;
            return `
                <div class="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[1.25rem] shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center gap-4 text-slate-600">
                        <span class="material-symbols-outlined text-red-500 text-4xl font-bold">picture_as_pdf</span>
                        <div class="flex flex-col">
                            <span class="text-sm font-black uppercase truncate max-w-[200px]">${doc.name}</span>
                            <span class="text-[9px] font-bold text-slate-400">${(doc.metadata?.size / 1024).toFixed(1)} KB • ${new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <a href="${url}" target="_blank" class="material-symbols-outlined text-slate-300 hover:text-primary text-3xl font-bold cursor-pointer transition-colors">download</a>
                </div>`;
        }).join('');

    } catch (e) {
        console.error(e);
        lista.innerHTML = `<p class="text-center text-red-300 py-4 text-xs font-bold">Error inesperado: ${e.message}</p>`;
    }
}

async function subirDocumentoExpediente(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const empleadoId = currentEmpleadoSeleccionado?.id;
    if (!empleadoId) return;

    try {
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const filePath = `${empleadoId}/${fileName}`;

        // Mostrar loading (simple)
        const btn = input.nextElementSibling;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="animate-spin text-xs">↻</span> Subiendo...`;
        btn.disabled = true;

        // Usamos FETCH directamente para mayor confiabilidad (igual que en subirFotoStorage)
        const res = await fetch(`${window.SUPABASE_URL}/storage/v1/object/rrhh_documentos/${filePath}`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': file.type,
                'x-upsert': 'true'
            },
            body: file
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`Error ${res.status}: ${errData.message || res.statusText}`);
        }

        alert("Documento subido correctamente.");
        cargarDocumentosExpediente(empleadoId);

    } catch (e) {
        console.error("Error subiendo documento:", e);
        alert("Error al subir documento. Asegúrate de que el bucket 'rrhh_documentos' exista y tenga políticas públicas.");
    } finally {
        // Restaurar botón
        const btn = input.nextElementSibling;
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        input.value = '';
    }
}

function filtrarEmpleados() {
    const busq = document.getElementById('busquedaInput').value.toLowerCase();
    const filtrados = empleadosCache.filter(e => e.nombre_completo.toLowerCase().includes(busq) || e.puesto?.toLowerCase().includes(busq));
    renderizarGridEmpleados(filtrados);
}

function cerrarExpediente() { document.getElementById('slideExpediente').classList.remove('active'); }
function abrirModalNuevoEmpleado() { pasoActual = 1; actualizarPasosUI(); document.getElementById('modalNuevoEmpleado').classList.remove('hidden'); }
function cerrarModalNuevoEmpleado() { document.getElementById('modalNuevoEmpleado').classList.add('hidden'); document.getElementById('formEmpleado').reset(); document.getElementById('editEmpleadoId').value = ""; }
function cambiarPaso(delta) { pasoActual += delta; actualizarPasosUI(); }
function actualizarPasosUI() {
    const titulos = ["Identidad", "Contacto", "Laboral", "Prestaciones"];
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step${pasoActual}`).classList.remove('hidden');
    document.getElementById('stepCircle').innerText = pasoActual;
    document.getElementById('txtStepTitle').innerText = titulos[pasoActual - 1];
    document.getElementById('currentStepText').innerText = pasoActual;
    document.getElementById('btnAnterior').classList.toggle('hidden', pasoActual === 1);
    document.getElementById('btnSiguiente').classList.toggle('hidden', pasoActual === 4);
    document.getElementById('btnGuardar').classList.toggle('hidden', pasoActual !== 4);
}
async function subirFotoStorage(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const preview = document.getElementById('previewFoto');
    const loading = document.getElementById('loadingFoto');

    loading.classList.remove('hidden');
    alert(`DEBUG V3: Iniciando subida de: ${file.name} (${file.type})`);

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

        // Revertimos a FETCH porque el cliente de Supabase fallaba con las credenciales actuales
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos_empleados/${fileName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': file.type
            },
            body: file
        });

        if (res.ok) {
            // Recibimos respuesta correcta
            const responseData = await res.json();
            // La URL pública se construye manualmente o se obtiene del response si viene
            globalFotoUrl = `${window.SUPABASE_URL}/storage/v1/object/public/fotos_empleados/${fileName}`;
            preview.src = globalFotoUrl;
        } else {
            // Si hay error, intentamos leer el mensaje
            const errData = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(`Status: ${res.status} - ${errData.message || 'Error desconocido'}`);
        }

    } catch (e) {
        console.error("Error subiendo foto:", e);
        // Alert más detallado para debug
        alert(`Error al subir la foto: ${e.message}\nVerifica conexión y bucket 'fotos_empleados'.`);
    } finally {
        loading.classList.add('hidden');
    }
}
function calcularEdad(fecha) {
    if (!fecha) return;
    const cumple = new Date(fecha);
    const hoy = new Date();
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    document.getElementById('edad').value = edad;
}

function calcularSueldoQuincenal() {
    const mensual = parseFloat(document.getElementById('sueldo_base').value) || 0;
    const quincenal = mensual / 2;
    document.getElementById('sueldo_quincenal').value = `$${quincenal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function prepararEdicion(emp) {
    document.getElementById('editEmpleadoId').value = emp.id;
    document.getElementById('nombre_completo').value = emp.nombre_completo;
    document.getElementById('fecha_nacimiento').value = emp.fecha_nacimiento;
    document.getElementById('curp').value = emp.curp;
    document.getElementById('rfc').value = emp.rfc;
    document.getElementById('nss').value = emp.nss;
    document.getElementById('estado_civil').value = emp.estado_civil;
    document.getElementById('direccion_completa').value = emp.direccion_completa;
    document.getElementById('correo_electronico').value = emp.correo_electronico;
    document.getElementById('telefono').value = emp.telefono;
    document.getElementById('escolaridad').value = emp.escolaridad;
    document.getElementById('sucursal').value = emp.sucursal;
    document.getElementById('puesto').value = emp.puesto;
    document.getElementById('fecha_ingreso').value = emp.fecha_ingreso;
    document.getElementById('tipo_contrato').value = emp.tipo_contrato;
    document.getElementById('banco').value = emp.banco;
    document.getElementById('cuenta_banco').value = emp.cuenta_banco;
    document.getElementById('sueldo_base').value = emp.sueldo_base || 0;
    calcularSueldoQuincenal();

    globalFotoUrl = emp.foto_url;
    document.getElementById('previewFoto').src = emp.foto_url || "https://ui-avatars.com/api/?name=User&background=f1f5f9&color=94a3b8";

    document.getElementById('txtStepTitle').innerText = "Editando Expediente";
    document.getElementById('btnGuardar').innerText = "Guardar Cambios";

    abrirModalNuevoEmpleado();
}

async function guardarNuevoEmpleado() {
    const editId = document.getElementById('editEmpleadoId').value;
    const btn = document.getElementById('btnGuardar');
    const prestaciones = Array.from(document.querySelectorAll('input[name="prestacion"]:checked')).map(c => c.value);

    const data = {
        nombre_completo: document.getElementById('nombre_completo').value.trim().toUpperCase(),
        fecha_nacimiento: document.getElementById('fecha_nacimiento').value || null,
        edad: parseInt(document.getElementById('edad').value) || 0,
        estado_civil: document.getElementById('estado_civil').value,
        curp: document.getElementById('curp').value.trim().toUpperCase(),
        rfc: document.getElementById('rfc').value.trim().toUpperCase(),
        nss: document.getElementById('nss').value.trim(),
        direccion_completa: document.getElementById('direccion_completa').value.trim().toUpperCase(),
        correo_electronico: document.getElementById('correo_electronico').value.trim().toLowerCase(),
        telefono: document.getElementById('telefono').value.trim(),
        escolaridad: document.getElementById('escolaridad').value,
        sucursal: document.getElementById('sucursal').value,
        puesto: document.getElementById('puesto').value.trim().toUpperCase(),
        fecha_ingreso: document.getElementById('fecha_ingreso').value || null,
        tipo_contrato: document.getElementById('tipo_contrato').value,
        banco: document.getElementById('banco').value.trim().toUpperCase(),
        cuenta_banco: document.getElementById('cuenta_banco').value.trim(),
        sueldo_base: parseFloat(document.getElementById('sueldo_base').value) || 0,
        prestaciones: prestaciones,
        foto_url: globalFotoUrl,
        estatus: 'Activo'
    };

    if (!data.nombre_completo) return alert("Nombre obligatorio.");
    btn.disabled = true; btn.innerText = "PROCESANDO...";

    try {
        const url = editId ? `${SUPABASE_URL}/rest/v1/empleados?id=eq.${editId}` : `${SUPABASE_URL}/rest/v1/empleados`;
        const method = editId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert(editId ? "¡Expediente Actualizado!" : "¡Registro Exitoso!");
            cerrarModalNuevoEmpleado();
            cargarEmpleados();
        } else {
            const err = await res.json();
            alert("Error: " + err.message);
        }
    } catch (e) { console.error(e); } finally { btn.disabled = false; btn.innerText = "Finalizar Registro"; }
}