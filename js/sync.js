/* =====================================================
   POS APP - SYNC MODULE
   Sincronización bidireccional con Supabase
   ===================================================== */

const Sync = {
    isOnline: navigator.onLine,
    channels: {},
    retryQueue: [],

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
            // Full sync when coming back online
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
        if (!statusEl) return;

        const icon = statusEl.querySelector('.sync-icon');
        const text = statusEl.querySelector('.sync-text');

        if (status === 'syncing') {
            icon.textContent = '🔄';
            text.textContent = 'Sincronizando...';
        } else if (!this.isOnline) {
            icon.textContent = '🔴';
            text.textContent = 'Sin conexión';
        } else if (this.isSupabaseReady()) {
            icon.textContent = '🟢';
            text.textContent = 'Sincronizado';
        } else {
            icon.textContent = '🟡';
            text.textContent = 'Solo local';
        }
    },

    // =====================================================
    // INITIAL SYNC - Pull data from cloud on startup
    // =====================================================
    async initialSync() {
        if (!this.isSupabaseReady()) return;

        console.log('🔄 Sincronizando con la nube...');
        this.updateStatusIndicator('syncing');

        try {
            // Sync products
            await this.pullFromCloud('products');

            // Sync categories
            await this.pullFromCloud('categories');

            // Sync users
            await this.pullFromCloud('users');

            // Sync orders/sales
            await this.pullFromCloud('sales');

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
                    // Pull today's orders from Supabase
                    cloudData = await SupabaseDB.getTodayOrders();
                    break;
                case 'settings':
                    const settings = await SupabaseDB.getSettings();
                    if (settings) cloudData = [settings];
                    break;
            }

            // Transform cloud data to local format and save
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
    // REAL-TIME SUBSCRIPTIONS
    // =====================================================
    subscribeToChanges() {
        if (!this.isSupabaseReady()) return;

        // Subscribe to products changes
        this.channels.products = SupabaseDB.subscribeToProducts(async (payload) => {
            console.log('📦 Cambio en productos:', payload.eventType);
            await this.handleRemoteChange('products', payload);
        });

        // Subscribe to categories
        if (typeof SupabaseDB.subscribeToCategories === 'function') {
            this.channels.categories = SupabaseDB.subscribeToCategories(async (payload) => {
                console.log('📁 Cambio en categorías:', payload.eventType);
                await this.handleRemoteChange('categories', payload);
            });
        }

        // Subscribe to users
        if (typeof SupabaseDB.subscribeToUsers === 'function') {
            this.channels.users = SupabaseDB.subscribeToUsers(async (payload) => {
                console.log('👤 Cambio en usuarios:', payload.eventType);
                await this.handleRemoteChange('users', payload);
            });
        }

        // Subscribe to orders
        this.channels.orders = SupabaseDB.subscribeToOrders(async (payload) => {
            console.log('🧾 Cambio en pedidos:', payload.eventType);
            await this.handleRemoteChange('sales', payload);
        });

        // Subscribe to settings
        if (typeof SupabaseDB.subscribeToSettings === 'function') {
            this.channels.settings = SupabaseDB.subscribeToSettings(async (payload) => {
                console.log('⚙️ Cambio en configuración:', payload.eventType);
                await this.handleRemoteChange('settings', payload);
            });
        }

        console.log('📡 Suscripto a cambios en tiempo real');
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

        // Refresh UI based on entity type
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
        }
    },

    // =====================================================
    // PUSH TO CLOUD - Save local changes to Supabase
    // =====================================================
    async pushToCloud(entityType, action, data) {
        if (!this.isSupabaseReady() || !this.isOnline) {
            // Queue for later sync
            this.retryQueue.push({ entityType, action, data, timestamp: Date.now() });
            console.log('📋 Cambio guardado para sincronizar después');
            return false;
        }

        try {
            const cloudData = this.localToCloud(entityType, data);

            switch (entityType) {
                case 'products':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteProduct(data.id);
                    } else {
                        // Upsert: try update, if fails try create
                        try {
                            await SupabaseDB.updateProduct(data.id, cloudData);
                        } catch (e) {
                            await SupabaseDB.createProduct(cloudData);
                        }
                    }
                    break;

                case 'categories':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteCategory(data.id);
                    } else {
                        try {
                            await SupabaseDB.updateCategory(data.id, cloudData);
                        } catch (e) {
                            await SupabaseDB.createCategory(cloudData);
                        }
                    }
                    break;

                case 'users':
                    if (action === 'DELETE') {
                        await SupabaseDB.deleteUser(data.id);
                    } else {
                        try {
                            await SupabaseDB.updateUser(data.id, cloudData);
                        } catch (e) {
                            await SupabaseDB.createUser(cloudData);
                        }
                    }
                    break;

                case 'sales':
                    if (action === 'DELETE') {
                        // Orders typically aren't deleted, but if needed:
                        // await SupabaseDB.deleteOrder(data.id);
                    } else {
                        // Create order with items
                        const orderData = cloudData.order;
                        const orderItems = cloudData.items;
                        await SupabaseDB.createOrder(orderData, orderItems);
                    }
                    break;

                case 'settings':
                    await SupabaseDB.updateSettings(cloudData);
                    break;
            }

            console.log(`☁️ ${entityType} sincronizado con la nube`);
            return true;

        } catch (error) {
            console.error(`Error sincronizando ${entityType}:`, error);
            // Queue for retry
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
            const success = await this.pushToCloud(item.entityType, item.action, item.data);
            if (!success) {
                // Will be re-added to queue by pushToCloud
            }
        }
    },

    // =====================================================
    // DATA TRANSFORMATION
    // =====================================================
    cloudToLocal(entityType, cloudData) {
        // Transform Supabase format to local format
        switch (entityType) {
            case 'products':
                return {
                    id: cloudData.id,
                    name: cloudData.name,
                    price: cloudData.price,
                    cost: cloudData.cost || 0,
                    category: cloudData.category_id,
                    stock: cloudData.stock,
                    barcode: cloudData.barcode,
                    image: cloudData.image,
                    is_active: cloudData.active !== false,
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
                // Transform Supabase order to local sale format
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
                    items: (cloudData.order_items || []).map(item => ({
                        product_id: item.product_id,
                        product_name: item.products?.name || 'Producto',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        subtotal: item.total,
                        modifiers: []
                    })),
                    comments: cloudData.notes || '',
                    status: cloudData.status,
                    sync_status: 'SYNCED',
                    created_at_local: cloudData.created_at
                };

            default:
                return cloudData;
        }
    },

    localToCloud(entityType, localData) {
        // Transform local format to Supabase format
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
                // Transform local sale to Supabase order format
                return {
                    order: {
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
                        created_at: localData.timestamp
                    },
                    items: (localData.items || []).map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.subtotal,
                        notes: null
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
        Object.values(this.channels).forEach(channel => {
            SupabaseDB.unsubscribe(channel);
        });
        this.channels = {};
    }
};

// Make globally available
window.Sync = Sync;
