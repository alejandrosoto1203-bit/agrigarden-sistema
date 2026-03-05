// ordenes_reparacion.js - Módulo de Registro de Órdenes de Reparación

// =====================================================
// ESTADO
// =====================================================
let clientesCache = [];
let mecanicosCache = [];
let ordenesCache = [];
let ultimoMecanicoIndex = -1; // Para carrusel round-robin

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function inicializarOrdenesReparacion() {
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#inputBuscarCliente') && !e.target.closest('#dropdownClientes')) {
            document.getElementById('dropdownClientes').classList.add('hidden');
        }
    });

    await Promise.all([
        cargarOrdenes(),
        cargarClientesCache(),
        cargarMecanicosCache()
    ]);
}

// =====================================================
// CARGAR ÓRDENES (BITÁCORA)
// =====================================================
async function cargarOrdenes() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?select=*&order=created_at.desc&limit=200`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        ordenesCache = await res.json();
        renderizarOrdenes(ordenesCache);
    } catch (e) {
        console.error('Error cargando órdenes:', e);
    }
}

function renderizarOrdenes(ordenes) {
    const tbody = document.getElementById('bodyOrdenes');

    if (!Array.isArray(ordenes) || ordenes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-12 text-center text-slate-300 italic text-xs">Sin órdenes registradas</td></tr>';
        return;
    }

    tbody.innerHTML = ordenes.map(o => {
        const fecha = new Date(o.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                <td class="px-4 py-3 font-black text-primary text-sm">${o.folio}</td>
                <td class="px-4 py-3 text-xs text-slate-500">${fecha}</td>
                <td class="px-4 py-3">
                    <p class="font-bold text-sm text-slate-800">${o.cliente_nombre}</p>
                    <p class="text-[10px] text-slate-400">${o.cliente_telefono || ''}</p>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="text-[10px] font-black uppercase ${o.tipo_comprobante === 'Factura' ? 'text-blue-600' : 'text-slate-400'}">${o.tipo_comprobante}</span>
                </td>
                <td class="px-4 py-3 text-xs text-slate-600">${o.equipo} — ${o.marca_modelo}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-600">${o.mecanico}</td>
                <td class="px-4 py-3 text-center">${badgeEstatus(o.estatus)}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="verOrden(${o.id})"
                        class="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                        <span class="material-symbols-outlined text-sm">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function badgeEstatus(estatus) {
    const estilos = {
        'PENDIENTE': 'bg-yellow-100 text-yellow-700',
        'COTIZACION_ENVIADA': 'bg-blue-100 text-blue-700',
        'EN_PROCESO': 'bg-orange-100 text-orange-700',
        'TERMINADA': 'bg-green-100 text-green-700',
        'ENTREGADA': 'bg-slate-100 text-slate-500'
    };
    const labels = {
        'PENDIENTE': 'Pendiente',
        'COTIZACION_ENVIADA': 'Cotización',
        'EN_PROCESO': 'En Proceso',
        'TERMINADA': 'Terminada',
        'ENTREGADA': 'Entregada'
    };
    return `<span class="estatus-badge ${estilos[estatus] || 'bg-slate-100 text-slate-500'}">${labels[estatus] || estatus}</span>`;
}

function filtrarOrdenes() {
    const q = document.getElementById('buscadorOrden').value.toLowerCase().trim();
    const estatus = document.getElementById('filtroEstatus').value;

    const filtradas = ordenesCache.filter(o => {
        const coincideTexto = !q ||
            o.folio?.toLowerCase().includes(q) ||
            o.cliente_nombre?.toLowerCase().includes(q) ||
            o.equipo?.toLowerCase().includes(q) ||
            o.mecanico?.toLowerCase().includes(q);
        const coincideEstatus = !estatus || o.estatus === estatus;
        return coincideTexto && coincideEstatus;
    });

    renderizarOrdenes(filtradas);
}

function verOrden(id) {
    const orden = ordenesCache.find(o => o.id === id);
    if (!orden) return;

    // Navegar según estatus
    if (orden.estatus === 'PENDIENTE' || orden.estatus === 'COTIZACION_ENVIADA') {
        window.location.href = `ordenes_pendientes.html?id=${id}`;
    } else {
        window.location.href = `ordenes_terminadas.html?id=${id}`;
    }
}

// =====================================================
// CARGAR CLIENTES
// =====================================================
async function cargarClientesCache() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/clientes?select=id,nombre,telefono,email,rfc&order=nombre.asc&limit=5000`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        clientesCache = await res.json();
    } catch (e) {
        console.error('Error cargando clientes:', e);
    }
}

