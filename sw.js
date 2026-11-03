// sw.js - Service Worker de SIRA PWA
const CACHE_NAME = 'sira-pwa-v1.1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './login.html',
    './dashboard-paciente.html',
    './dashboard-dr.html',
    './dashboard-admin.html',
    './biblioteca.html',
    './monitor.html',
    './perfil.html',
    './css/styles.css',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable.png',
    './icons/apple-touch-icon.png',
    './img/logo-sira.png.png'
];

// 1. INSTALACIÓN: Guardar archivos estáticos esenciales
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('Algunos recursos no se pudieron precachear:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVACIÓN: Limpiar cachés antiguas si hay nueva versión
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. ESTRATEGIA DE RED: Stale-While-Revalidate para recursos estáticos y Network-First para datos
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Evitar interceptar llamadas a Firebase, Firestore, Auth o APIs externas de streaming
    if (url.origin.includes('firebase') || url.origin.includes('googleapis') || url.origin.includes('gstatic') || req.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            const fetchPromise = fetch(req).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Si la red falla y no hay caché, retornar fallback para páginas HTML
                if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });

            return cachedResponse || fetchPromise;
        })
    );
});
