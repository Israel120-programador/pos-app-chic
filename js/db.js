/* =====================================================
   POS APP - DATABASE LAYER (Storage Agnostic)
   Supports IndexedDB with automatic LocalStorage fallback
   ===================================================== */

const DB = {
    name: 'pos_database',
    version: 3, // Incremented for schema changes
    mode: 'idb', // 'idb' or 'local'
    db: null,

    stores: {
        products: { keyPath: 'id', indexes: ['name', 'category', 'barcode'] },
        categories: { keyPath: 'id', indexes: ['name', 'parent_id'] }, // Added parent_id
        sales: { keyPath: 'id', indexes: ['timestamp', 'sync_status', 'cashier_id'] },
        sync_queue: { keyPath: 'id', indexes: ['status', 'timestamp', 'operation_type'] },
        inventory_movements: { keyPath: 'id', indexes: ['product_id', 'timestamp', 'sync_status'] },
        customers: { keyPath: 'id', indexes: ['phone', 'email'] },
        users: { keyPath: 'id', indexes: ['pin'] },
        settings: { keyPath: 'device_id' },
        imported_files: { keyPath: 'id', indexes: ['timestamp', 'filename'] }
    },

    async init() {
        // Detect environment
        if (window.location.protocol === 'file:') {
            console.warn('Running in FILE protocol. IndexedDB might be restricted. Attempting LocalStorage fallback.');
            this.mode = 'local';
            return Promise.resolve(true);
        }

        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(this.name, this.version);

                request.onerror = (e) => {
                    console.error('IDB Error. Switching to LocalStorage mode.', e);
                    this.mode = 'local';
                    resolve(true); // Resolve anyway to continue app flow
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.mode = 'idb';
                    console.log('Database initialized (IndexedDB Mode)');
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    Object.entries(this.stores).forEach(([storeName, config]) => {
                        if (!db.objectStoreNames.contains(storeName)) {
                            const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
                            config.indexes?.forEach(idx => {
                                store.createIndex(idx, idx, { unique: false });
                            });
                        } else {
                            // Schema updates for existing stores
                            const store = request.transaction.objectStore(storeName);
                            config.indexes?.forEach(idx => {
                                if (!store.indexNames.contains(idx)) {
                                    store.createIndex(idx, idx, { unique: false });
                                }
                            });
                        }
                    });
                };
            } catch (e) {
                console.error('IDB Exception. Switching to LocalStorage mode.', e);
                this.mode = 'local';
                resolve(true);
            }
        });
    },

    // --- GENERIC METHODS (Route to Mode) ---

    async getAll(storeName) {
        if (this.mode === 'local') return this.localGetAll(storeName);

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (e) { reject(e); }
        });
    },

    async get(storeName, id) {
        if (this.mode === 'local') return this.localGet(storeName, id);

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (e) { reject(e); }
        });
    },

    async add(storeName, data) {
        if (this.mode === 'local') return this.localPut(storeName, data); // Add == Put in LocalStorage

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.add(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (e) { reject(e); }
        });
    },

    async put(storeName, data) {
        if (this.mode === 'local') return this.localPut(storeName, data);

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (e) { reject(e); }
        });
    },

    async delete(storeName, id) {
        if (this.mode === 'local') return this.localDelete(storeName, id);

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (e) { reject(e); }
        });
    },

    // --- LOCAL STORAGE FALLBACK IMPLEMENTATION ---
    // Stores data as 'pos_db_[storeName]' -> JSON Array

    _lsKey(storeName) {
        return `pos_db_${storeName}`;
    },

    localGetAll(storeName) {
        try {
            const raw = localStorage.getItem(this._lsKey(storeName));
            return Promise.resolve(raw ? JSON.parse(raw) : []);
        } catch (e) { return Promise.resolve([]); }
    },

    async localGet(storeName, id) {
        const items = await this.localGetAll(storeName);
        const keyPath = this.stores[storeName].keyPath;
        return items.find(i => i[keyPath] === id);
    },

    async localPut(storeName, data) {
        let items = await this.localGetAll(storeName);
        const keyPath = this.stores[storeName].keyPath;
        
        // Check if exists (Update) or New
        const idx = items.findIndex(i => i[keyPath] === data[keyPath]);
        if (idx >= 0) {
            items[idx] = data;
        } else {
            items.push(data);
        }
        
        try {
            localStorage.setItem(this._lsKey(storeName), JSON.stringify(items));
            return Promise.resolve(data[keyPath]);
        } catch (e) {
            console.error('LocalStorage Quota Exceeded likely', e);
            return Promise.reject(e);
        }
    },

    async localDelete(storeName, id) {
        let items = await this.localGetAll(storeName);
        const keyPath = this.stores[storeName].keyPath;
        items = items.filter(i => i[keyPath] !== id);
        localStorage.setItem(this._lsKey(storeName), JSON.stringify(items));
        return Promise.resolve();
    },

    // --- HELPERS ---

    hasStore(storeName) {
        if (this.mode === 'local') return true; // LocalStorage "stores" are just keys
        return this.db && this.db.objectStoreNames.contains(storeName);
    },

    async queueSync(operationType, entityType, entityId, payload) {
        const op = {
            id: 'op_' + Utils.generateUUID(),
            operation_type: operationType,
            entity_type: entityType,
            entity_id: entityId,
            payload,
            timestamp: Utils.now(),
            status: 'PENDING',
            retry_count: 0
        };
        await this.add('sync_queue', op);
        return op;
    }
};
