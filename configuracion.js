// Hardcoded Credentials for Reliability
const SBC_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SBC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let currentMetodosPago = [];
let currentUsers = [];
let rrhhEmployeesCache = []; // Global cache for employee data

// Helper to get client consistently
function getClient() {
    if (window.sb) return window.sb;
    if (window.supabase) {
        return window.supabase.createClient(SBC_URL, SBC_KEY);
    }
    return null;
}

// ---------------------------
// 1. MÉTODOS DE PAGO Y COMISIONES
// ---------------------------
async function cargarComisionesUI() {
    const contenedor = document.getElementById('gridComisiones');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="text-gray-400 italic col-span-full">Cargando métodos de pago...</p>';

    try {
        const client = getClient();
        if (!client) throw new Error("Librería Supabase no cargada");

        const { data, error } = await client
            .from('sys_metodos_pago')
            .select('*')
            .order('orden');

        if (error) throw error;

        currentMetodosPago = data || [];
        renderMetodosPago(currentMetodosPago);
    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `
            <div class="col-span-full bg-red-50 p-4 rounded-xl border border-red-100">
                <p class="text-red-800 font-bold text-sm mb-1">Error de Sistema:</p>
                <p class="text-red-500 text-xs font-mono break-all">${e.message}</p>
            </div>`;
    }
}

