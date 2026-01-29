// Hardcoded Credentials for Reliability
const SBC_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
const SBC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

let currentComisiones = {};
let currentUsers = [];

// Helper to get client consistently
function getClient() {
    if (window.sb) return window.sb;
    if (window.supabase) {
        return window.supabase.createClient(SBC_URL, SBC_KEY);
    }
    return null;
}

// ---------------------------
// 1. COMISIONES
// ---------------------------
async function cargarComisionesUI() {
    const contenedor = document.getElementById('gridComisiones');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="text-gray-400 italic">Actualizando...</p>';

    try {
        const client = getClient();
        if (!client) throw new Error("Librería Supabase no cargada");

        const { data, error } = await client
            .from('sys_config')
            .select('value')
            .eq('key', 'tasas_comision')
            .maybeSingle();

        if (error) {
            // 42P01 is PostgreSQL error for "undefined table"
            if (error.code === '42P01' || error.message.includes('relation "sys_config" does not exist')) {
                throw new Error("Faltan Tablas del Sistema. Ejecuta el SQL.");
            }
            throw error;
        }

        if (data && data.value) {
            currentComisiones = data.value;
            renderComisiones(currentComisiones);
        } else {
            // Fallback default from global config if available
            if (window.CONFIG_NEGOCIO && window.CONFIG_NEGOCIO.tasasComision) {
                renderComisiones(window.CONFIG_NEGOCIO.tasasComision);
            } else {
                throw new Error("No hay configuración predeterminada cargada.");
            }
        }
    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `
            <div class="col-span-full bg-red-50 p-4 rounded-xl border border-red-100">
                <p class="text-red-800 font-bold text-sm mb-1">Error de Sistema:</p>
                <p class="text-red-500 text-xs font-mono break-all">${e.message || JSON.stringify(e)}</p>
                <p class="text-[10px] text-gray-500 mt-2">¿Ejecutaste el script SQL de configuración?</p>
            </div>`;
    }
}

function renderComisiones(tasas) {
    const contenedor = document.getElementById('gridComisiones');
    const methods = Object.keys(tasas);

    contenedor.innerHTML = methods.map(m => {
        const val = (tasas[m] || 0) * 100; // Convert 0.035 -> 3.5
        return `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span class="text-sm font-bold uppercase text-gray-600">${m}</span>
                <div class="flex items-center gap-2">
                    <input type="number" step="0.1" class="input-comision w-20 text-right font-bold p-2 rounded-lg border border-gray-200" 
                        data-method="${m}" value="${val.toFixed(1)}">
                    <span class="text-xs font-black">%</span>
                </div>
            </div>
        `;
    }).join('');
}

window.guardarComisiones = async function () {
    const client = getClient();
    if (!client) return alert("Error de conexión");

    const inputs = document.querySelectorAll('.input-comision');
    const newTasas = {};

    inputs.forEach(inp => {
        const m = inp.dataset.method;
        const v = parseFloat(inp.value) || 0;
        newTasas[m] = v / 100; // Convert 3.5 -> 0.035
    });

    try {
        const { error } = await client
            .from('sys_config')
            .upsert({ key: 'tasas_comision', value: newTasas });

        if (error) throw error;

        // Update local helper
        currentComisiones = newTasas;
        if (window.CONFIG_NEGOCIO) window.CONFIG_NEGOCIO.tasasComision = newTasas;

        alert("Comisiones actualizadas correctamente.");

    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
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
            : '<span class="px-2 py-1 btn btn-xs rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase">READER</span>'
        }
                </div>
                <h4 class="font-bold text-lg leading-tight mb-1">${u.nombre}</h4>
                <p class="text-xs text-gray-400 font-mono mb-4">${u.email}</p>
                
                <div class="bg-gray-50 rounded-lg p-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-300 text-sm">key</span>
                    <span class="text-xs font-mono text-gray-500 tracking-widest">••••••</span>
                    <button onclick="navigator.clipboard.writeText('${u.password}')" class="text-[10px] text-blue-500 font-bold hover:underline ml-auto">COPIAR</button>
                </div>
            </div>

            <button onclick='abrirModalUsuario(${JSON.stringify(u)})' class="mt-6 w-full py-2 rounded-lg border border-gray-200 text-xs font-bold hover:bg-black hover:text-white transition-colors">
                EDITAR ACCESO
            </button>
        </div>
    `).join('');
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
        document.getElementById('userPass').value = user.password;
        document.getElementById('userRol').value = user.rol;
        document.getElementById('userSucursal').value = user.sucursal || 'Ambas';

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

    // Recolectar permisos
    const permisos = {};
    Permisos.MODULOS.forEach(mod => {
        permisos[mod] = {
            ver: document.getElementById(`perm_ver_${mod}`)?.checked || false,
            editar: document.getElementById(`perm_edit_${mod}`)?.checked || false
        };
    });

    const payload = { nombre, email, password, rol, sucursal, permisos };

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

    try {
        const payload = {
            saldo_inicial_norte: saldoNorte,
            saldo_inicial_sur: saldoSur,
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