// =====================================================
// BUSCADOR DE CLIENTES (AUTOCOMPLETE)
// =====================================================
function buscarCliente(query) {
    const dropdown = document.getElementById('dropdownClientes');
    const q = query.toLowerCase().trim();

    if (q.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }

    const resultados = clientesCache
        .filter(c =>
            c.nombre?.toLowerCase().includes(q) ||
            c.telefono?.includes(q) ||
            c.rfc?.toLowerCase().includes(q)
        )
        .slice(0, 10);

    if (resultados.length === 0) {
        dropdown.innerHTML = `
            <div class="py-4 text-center">
                <p class="text-slate-400 text-xs italic">Sin resultados</p>
                <button onclick="seleccionarClienteNuevo()" class="text-primary text-xs font-bold mt-1 hover:underline">+ Registrar como nuevo cliente</button>
            </div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = resultados.map(c => `
        <div class="autocomplete-item" onclick='seleccionarCliente(${JSON.stringify(c).replace(/'/g, "\\'")})'>
            <div class="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0">
                ${(c.nombre || '?').charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-800 truncate">${c.nombre}</p>
                <p class="text-[10px] text-slate-400">${c.telefono || ''} ${c.rfc ? '• ' + c.rfc : ''}</p>
            </div>
        </div>
    `).join('');

    dropdown.classList.remove('hidden');
}

function seleccionarCliente(cliente) {
    document.getElementById('inputBuscarCliente').value = cliente.nombre;
    document.getElementById('clienteIdSeleccionado').value = cliente.id;
    document.getElementById('dropdownClientes').classList.add('hidden');
    document.getElementById('clienteSeleccionadoInfo').textContent = `✓ Cliente seleccionado: ${cliente.nombre}`;
    document.getElementById('clienteSeleccionadoInfo').classList.remove('hidden');

    // Mostrar cuadro de actualización de datos
    const cuadro = document.getElementById('cuadroActualizarDatos');
    cuadro.classList.remove('hidden');
    document.getElementById('inputTelefonoCliente').value = cliente.telefono || '';
    document.getElementById('inputEmailCliente').value = cliente.email || '';
}

function seleccionarClienteNuevo() {
    document.getElementById('clienteIdSeleccionado').value = '';
    document.getElementById('dropdownClientes').classList.add('hidden');
    document.getElementById('clienteSeleccionadoInfo').textContent = '✓ Se creará como nuevo cliente';
    document.getElementById('clienteSeleccionadoInfo').classList.remove('hidden');

    // Mostrar cuadro para datos
    const cuadro = document.getElementById('cuadroActualizarDatos');
    cuadro.classList.remove('hidden');
    document.getElementById('inputTelefonoCliente').value = '';
    document.getElementById('inputEmailCliente').value = '';
}

// =====================================================
// CARGAR MECÁNICOS + CARRUSEL
// =====================================================
async function cargarMecanicosCache() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/mecanicos?activo=eq.true&select=id,nombre&order=nombre.asc`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        mecanicosCache = await res.json();

        // Cargar último mecánico asignado para el carrusel
        await cargarUltimoMecanicoAsignado();
    } catch (e) {
        console.error('Error cargando mecánicos:', e);
    }
}