function renderMetodosPago(metodos) {
    const contenedor = document.getElementById('gridComisiones');

    contenedor.innerHTML = metodos.map(m => {
        const tasaBase = (m.tasa_base || 0) * 100;
        const tasaEfectiva = m.aplica_iva ? (m.tasa_base || 0) * 1.16 * 100 : tasaBase;
        const etiquetaIva = m.aplica_iva
            ? `<span class="text-blue-500 font-bold text-[10px]">+ IVA = ${tasaEfectiva.toFixed(2)}% efectivo</span>`
            : `<span class="text-gray-400 text-[10px]">sin IVA</span>`;

        return `
        <div class="flex items-start justify-between p-4 rounded-xl border border-gray-100 ${m.activo ? 'bg-white' : 'bg-gray-50 opacity-60'}" id="metodo-row-${m.id}">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="size-8 rounded-full ${m.activo ? 'bg-black text-white' : 'bg-gray-300 text-gray-500'} flex items-center justify-center text-xs font-black flex-shrink-0">
                    ${m.nombre.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                    <input type="text"
                        class="input-nombre w-full text-sm font-bold bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-300 focus:bg-white rounded px-1 py-0.5 outline-none transition-all"
                        data-id="${m.id}" data-nombre-original="${m.nombre}" value="${m.nombre}">
                    <p class="text-[10px] font-bold uppercase ${m.activo ? 'text-green-600' : 'text-gray-400'} ml-1">${m.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <div class="text-right">
                    <div class="flex items-center gap-1">
                        <input type="number" step="0.01" min="0" max="100"
                            class="input-comision w-16 text-right font-bold p-1.5 rounded-lg border border-gray-200 text-sm"
                            data-id="${m.id}" data-nombre="${m.nombre}" data-aplica-iva="${m.aplica_iva}"
                            value="${tasaBase.toFixed(2)}"
                            oninput="actualizarEfectiva(this)">
                        <span class="text-xs font-black text-gray-500">%</span>
                    </div>
                    <div id="efectiva-${m.id}" class="mt-0.5 text-right">${etiquetaIva}</div>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="guardarMetodo(${m.id})"
                        class="px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-bold uppercase hover:bg-gray-700 transition-colors">
                        Guardar
                    </button>
                    <button onclick="toggleMetodo(${m.id}, ${m.activo})"
                        class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${m.activo
                            ? 'text-red-500 hover:bg-red-50 border border-red-100'
                            : 'text-green-600 hover:bg-green-50 border border-green-100'}">
                        ${m.activo ? 'Desact.' : 'Activar'}
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Actualiza el label de tasa efectiva en tiempo real mientras escribe
window.actualizarEfectiva = function (input) {
    const id = input.dataset.id;
    const aplicaIva = input.dataset.aplicaIva === 'true';
    const base = parseFloat(input.value) || 0;
    const efectiva = aplicaIva ? base * 1.16 : base;
    const el = document.getElementById(`efectiva-${id}`);
    if (el) {
        el.innerHTML = aplicaIva
            ? `<span class="text-blue-500 font-bold text-[10px]">+ IVA = ${efectiva.toFixed(2)}% efectivo</span>`
            : `<span class="text-gray-400 text-[10px]">sin IVA</span>`;
    }
}

window.guardarMetodo = async function (id) {
    const client = getClient();
    if (!client) return alert("Error de conexión");

    const inputComision = document.querySelector(`.input-comision[data-id="${id}"]`);
    const inputNombre = document.querySelector(`.input-nombre[data-id="${id}"]`);
    if (!inputComision || !inputNombre) return;

    const nombreOriginal = inputNombre.dataset.nombreOriginal;
    const nuevoNombre = inputNombre.value.trim();
    const nuevaBase = (parseFloat(inputComision.value) || 0) / 100;

    if (!nuevoNombre) return alert("El nombre no puede estar vacío.");

    // Buscar el valor anterior
    const anterior = currentMetodosPago.find(m => m.id === id);
    const anteriorBase = anterior?.tasa_base || 0;
    const cambioEnTasa = Math.abs(nuevaBase - anteriorBase) > 0.000001;
    const cambioEnNombre = nuevoNombre !== nombreOriginal;

    let retroactivo = false;
    if (cambioEnTasa && anteriorBase > 0) {
        const respuesta = confirm(
            `¿Deseas aplicar el nuevo porcentaje (${(nuevaBase * 100).toFixed(2)}%) también a las transacciones ANTERIORES de "${nombreOriginal}"?\n\n` +
            `• Aceptar = Actualizar todo el historial\n` +
            `• Cancelar = Solo ventas futuras`
        );
        retroactivo = respuesta;
    }

    // Advertencia si cambia el nombre (afecta historial de transacciones)
    if (cambioEnNombre) {
        const ok = confirm(
            `¿Renombrar "${nombreOriginal}" a "${nuevoNombre}"?\n\n` +
            `Las transacciones existentes con el nombre antiguo quedarán registradas con el nombre anterior en el historial.`
        );
        if (!ok) return;
    }

    try {
        const payload = { tasa_base: nuevaBase };
        if (cambioEnNombre) payload.nombre = nuevoNombre;

        const { error } = await client
            .from('sys_metodos_pago')
            .update(payload)
            .eq('id', id);
        if (error) throw error;

        // Actualizar cache local y CONFIG_NEGOCIO
        if (anterior) {
            if (cambioEnNombre) {
                delete window.CONFIG_NEGOCIO?.tasasComision?.[nombreOriginal];
                anterior.nombre = nuevoNombre;
            }
            anterior.tasa_base = nuevaBase;
            if (window.CONFIG_NEGOCIO) {
                const aplicaIva = anterior?.aplica_iva;
                window.CONFIG_NEGOCIO.tasasComision[nuevoNombre] = aplicaIva ? nuevaBase * 1.16 : nuevaBase;
            }
        }

        // Si retroactivo, recalcular comisiones en transacciones anteriores
        if (retroactivo) {
            await aplicarComisionRetroactiva(client, nombreOriginal, anterior?.aplica_iva, nuevaBase);
        }

        cargarComisionesUI();
        const msgs = [];
        if (cambioEnNombre) msgs.push(`Nombre actualizado a "${nuevoNombre}".`);
        msgs.push(`Comisión guardada.`);
        if (retroactivo) msgs.push(`Historial recalculado.`);
        alert(msgs.join('\n'));
    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
}

async function aplicarComisionRetroactiva(client, nombreMetodo, aplicaIva, nuevaBase) {
    const tasaEfectiva = aplicaIva ? nuevaBase * 1.16 : nuevaBase;

    // Traer transacciones de ese método de pago
    const { data: txns, error } = await client
        .from('transacciones')
        .select('id, monto')
        .eq('metodo_pago', nombreMetodo);

    if (error || !txns || txns.length === 0) return;

    // Actualizar en lotes de 50
    const lotes = [];
    for (let i = 0; i < txns.length; i += 50) lotes.push(txns.slice(i, i + 50));

    for (const lote of lotes) {
        const updates = lote.map(t => ({
            id: t.id,
            comision_bancaria: t.monto * tasaEfectiva,
            monto_neto: t.monto - (t.monto * tasaEfectiva)
        }));
        await client.from('transacciones').upsert(updates);
    }
}

window.toggleMetodo = async function (id, estadoActual) {
    const accion = estadoActual ? 'desactivar' : 'activar';
    const metodo = currentMetodosPago.find(m => m.id === id);
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el método "${metodo?.nombre}"?`)) return;

    try {
        const client = getClient();
        const { error } = await client
            .from('sys_metodos_pago')
            .update({ activo: !estadoActual })
            .eq('id', id);
        if (error) throw error;
        cargarComisionesUI();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

window.mostrarFormNuevoMetodo = function () {
    document.getElementById('formNuevoMetodo').classList.remove('hidden');
    document.getElementById('inputNuevoMetodoNombre').focus();
}

window.cancelarNuevoMetodo = function () {
    document.getElementById('formNuevoMetodo').classList.add('hidden');
    document.getElementById('inputNuevoMetodoNombre').value = '';
    document.getElementById('inputNuevoMetodoPct').value = '0';
    document.getElementById('inputNuevoMetodoIva').checked = false;
}

window.guardarNuevoMetodo = async function () {
    const client = getClient();
    if (!client) return alert("Error de conexión");

    const nombre = document.getElementById('inputNuevoMetodoNombre').value.trim();
    const pct = parseFloat(document.getElementById('inputNuevoMetodoPct').value) || 0;
    const aplicaIva = document.getElementById('inputNuevoMetodoIva').checked;

    if (!nombre) return alert("Escribe el nombre del método de pago.");

    const maxOrden = currentMetodosPago.reduce((max, m) => Math.max(max, m.orden || 0), 0);

    try {
        const { error } = await client
            .from('sys_metodos_pago')
            .insert([{ nombre, tasa_base: pct / 100, aplica_iva: aplicaIva, activo: true, orden: maxOrden + 1 }]);
        if (error) throw error;

        cancelarNuevoMetodo();
        cargarComisionesUI();
        alert(`Método "${nombre}" agregado correctamente.`);
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    }
}


// ---------------------------
// 2. METAS
// ---------------------------
async function cargarMetasUI() {
    const list = document.getElementById('listaMetas');
    if (!list) return;

    try {
        const client = getClient();
        if (!client) return;

        const { data } = await client
            .from('sys_metas_ingresos')
            .select('*')
            .order('anio', { ascending: false })
            .order('mes', { ascending: false })
            .limit(5);

        if (data) {
            list.innerHTML = data.map(m => `
                <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <div>
                        <span class="text-xs font-bold text-gray-500 block">${m.mes}/${m.anio}</span>
                        <span class="text-[9px] font-bold uppercase text-gray-400 tracking-wider">${m.sucursal || 'Norte'}</span>
                    </div>
                    <span class="text-xs font-black text-blue-600">$${parseFloat(m.monto_meta).toLocaleString()}</span>
                </div>
            `).join('');

            // Set input to current
            const now = new Date();
            const yearVal = parseInt(document.getElementById('metaAnio').value) || now.getFullYear();
            const mesVal = parseInt(document.getElementById('metaMes').value) || (now.getMonth() + 1);

            // Fetch current selected values if they exist in data (might not if pagination limits)
            // Better strategy: Listen to change events. But for initial load:
            cargarMetasInputs();
        }
    } catch (e) { console.error(e); }
}

async function cargarMetasInputs() {
    const client = getClient();
    const anio = document.getElementById('metaAnio').value;
    const mes = document.getElementById('metaMes').value;

    // Reset
    document.getElementById('metaMontoNorte').value = '';
    document.getElementById('metaMontoSur').value = '';

    const { data } = await client.from('sys_metas_ingresos')
        .select('*')
        .eq('anio', anio)
        .eq('mes', mes);

    if (data) {
        const norte = data.find(d => d.sucursal === 'Norte');
        const sur = data.find(d => d.sucursal === 'Sur');
        if (norte) document.getElementById('metaMontoNorte').value = norte.monto_meta;
        if (sur) document.getElementById('metaMontoSur').value = sur.monto_meta;
    }
}

// Add listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('metaAnio').addEventListener('change', cargarMetasInputs);
    document.getElementById('metaMes').addEventListener('change', cargarMetasInputs);

    // User - Employee Link logic
    const selectEmpId = document.getElementById('userEmpleadoId');
    if (selectEmpId) {
        selectEmpId.addEventListener('change', () => {
            console.log("Empleado selection changed");
            handleEmpleadoSelection();
        });
    }
});

