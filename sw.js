// sw.js - Service Worker para Notificaciones Push Agrigarden

const CACHE_NAME = 'agrigarden-cache-v1';

self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activando...');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let data = {
        title: 'Agrigarden Alerta',
        body: 'Tienes una nueva notificación.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [200, 100, 200],
        data: data.data,
        actions: [
            { action: 'open', title: 'Ver Detalle' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    let urlToOpen = '/';
    if (event.notification.data && event.notification.data.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
