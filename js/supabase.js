// =====================================================
// SUPABASE CLIENT - POS App Multi-Dispositivo
// =====================================================

const SUPABASE_URL = 'https://bmnlzxwpeyavfnzvcthd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbmx6eHdwZXlhdmZuenZjdGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjU5MTcsImV4cCI6MjA4MTc0MTkxN30.xBOkAWOIYXtG_u4vDOxHEdOCAliNfQj9qjYDLsRHXT0';

// Supabase client instance
let supabaseClient = null;

// Initialize Supabase
const SupabaseDB = {
    // Initialize the Supabase client
    init() {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase conectado');
            return true;
        } else {
            console.error('❌ Supabase SDK no cargado');
            return false;
        }
    },

    // Get client
    getClient() {
        return supabaseClient;
    },

    // =====================================================
    // USERS / AUTHENTICATION
    // =====================================================
    async getUsers() {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getUserByPin(pin) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('pin', pin)
            .eq('active', true)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createUser(user) {
        const { data, error } = await supabaseClient
            .from('users')
            .insert([user])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateUser(id, updates) {
        const { data, error } = await supabaseClient
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteUser(id) {
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // =====================================================
    // CATEGORIES
    // =====================================================
    async getCategories() {
        const { data, error } = await supabaseClient
            .from('categories')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async createCategory(category) {
        const { data, error } = await supabaseClient
            .from('categories')
            .insert([category])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateCategory(id, updates) {
        const { data, error } = await supabaseClient
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteCategory(id) {
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // =====================================================
    // PRODUCTS
    // =====================================================
    async getProducts() {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*, categories(name, color, icon)')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getProductsByCategory(categoryId) {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*, categories(name, color, icon)')
            .eq('category_id', categoryId)
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async createProduct(product) {
        const { data, error } = await supabaseClient
            .from('products')
            .insert([product])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateProduct(id, updates) {
        const { data, error } = await supabaseClient
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteProduct(id) {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async updateStock(id, quantity) {
        const { data, error } = await supabaseClient
            .rpc('update_stock', { product_id: id, qty: quantity });
        if (error) throw error;
        return data;
    },

    // =====================================================
    // ORDERS (VENTAS)
    // =====================================================
    async getOrders(dateFrom = null, dateTo = null) {
        let query = supabaseClient
            .from('orders')
            .select('*, order_items(*, products(name)), users(name)')
            .order('created_at', { ascending: false });

        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getTodayOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.getOrders(today.toISOString(), tomorrow.toISOString());
    },

    async getPendingOrders() {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*, order_items(*, products(name)), users(name)')
            .in('status', ['pending', 'preparing'])
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async createOrder(order, items) {
        // Create the order
        const { data: orderData, error: orderError } = await supabaseClient
            .from('orders')
            .insert([order])
            .select()
            .single();
        if (orderError) throw orderError;

        // Add order items
        const orderItems = items.map(item => ({
            order_id: orderData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            notes: item.notes || null
        }));

        const { error: itemsError } = await supabaseClient
            .from('order_items')
            .insert(orderItems);
        if (itemsError) throw itemsError;

        return orderData;
    },

    async updateOrderStatus(id, status) {
        const updates = { status };
        if (status === 'ready') {
            updates.ready_at = new Date().toISOString();
        } else if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
        }

        const { data, error } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // =====================================================
    // REAL-TIME SUBSCRIPTIONS
    // =====================================================
    subscribeToOrders(callback) {
        return supabaseClient
            .channel('orders-channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                console.log('📦 Order change:', payload);
                callback(payload);
            })
            .subscribe();
    },

    subscribeToProducts(callback) {
        return supabaseClient
            .channel('products-channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products'
            }, (payload) => {
                console.log('🛒 Product change:', payload);
                callback(payload);
            })
            .subscribe();
    },

    subscribeToCategories(callback) {
        return supabaseClient
            .channel('categories-channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'categories'
            }, (payload) => {
                console.log('📁 Category change:', payload);
                callback(payload);
            })
            .subscribe();
    },

    subscribeToUsers(callback) {
        return supabaseClient
            .channel('users-channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'users'
            }, (payload) => {
                console.log('👤 User change:', payload);
                callback(payload);
            })
            .subscribe();
    },

    unsubscribe(channel) {
        if (channel) {
            supabaseClient.removeChannel(channel);
        }
    },

    // =====================================================
    // MIGRATION FROM LOCALSTORAGE
    // =====================================================
    async migrateFromLocalStorage() {
        console.log('🔄 Iniciando migración desde localStorage...');

        try {
            // Migrate categories
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

            // Migrate products
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

            // Migrate users
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

    // Check if cloud has data
    async hasCloudData() {
        const { count } = await supabaseClient
            .from('products')
            .select('*', { count: 'exact', head: true });
        return count > 0;
    }
};

// Make globally available
window.SupabaseDB = SupabaseDB;