window.guardarMeta = async function () {
    const client = getClient();
    if (!client) return alert("Error de conexión");

    const anio = parseInt(document.getElementById('metaAnio').value);
    const mes = parseInt(document.getElementById('metaMes').value);
    const montoNorte = parseFloat(document.getElementById('metaMontoNorte').value) || 0;
    const montoSur = parseFloat(document.getElementById('metaMontoSur').value) || 0;

    try {
        const updates = [
            { anio, mes, sucursal: 'Norte', monto_meta: montoNorte },
            { anio, mes, sucursal: 'Sur', monto_meta: montoSur }
        ];

        const { error } = await client
            .from('sys_metas_ingresos')
            .upsert(updates, { onConflict: 'anio, mes, sucursal' });

        if (error) throw error;

        // Update Global Config Live if current month
        const now = new Date();
        if (anio === now.getFullYear() && mes === (now.getMonth() + 1)) {
            if (!window.CONFIG_NEGOCIO) window.CONFIG_NEGOCIO = {};
            if (!window.CONFIG_NEGOCIO.metas) window.CONFIG_NEGOCIO.metas = {};
            window.CONFIG_NEGOCIO.metas['Norte'] = montoNorte;
            window.CONFIG_NEGOCIO.metas['Sur'] = montoSur;
            // Legacy format backup
            window.CONFIG_NEGOCIO.metaMensual = montoNorte + montoSur;
        }

        alert("Metas actualizadas correctamente.");
        cargarMetasUI();
        cargarMetasInputs();

    } catch (e) {
        console.error(e);
        alert("Error al guardar metas: " + e.message);
    }
}


