// permisos.js - Utilidades para Control de Acceso (RBAC)
const Permisos = {
    /**
     * Obtiene el objeto de permisos del usuario actual desde sessionStorage
     */
    getPermisos() {
        try {
            const p = sessionStorage.getItem('userPermisos');
            return p ? JSON.parse(p) : {};
        } catch (e) {
            console.error("Error al leer permisos:", e);
            return {};
        }
    },

    /**
     * Verifica si el usuario puede VER un módulo
     */
    puedeVer(modulo) {
        const p = this.getPermisos();
        // Si no hay permisos definidos (usuario viejo o error), solo admin ve todo
        if (!p || Object.keys(p).length === 0) {
            return sessionStorage.getItem('userRole') === 'admin';
        }
        return p[modulo]?.ver === true;
    },

    /**
     * Verifica si el usuario puede EDITAR un módulo
     */
    puedeEditar(modulo) {
        const p = this.getPermisos();
        if (!p || Object.keys(p).length === 0) {
            return sessionStorage.getItem('userRole') === 'admin';
        }
        return p[modulo]?.editar === true;
    },

    /**
     * Busca botones o elementos con data-permiso y los oculta si no tiene permisos de edición
     */
    aplicarPermisosUI() {
        const p = this.getPermisos();
        const isAdmin = sessionStorage.getItem('userRole') === 'admin';

        // 1. Ocultar elementos marcados con data-permiso-ver="modulo"
        document.querySelectorAll('[data-permiso-ver]').forEach(el => {
            const mod = el.dataset.permisoVer;
            if (!this.puedeVer(mod) && !isAdmin) {
                el.style.display = 'none';
                el.remove(); // Más seguro para evitar inspección simple
            }
        });

        // 2. Ocultar elementos marcados con data-permiso-editar="modulo" (Botones Guardar, etc)
        document.querySelectorAll('[data-permiso-editar]').forEach(el => {
            const mod = el.dataset.permisoEditar;
            if (!this.puedeEditar(mod) && !isAdmin) {
                el.style.display = 'none';
                el.remove();
            }
        });
    }
};

// Auto-ejecutar al cargar si hay elementos marcados
document.addEventListener('DOMContentLoaded', () => {
    // Retraso pequeño para asegurar que otros scripts inyectaron contenido
    setTimeout(() => Permisos.aplicarPermisosUI(), 100);
});

window.Permisos = Permisos;
