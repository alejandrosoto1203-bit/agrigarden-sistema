// cortes_caja.js
// Lógica para mostrar historial de cortes de caja

async function cargarCortesCaja() {
    const tbody = document.getElementById('tablaCortes');
    const filtroSucursal = document.getElementById('filtroSucursal').value;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="px-6 py-12 text-center text-gray-400 italic">
                <span class="material-symbols-outlined text-4xl mb-2 block mx-auto animate-spin">refresh</span>
                Cargando datos...
            </td>
        </tr>
    `;

    try {
        let query = `${window.SUPABASE_URL}/rest/v1/caja_sesiones?select=*&order=fecha_cierre.desc.nullslast`;

        if (filtroSucursal !== 'Todas') {
            query += `&sucursal=eq.${filtroSucursal}`;
        }

        const response = await fetch(query, {
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar cortes');

        const sesiones = await response.json();

        if (sesiones.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-6 py-12 text-center text-gray-400 italic">
                        <span class="material-symbols-outlined text-4xl mb-2 block mx-auto">history</span>
                        No se encontraron cortes registrados.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sesiones.map(s => {
            const fechaCierre = s.fecha_cierre ? new Date(s.fecha_cierre).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }) : '<span class="text-orange-500 font-bold">En Curso</span>';

            const diferencia = s.diferencia || 0;
            let claseDiferencia = 'text-gray-400';
            let signoDiferencia = '';

            if (diferencia > 0) {
                claseDiferencia = 'text-green-600 font-bold';
                signoDiferencia = '+';
            } else if (diferencia < 0) {
                claseDiferencia = 'text-red-500 font-bold';
            }

            const estadoBadge = s.estado === 'CERRADA'
                ? '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase">Cerrada</span>'
                : '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase animate-pulse">Abierta</span>';

            // Solo permitir acciones si está CERRADA (o permitir editar/eliminar siempre bajo riesgo)
            // Mostrar botones
            return `
                <tr class="hover:bg-gray-50 transition-colors group">
                    <td class="px-6 py-4 font-bold text-gray-700">
                        ${fechaCierre}
                    </td>
                    <td class="px-6 py-4 text-gray-600 font-medium">
                        <span class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-gray-400 text-sm">store</span>
                            ${s.sucursal}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-xs uppercase font-bold tracking-wide">
                        ${s.usuario_cierre || s.usuario_apertura || 'Desconocido'}
                    </td>
                    <td class="px-6 py-4 text-right font-mono text-gray-600">
                        ${formatMoney(s.fondo_inicial)}
                    </td>
                    <td class="px-6 py-4 text-right font-mono text-gray-600">
                        ${formatMoney(s.ventas_efectivo)}
                    </td>
                    <td class="px-6 py-4 text-right font-mono font-bold text-gray-800">
                        ${formatMoney(s.efectivo_real)}
                    </td>
                    <td class="px-6 py-4 text-right font-mono ${claseDiferencia}">
                        ${signoDiferencia}${formatMoney(diferencia)}
                    </td>
                    <td class="px-6 py-4 text-center">
                        ${estadoBadge}
                    </td>
                    <td class="px-6 py-4 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick='verDetalleCorte(${JSON.stringify(s)})' class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Ver Detalle">
                                <span class="material-symbols-outlined text-lg">visibility</span>
                            </button>
                            <button onclick='editarCorte(${JSON.stringify(s)})' class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Editar">
                                <span class="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onclick="eliminarCorte(${s.id})" class="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Eliminar">
                                <span class="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-6 py-12 text-center text-red-500 font-bold">
                    Error al cargar los datos. Intenta nuevamente.
                </td>
            </tr>
        `;
    }
}

function formatMoney(amount) {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

// ==========================================
// FUNCIONES DE ACCIÓN
// ==========================================

function verDetalleCorte(corte) {
    document.getElementById('detalleFecha').textContent = corte.fecha_cierre ? new Date(corte.fecha_cierre).toLocaleString('es-MX') : 'En Curso';
    document.getElementById('detalleSucursal').textContent = corte.sucursal;
    document.getElementById('detalleUsuario').textContent = corte.usuario_cierre || corte.usuario_apertura || '-';

    document.getElementById('detalleFondo').textContent = formatMoney(corte.fondo_inicial);
    document.getElementById('detalleVentas').textContent = formatMoney(corte.ventas_efectivo);

    const esperado = (corte.fondo_inicial || 0) + (corte.ventas_efectivo || 0);
    document.getElementById('detalleEsperado').textContent = formatMoney(esperado);

    document.getElementById('detalleReal').textContent = formatMoney(corte.efectivo_real);

    const diff = corte.diferencia || 0;
    const elDiff = document.getElementById('detalleDiferencia');
    elDiff.textContent = formatMoney(diff);

    if (diff > 0) {
        elDiff.className = 'font-black text-xl text-green-600';
    } else if (diff < 0) {
        elDiff.className = 'font-black text-xl text-red-600';
    } else {
        elDiff.className = 'font-black text-xl text-gray-400';
    }

    document.getElementById('detalleNotas').textContent = corte.notas_cierre || 'Sin notas registradas';

    document.getElementById('modalDetalleCorte').classList.remove('hidden');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleCorte').classList.add('hidden');
}

function editarCorte(corte) {
    document.getElementById('editIdCorte').value = corte.id;
    document.getElementById('editFondo').value = corte.fondo_inicial;
    document.getElementById('editReal').value = corte.efectivo_real;
    document.getElementById('editNotas').value = corte.notas_cierre || '';

    document.getElementById('modalEditarCorte').classList.remove('hidden');
}

async function guardarEdicionCorte() {
    const id = document.getElementById('editIdCorte').value;
    const fondo = parseFloat(document.getElementById('editFondo').value) || 0;
    const real = parseFloat(document.getElementById('editReal').value) || 0;
    const notas = document.getElementById('editNotas').value;

    // Recalcular diferencia: (Real - Esperado) -> Esperado = Fondo + Ventas
    // Necesitamos saber Ventas Efectivo para recalcular bien la diferencia. 
    // Como no lo tengo aquí "a mano" sin hacer fetch, una opción es pasar también ventas al modal o hacer un fetch previo.
    // O mejor, obtengo el registro actual primero.

    try {
        const resOld = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?id=eq.${id}&select=ventas_efectivo`, {
            headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${window.SUPABASE_KEY}` }
        });
        const [oldData] = await resOld.json();
        const ventas = oldData.ventas_efectivo || 0;
        const esperado = fondo + ventas;
        const diferencia = real - esperado;

        const updateData = {
            fondo_inicial: fondo,
            efectivo_real: real,
            diferencia: diferencia,
            notas_cierre: notas
        };

        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            alert('¡Corte actualizado correctamente!');
            document.getElementById('modalEditarCorte').classList.add('hidden');
            cargarCortesCaja();
        } else {
            alert('Error al actualizar');
        }

    } catch (e) {
        console.error(e);
        alert('Error de conexión');
    }
}

async function eliminarCorte(id) {
    if (!confirm('¿Estás seguro de eliminar este registro de corte? Esta acción no se puede deshacer.')) return;

    try {
        const response = await fetch(`${window.SUPABASE_URL}/rest/v1/caja_sesiones?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': window.SUPABASE_KEY,
                'Authorization': `Bearer ${window.SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            alert('Registro eliminado');
            cargarCortesCaja();
        } else {
            alert('No se pudo eliminar el registro');
        }
    } catch (e) {
        console.error(e);
        alert('Error al eliminar');
    }
}
