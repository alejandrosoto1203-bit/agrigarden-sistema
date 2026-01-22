// rrhh_organigrama.js - Motor Jerárquico Avanzado
let empleadosRaw = [];
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;
let draggedNodeId = null;

// Inicialización
async function inicializarOrganigrama() {
    await cargarDatos();
    setupPanZoom();
}

async function cargarDatos() {
    try {
        console.log("Iniciando carga de datos...");

        // Credential Fallback (Safety Check)
        if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL) {
            console.warn("Variables globales no definidas. Usando fallback.");
            window.SUPABASE_URL = 'https://gajhfqfuvzotppnmzbuc.supabase.co';
            window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';
        }

        // Ensure constants are available locally if needed or just use window props
        const apiUrl = window.SUPABASE_URL || SUPABASE_URL;
        const apiKey = window.SUPABASE_KEY || SUPABASE_KEY;

        // Use fetch directly as sbClientTareas is not defined in this scope
        const response = await fetch(`${apiUrl}/rest/v1/empleados?select=*`, {
            method: 'GET',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        empleadosRaw = await response.json();
        console.log("Datos cargados:", empleadosRaw.length, "empleados");

        // Find root (null reporta_a)
        const roots = empleadosRaw.filter(e => !e.reporta_a);
        if (roots.length === 0 && empleadosRaw.length > 0) {
            console.warn("No clear root found, using first employee");
            roots.push(empleadosRaw[0]);
        }

        const root = roots[0];
        const dataEstructurada = construirJerarquia(root);
        renderizarArbol(dataEstructurada);
    } catch (e) {
        console.error("Error organigrama:", e);
        // alert("Error cargando organigrama: " + e.message); // Optional alert
    }
}

function construirJerarquia(rootNode) {
    if (!rootNode) return null;
    const node = { ...rootNode, children: [] };
    const children = empleadosRaw.filter(e => e.reporta_a === rootNode.id);
    children.forEach(child => {
        node.children.push(construirJerarquia(child));
    });
    return node;
}

// Rendering
let lines = [];
let nodePositions = JSON.parse(localStorage.getItem('orgPositions')) || {};

// Rendering
function renderizarArbol(root) {
    const container = document.getElementById('tree-root');
    container.innerHTML = '';

    // Clear lines
    lines.forEach(l => { try { l.remove(); } catch (e) { } });
    lines = [];

    if (!root) {
        container.innerHTML = '<p class="text-slate-400 font-bold p-10">Cargando...</p>';
        return;
    }

    // Calculate Initial Positions if not stored (Generic Tree Layout fallback)
    const positions = calculateTreeLayout(root);

    // Flatten tree to render simple divs
    const flatNodes = flattenTree(root);

    flatNodes.forEach(node => {
        const div = document.createElement('div');
        div.id = `node-${node.id}`;
        div.className = 'absolute bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-emerald-500 transition-shadow cursor-move w-64 z-10 select-none';
        div.style.userSelect = 'none'; // Ensure no text selection

        // Position
        const stored = nodePositions[node.id];
        const initial = positions[node.id] || { x: 0, y: 0 };
        const x = stored ? stored.x : initial.x;
        const y = stored ? stored.y : initial.y;

        div.style.left = `${x}px`;
        div.style.top = `${y}px`;

        // Content
        const nombre = node.nombre_completo.split(' ');
        const nombreCorto = `${nombre[0]} ${nombre[1] || ''}`;

        div.innerHTML = `
            <div class="flex items-center gap-3" onmousedown="startNodeDrag(event, '${node.id}')" onclick="verDetalleNodo('${node.id}')">
                 <img src="${node.foto_url || 'https://ui-avatars.com/api/?name=' + node.nombre_completo}" class="size-10 rounded-full object-cover pointer-events-none">
                 <div class="pointer-events-none">
                     <h4 class="text-xs font-bold text-slate-800 leading-tight">${nombreCorto}</h4>
                     <p class="text-[9px] text-emerald-600 font-bold uppercase">${node.puesto || 'Sin Puesto'}</p>
                 </div>
            </div>
        `;

        container.appendChild(div);
    });

    // Draw Lines (After render)
    setTimeout(drawLines, 100);
}

function flattenTree(node, list = []) {
    list.push(node);
    if (node.children) node.children.forEach(c => flattenTree(c, list));
    return list;
}

function calculateTreeLayout(root) {
    const pos = {};
    const levelHeight = 150;
    const siblingGap = 270;

    function traverse(node, level, offset) {
        pos[node.id] = { x: offset, y: level * levelHeight + 50 };

        if (node.children && node.children.length > 0) {
            let startX = offset - ((node.children.length - 1) * siblingGap) / 2;
            node.children.forEach((child, i) => {
                traverse(child, level + 1, startX + (i * siblingGap));
            });
        }
    }

    // Center based on viewport approx
    traverse(root, 0, 400);
    return pos;
}

function drawLines() {
    lines.forEach(l => { try { l.remove(); } catch (e) { } });
    lines = [];

    empleadosRaw.forEach(emp => {
        if (emp.reporta_a) {
            const start = document.getElementById(`node-${emp.reporta_a}`);
            const end = document.getElementById(`node-${emp.id}`);
            if (start && end) {
                try {
                    const line = new LeaderLine(start, end, {
                        color: '#cbd5e1',
                        size: 2,
                        path: 'straight',
                        startSocket: 'bottom',
                        endSocket: 'top'
                    });
                    lines.push(line);
                } catch (e) { console.error("Line error", e); }
            }
        }
    });
}


// Free Drag Logic
let activeDragNode = null;
let lastMouseX, lastMouseY;

function startNodeDrag(e, id) {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    activeDragNode = document.getElementById(`node-${id}`);

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onNodeDrag);
    document.addEventListener('mouseup', endNodeDrag);
}