async function cargarUltimoMecanicoAsignado() {
    try {
        const res = await fetch(
            `${window.SUPABASE_URL}/rest/v1/ordenes_reparacion?select=mecanico&order=created_at.desc&limit=1`,
            { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` } }
        );
        const data = await res.json();
        if (data.length > 0) {
            const idx = mecanicosCache.findIndex(m => m.nombre === data[0].mecanico);
            ultimoMecanicoIndex = idx >= 0 ? idx : -1;
        }
    } catch (e) {
        console.error('Error cargando último mecánico:', e);
    }
}

function renderizarMecanicos() {
    const contenedor = document.getElementById('contenedorMecanicos');

    if (mecanicosCache.length === 0) {
        contenedor.innerHTML = '<p class="text-xs text-red-400 font-bold">No hay mecánicos configurados. Ve a Configuración → Mecánicos.</p>';
        return;
    }

    // Siguiente mecánico en carrusel
    const siguienteIndex = (ultimoMecanicoIndex + 1) % mecanicosCache.length;
    const mecanicoSugerido = mecanicosCache[siguienteIndex]?.nombre;

    contenedor.innerHTML = mecanicosCache.map(m => `
        <button type="button" onclick="seleccionarMecanico('${m.nombre}')"
            class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all mecanico-btn
            ${m.nombre === mecanicoSugerido ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}"
            data-nombre="${m.nombre}">
            ${m.nombre}
        </button>
    `).join('') + `
        <button type="button" onclick="seleccionarMecanico('Tercero')"
            class="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all mecanico-btn bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
            data-nombre="Tercero">
            🔧 Tercero
        </button>
    `;

    // Preseleccionar el sugerido
    document.getElementById('mecanicoSeleccionado').value = mecanicoSugerido || '';
}

function seleccionarMecanico(nombre) {
    document.getElementById('mecanicoSeleccionado').value = nombre;

    // Actualizar estilos
    document.querySelectorAll('.mecanico-btn').forEach(btn => {
        if (btn.dataset.nombre === nombre) {
            btn.className = 'px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all mecanico-btn bg-primary text-black shadow-lg shadow-primary/20 scale-105';
        } else if (btn.dataset.nombre === 'Tercero') {
            btn.className = 'px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all mecanico-btn bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200';
        } else {
            btn.className = 'px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all mecanico-btn bg-slate-100 text-slate-500 hover:bg-slate-200';
        }
    });
}

// =====================================================
// MODAL NUEVA ORDEN
// =====================================================
function abrirModalNuevaOrden() {
    // Reset form
    document.getElementById('inputFolio').value = '';
    document.getElementById('inputBuscarCliente').value = '';
    document.getElementById('clienteIdSeleccionado').value = '';
    document.getElementById('clienteSeleccionadoInfo').classList.add('hidden');
    document.getElementById('cuadroActualizarDatos').classList.add('hidden');
    document.getElementById('inputTelefonoCliente').value = '';
    document.getElementById('inputEmailCliente').value = '';
    document.getElementById('inputComprobante').value = 'Remisión';
    document.getElementById('inputEquipo').value = '';
    document.getElementById('inputMarcaModelo').value = '';
    document.getElementById('inputObservaciones').value = '';
    document.getElementById('mecanicoSeleccionado').value = '';

    renderizarMecanicos();

    document.getElementById('modalNuevaOrden').classList.remove('hidden');
}

function cerrarModalNuevaOrden() {
    document.getElementById('modalNuevaOrden').classList.add('hidden');
}

// =====================================================
// GUARDAR ORDEN
// =====================================================
async function guardarOrden() {
    const folio = document.getElementById('inputFolio').value.trim().toUpperCase();
    const clienteNombre = document.getElementById('inputBuscarCliente').value.trim();
    const clienteId = document.getElementById('clienteIdSeleccionado').value || null;
    const telefono = document.getElementById('inputTelefonoCliente').value.trim();
    const email = document.getElementById('inputEmailCliente').value.trim();
    const comprobante = document.getElementById('inputComprobante').value;
    const equipo = document.getElementById('inputEquipo').value.trim();
    const marcaModelo = document.getElementById('inputMarcaModelo').value.trim();
    const mecanico = document.getElementById('mecanicoSeleccionado').value;
    const observaciones = document.getElementById('inputObservaciones').value.trim();

    // Validaciones
    if (!folio) return alert('El folio es obligatorio.');
    if (!clienteNombre) return alert('Selecciona o escribe un cliente.');
    if (!telefono) return alert('El teléfono del cliente es obligatorio.');
    if (!equipo) return alert('El equipo es obligatorio.');
    if (!marcaModelo) return alert('La marca/modelo es obligatorio.');
    if (!mecanico) return alert('Selecciona quién repara.');
    if (!observaciones) return alert('Las observaciones son obligatorias.');

    const btn = document.getElementById('btnGuardarOrden');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span> Guardando...';

    try {
        const usuario = sessionStorage.getItem('userName') || 'Usuario';

        // 1. Si es cliente existente, actualizar datos de contacto
        if (clienteId) {
            const updateData = { telefono };
            if (email) updateData.email = email;

            await fetch(`${window.SUPABASE_URL}/rest/v1/clientes?id=eq.${clienteId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
        }

        // 2. Crear la orden
        const ordenData = {
            folio,
            cliente_id: clienteId,
            cliente_nombre: clienteNombre.toUpperCase(),
            cliente_telefono: telefono,
            cliente_email: email || null,
            tipo_comprobante: comprobante,
            equipo: equipo.toUpperCase(),
            marca_modelo: marcaModelo.toUpperCase(),
            mecanico,
            observaciones: observaciones.toUpperCase(),
            estatus: 'PENDIENTE',
            usuario_registro: usuario
        };

        const res = await fetch(`${window.SUPABASE_URL}/rest/v1/ordenes_reparacion`, {
            method: 'POST',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(ordenData)
        });

        if (!res.ok) {
            const err = await res.json();
            if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
                throw new Error(`El folio "${folio}" ya existe. Usa un folio diferente.`);
            }
            throw new Error(err.message || 'Error al guardar');
        }

        alert(`✅ Orden ${folio} registrada exitosamente.`);
        cerrarModalNuevaOrden();
        await cargarOrdenes();
        await cargarUltimoMecanicoAsignado(); // Actualizar carrusel

    } catch (e) {
        console.error('Error guardando orden:', e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Guardar Orden de Reparación';
    }
}
