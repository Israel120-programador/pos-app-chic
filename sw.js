// NUKE SW - Self-destructing Service Worker
// This SW immediately unregisters itself and clears ALL caches
// Once caches are clear, the browser will load fresh files from the server

const CACHES_TO_DESTROY = [
    'pos-firebase-v2.0-stable',
    'pos-firebase-v2.0',
    'pos-firebase-v1',
    'pos-cache-v1',
    'pos-cache'
];

self.addEventListener('install', (event) => {
    console.log('� NUKE SW: Installing...');
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
    console.log('� NUKE SW: Activating - DESTROYING ALL CACHES...');
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.map((name) => {
                    console.log('🗑️ Deleting cache:', name);
                    return caches.delete(name);
                })
            );
        }).then(() => {
            console.log('✅ All caches destroyed.');
            // Tell all clients to reload
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach((client) => {
                client.postMessage({ type: 'CACHES_CLEARED' });
            });
            // Unregister ourselves
            return self.registration.unregister();
        }).then(() => {
            console.log('✅ NUKE SW: Unregistered. Browser is clean.');
        })
    );
});

// Don't intercept ANY requests - let browser handle everything directly
self.addEventListener('fetch', (event) => {
    // Do nothing - pass through to network
    return;
});