function onNodeDrag(e) {
    if (!activeDragNode) return;
    e.preventDefault();

    const dx = (e.clientX - lastMouseX) / zoomLevel;
    const dy = (e.clientY - lastMouseY) / zoomLevel;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    const currentLeft = parseFloat(activeDragNode.style.left) || 0;
    const currentTop = parseFloat(activeDragNode.style.top) || 0;

    activeDragNode.style.left = `${currentLeft + dx}px`;
    activeDragNode.style.top = `${currentTop + dy}px`;

    // Reposition affected lines
    lines.forEach(l => {
        if (l.start === activeDragNode || l.end === activeDragNode) {
            // Force reset
            l.position();
        }
    });
}

function endNodeDrag(e) {
    if (activeDragNode) {
        const id = activeDragNode.id.replace('node-', '');
        nodePositions[id] = {
            x: parseFloat(activeDragNode.style.left),
            y: parseFloat(activeDragNode.style.top)
        };
        localStorage.setItem('orgPositions', JSON.stringify(nodePositions));
        activeDragNode = null;
    }
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', onNodeDrag);
    document.removeEventListener('mouseup', endNodeDrag);
}





function esDescendiente(padreId, posibleHijoId) {
    let current = empleadosRaw.find(e => e.id === posibleHijoId);
    while (current && current.reporta_a) {
        if (current.reporta_a === padreId) return true;
        current = empleadosRaw.find(e => e.id === current.reporta_a);
    }
    return false;
}

// ==========================================
// PAN & ZOOM LOGIC
// ==========================================

function setupPanZoom() {
    updateTransform();
}

function handleZoom(delta) {
    zoomLevel += delta;
    if (zoomLevel < 0.2) zoomLevel = 0.2;
    if (zoomLevel > 3) zoomLevel = 3;
    updateTransform();
}

function resetView() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateTransform();
}

function startPan(e) {
    // Only pan if clicking on background, not a card
    if (e.target.closest('.node-card')) return;

    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    document.body.style.cursor = 'grabbing';

    document.addEventListener('mousemove', doPan);
    document.addEventListener('mouseup', stopPan);
}

function doPan(e) {
    if (!isPanning) return;
    e.preventDefault();
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
}

function stopPan() {
    isPanning = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', doPan);
    document.removeEventListener('mouseup', stopPan);
}