// ---------------------------
// 3. USUARIOS
// ---------------------------
async function cargarUsuariosUI() {
    const grid = document.getElementById('gridUsuarios');
    grid.innerHTML = '<p class="text-gray-400 italic">Cargando...</p>';

    try {
        const client = getClient();
        if (!client) throw new Error("Supabase no disponible");

        const { data, error } = await client
            .from('sys_usuarios')
            .select('*')
            .order('nombre');

        if (error) throw error;
        currentUsers = data || [];
        renderUsuarios(currentUsers);
        await cargarEmpleadosDropdown(); // Awaited for robustness
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p class="text-red-500">Error al cargar usuarios.</p>';
    }
}

function renderUsuarios(list) {
    const grid = document.getElementById('gridUsuarios');
    if (list.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center py-10 text-gray-300">No hay usuarios registrados</p>';
        return;
    }

    grid.innerHTML = list.map(u => `
        <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <div class="size-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                        ${u.nombre.charAt(0)}
                    </div>
                    ${u.rol === 'admin'
            ? '<span class="px-2 py-1 btn btn-xs rounded-md bg-black text-white text-[10px] font-bold uppercase">ADMIN</span>'
            : u.rol === 'empleado'
                ? '<span class="px-2 py-1 btn btn-xs rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase">EMPLEADO</span>'
                : '<span class="px-2 py-1 btn btn-xs rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">READER</span>'
        }
                </div>
                <h4 class="font-bold text-lg leading-tight mb-1">${u.nombre}</h4>
                <p class="text-xs text-gray-400 font-mono mb-2">${u.email}</p>
                
                ${u.empleado_id ? `
                    <div class="flex items-center gap-1.5 mb-4 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md w-fit">
                        <span class="material-symbols-outlined text-[12px]">verified_user</span> VINCULADO A RRHH
                    </div>
                ` : ''}

                <div class="bg-gray-50 rounded-lg p-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-300 text-sm">key</span>
                    <span class="text-xs font-mono text-gray-500 tracking-widest">••••••</span>
                </div>
            </div>

            <button onclick='abrirModalUsuario(${JSON.stringify(u)})' class="mt-6 w-full py-2 rounded-lg border border-gray-200 text-xs font-bold hover:bg-black hover:text-white transition-colors">
                EDITAR ACCESO
            </button>
        </div>
    `).join('');
}

