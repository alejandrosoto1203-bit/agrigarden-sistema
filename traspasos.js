// traspasos.js - Lógica de Traspasos Inter-Sucursal

// --- UTILS FALLBACK ---
if (typeof formatMoney === 'undefined') {
    window.formatMoney = (n) => {
        if (n === undefined || n === null) return "$0.00";
        return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };
}
// ----------------------

function abrirModalTraspaso() {
    const modal = document.getElementById('modalTraspaso');
    if (modal) {
        modal.classList.remove('hidden');
        actualizarDestinoTraspaso(); // Inicializar destino correcto
    }
}

function cerrarModalTraspaso() {
    const modal = document.getElementById('modalTraspaso');
    if (modal) modal.classList.add('hidden');
}

function actualizarDestinoTraspaso() {
    const origen = document.getElementById('traspasoOrigen').value;
    const destinoSelect = document.getElementById('traspasoDestino');

    // Si el origen es Norte, el destino es Sur y viceversa
    if (destinoSelect) {
        destinoSelect.value = (origen === 'Norte') ? 'Sur' : 'Norte';
    }
}

function sugerirMetodoLlegada() {
    const origen = document.getElementById('traspasoMetodo').value;
    const destinoSelect = document.getElementById('traspasoMetodoDestino');
    if (destinoSelect) {
        destinoSelect.value = origen;
    }
}

async function ejecutarTraspaso() {
    const origen = document.getElementById('traspasoOrigen').value;
    const destino = document.getElementById('traspasoDestino').value;

    // NUEVO: Manejo de métodos independientes para inyección a caja
    const metodoSalida = document.getElementById('traspasoMetodo').value;
    const metodoLlegada = document.getElementById('traspasoMetodoDestino').value;

    const monto = parseFloat(document.getElementById('traspasoMonto').value);
    const notas = document.getElementById('traspasoNotas').value || 'Traspaso de fondos';

    if (isNaN(monto) || monto <= 0) {
        alert("Por favor ingresa un monto válido mayor a cero.");
        return;
    }

    const btn = document.getElementById('btnEjecutarTraspaso');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin material-symbols-outlined">sync</span> Procesando...`;

    try {
        const API_URL = window.SUPABASE_URL;
        const API_KEY = window.SUPABASE_KEY;
        const headers = {
            'apikey': API_KEY,
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };

        const fechaISO = new Date().toISOString();

        // 1. REGISTRO DE SALIDA (GASTO) EN SUCURSAL ORIGEN
        const bodyGasto = {
            created_at: fechaISO,
            sucursal: origen,
            monto_total: monto,
            metodo_pago: metodoSalida, // Sale con este método
            categoria: 'TRASPASO INTER-SUCURSAL',
            proveedor: `DESTINO: ${destino}`,
            notas: `TRASPASO HACIA ${destino}. ${notas}`
        };

        // 2. REGISTRO DE ENTRADA (INGRESO) EN SUCURSAL DESTINO
        const bodyIngreso = {
            created_at: fechaISO,
            sucursal: destino,
            monto: monto,
            monto_neto: monto,
            metodo_pago: metodoLlegada, // Entra con este método (puede ser Efectivo)
            categoria: 'TRASPASO INTER-SUCURSAL',
            tipo: 'TRASPASO',
            nombre_cliente: `ORIGEN: ${origen}`,
            notas: `TRASPASO DESDE ${origen}. ${notas}`
        };

        // Ejecutar ambas inserciones
        const [resGasto, resIngreso] = await Promise.all([
            fetch(`${API_URL}/rest/v1/gastos`, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyGasto)
            }),
            fetch(`${API_URL}/rest/v1/transacciones`, {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyIngreso)
            })
        ]);

        if (resGasto.ok && resIngreso.ok) {
            alert(`¡Traspaso exitoso! Se movieron ${formatMoney(monto)} de ${origen} (${metodoSalida}) a ${destino} (${metodoLlegada}).`);
            cerrarModalTraspaso();

            // Limpiar campos
            document.getElementById('traspasoMonto').value = '';
            document.getElementById('traspasoNotas').value = '';

            // Recargar datos en la UI (asumiendo que cargarControlEfectivo existe de control_efectivo.js)
            if (typeof window.cargarControlEfectivo === 'function') {
                window.cargarControlEfectivo();
            }
        } else {
            console.error("Error en el traspaso:", await resGasto.text(), await resIngreso.text());
            alert("Hubo un error al procesar el traspaso en la base de datos.");
        }

    } catch (error) {
        console.error("Error FATAL traspaso:", error);
        alert("Error de conexión al procesar el traspaso.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
