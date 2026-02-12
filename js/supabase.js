/* =====================================================
   FIREBASE FIRESTORE - POS App Multi-Dispositivo
   Reemplaza Supabase con Firebase Firestore
   ===================================================== */

const SupabaseDB = {
    db: null,

    init() {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            this.db = firebase.firestore();
            // Enable offline persistence for better offline support
            this.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
                console.warn('Firestore persistence error:', err.code);
            });
            console.log('✅ Firebase Firestore conectado');
            return true;
        } else {
            console.error('❌ Firebase no inicializado');
            return false;
        }
    },

    getClient() {
        return this.db;
    },

    // =====================================================
    // USERS / AUTHENTICATION
    // =====================================================
    async getUsers() {
        const snapshot = await this.db.collection('users').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getUserByPin(pin) {
        const snapshot = await this.db.collection('users')
            .where('pin', '==', pin)
            .where('active', '==', true)
            .limit(1)
            .get();
        return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    },

    async createUser(user) {
        const id = user.id || this.db.collection('users').doc().id;
        const data = { ...user, id, created_at: user.created_at || new Date().toISOString() };
        await this.db.collection('users').doc(id).set(data, { merge: true });
        return data;
    },

    async updateUser(id, updates) {
        await this.db.collection('users').doc(id).set(updates, { merge: true });
        const doc = await this.db.collection('users').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : updates;
    },

    async deleteUser(id) {
        await this.db.collection('users').doc(id).delete();
    },

    // =====================================================
    // CATEGORIES
    // =====================================================
    async getCategories() {
        const snapshot = await this.db.collection('categories').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async createCategory(category) {
        const id = category.id || this.db.collection('categories').doc().id;
        const data = { ...category, id, created_at: category.created_at || new Date().toISOString() };
        await this.db.collection('categories').doc(id).set(data, { merge: true });
        return data;
    },

    async updateCategory(id, updates) {
        await this.db.collection('categories').doc(id).set(updates, { merge: true });
        const doc = await this.db.collection('categories').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : updates;
    },

    async deleteCategory(id) {
        await this.db.collection('categories').doc(id).delete();
    },

    // =====================================================
    // PRODUCTS
    // =====================================================
    async getProducts() {
        const snapshot = await this.db.collection('products').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getProductsByCategory(categoryId) {
        const snapshot = await this.db.collection('products')
            .where('category_id', '==', categoryId)
            .orderBy('name')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async createProduct(product) {
        const id = product.id || this.db.collection('products').doc().id;
        const data = { ...product, id, created_at: product.created_at || new Date().toISOString() };
        await this.db.collection('products').doc(id).set(data, { merge: true });
        return data;
    },

    async updateProduct(id, updates) {
        await this.db.collection('products').doc(id).set(updates, { merge: true });
        const doc = await this.db.collection('products').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : updates;
    },

    async deleteProduct(id) {
        await this.db.collection('products').doc(id).delete();
    },

    async updateStock(id, quantity) {
        await this.db.collection('products').doc(id).update({
            stock: firebase.firestore.FieldValue.increment(quantity)
        });
    },

    // =====================================================
    // ORDERS (VENTAS)
    // =====================================================
    async getOrders(dateFrom = null, dateTo = null) {
        let query = this.db.collection('orders').orderBy('created_at', 'desc');

        if (dateFrom) {
            query = query.where('created_at', '>=', dateFrom);
        }
        if (dateTo) {
            query = query.where('created_at', '<=', dateTo);
        }

        const snapshot = await query.limit(200).get();
        const orders = [];

        for (const doc of snapshot.docs) {
            const order = { id: doc.id, ...doc.data() };
            const itemsSnap = await this.db.collection('orders').doc(doc.id)
                .collection('items').get();
            order.order_items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            orders.push(order);
        }
        return orders;
    },

    async getTodayOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return this.getOrders(today.toISOString(), tomorrow.toISOString());
    },

    async getPendingOrders() {
        const snapshot = await this.db.collection('orders')
            .where('status', 'in', ['pending', 'preparing'])
            .orderBy('created_at', 'asc')
            .get();

        const orders = [];
        for (const doc of snapshot.docs) {
            const order = { id: doc.id, ...doc.data() };
            const itemsSnap = await this.db.collection('orders').doc(doc.id)
                .collection('items').get();
            order.order_items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            orders.push(order);
        }
        return orders;
    },

    async createOrder(order, items) {
        const id = order.id || this.db.collection('orders').doc().id;
        const orderData = { ...order, id, created_at: order.created_at || new Date().toISOString() };
        await this.db.collection('orders').doc(id).set(orderData, { merge: true });

        if (items && items.length > 0) {
            const batch = this.db.batch();
            items.forEach(item => {
                const itemRef = this.db.collection('orders').doc(id).collection('items').doc();
                batch.set(itemRef, {
                    order_id: id,
                    product_id: item.product_id,
                    product_name: item.product_name || 'Producto',
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total: item.total,
                    notes: item.notes || null
                });
            });
            await batch.commit();
        }
        return orderData;
    },

    async updateOrderStatus(id, status) {
        const updates = { status };
        if (status === 'ready') updates.ready_at = new Date().toISOString();
        if (status === 'completed') updates.completed_at = new Date().toISOString();

        await this.db.collection('orders').doc(id).update(updates);
        const doc = await this.db.collection('orders').doc(id).get();
        return { id: doc.id, ...doc.data() };
    },

    async deleteAllOrders() {
        // Batch delete (limit 500 per batch)
        const snapshot = await this.db.collection('orders').limit(500).get();
        const batch = this.db.batch();
        let count = 0;

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            // If there were 500, there might be more. Recurse?
            if (count === 500) await this.deleteAllOrders();
        }
        return count;
    },

    // =====================================================
    // REAL-TIME SUBSCRIPTIONS (Firestore onSnapshot)
    // =====================================================
    subscribeToOrders(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('orders')
            .orderBy('created_at', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    console.log('🧾 Orders: initial snapshot loaded (' + snapshot.size + ' docs)');
                    return; // Skip initial snapshot
                }
                snapshot.docChanges().forEach(change => {
                    if (change.doc.metadata.hasPendingWrites) return; // Skip local writes
                    const data = { id: change.doc.id, ...change.doc.data() };
                    callback({
                        eventType: change.type === 'added' ? 'INSERT' :
                            change.type === 'modified' ? 'UPDATE' : 'DELETE',
                        new: change.type !== 'removed' ? data : null,
                        old: change.type === 'removed' ? data : null
                    });
                });
            });
        return unsub;
    },

    subscribeToProducts(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('products')
            .onSnapshot(snapshot => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    console.log('📦 Products: initial snapshot loaded (' + snapshot.size + ' docs)');
                    return; // Skip initial snapshot
                }
                snapshot.docChanges().forEach(change => {
                    if (change.doc.metadata.hasPendingWrites) return; // Skip local writes
                    const data = { id: change.doc.id, ...change.doc.data() };
                    callback({
                        eventType: change.type === 'added' ? 'INSERT' :
                            change.type === 'modified' ? 'UPDATE' : 'DELETE',
                        new: change.type !== 'removed' ? data : null,
                        old: change.type === 'removed' ? data : null
                    });
                });
            });
        return unsub;
    },

    subscribeToCategories(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('categories')
            .onSnapshot(snapshot => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    console.log('📁 Categories: initial snapshot loaded (' + snapshot.size + ' docs)');
                    return; // Skip initial snapshot
                }
                snapshot.docChanges().forEach(change => {
                    if (change.doc.metadata.hasPendingWrites) return;
                    const data = { id: change.doc.id, ...change.doc.data() };
                    callback({
                        eventType: change.type === 'added' ? 'INSERT' :
                            change.type === 'modified' ? 'UPDATE' : 'DELETE',
                        new: change.type !== 'removed' ? data : null,
                        old: change.type === 'removed' ? data : null
                    });
                });
            });
        return unsub;
    },

    subscribeToUsers(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('users')
            .onSnapshot(snapshot => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    console.log('👤 Users: initial snapshot loaded (' + snapshot.size + ' docs)');
                    return;
                }
                snapshot.docChanges().forEach(change => {
                    if (change.doc.metadata.hasPendingWrites) return;
                    const data = { id: change.doc.id, ...change.doc.data() };
                    callback({
                        eventType: change.type === 'added' ? 'INSERT' :
                            change.type === 'modified' ? 'UPDATE' : 'DELETE',
                        new: change.type !== 'removed' ? data : null,
                        old: change.type === 'removed' ? data : null
                    });
                });
            });
        return unsub;
    },

    unsubscribe(unsubscribeFn) {
        if (typeof unsubscribeFn === 'function') {
            unsubscribeFn();
        }
    },

    // =====================================================
    // INVENTORY MOVEMENTS - Sync history
    // =====================================================
    async getInventoryMovements() {
        const snapshot = await this.db.collection('inventory_movements')
            .orderBy('timestamp', 'desc')
            .limit(500)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async createInventoryMovement(movement) {
        const id = movement.id || this.db.collection('inventory_movements').doc().id;
        const data = { ...movement, id, created_at: movement.timestamp || new Date().toISOString() };
        await this.db.collection('inventory_movements').doc(id).set(data);
        return data;
    },

    async deleteAllInventoryMovements() {
        const snapshot = await this.db.collection('inventory_movements').limit(500).get();
        const batch = this.db.batch();
        let count = 0;

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            if (count === 500) await this.deleteAllInventoryMovements();
        }
        return count;
    },

    subscribeToInventoryMovements(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('inventory_movements')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    return;
                }
                snapshot.docChanges().forEach(change => {
                    if (change.doc.metadata.hasPendingWrites) return;
                    const data = { id: change.doc.id, ...change.doc.data() };
                    callback({
                        eventType: change.type === 'added' ? 'INSERT' :
                            change.type === 'modified' ? 'UPDATE' : 'DELETE',
                        new: change.type !== 'removed' ? data : null,
                        old: change.type === 'removed' ? data : null
                    });
                });
            });
        return unsub;
    },

    // =====================================================
    // GLOBAL SETTINGS
    // =====================================================
    async getSettings() {
        const doc = await this.db.collection('settings').doc('global').get();
        return doc.exists ? doc.data()?.value || doc.data() : null;
    },

    async updateSettings(settings) {
        await this.db.collection('settings').doc('global').set({
            key: 'global',
            value: settings,
            updated_at: new Date().toISOString()
        }, { merge: true });
        return settings;
    },

    subscribeToSettings(callback) {
        let isInitialLoad = true;
        const unsub = this.db.collection('settings').doc('global')
            .onSnapshot(doc => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    return;
                }
                if (doc.exists && !doc.metadata.hasPendingWrites) {
                    callback({
                        eventType: 'UPDATE',
                        new: { id: doc.id, ...doc.data() },
                        old: null
                    });
                }
            });
        return unsub;
    },

    // =====================================================
    // MIGRATION FROM LOCALSTORAGE
    // =====================================================
    async migrateFromLocalStorage() {
        console.log('🔄 Iniciando migración desde localStorage...');

        try {
            const localCategories = JSON.parse(localStorage.getItem('pos_categories') || '[]');
            if (localCategories.length > 0) {
                console.log(`📁 Migrando ${localCategories.length} categorías...`);
                for (const cat of localCategories) {
                    await this.createCategory({
                        name: cat.name,
                        color: cat.color || '#FF6B35',
                        icon: cat.icon || '📦',
                        image: cat.image || null,
                        parent_id: null
                    }).catch(e => console.log('Categoría ya existe:', cat.name));
                }
            }

            const localProducts = JSON.parse(localStorage.getItem('pos_products') || '[]');
            if (localProducts.length > 0) {
                console.log(`📦 Migrando ${localProducts.length} productos...`);
                const categories = await this.getCategories();
                const catMap = {};
                categories.forEach(c => catMap[c.name.toLowerCase()] = c.id);

                for (const prod of localProducts) {
                    const categoryId = prod.categoryId ?
                        catMap[prod.categoryId.toLowerCase()] || null : null;

                    await this.createProduct({
                        name: prod.name,
                        price: prod.price,
                        cost: prod.cost || 0,
                        stock: prod.stock ?? null,
                        category_id: categoryId,
                        image: prod.image || null,
                        barcode: prod.barcode || null,
                        active: prod.active !== false
                    }).catch(e => console.log('Producto ya existe:', prod.name));
                }
            }

            const localUsers = JSON.parse(localStorage.getItem('pos_users') || '[]');
            if (localUsers.length > 0) {
                console.log(`👤 Migrando ${localUsers.length} usuarios...`);
                for (const user of localUsers) {
                    await this.createUser({
                        name: user.name,
                        pin: user.pin,
                        role: user.role || 'cashier',
                        active: user.active !== false
                    }).catch(e => console.log('Usuario ya existe:', user.name));
                }
            }

            console.log('✅ Migración completada!');
            return true;
        } catch (error) {
            console.error('❌ Error en migración:', error);
            return false;
        }
    },

    async hasCloudData() {
        const snapshot = await this.db.collection('products').limit(1).get();
        return !snapshot.empty;
    }
};

// Make globally available
window.SupabaseDB = SupabaseDB;
