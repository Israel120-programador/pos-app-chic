/* =====================================================
   POS APP - MAIN APPLICATION
   ===================================================== */

const App = {
    currentUser: null,
    currentSection: 'pos',

    async init() {
        try {
            // Initialize database
            await DB.init();

            // Initialize Supabase (if available)
            if (typeof SupabaseDB !== 'undefined') {
                const supabaseReady = SupabaseDB.init();
                if (supabaseReady) {
                    console.log('☁️ Supabase conectado - modo cloud');
                    // Check if we should migrate local data
                    const hasCloudData = await SupabaseDB.hasCloudData();
                    if (!hasCloudData) {
                        console.log('📤 Migrando datos locales a la nube...');
                        await SupabaseDB.migrateFromLocalStorage();
                    }
                }
            }

            // Register service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(() => { });
            }

            // Seed demo data if empty
            await this.seedDemoData();

            // Initialize all modules
            await Promise.all([
                POS.init(),
                Products.init(),
                Categories.init(),
                Inventory.init(),
                Sales.init(),
                Customers.init(),
                Users.init(),
                Settings.init()
            ]);

            // Initialize Sync module for real-time multi-device sync
            if (typeof Sync !== 'undefined') {
                await Sync.init();
            }

            // Setup navigation
            this.setupNavigation();
            this.setupModals();

            // Hide splash and check for saved session
            setTimeout(async () => {
                document.getElementById('splash-screen').classList.add('hidden');

                // Check for saved session
                const savedUser = localStorage.getItem('pos_current_user');
                if (savedUser) {
                    try {
                        this.currentUser = JSON.parse(savedUser);
                        // Validate user still exists and is active
                        const user = await this.validatePin(this.currentUser.pin);
                        if (user) {
                            this.currentUser = user;
                            this.updateNavVisibility();
                            document.getElementById('app').classList.remove('hidden');
                            Utils.showToast(`Bienvenido de vuelta, ${user.name}`, 'success');
                            return;
                        }
                    } catch (e) {
                        console.log('Auto-login failed:', e);
                    }
                }

                this.showLogin();
            }, 1000);

        } catch (error) {
            console.error('Init error:', error);
            Utils.showToast('Error al iniciar la aplicación', 'error');
        }
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.handleNavigationRequest(section);
            });
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    },

    handleNavigationRequest(section) {
        // Restricted sections
        const restricted = ['inventory-setup', 'sales-history', 'users', 'settings'];

        if (restricted.includes(section)) {
            // Check if current user is admin
            if (this.currentUser && this.currentUser.role === 'admin') {
                this.navigateTo(section);
            } else {
                // Request Admin Auth
                this.requestAdminAuth(() => {
                    this.navigateTo(section);
                });
            }
        } else {
            this.navigateTo(section);
        }
    },

    requestAdminAuth(onSuccess) {
        const modal = document.getElementById('admin-auth-modal');
        const errorMsg = document.getElementById('admin-auth-error');
        const dots = modal.querySelectorAll('.pin-dot');
        let pin = '';

        const updateDots = () => {
            dots.forEach((dot, i) => dot.classList.toggle('filled', i < pin.length));
        };

        // Clear previous state
        pin = '';
        updateDots();
        errorMsg.classList.add('hidden');
        modal.classList.add('active');

        // One-time event handler setup (simplified for this context, ideally debounced or managed better)
        // We need to avoid duplicate listeners. A clean way is to replace the pad node or use a unique handler.
        // For now, let's assume we can attach new listeners or use a global handler.
        // Better: Use a dedicated method that re-binds or checks state.

        const pad = document.getElementById('admin-auth-pad');
        const newPad = pad.cloneNode(true);
        pad.parentNode.replaceChild(newPad, pad);

        newPad.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                errorMsg.classList.add('hidden');
                if (btn.dataset.digit !== undefined) {
                    if (pin.length < 4) {
                        pin += btn.dataset.digit;
                        updateDots();
                        if (pin.length === 4) {
                            const admin = await this.validateAdminPin(pin);
                            if (admin) {
                                modal.classList.remove('active');
                                onSuccess();
                            } else {
                                errorMsg.classList.remove('hidden');
                                pin = '';
                                updateDots();
                            }
                        }
                    }
                } else if (btn.dataset.action === 'clear') {
                    pin = '';
                    updateDots();
                } else if (btn.dataset.action === 'back') {
                    pin = pin.slice(0, -1);
                    updateDots();
                }
            });
        });
    },

    async validateAdminPin(pin) {
        const users = await DB.getAll('users');
        return users.find(u => u.pin === pin && u.role === 'admin' && u.is_active);
    },

    updateNavVisibility() {
        const isAdmin = this.currentUser && this.currentUser.role === 'admin';
        const isKitchen = this.currentUser && this.currentUser.role === 'kitchen';
        const isCashier = this.currentUser && this.currentUser.role === 'cashier';

        // Show/hide admin-only nav items
        document.querySelectorAll('.nav-item[data-admin-only="true"]').forEach(item => {
            item.style.display = isAdmin ? '' : 'none';
        });

        // Show/hide kitchen-only nav items (none now)
        document.querySelectorAll('.nav-item[data-kitchen-only="true"]').forEach(item => {
            item.style.display = 'none';
        });
    },

    navigateTo(section) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `${section}-section`);
        });

        this.currentSection = section;

        // Refresh data when entering specific sections
        if (section === 'inventory-setup') {
            Products.loadProducts();
            Inventory.loadAll();
        } else if (section === 'sales-history') {
            Sales.loadSales();
            // Load stats that were moved here
            Inventory.loadTopProducts();
            Inventory.loadStockList();
        } else if (section === 'daily-sales') {
            Sales.loadDailySales();
        }
    },

    setupModals() {
        // Close modal buttons
        document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.dataset.modal || btn.closest('.modal')?.id;
                if (modalId) document.getElementById(modalId)?.classList.remove('active');
            });
        });

        // Close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        this.setupPinPad();
    },

    setupPinPad() {
        const dots = document.querySelectorAll('.pin-dot');
        const error = document.querySelector('.login-error');
        let pin = '';

        const updateDots = () => {
            dots.forEach((dot, i) => {
                dot.classList.toggle('filled', i < pin.length);
            });
        };

        document.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                error.classList.add('hidden');

                if (btn.dataset.digit !== undefined) {
                    if (pin.length < 4) {
                        pin += btn.dataset.digit;
                        updateDots();

                        if (pin.length === 4) {
                            const user = await this.validatePin(pin);
                            if (user) {
                                this.currentUser = user;
                                // Save session
                                localStorage.setItem('pos_current_user', JSON.stringify(user));
                                this.updateNavVisibility();
                                document.getElementById('login-screen').classList.add('hidden');
                                document.getElementById('app').classList.remove('hidden');
                                Utils.showToast(`Bienvenido, ${user.name}`, 'success');
                            } else {
                                error.classList.remove('hidden');
                                pin = '';
                                updateDots();
                            }
                        }
                    }
                } else if (btn.dataset.action === 'clear') {
                    pin = '';
                    updateDots();
                } else if (btn.dataset.action === 'back') {
                    pin = pin.slice(0, -1);
                    updateDots();
                }
            });
        });
    },

    async validatePin(pin) {
        // Try Supabase first
        if (typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient()) {
            try {
                const user = await SupabaseDB.getUserByPin(pin);
                if (user) {
                    return {
                        id: user.id,
                        name: user.name,
                        role: user.role,
                        pin: user.pin,
                        is_active: user.active
                    };
                }
            } catch (e) {
                console.log('Supabase auth fallback to local:', e);
            }
        }
        // Fallback to local DB
        const users = await DB.getAll('users');
        return users.find(u => u.pin === pin && u.is_active);
    },

    logout() {
        this.currentUser = null;
        // Clear saved session
        localStorage.removeItem('pos_current_user');
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
        Utils.showToast('Sesión cerrada', 'info');
    },

    async seedDemoData() {
        // Always ensure default admin exists with correct PIN (1234)
        // This fixes the issue where existing databases wouldn't update the PIN
        await DB.put('users', {
            id: 'user_admin',
            name: 'Administrador',
            role: 'admin',
            pin: '1234',
            is_active: true,
            created_at: Utils.now()
        });

        // Check if already seeded (for products/categories)
        const products = await DB.getAll('products');
        if (products.length > 0) return;

        // Demo categories
        const cats = [
            { id: 'cat_burgers', name: 'Hamburguesas', color: '#FF6B35', icon: '🍔' },
            { id: 'cat_drinks', name: 'Bebidas', color: '#4EC5F1', icon: '🥤' },
            { id: 'cat_sides', name: 'Acompañamientos', color: '#FFB800', icon: '🍟' },
            { id: 'cat_desserts', name: 'Postres', color: '#FF69B4', icon: '🍰' }
        ];
        for (const c of cats) {
            c.created_at = Utils.now();
            await DB.put('categories', c);
        }

        // Demo products
        const prods = [
            { name: 'Hamburguesa Clásica', price: 5990, cost: 2500, category: 'cat_burgers', stock: 50 },
            { name: 'Hamburguesa Doble', price: 7990, cost: 3500, category: 'cat_burgers', stock: 30 },
            { name: 'Hamburguesa BBQ', price: 6990, cost: 3000, category: 'cat_burgers', stock: 25 },
            { name: 'Coca-Cola 500ml', price: 1500, cost: 600, category: 'cat_drinks', stock: 100 },
            { name: 'Agua Mineral', price: 1000, cost: 300, category: 'cat_drinks', stock: 80 },
            { name: 'Jugo Natural', price: 2500, cost: 1000, category: 'cat_drinks', stock: 40 },
            { name: 'Papas Fritas', price: 2990, cost: 800, category: 'cat_sides', stock: 60 },
            { name: 'Aros de Cebolla', price: 3490, cost: 1000, category: 'cat_sides', stock: 45 },
            { name: 'Helado', price: 1990, cost: 600, category: 'cat_desserts', stock: 35 },
            { name: 'Brownie', price: 2490, cost: 800, category: 'cat_desserts', stock: 20 }
        ];
        for (const p of prods) {
            await DB.put('products', {
                id: 'prod_' + Utils.generateUUID(),
                ...p,
                tax_rate: 0.19,
                is_active: true,
                sync_status: 'SYNCED',
                created_at: Utils.now(),
                updated_at: Utils.now()
            });
        }

        // Default settings
        await DB.put('settings', {
            device_id: 'default',
            business_name: 'Mi Restaurante',
            rut: '76.123.456-7',
            address: 'Av. Principal 123',
            giro: 'Venta de alimentos',
            currency: 'CLP',
            tax_rate: 19,
            receipt_footer: '¡Gracias por su compra!',
            print_receipts: true,
            offline_mode: false
        });
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
