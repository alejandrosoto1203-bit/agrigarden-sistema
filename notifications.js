// notifications.js - Gestión de Notificaciones Push y Alertas Locales

const VAPID_PUBLIC_KEY = 'BI5mG6fPz7q-c2WvDXY-c9Lz9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9z9Z9'; // Placeholder, se debe generar una real

const NotificationsManager = {
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window,

    async init() {
        if (!this.isSupported) {
            console.warn("Este navegador no soporta notificaciones push.");
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registrado con éxito:', registration.scope);
            this.requestPermission(); // Solicitar permiso al inicializar
        } catch (error) {
            console.error('Fallo el registro del Service Worker:', error);
        }
    },

    async requestPermission() {
        if (!this.isSupported) return false;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Permiso de notificaciones concedido.');
            await this.subscribeUser();
            return true;
        }
        return false;
    },

    async subscribeUser() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            console.log('Usuario suscrito:', subscription);
            await this.saveSubscriptionOnServer(subscription);
        } catch (error) {
            console.error('Error al suscribir al usuario:', error);
        }
    },

    async saveSubscriptionOnServer(subscription) {
        // Obtener usuario actual del session storage (patrón del proyecto)
        const userStr = sessionStorage.getItem('usuario');
        if (!userStr) return;
        const user = JSON.parse(userStr);

        try {
            const client = typeof getClient === 'function' ? getClient() : null;
            if (!client) return;

            const browserInfo = navigator.userAgent.substring(0, 100);

            const { error } = await client
                .from('sys_push_subscriptions')
                .upsert({
                    usuario_id: user.id,
                    subscription_data: subscription,
                    browser_info: browserInfo,
                    last_used_at: new Date().toISOString()
                }, { onConflict: 'usuario_id, browser_info' });

            if (error) throw error;
            console.log('Suscripción guardada en base de datos.');
        } catch (e) {
            console.error("Error guardando suscripción:", e);
        }
    },

    // Notificación local (utilizando el Service Worker para mayor confiabilidad)
    async notify(title, body, options = {}) {
        console.log(`🔔 Notificación: ${title} - ${body}`);

        // 1. Intentar sonido siempre
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.warn("Límite de audio del navegador:", e));
        } catch (e) { }

        // 2. Intentar Notificación Nativa
        let nativeShown = false;
        if (("Notification" in window) && Notification.permission === 'granted') {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, {
                    body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    vibrate: [200, 100, 200],
                    ...options
                });
                nativeShown = true;
            } catch (e) {
                console.warn("Fallo showNotification:", e);
                try { new Notification(title, { body, ...options }); nativeShown = true; } catch (e2) { }
            }
        }

        // 3. Fallback: Notificación Interna (UI) si no se mostró la nativa o para reforzar
        this.showInAppNotification(title, body, options);
    },

    // Crea un banner visual dentro de la aplicación
    showInAppNotification(title, body, options = {}) {
        const id = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = "fixed bottom-4 right-4 z-[9999] bg-white border-l-4 border-primary shadow-2xl rounded-lg p-4 max-w-sm transform translate-y-20 transition-all duration-500 flex gap-3 items-start animate-bounce-subtle";
        toast.innerHTML = `
            <div class="bg-primary/10 p-2 rounded-full text-primary">
                <span class="material-symbols-outlined text-sm">notifications</span>
            </div>
            <div class="flex-1">
                <p class="text-xs font-black uppercase text-slate-800">${title}</p>
                <p class="text-[10px] text-slate-500 font-medium leading-tight mt-1">${body}</p>
            </div>
            <button onclick="this.parentElement.remove()" class="text-slate-300 hover:text-slate-500">
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
        `;
        document.body.appendChild(toast);

        // Animación de entrada
        setTimeout(() => toast.classList.remove('translate-y-20'), 100);

        // Auto-eliminar
        setTimeout(() => {
            if (document.getElementById(id)) {
                toast.classList.add('opacity-0', 'translate-y-4');
                setTimeout(() => toast.remove(), 500);
            }
        }, 6000);
    },

    async runDiagnostics() {
        const results = {
            supported: this.isSupported,
            permission: Notification.permission,
            swActive: !!(await navigator.serviceWorker.getRegistration()),
            userAgent: navigator.userAgent
        };
        console.table(results);
        this.notify("Diagnóstico Ejecutado", `Permiso: ${results.permission}. SW: ${results.swActive ? 'Activo' : 'Inactivo'}`);
        return results;
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
};

window.NotificationsManager = NotificationsManager;
