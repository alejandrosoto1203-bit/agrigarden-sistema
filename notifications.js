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

    // Notificación local (fallback si no hay push o pestaña abierta)
    notify(title, body, options = {}) {
        if (!("Notification" in window)) return alert(`${title}: ${body}`);

        if (Notification.permission === 'granted') {
            try {
                const n = new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    ...options
                });

                // Sonido de alerta
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.warn("No se pudo reproducir el sonido:", e));

                n.onclick = () => {
                    window.focus();
                    if (options.url) window.location.href = options.url;
                };
            } catch (e) {
                // Algunos navegadores móviles no permiten el constructor de Notification
                console.warn("Error con Notification API, intentando alert:", e);
                alert(`${title}: ${body}`);
            }
        } else if (Notification.permission !== 'denied') {
            this.requestPermission().then(() => {
                if (Notification.permission === 'granted') this.notify(title, body, options);
            });
        } else {
            // Si está denegado, al menos mostrar un alert normal para no perder el aviso
            console.log(`Notificación (Denegada): ${title} - ${body}`);
            // No usamos alert aquí para no ser molestos si el usuario denegó a propósito, 
            // pero podrías activarlo si es crítico.
        }
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
