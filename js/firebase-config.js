// js/firebase-config.js
// Configuración y funciones helper para Firebase

const db = firebase.firestore();

// Habilitar persistencia offline
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Persistencia offline: múltiples pestañas abiertas');
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Navegador no soporta persistencia offline');
        }
    });

// Helper: Obtener timestamp del servidor
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();

// Helper: Increment para actualizaciones atómicas
const increment = (value) => firebase.firestore.FieldValue.increment(value);

// Helper: Array operations
const arrayUnion = (...elements) => firebase.firestore.FieldValue.arrayUnion(...elements);
const arrayRemove = (...elements) => firebase.firestore.FieldValue.arrayRemove(...elements);

// Estado de conexión
let isOnline = true;
let connectionListeners = [];

// Detectar estado de conexión
window.addEventListener('online', () => {
    isOnline = true;
    console.log('🟢 Conexión restaurada - Sincronizando...');
    connectionListeners.forEach(listener => listener(true));
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('🔴 Sin conexión - Modo offline activado');
    connectionListeners.forEach(listener => listener(false));
});

// Función para suscribirse a cambios de conexión
function onConnectionChange(callback) {
    connectionListeners.push(callback);
    // Llamar inmediatamente con el estado actual
    callback(isOnline);
}

// Mostrar indicador de sincronización
function showSyncIndicator(message = 'Sincronizando...') {
    const indicator = document.getElementById('sync-indicator') || createSyncIndicator();
    indicator.textContent = message;
    indicator.classList.add('active');

    setTimeout(() => {
        indicator.classList.remove('active');
    }, 2000);
}

function createSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'sync-indicator';
    document.body.appendChild(indicator);
    return indicator;
}

// Función para manejar errores de Firebase
function handleFirebaseError(error, context = '') {
    console.error(`❌ Error Firebase (${context}):`, error);

    const errorMessages = {
        'permission-denied': 'No tienes permisos para realizar esta acción',
        'unavailable': 'Servicio temporalmente no disponible. Intenta de nuevo.',
        'failed-precondition': 'Operación no permitida en este momento',
        'not-found': 'Documento no encontrado',
        'already-exists': 'El documento ya existe'
    };

    const message = errorMessages[error.code] || 'Error al sincronizar con el servidor';

    // Mostrar error al usuario
    if (window.Utils && window.Utils.showToast) {
        window.Utils.showToast(message, 'error');
    } else {
        alert(message);
    }

    return { success: false, error: message };
}

// Función helper para ejecutar transacciones con reintentos
async function runTransactionWithRetry(updateFunction, maxRetries = 3) {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            return await db.runTransaction(updateFunction);
        } catch (error) {
            retries++;

            if (retries >= maxRetries) {
                throw error;
            }

            // Esperar antes de reintentar (backoff exponencial)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
        }
    }
}

// Función para batch writes (para operaciones múltiples)
function getBatch() {
    return db.batch();
}

// Inicialización asíncrona (placeholder)
async function init() {
    // Aquí puedes poner lógica de inicialización extra si la necesitas
    // De momento, solo retornamos true para indicar éxito
    return true;
}

// Exportar funciones y variables
window.FirebaseConfig = {
    db,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove,
    isOnline: () => isOnline,
    onConnectionChange,
    showSyncIndicator,
    handleFirebaseError,
    runTransactionWithRetry,
    getBatch,
    init // Añadido para compatibilidad con app.js
};

console.log('✅ Firebase configurado y listo (Robust Mode)');