async function cargarEmpleadosDropdown() {
    const select = document.getElementById('userEmpleadoId');
    if (!select) return;

    try {
        const client = getClient();
        const { data, error } = await client
            .from('empleados')
            .select('id, nombre_completo, correo_electronico')
            .eq('estatus', 'Activo')
            .order('nombre_completo');

        if (error) throw error;

        rrhhEmployeesCache = data || []; // Store in global cache
        console.log("RRHH Cache Loaded:", rrhhEmployeesCache.length, "employees");
        select.innerHTML = '<option value="">Sin vincular</option>' +
            data.map(e => `<option value="${e.id}">${e.nombre_completo}</option>`).join('');

    } catch (e) {
        console.error("Error cargando empleados:", e);
    }
}

function handleEmpleadoSelection() {
    console.log("Handling Empleado Selection...");
    const select = document.getElementById('userEmpleadoId');
    const empId = select.value;
    const inputNombre = document.getElementById('userNombre');
    const inputEmail = document.getElementById('userEmail');

    console.log("Selected EmpID:", empId);

    if (empId) {
        // Use loose equality (==) for robust ID matching (string vs numeric)
        const employee = rrhhEmployeesCache.find(e => String(e.id) === String(empId));
        console.log("Found employee in cache:", employee);

        if (employee) {
            inputNombre.value = employee.nombre_completo;
            inputEmail.value = employee.correo_electronico || '';
            inputNombre.readOnly = true;
            inputEmail.readOnly = true;
            inputNombre.classList.add('bg-gray-100', 'cursor-not-allowed', 'border-gray-200');
            inputEmail.classList.add('bg-gray-100', 'cursor-not-allowed', 'border-gray-200');
        } else {
            console.warn("Employee not found in cache for ID:", empId);
        }
    } else {
        console.log("No employee selected, resetting fields");
        // Only clear if it was read-only (meaning it was auto-filled)
        if (inputNombre.readOnly) {
            inputNombre.value = '';
            inputEmail.value = '';
        }
        inputNombre.readOnly = false;
        inputEmail.readOnly = false;
        inputNombre.classList.remove('bg-gray-100', 'cursor-not-allowed', 'border-gray-200');
        inputEmail.classList.remove('bg-gray-100', 'cursor-not-allowed', 'border-gray-200');
    }
}

window.abrirModalUsuario = function (user = null) {
    const modal = document.getElementById('modalUsuario');
    const title = document.getElementById('modalTitle');

    // Titulo y reset Form
    title.innerText = user ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = user?.id || '';
    document.getElementById('btnEliminarUser').classList.toggle('hidden', !user);

    if (user) {
        document.getElementById('userNombre').value = user.nombre;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userPass').value = '';
        document.getElementById('userPass').placeholder = '(sin cambios)';
        document.getElementById('userRol').value = user.rol;
        document.getElementById('userSucursal').value = user.sucursal || 'Ambas';
        document.getElementById('userEmpleadoId').value = user.empleado_id || '';

        // Llenar checkboxes de permisos
        const permisos = user.permisos || {};
        Permisos.MODULOS.forEach(mod => {
            const checkVer = document.getElementById(`perm_ver_${mod}`);
            const checkEdit = document.getElementById(`perm_edit_${mod}`);
            if (checkVer) checkVer.checked = !!permisos[mod]?.ver;
            if (checkEdit) checkEdit.checked = !!permisos[mod]?.editar;
        });
    } else {
        // Default admin permissions for new user if needed, or empty
        Permisos.MODULOS.forEach(mod => {
            const cv = document.getElementById(`perm_ver_${mod}`);
            const ce = document.getElementById(`perm_edit_${mod}`);
            if (cv) cv.checked = false;
            if (ce) ce.checked = false;
        });
    }

    // Trigger read-only check on open
    handleEmpleadoSelection();

    modal.classList.remove('hidden');
    setTimeout(() => modal.querySelector('.bg-white').classList.remove('translate-y-full'), 10);
}