function updateTransform() {
    const layer = document.getElementById('pan-layer');
    if (layer) {
        layer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
}

// ==========================================
// SIDEBAR LOGIC
// ==========================================

function verDetalleNodo(id) {
    const emp = empleadosRaw.find(e => e.id === id);
    const reportes = empleadosRaw.filter(e => e.reporta_a === id);
    const jefe = empleadosRaw.find(e => e.id === emp.reporta_a);

    // Highlight selected
    document.querySelectorAll('.node-card').forEach(n => n.classList.remove('selected'));
    document.getElementById(`node-${id}`)?.classList.add('selected');

    document.getElementById('detNombre').innerText = emp.nombre_completo;
    document.getElementById('detPuesto').innerText = emp.puesto;
    document.getElementById('detFoto').src = emp.foto_url || `https://ui-avatars.com/api/?name=${emp.nombre_completo}`;

    const countEl = document.getElementById('detCountReportes');
    if (countEl) countEl.innerText = reportes.length;

    // Poblar Reportes
    const lista = document.getElementById('listaReportes');
    let reportesHTML = '';
    if (reportes.length === 0) {
        reportesHTML = '<p class="text-xs text-slate-400 italic">No tiene subordinados directos.</p>';
    } else {
        reportesHTML = reportes.map(r => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer" onclick="verDetalleNodo('${r.id}')">
                <div class="flex items-center gap-3">
                    <img src="${r.foto_url || 'https://ui-avatars.com/api/?name=' + r.nombre_completo}" class="size-8 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-black uppercase text-slate-800 truncate">${r.nombre_completo}</p>
                        <p class="text-[8px] font-bold text-slate-400 uppercase truncate">${r.puesto || 'N/A'}</p>
                    </div>
                </div>
                <span class="material-symbols-outlined text-slate-300 text-xs">chevron_right</span>
            </div>
        `).join('');
    }

    let jefeHTML = '';
    if (jefe) {
        jefeHTML = `
            <div class="mb-6">
                <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Jefe Directo</p>
                <div class="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors" onclick="verDetalleNodo('${jefe.id}')">
                    <img src="${jefe.foto_url || 'https://ui-avatars.com/api/?name=' + jefe.nombre_completo}" class="size-10 rounded-full border-2 border-white shadow-sm object-cover">
                    <div>
                        <p class="text-xs font-black text-emerald-900 leading-tight">${jefe.nombre_completo}</p>
                        <p class="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">${jefe.puesto || 'Jefe'}</p>
                    </div>
                </div>
            </div>
        `;
    } else {
        jefeHTML = `
           <div class="mb-6">
                 <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Jefe Directo</p>
                 <div class="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                    <p class="text-[10px] font-bold text-slate-400">CEO / Nivel Superior</p>
                 </div>
            </div>
        `;
    }

    const dangerZone = `
        <div class="mt-8 pt-6 border-t border-slate-100">
             <p class="text-[9px] font-black text-slate-400 uppercase mb-3">Zona de Peligro</p>
             <button onclick="eliminarDelOrganigrama('${id}')" class="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-100 transition-colors">
                <span class="material-symbols-outlined text-sm">person_remove</span>
                Quitar del Organigrama
             </button>
        </div>
    `;

    lista.innerHTML = jefeHTML + reportesHTML + dangerZone;

    document.getElementById('panelDetalle').classList.remove('translate-x-full');

    // Update Supervisor Select
    const select = document.getElementById('selectSupervisor');
    if (select) {
        select.innerHTML = '<option value="">-- Cambiar Supervisor --</option>';
        select.dataset.currentId = id;

        empleadosRaw.forEach(e => {
            if (e.id !== id) {
                const selected = e.id === emp.reporta_a ? 'selected' : '';
                select.innerHTML += `<option value="${e.id}" ${selected}>${e.nombre_completo}</option>`;
            }
        });
    }
}

function cerrarPanelDetalle() {
    document.getElementById('panelDetalle').classList.add('translate-x-full');
    document.querySelectorAll('.node-card').forEach(n => n.classList.remove('selected'));
}

async function guardarNuevoSupervisor() {
    const select = document.getElementById('selectSupervisor');
    const empleadoId = select.dataset.currentId;
    const nuevoSupervisorId = select.value;

    if (!nuevoSupervisorId) return;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/empleados?id=eq.${empleadoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ reporta_a: nuevoSupervisorId })
        });
        if (!res.ok) throw new Error("Update Failed");

        inicializarOrganigrama();
        cerrarPanelDetalle();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// Global Exports
window.inicializarOrganigrama = inicializarOrganigrama;
window.handleZoom = handleZoom;
window.resetView = resetView;
window.startPan = startPan;
window.verDetalleNodo = verDetalleNodo;
window.cerrarPanelDetalle = cerrarPanelDetalle;
window.guardarNuevoSupervisor = guardarNuevoSupervisor;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
// ==========================================
// NUEVO EMPLEADO MODAL LOGIC
// ==========================================

async function agregarEmpleado() {
    const modal = document.getElementById('modalNuevoEmpleado');
    const panel = document.getElementById('panelNuevoEmpleado');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        panel.classList.remove('translate-x-full');
    });

    // Ensure data is loaded
    if (!empleadosRaw || empleadosRaw.length === 0) {
        console.log("Cargando empleados para el selector...");
        await cargarDatos();
    }

    // Populate Supervisor Dropdown
    const selectSup = document.getElementById('selectSupervisorOrg');
    selectSup.innerHTML = '<option value="">-- Sin Jefe (Raíz) --</option>';

    // Attempt to pre-select currently selected node if any
    const selectedNode = document.querySelector('.node-card.selected');
    let preSelectId = selectedNode ? selectedNode.id.replace('node-', '') : null;

    empleadosRaw.forEach(e => {
        const selected = e.id === preSelectId ? 'selected' : '';
        selectSup.innerHTML += `<option value="${e.id}" ${selected}>${e.nombre_completo}</option>`;
    });

    // Populate Existing Employee Dropdown
    const selectEmp = document.getElementById('selectEmpleadoExistente');
    selectEmp.innerHTML = '<option value="">-- Seleccionar Empleado --</option>';

    // Sort alphabetically with safety check
    const sortedEmp = [...empleadosRaw].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));

    sortedEmp.forEach(e => {
        const note = e.reporta_a ? '✓' : '(libre)';
        selectEmp.innerHTML += `<option value="${e.id}">${e.nombre_completo} - ${e.puesto || 'N/A'} ${note}</option>`;
    });
}

function cerrarModalEmpleado() {
    const modal = document.getElementById('modalNuevoEmpleado');
    const panel = document.getElementById('panelNuevoEmpleado');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('formNuevoEmpleado').reset();
    }, 300);
}

async function guardarEmpleadoOrg() {
    const empleadoId = document.getElementById('selectEmpleadoExistente').value;
    const supervisorId = document.getElementById('selectSupervisorOrg').value || null;

    if (!empleadoId) {
        alert("Debes seleccionar un empleado.");
        return;
    }

    if (empleadoId === supervisorId) {
        alert("Un empleado no puede ser su propio supervisor.");
        return;
    }

    if (supervisorId && esDescendiente(empleadoId, supervisorId)) {
        alert("Ciclo detectado: No puedes asignar a un supervisor debajo de su propio subordinado.");
        return;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/empleados?id=eq.${empleadoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ reporta_a: supervisorId })
        });

        if (!res.ok) throw new Error("Update Failed");

        alert("Jerarquía actualizada.");
        cerrarModalEmpleado();
        inicializarOrganigrama();

    } catch (e) {
        console.error(e);
        alert("Error al vincular: " + e.message);
    }
}

async function eliminarDelOrganigrama(id) {
    if (!confirm("¿Estás seguro de quitar a este empleado del organigrama? \n\nEsto lo desvinculará de su jefe actual, pero NO eliminará su registro de empleado (seguirá en la lista de disponibles).")) return;

    try {
        // Fallback or window lookup for credentials
        const apiUrl = window.SUPABASE_URL || SUPABASE_URL;
        const apiKey = window.SUPABASE_KEY || SUPABASE_KEY;

        const res = await fetch(`${apiUrl}/rest/v1/empleados?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reporta_a: null })
        });

        if (!res.ok) throw new Error("Error al desvincular");

        alert("Empleado quitado del organigrama correctamente.");
        cerrarPanelDetalle();
        inicializarOrganigrama();
    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    }
}

// Exports
window.agregarEmpleado = agregarEmpleado;
window.cerrarModalEmpleado = cerrarModalEmpleado;
window.guardarEmpleadoOrg = guardarEmpleadoOrg;
window.eliminarDelOrganigrama = eliminarDelOrganigrama;