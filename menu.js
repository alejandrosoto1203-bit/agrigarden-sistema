// menu.js - Centralizador de Navegación Agrigarden
function inyectarMenu(paginaActiva) {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    const items = [
        { id: 'dashboard', nombre: 'Dashboard', icon: 'dashboard', link: 'dashboard.html' },
        { id: 'ingresos', nombre: 'Ingresos', icon: 'payments', link: 'ingresos.html' },
        { id: 'cobrar', nombre: 'Por Cobrar', icon: 'account_balance_wallet', link: 'cuentas_por_cobrar.html' },
        { id: 'gastos', nombre: 'Gastos', icon: 'shopping_cart', link: 'gastos.html' },
        { id: 'compras', nombre: 'Compras', icon: 'shopping_cart_checkout', link: 'compras.html' },
        { id: 'pagar', nombre: 'Por Pagar', icon: 'receipt_long', link: 'cuentas_por_pagar.html' },
        { id: 'inversiones', nombre: 'Inversiones', icon: 'account_balance', link: 'inversiones.html' },
        { id: 'prestamos', nombre: 'Préstamos', icon: 'real_estate_agent', link: 'prestamos.html' },
        { id: 'rrhh', nombre: 'Recursos Humanos', icon: 'groups', link: 'rrhh_empleados.html' },
        { id: 'inventario', nombre: 'Inventario', icon: 'inventory_2', link: 'inventario.html' },
        { id: 'flotilla', nombre: 'Control de Flotillas', icon: 'directions_car', link: 'flotilla.html' },
        { id: 'efectivo', nombre: 'Control de Efectivo', icon: 'local_atm', link: 'control_efectivo.html' },
        { id: 'estado_resultados', nombre: 'Estado de Resultados', icon: 'trending_up', link: 'estado_resultados.html' },
        { id: 'reportes', nombre: 'Reportes', icon: 'bar_chart', link: 'reportes.html' },
        { id: 'configuracion', nombre: 'Configuración', icon: 'settings', link: 'configuracion.html' }
    ];

    let html = `
        <aside class="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50">
            <div class="p-8 border-b border-gray-100 flex items-center gap-3">
                <div class="size-8 bg-black rounded-full flex items-center justify-center text-white">
                    <span class="material-symbols-outlined text-sm">potted_plant</span>
                </div>
                <span class="text-xl font-extrabold tracking-tight">Agrigarden</span>
            </div>
            
            <nav class="flex-1 p-6 space-y-2 overflow-y-auto">
                ${items.map(item => `
                    <a href="${item.link}" class="${paginaActiva === item.id ? 'bg-[#19e66b15] text-[#19e66b] font-black border border-[#19e66b30]' : 'text-gray-500 hover:bg-gray-50'} flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-xl">
                        <span class="material-symbols-outlined">${item.icon}</span> ${item.nombre}
                    </a>
                `).join('')}
            </nav>

            <div class="p-6 border-t border-gray-100">
                <button onclick="logout()" class="flex items-center gap-3 p-3 text-sm font-bold text-red-500 hover:bg-red-50 w-full rounded-xl transition-all">
                    <span class="material-symbols-outlined">logout</span> Salir
                </button>
            </div>
        </aside>
    `;

    sidebar.innerHTML = html;
}

/**
 * Nueva Función: Inyecta una barra de pestañas horizontal para navegación interna de RRHH
 * @param {string} subPaginaActiva - ID del módulo interno (central, nomina, tareas, organigrama, analytics)
 */
function inyectarSubmenuRRHH(subPaginaActiva) {
    const main = document.querySelector('main');
    if (!main) return;

    const subItems = [
        { id: 'central', nombre: 'Central de Empleados', link: 'rrhh_empleados.html' },
        { id: 'nomina', nombre: 'Nómina', link: 'rrhh_nomina.html' },
        { id: 'tareas', nombre: 'Monitor de Tareas', link: 'rrhh_tareas.html' },
        { id: 'organigrama', nombre: 'Organigrama', link: 'rrhh_organigrama.html' }
    ];

    // Buscamos el header de la página para insertar el menú justo debajo
    const header = main.querySelector('header');

    const navHtml = `
        <div class="flex gap-8 border-b border-gray-200 mb-8 overflow-x-auto">
            ${subItems.map(item => `
                <a href="${item.link}" class="pb-4 text-xs font-black uppercase tracking-widest transition-all ${subPaginaActiva === item.id ? 'text-[#19e66b] border-b-2 border-[#19e66b]' : 'text-gray-400 hover:text-gray-600'}">
                    ${item.nombre}
                </a>
            `).join('')}
        </div>
    `;

    // Insertamos después del header o al principio del main si no hay header
    if (header) {
        header.insertAdjacentHTML('afterend', navHtml);
    } else {
        main.insertAdjacentHTML('afterbegin', navHtml);
    }
}