window.guardarUsuario = async function (e) {
    e.preventDefault();
    const client = getClient();
    const id = document.getElementById('userId').value;
    const nombre = document.getElementById('userNombre').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPass').value;
    const rol = document.getElementById('userRol').value;
    const sucursal = document.getElementById('userSucursal').value;
    const empleado_id = document.getElementById('userEmpleadoId').value || null;

    // Recolectar permisos
    const permisos = {};
    Permisos.MODULOS.forEach(mod => {
        permisos[mod] = {
            ver: document.getElementById(`perm_ver_${mod}`)?.checked || false,
            editar: document.getElementById(`perm_edit_${mod}`)?.checked || false
        };
    });

    const payload = { nombre, email, rol, sucursal, permisos, empleado_id };

    // Si hay contraseña nueva, hashearla antes de guardar
    if (password) {
        const { data: hashedPass, error: hashError } = await client
            .rpc('hash_password', { p_password: password });
        if (hashError) {
            alert("Error al procesar contraseña: " + hashError.message);
            return;
        }
        payload.password = hashedPass;
    }

    try {
        let error;
        if (id) {
            const res = await client.from('sys_usuarios').update(payload).eq('id', id);
            error = res.error;
        } else {
            const res = await client.from('sys_usuarios').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        cerrarModalUsuario();
        cargarUsuariosUI();
        alert("Usuario guardado.");

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
}

window.eliminarUsuario = async function () {
    const client = getClient();
    const id = document.getElementById('userId').value;
    const currentId = sessionStorage.getItem('userId');

    if (id == currentId) {
        return alert("No puedes eliminar tu propio usuario mientras estás conectado.");
    }

    if (!confirm("¿Eliminar este usuario permanentemente?")) return;

    try {
        const { error } = await client.from('sys_usuarios').delete().eq('id', id);
        if (error) throw error;

        cerrarModalUsuario();
        cargarUsuariosUI();
        alert("Usuario eliminado.");

    } catch (e) {
        alert("Error: " + e.message);
    }
}


// ---------------------------
// 4. CONTROL EFECTIVO
// ---------------------------
async function cargarConfigEfectivoUI() {
    try {
        const client = getClient();
        if (!client) return;

        const { data, error } = await client
            .from('sys_config')
            .select('value')
            .eq('key', 'cash_control_config')
            .maybeSingle();

        if (error) throw error;

        if (data && data.value) {
            document.getElementById('saldoInicialNorte').value = data.value.saldo_inicial_norte || 0;
            document.getElementById('saldoInicialSur').value = data.value.saldo_inicial_sur || 0;
            if (document.getElementById('fechaInicioCaja')) {
                document.getElementById('fechaInicioCaja').value = data.value.fecha_inicio || '';
            }

            // Global Update
            if (window.CONFIG_NEGOCIO) {
                window.CONFIG_NEGOCIO.saldoInicialNorte = data.value.saldo_inicial_norte;
                window.CONFIG_NEGOCIO.saldoInicialSur = data.value.saldo_inicial_sur;
            }
        }
    } catch (e) { console.error("Error loading cash config:", e); }
}

window.guardarConfigEfectivo = async function () {
    const client = getClient();
    const saldoNorte = parseFloat(document.getElementById('saldoInicialNorte').value) || 0;
    const saldoSur = parseFloat(document.getElementById('saldoInicialSur').value) || 0;
    const fechaInicio = document.getElementById('fechaInicioCaja')?.value || null;

    try {
        const payload = {
            saldo_inicial_norte: saldoNorte,
            saldo_inicial_sur: saldoSur,
            fecha_inicio: fechaInicio || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await client
            .from('sys_config')
            .upsert({ key: 'cash_control_config', value: payload });

        if (error) throw error;

        if (window.CONFIG_NEGOCIO) {
            window.CONFIG_NEGOCIO.saldoInicialNorte = saldoNorte;
            window.CONFIG_NEGOCIO.saldoInicialSur = saldoSur;
        }
        alert("Saldos iniciales actualizados.");
    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
    }
}

// ---------------------------
// 5. MECÁNICOS DE TALLER
// ---------------------------
async function cargarMecanicosUI() {
    const contenedor = document.getElementById('listaMecanicos');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="text-gray-400 italic">Cargando...</p>';

    try {
        const client = getClient();
        if (!client) throw new Error("Supabase no disponible");

        const { data, error } = await client
            .from('mecanicos')
            .select('*')
            .order('nombre');

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p class="text-gray-400 italic text-sm text-center py-6">No hay mecánicos registrados. Agrega uno para comenzar.</p>';
            return;
        }

        contenedor.innerHTML = data.map(m => `
            <div class="flex items-center justify-between p-4 rounded-xl border border-gray-100 ${m.activo ? 'bg-white' : 'bg-gray-50 opacity-60'}">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full ${m.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'} flex items-center justify-center font-bold text-lg">
                        ${m.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${m.nombre}</p>
                        <p class="text-[10px] font-bold uppercase ${m.activo ? 'text-green-600' : 'text-gray-400'}">${m.activo ? 'Activo' : 'Inactivo'}</p>
                    </div>
                </div>
                <button onclick="toggleMecanico(${m.id}, ${m.activo})"
                    class="px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${m.activo
                ? 'text-red-500 hover:bg-red-50 border border-red-100'
                : 'text-green-600 hover:bg-green-50 border border-green-100'}">
                    ${m.activo ? 'Desactivar' : 'Activar'}
                </button>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
    }
}

window.abrirFormMecanico = function () {
    document.getElementById('formNuevoMecanico').classList.remove('hidden');
    document.getElementById('inputNombreMecanico').focus();
}

window.cancelarFormMecanico = function () {
    document.getElementById('formNuevoMecanico').classList.add('hidden');
    document.getElementById('inputNombreMecanico').value = '';
}

window.guardarMecanico = async function () {
    const nombre = document.getElementById('inputNombreMecanico').value.trim();
    if (!nombre) return alert('Escribe el nombre del mecánico.');

    try {
        const client = getClient();
        const { error } = await client
            .from('mecanicos')
            .insert([{ nombre, activo: true }]);

        if (error) throw error;

        cancelarFormMecanico();
        cargarMecanicosUI();
        alert('Mecánico agregado.');
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}

window.toggleMecanico = async function (id, estadoActual) {
    const accion = estadoActual ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este mecánico?`)) return;

    try {
        const client = getClient();
        const { error } = await client
            .from('mecanicos')
            .update({ activo: !estadoActual })
            .eq('id', id);

        if (error) throw error;
        cargarMecanicosUI();
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}

// ---------------------------
// 6. VENDEDORES POS
// ---------------------------
async function cargarVendedoresUI() {
    const contenedor = document.getElementById('listaVendedores');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="text-gray-400 italic">Cargando...</p>';

    try {
        const client = getClient();
        if (!client) throw new Error("Supabase no disponible");

        const { data, error } = await client
            .from('sys_vendedores')
            .select('*')
            .order('nombre');

        if (error) {
            if (error.code === '42P01' || error.message.includes('relation "sys_vendedores" does not exist')) {
                contenedor.innerHTML = '<p class="text-red-500 text-sm font-bold">Falta ejecutar el script SQL para crear la tabla sys_vendedores en Supabase.</p>';
                return;
            }
            throw error;
        }

        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p class="text-gray-400 italic text-sm text-center py-6">No hay vendedores registrados. Agrega uno para comenzar.</p>';
            return;
        }

        contenedor.innerHTML = data.map(v => `
            <div class="flex items-center justify-between p-4 rounded-xl border border-gray-100 ${v.activo ? 'bg-white' : 'bg-gray-50 opacity-60'}">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full ${v.activo ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'} flex items-center justify-center font-bold text-lg">
                        ${v.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${v.nombre}</p>
                        <p class="text-[10px] font-bold uppercase ${v.activo ? 'text-green-600' : 'text-gray-400'}">${v.activo ? 'Activo' : 'Inactivo'}</p>
                    </div>
                </div>
                <button onclick="toggleVendedor(${v.id}, ${v.activo})"
                    class="px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${v.activo
                ? 'text-red-500 hover:bg-red-50 border border-red-100'
                : 'text-green-600 hover:bg-green-50 border border-green-100'}">
                    ${v.activo ? 'Desactivar' : 'Activar'}
                </button>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
    }
}

window.abrirFormVendedor = function () {
    document.getElementById('formNuevoVendedor').classList.remove('hidden');
    document.getElementById('inputNombreVendedor').focus();
}

window.cancelarFormVendedor = function () {
    document.getElementById('formNuevoVendedor').classList.add('hidden');
    document.getElementById('inputNombreVendedor').value = '';
}

window.guardarVendedor = async function () {
    const nombre = document.getElementById('inputNombreVendedor').value.trim();
    if (!nombre) return alert('Escribe el nombre del vendedor.');

    try {
        const client = getClient();
        const { error } = await client
            .from('sys_vendedores')
            .insert([{ nombre, activo: true }]);

        if (error) throw error;

        cancelarFormVendedor();
        cargarVendedoresUI();
        alert('Vendedor agregado.');
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}

window.toggleVendedor = async function (id, estadoActual) {
    const accion = estadoActual ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este vendedor?`)) return;

    try {
        const client = getClient();
        const { error } = await client
            .from('sys_vendedores')
            .update({ activo: !estadoActual })
            .eq('id', id);

        if (error) throw error;
        cargarVendedoresUI();
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
}


// ---------------------------
// 7. CUENTAS BANCARIAS
// ---------------------------
async function cargarConfigCuentasUI() {
    try {
        const client = getClient();
        if (!client) return;

        const { data, error } = await client
            .from('sys_config')
            .select('value')
            .eq('key', 'banking_accounts_config')
            .maybeSingle();

        if (error) throw error;
        const v = data?.value || {};

        // Cuentas regulares
        document.getElementById('cfg_bbva_norte_saldo').value    = v.bbva_norte?.saldo_inicial ?? '';
        document.getElementById('cfg_hey_banco_sur_saldo').value = v.hey_banco_sur?.saldo_inicial ?? '';
        document.getElementById('cfg_bbva_sur_saldo').value      = v.bbva_sur?.saldo_inicial ?? '';
        document.getElementById('cfg_mp_nofiscal_saldo').value   = v.mp_nofiscal_norte?.saldo_inicial ?? '';
        document.getElementById('cfg_mp_fiscal_saldo').value     = v.mp_fiscal_norte?.saldo_inicial ?? '';

        // TDC BBVA
        document.getElementById('cfg_tdc_bbva_limite').value       = v.tdc_bbva?.limite ?? '';
        document.getElementById('cfg_tdc_bbva_saldo_inicio').value = v.tdc_bbva?.saldo_inicio ?? '';
        document.getElementById('cfg_tdc_bbva_dia_corte').value    = v.tdc_bbva?.dia_corte ?? '';
        document.getElementById('cfg_tdc_bbva_dias_pago').value    = v.tdc_bbva?.dias_pago ?? '';

        // TDC Hey Banco
        document.getElementById('cfg_tdc_hey_limite').value       = v.tdc_hey?.limite ?? '';
        document.getElementById('cfg_tdc_hey_saldo_inicio').value = v.tdc_hey?.saldo_inicio ?? '';
        document.getElementById('cfg_tdc_hey_dia_corte').value    = v.tdc_hey?.dia_corte ?? '';
        document.getElementById('cfg_tdc_hey_dias_pago').value    = v.tdc_hey?.dias_pago ?? '';

    } catch (e) { console.error('Error cargando config cuentas:', e); }
}

window.guardarConfigCuentas = async function () {
    const client = getClient();
    if (!client) return alert('Error de conexión');

    const n = (id) => parseFloat(document.getElementById(id).value) || 0;
    const i = (id) => parseInt(document.getElementById(id).value) || 0;

    const payload = {
        fecha_inicio: '2026-04-01',
        bbva_norte:        { saldo_inicial: n('cfg_bbva_norte_saldo') },
        hey_banco_sur:     { saldo_inicial: n('cfg_hey_banco_sur_saldo') },
        bbva_sur:          { saldo_inicial: n('cfg_bbva_sur_saldo') },
        mp_nofiscal_norte: { saldo_inicial: n('cfg_mp_nofiscal_saldo') },
        mp_fiscal_norte:   { saldo_inicial: n('cfg_mp_fiscal_saldo') },
        tdc_bbva: {
            limite:       n('cfg_tdc_bbva_limite'),
            saldo_inicio: n('cfg_tdc_bbva_saldo_inicio'),
            dia_corte:    i('cfg_tdc_bbva_dia_corte'),
            dias_pago:    i('cfg_tdc_bbva_dias_pago')
        },
        tdc_hey: {
            limite:       n('cfg_tdc_hey_limite'),
            saldo_inicio: n('cfg_tdc_hey_saldo_inicio'),
            dia_corte:    i('cfg_tdc_hey_dia_corte'),
            dias_pago:    i('cfg_tdc_hey_dias_pago')
        },
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await client
            .from('sys_config')
            .upsert({ key: 'banking_accounts_config', value: payload });

        if (error) throw error;
        alert('Configuración de cuentas guardada correctamente.');
    } catch (e) {
        console.error(e);
        alert('Error al guardar: ' + e.message);
    }
}
