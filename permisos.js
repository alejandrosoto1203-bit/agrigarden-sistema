// permisos.js - Lógica de Control de Acceso por Módulo y Sucursal

const Permisos = {
    // Definición de módulos del sistema
    MODULOS: [
        'dashboard', 'ventas', 'ingresos', 'cobrar', 'gastos',
        'compras', 'pagar', 'inversiones', 'prestamos',
        'clientes', 'proveedores',
        'rrhh', 'inventario', 'inventario_stock', 'conteo_inventario', 'productos',
        'flotilla', 'efectivo', 'pos_cortes',
        'cuentas', 'traspasos',
        'ordenes_pendientes', 'ordenes_reparacion', 'ordenes_terminadas',
        'estado_resultados', 'reportes', 'configuracion',
        'solicitudes_personal'
    ],

    // Etiquetas de visualización para el modal de permisos
    MODULOS_LABELS: {
        'dashboard':            'Dashboard',
        'ventas':               'Ventas',
        'ingresos':             'Ingresos',
        'cobrar':               'Por Cobrar',
        'gastos':               'Gastos',
        'compras':              'Compras',
        'pagar':                'Por Pagar',
        'inversiones':          'Inversiones',
        'prestamos':            'Préstamos',
        'clientes':             'Clientes',
        'proveedores':          'Proveedores',
        'rrhh':                 'Recursos Humanos',
        'inventario':           'Inventario',
        'inventario_stock':     'Inventario Stock',
        'conteo_inventario':    'Conteo Inventario',
        'productos':            'Productos',
        'flotilla':             'Flotilla',
        'efectivo':             'Control de Efectivo',
        'pos_cortes':           'POS / Cortes de Caja',
        'cuentas':              'Cuentas Bancarias',
        'traspasos':            'Traspasos',
        'ordenes_pendientes':   'Órdenes Pendientes',
        'ordenes_reparacion':   'Órdenes Reparación',
        'ordenes_terminadas':   'Órdenes Terminadas',
        'estado_resultados':    'Estado de Resultados',
        'reportes':             'Reportes',
        'configuracion':        'Configuración',
        'solicitudes_personal': 'Solicitudes Personal',
    },

    MODULOS_EMPLEADO: ['solicitudes_rrhh'],

    // Obtener datos del usuario actual
    getUsuario() {
        try {
            const userStr = sessionStorage.getItem('usuario');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    // Verificar si puede VER un módulo
    puedeVer(moduloId) {
        const user = this.getUsuario();
        if (!user) return false;

        // El rol admin tiene acceso total por defecto
        if (user.rol === 'admin') return true;

        // El rol empleado solo puede ver su módulo de solicitudes
        if (user.rol === 'empleado') return this.MODULOS_EMPLEADO.includes(moduloId);

        // Verificar en el objeto de permisos del usuario
        if (user.permisos && user.permisos[moduloId]) {
            return !!user.permisos[moduloId].ver;
        }

        return false;
    },

    // Verificar si puede EDITAR/CREAR en un módulo
    puedeEditar(moduloId) {
        const user = this.getUsuario();
        if (!user) return false;

        if (user.rol === 'admin') return true;
        if (user.rol === 'empleado') return false; // empleados no editan módulos del CRM

        if (user.permisos && user.permisos[moduloId]) {
            return !!user.permisos[moduloId].editar;
        }

        return false;
    },

    // Verifica si el usuario actual es empleado
    isEmpleado() {
        const user = this.getUsuario();
        return user?.rol === 'empleado';
    },

    // Verifica si el usuario actual es admin
    isAdmin() {
        const user = this.getUsuario();
        return user?.rol === 'admin';
    },

    // Obtener la sucursal asignada (Norte, Sur, Ambas)
    getSucursal() {
        const user = this.getUsuario();
        return user ? (user.sucursal || 'Ambas') : 'Ambas';
    },

    // Filtrar datos por sucursal según el usuario
    filtrarPorSucursal(lista, campoSucursal = 'sucursal') {
        const sucursalAsignada = this.getSucursal();
        if (sucursalAsignada === 'Ambas') return lista;

        return lista.filter(item => item[campoSucursal] === sucursalAsignada);
    }
};

window.Permisos = Permisos;
