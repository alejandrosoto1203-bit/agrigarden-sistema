// Helper to get client consistently
function getClient() {
    // 1. Prioridad: Cliente global inicializado en api.js
    if (window.sb) return window.sb;

    // 2. Fallback: Inicializar con variables de entorno (config.js)
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
        return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }

    console.warn("⚠️ Supabase Client not ready. window.sb is missing.");
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

        // También cargamos empleados para el select por si se necesita crear/editar
        cargarEmpleadosSelect();

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

    const roleNames = {
        'admin': 'Administrador',
        'ventas_norte': 'Ventas Norte',
        'ventas_sur': 'Ventas Sur',
        'jefe_taller': 'Jefe Taller',
        'mecanico': 'Mecánico',
        'vendedor_ruta': 'Vendedor Ruta',
        'repartidor': 'Repartidor',
        'viewer': 'Solo Lectura'
    };

    grid.innerHTML = list.map(u => `
        <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <div class="size-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                        ${u.nombre.charAt(0)}
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="px-2 py-1 rounded-md bg-black text-white text-[9px] font-bold uppercase">${roleNames[u.rol] || u.rol}</span>
                        <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[8px] font-bold uppercase tracking-wider">${u.sucursal || 'Ambas'}</span>
                    </div>
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
                GESTIONAR PERMISOS
            </button>
        </div>
    `).join('');
}

window.guardarUsuario = async function (e) {
    e.preventDefault();
    const client = getClient();
    const id = document.getElementById('userId').value;
    console.log("💾 Guardando usuario. ID detectado:", id || "NUEVO");
    const nombre = document.getElementById('userNombre').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPass').value;
    const rol = document.getElementById('userRol').value;
    const sucursal = document.getElementById('userSucursal').value;

    // Recolectar permisos de la matriz
    const permisos = {};
    document.querySelectorAll('.chk-permiso-ver').forEach(chk => {
        const mod = chk.dataset.mod;
        if (!permisos[mod]) permisos[mod] = { ver: false, editar: false };
        permisos[mod].ver = chk.checked;
    });
    document.querySelectorAll('.chk-permiso-editar').forEach(chk => {
        const mod = chk.dataset.mod;
        if (!permisos[mod]) permisos[mod] = { ver: false, editar: false };
        permisos[mod].editar = chk.checked;
    });

    const empleado_id = document.getElementById('userEmpleado').value || null;

    const payload = { nombre, email, password, rol, sucursal, permisos, empleado_id };

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

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

        // Si es el usuario actual, actualizar sessionStorage
        if (id == sessionStorage.getItem('userId')) {
            sessionStorage.setItem('userPermisos', JSON.stringify(permisos));
            sessionStorage.setItem('userSucursal', sucursal);
            sessionStorage.setItem('userRole', rol);
            sessionStorage.setItem('userName', nombre);
        }

        cerrarModalUsuario();
        cargarUsuariosUI();
        alert("Usuario guardado correctamente.");

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
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

// Vinculación con Empleados
let empleadosRRHH = [];
async function cargarEmpleadosSelect() {
    const selector = document.getElementById('userEmpleado');
    if (!selector) return;

    try {
        const client = getClient();
        if (!client) return;

        const { data, error } = await client
            .from('empleados')
            .select('id, nombre_completo, correo_electronico, sucursal')
            .order('nombre_completo');

        if (error) throw error;
        empleadosRRHH = data || [];

        selector.innerHTML = '<option value="">-- Seleccionar Empleado (Opcional) --</option>' +
            empleadosRRHH.map(e => `<option value="${e.id}">${e.nombre_completo}</option>`).join('');

    } catch (e) {
        console.error("Error cargando empleados para select:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('userEmpleado');
    if (selector) {
        selector.addEventListener('change', (e) => {
            const empId = e.target.value;
            if (!empId) return;

            const emp = empleadosRRHH.find(x => x.id == empId);
            if (emp) {
                document.getElementById('userNombre').value = emp.nombre_completo;
                document.getElementById('userEmail').value = emp.correo_electronico || '';

                // Mapeo simple de sucursal
                const sucVal = emp.sucursal === 'NORTE' ? 'Norte' : (emp.sucursal === 'SUR' ? 'Sur' : 'Ambas');
                document.getElementById('userSucursal').value = sucVal;

                alert(`Datos cargados de: ${emp.nombre_completo}`);
            }
        });
    }
});
