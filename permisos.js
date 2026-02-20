// permisos.js - Lógica de Control de Acceso por Módulo y Sucursal

const Permisos = {
    // Definición de módulos del sistema
    MODULOS: [
        'dashboard', 'ventas', 'ingresos', 'cobrar', 'gastos',
        'compras', 'pagar', 'inversiones', 'prestamos', 'rrhh',
        'inventario', 'conteo_inventario', 'productos', 'flotilla', 'efectivo',
        'estado_resultados', 'reportes', 'configuracion'
    ],

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

        if (user.permisos && user.permisos[moduloId]) {
            return !!user.permisos[moduloId].editar;
        }

        return false;
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
