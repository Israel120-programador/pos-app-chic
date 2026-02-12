/* =====================================================
   POS APP - SYNC MODULE
   Sincronización bidireccional con Firebase Firestore
   ===================================================== */

const Sync = {
    isOnline: navigator.onLine,
    channels: {},
    retryQueue: [],
    _skipRemoteUpdates: false,

    async init() {
        // Monitor online/offline status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Manual sync button
        document.getElementById('sync-manual-btn')?.addEventListener('click', () => {
            this.manualSync();
        });

        // Initial sync if online
        if (this.isOnline && this.isSupabaseReady()) {
            await this.initialSync();
            this.subscribeToChanges();
        }

        this.updateStatusIndicator();
    },

    async manualSync() {
        if (!this.isOnline) {
            Utils.showToast('No hay conexión a internet', 'error');
            return;
        }

        const btn = document.getElementById('sync-manual-btn');
        if (btn) btn.innerHTML = '↻ Sincronizando...';

        await this.initialSync();
        await this.processRetryQueue();

        if (btn) btn.innerHTML = '↻ Sincronizar Ahora';
        Utils.showToast('Sincronización completada', 'success');
    },

    isSupabaseReady() {
        return typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient();
    },

    async handleOnline() {
        console.log('🌐 Conexión restaurada');
        this.isOnline = true;
        this.updateStatusIndicator();

        if (this.isSupabaseReady()) {
            console.log('🔄 Sincronizando datos después de reconexión...');
            await this.initialSync();
            await this.processRetryQueue();
            this.subscribeToChanges();
        }
    },

    handleOffline() {
        console.log('📴 Sin conexión');
        this.isOnline = false;
        this.updateStatusIndicator();
    },

    updateStatusIndicator(status) {
        const statusEl = document.getElementById('sync-status');
        const manualBtn = document.getElementById('sync-manual-btn');
        if (!statusEl) return;

        const icon = statusEl.querySelector('.sync-icon');
        const text = statusEl.querySelector('.sync-text');

        if (manualBtn) manualBtn.classList.remove('hidden');

        if (status === 'syncing') {
            icon.textContent = '🔄';
            text.textContent = 'Sincronizando...';
            if (manualBtn) {
                manualBtn.innerHTML = '🔄 ...';
                manualBtn.disabled = true;
                manualBtn.style.opacity = '0.7';
            }
        } else {
            if (manualBtn) {
                manualBtn.innerHTML = '↻ Sincronizar Ahora';
                manualBtn.disabled = false;
                manualBtn.style.opacity = '1';
            }

            if (!this.isOnline) {
                icon.textContent = '🔴';
                text.textContent = 'Sin conexión';
            } else if (this.isSupabaseReady()) {
                icon.textContent = '🟢';
                text.textContent = 'Sincronizado';
            } else {
                icon.textContent = '🟡';
                text.textContent = 'Solo local';
            }
        }
    },

    // =====================================================
    // INITIAL SYNC - Pull data from cloud on startup
    // =====================================================
    async initialSync() {
        if (!this.isSupabaseReady()) return;

        console.log('🔄 Sincronizando con Firebase...');
        this.updateStatusIndicator('syncing');

        try {
            await this.pullFromCloud('products');
            await this.pullFromCloud('categories');
            await this.pullFromCloud('users');
            await this.pullFromCloud('sales');
            await this.pullFromCloud('inventory_movements');

            console.log('✅ Sincronización inicial completada');
            this.updateStatusIndicator();

        } catch (error) {
            console.error('❌ Error en sincronización inicial:', error);
            this.updateStatusIndicator();
        }
    },

    async pullFromCloud(entityType) {
        if (!this.isSupabaseReady()) return;

        try {
            let cloudData = [];

            switch (entityType) {
                case 'products':
                    cloudData = await SupabaseDB.getProducts();
                    break;
                case 'categories':
                    cloudData = await SupabaseDB.getCategories();
                    break;
                case 'users':
                    cloudData = await SupabaseDB.getUsers();
                    break;
                case 'sales':
                    cloudData = await SupabaseDB.getTodayOrders();
                    break;
                case 'inventory_movements':
                    cloudData = await SupabaseDB.getInventoryMovements();
                    break;
                case 'settings':
                    const settings = await SupabaseDB.getSettings();
                    if (settings) cloudData = [settings];
                    break;
            }

            for (const item of cloudData) {
                const localItem = this.cloudToLocal(entityType, item);
                await DB.put(entityType, localItem);
            }

            console.log(`📥 ${entityType}: ${cloudData.length} items sincronizados`);

        } catch (error) {
            console.error(`Error pulling ${entityType}:`, error);
        }
    },

    // =====================================================
    // REAL-TIME SUBSCRIPTIONS (Firebase onSnapshot)
    // =====================================================
    subscribeToChanges() {
        if (!this.isSupabaseReady()) return;

        // Unsubscribe existing listeners first
        this.unsubscribeAll();

        // Subscribe to products changes
        this.channels.products = SupabaseDB.subscribeToProducts(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('📦 Cambio en productos:', payload.eventType);
            await this.handleRemoteChange('products', payload);
        });

        // Subscribe to categories
        this.channels.categories = SupabaseDB.subscribeToCategories(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('📁 Cambio en categorías:', payload.eventType);
            await this.handleRemoteChange('categories', payload);
        });

        // Subscribe to users
        this.channels.users = SupabaseDB.subscribeToUsers(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('👤 Cambio en usuarios:', payload.eventType);
            await this.handleRemoteChange('users', payload);
        });

        // Subscribe to orders
        this.channels.orders = SupabaseDB.subscribeToOrders(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('🧾 Cambio en pedidos:', payload.eventType);
            await this.handleRemoteChange('sales', payload);
        });

        // Subscribe to settings
        this.channels.settings = SupabaseDB.subscribeToSettings(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('⚙️ Cambio en configuración:', payload.eventType);
            await this.handleRemoteChange('settings', payload);
        });

        // Subscribe to inventory movements
        this.channels.movements = SupabaseDB.subscribeToInventoryMovements(async (payload) => {
            if (this._skipRemoteUpdates) return;
            console.log('📦 Cambio en movimientos:', payload.eventType);
            await this.handleRemoteChange('inventory_movements', payload);
        });

        console.log('📡 Suscripto a cambios en tiempo real (Firebase)');
    },

    async handleRemoteChange(entityType, payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (eventType) {
            case 'INSERT':
            case 'UPDATE':
                if (newRecord) {
                    const localItem = this.cloudToLocal(entityType, newRecord);
                    await DB.put(entityType, localItem);
                }
                break;

            case 'DELETE':
                if (oldRecord) {
                    await DB.delete(entityType, oldRecord.id);
                }
                break;
        }

        this.refreshUI(entityType);
    },

    refreshUI(entityType) {
        switch (entityType) {
            case 'products':
                if (typeof Products !== 'undefined') Products.loadProducts();
                if (typeof POS !== 'undefined') POS.loadProducts();
                if (typeof Inventory !== 'undefined') Inventory.loadStockList();
                break;
            case 'categories':
                if (typeof Categories !== 'undefined') Categories.loadCategories();
                if (typeof POS !== 'undefined') POS.loadProducts();
                break;
            case 'users':
                if (typeof Users !== 'undefined') Users.loadUsers();
                break;
            case 'sales':
                if (typeof Sales !== 'undefined') Sales.loadSales();
                break;
            case 'settings':
                if (typeof Settings !== 'undefined') Settings.loadSettings();
                break;
            case 'inventory_movements':
                // Refresh inventory and stats
                if (typeof Inventory !== 'undefined') {
                    Inventory.loadAll();
                    // Verify if this is enough. Usually loadAll loads products and movements.
                }
                break;
        }
    },

    // =====================================================
    // PUSH TO CLOUD - Save local changes to Firebase
    // =====================================================
    async pushToCloud(entityType, action, data) {
        if (!this.isSupabaseReady() || !this.isOnline) {
            this.retryQueue.push({ entityType, action, data, timestamp: Date.now() });
            console.log('📋 Cambio guardado para sincronizar después');
            return false;
        }

        try {
            // Skip processing our own remote changes while pushing
            this._skipRemoteUpdates = true;

            const cloudData = this.localToCloud(entityType, data);

            switch (entityType) {
                case 'products':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteProduct(data.id);
                    } else {
                        // Firestore set with merge = upsert
                        await SupabaseDB.createProduct(cloudData);
                    }
                    break;

                case 'categories':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteCategory(data.id);
                    } else {
                        await SupabaseDB.createCategory(cloudData);
                    }
                    break;

                case 'users':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteUser(data.id);
                    } else {
                        await SupabaseDB.createUser(cloudData);
                    }
                    break;

                case 'sales':
                    if (action === 'DELETE') {
                        // Orders typically aren't deleted
                    } else {
                        const orderData = cloudData.order;
                        const orderItems = cloudData.items;
                        await SupabaseDB.createOrder(orderData, orderItems);
                    }
                    break;

                case 'settings':
                    await SupabaseDB.updateSettings(cloudData);
                    break;

                case 'inventory_movements':
                    // Append-only history
                    if (action === 'DELETE') {
                        // Not commonly used, but for cleanup
                    } else {
                        await SupabaseDB.createInventoryMovement(cloudData);
                    }
                    break;
            }

            // Re-enable remote updates after a short delay
            setTimeout(() => { this._skipRemoteUpdates = false; }, 1000);

            console.log(`☁️ ${entityType} sincronizado con Firebase`);
            return true;

        } catch (error) {
            this._skipRemoteUpdates = false;
            console.error(`Error sincronizando ${entityType}:`, error);
            this.retryQueue.push({ entityType, action, data, timestamp: Date.now() });
            return false;
        }
    },

    async processRetryQueue() {
        if (this.retryQueue.length === 0) return;

        console.log(`🔄 Procesando ${this.retryQueue.length} cambios pendientes...`);

        const queue = [...this.retryQueue];
        this.retryQueue = [];

        for (const item of queue) {
            await this.pushToCloud(item.entityType, item.action, item.data);
        }
    },

    // =====================================================
    // DATA TRANSFORMATION
    // =====================================================
    cloudToLocal(entityType, cloudData) {
        switch (entityType) {
            case 'products':
                return {
                    id: cloudData.id,
                    name: cloudData.name,
                    price: cloudData.price,
                    cost: cloudData.cost || 0,
                    category: cloudData.category_id || cloudData.category,
                    stock: cloudData.stock,
                    barcode: cloudData.barcode,
                    image: cloudData.image,
                    is_active: cloudData.active !== false && cloudData.is_active !== false,
                    tax_rate: 0.19,
                    sync_status: 'SYNCED',
                    created_at: cloudData.created_at,
                    updated_at: cloudData.updated_at || cloudData.created_at
                };

            case 'categories':
                return {
                    id: cloudData.id,
                    name: cloudData.name,
                    color: cloudData.color || '#FF6B35',
                    icon: cloudData.icon || '📦',
                    image: cloudData.image,
                    parent_id: cloudData.parent_id,
                    created_at: cloudData.created_at
                };

            case 'users':
                return {
                    id: cloudData.id,
                    name: cloudData.name,
                    pin: cloudData.pin,
                    role: cloudData.role || 'cashier',
                    is_active: cloudData.active !== false,
                    created_at: cloudData.created_at
                };

            case 'sales':
                return {
                    id: cloudData.id,
                    order_number: cloudData.folio,
                    timestamp: cloudData.created_at,
                    total: cloudData.total,
                    subtotal: cloudData.subtotal,
                    tax: cloudData.tax,
                    payment_method: cloudData.payment_method,
                    customer_id: cloudData.customer_id,
                    cashier_id: cloudData.user_id,
                    device_id: 'cloud',
                    items: (cloudData.items || cloudData.order_items || []).map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name || item.name || item.products?.name || 'Producto',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        subtotal: item.total || item.subtotal,
                        modifiers: item.modifiers || []
                    })),
                    comments: cloudData.notes || cloudData.comments || '',
                    status: cloudData.status,
                    sync_status: 'SYNCED',
                    created_at_local: cloudData.created_at
                };

            case 'inventory_movements':
                return {
                    id: cloudData.id,
                    product_id: cloudData.product_id,
                    movement_type: cloudData.movement_type,
                    quantity_change: cloudData.quantity_change,
                    previous_stock: cloudData.previous_stock,
                    new_stock: cloudData.new_stock,
                    reason: cloudData.reason,
                    user_id: cloudData.user_id,
                    timestamp: cloudData.timestamp || cloudData.created_at,
                    sync_status: 'SYNCED'
                };

            default:
                return cloudData;
        }
    },

    localToCloud(entityType, localData) {
        switch (entityType) {
            case 'products':
                return {
                    id: localData.id,
                    name: localData.name,
                    price: localData.price,
                    cost: localData.cost || 0,
                    category_id: localData.category || null,
                    stock: localData.stock,
                    barcode: localData.barcode || null,
                    image: localData.image || null,
                    active: localData.is_active !== false
                };

            case 'categories':
                return {
                    id: localData.id,
                    name: localData.name,
                    color: localData.color || '#FF6B35',
                    icon: localData.icon || '📦',
                    image: localData.image || null,
                    parent_id: localData.parent_id || null
                };

            case 'users':
                return {
                    id: localData.id,
                    name: localData.name,
                    pin: localData.pin,
                    role: localData.role || 'cashier',
                    active: localData.is_active !== false
                };

            case 'sales':
                // Flat structure is better for Firestore unless we really need relational
                // But for now let's keep the structure flexible but ensure fields exist
                return {
                    id: localData.id,
                    folio: localData.order_number,
                    user_id: localData.cashier_id,
                    customer_id: localData.customer_id,
                    total: localData.total,
                    subtotal: localData.subtotal,
                    tax: localData.tax,
                    payment_method: localData.payment_method,
                    status: localData.status || 'completed',
                    notes: localData.comments || null,
                    created_at: localData.timestamp,
                    // Store items directly
                    items: (localData.items || []).map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        subtotal: item.subtotal, // match local property
                        total: item.subtotal, // alias for backend
                        notes: null,
                        modifiers: item.modifiers || []
                    }))
                };

            default:
                return localData;
        }
    },

    // =====================================================
    // CLEANUP
    // =====================================================
    unsubscribeAll() {
        Object.values(this.channels).forEach(unsubFn => {
            if (typeof unsubFn === 'function') {
                unsubFn(); // Firebase onSnapshot returns an unsubscribe function
            }
        });
        this.channels = {};
    }
};

// Make globally available
window.Sync = Sync;
