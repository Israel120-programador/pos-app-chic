
// NUKE SERVICE WORKER AND CACHE
console.log('💥 NUKING SERVICE WORKER AND CACHE...');

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister()
                .then(success => console.log('💥 SW Unregistered:', success))
                .catch(err => console.error('❌ SW Unregister Failed:', err));
        }
    });
}

if ('caches' in window) {
    caches.keys().then(function (names) {
        for (let name of names) {
            caches.delete(name)
                .then(success => console.log('💥 Cache Deleted:', name))
                .catch(err => console.error('❌ Cache Delete Failed:', name));
        }
    });
}

// Force reload if we suspect we are stale
if (!sessionStorage.getItem('nuked_once')) {
    sessionStorage.setItem('nuked_once', 'true');
    console.log('🔄 Force Reloading in 1s...');
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
}
