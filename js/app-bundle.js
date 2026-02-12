// js/app.js
// Aplicación Principal - Inicialización y Coordinación

const App = {
    async init() {
        try {
            console.log('🚀 Iniciando Chic321 POS...');

            // 1. Inicializar Firebase
            if (window.FirebaseConfig && window.FirebaseConfig.init) {
                await window.FirebaseConfig.init();
            } else {
                throw new Error('FirebaseConfig no encontrado');
            }

            // 2. Verificar Sesión
            await this.checkSession();

            // 3. Inicializar Servicios - START LISTENERS
            if (window.productsService) {
                window.productsService.startListening();
            }

            if (window.salesService) {
                window.salesService.startListening((sales) => {
                    // Auto-refresh Sales UI dashboard whenever sales data changes
                    if (typeof Sales !== 'undefined' && Sales.updateDashboardStats) {
                        const filtered = sales.filter(s => s.estado !== 'anulada');
                        Sales.allSales = filtered;
                        Sales.updateDashboardStats(filtered);
                    }
                    // Auto-refresh daily sales table if that section is visible
                    const dailySection = document.getElementById('daily-sales-section');
                    if (dailySection && dailySection.classList.contains('active') && typeof Sales !== 'undefined') {
                        Sales.openDailyTransactions();
                    }
                });
            }

            if (window.categoriesService) {
                await window.categoriesService.init();
            }

            // Re-render POS when products or categories change (they load async from Firebase)
            if (window.productsService) {
                window.productsService.addListener(() => {
                    if (window.posScreen) window.posScreen.renderProducts();
                });
            }

            // Initialize legacy modules
            if (typeof Inventory !== 'undefined') {
                await Inventory.init();
            }
            if (typeof Settings !== 'undefined') {
                await Settings.init();
            }
            if (typeof Customers !== 'undefined') {
                await Customers.init();
            }
            if (typeof Sales !== 'undefined' && Sales.loadSalesHistory) {
                await Sales.loadSalesHistory();
            }
            if (typeof CatalogUI !== 'undefined') {
                CatalogUI.init();
            }

            if (window.posScreen) {
                window.posScreen.init();
            }

            // 4. Configurar Navegación
            this.setupNavigation();
            this.setupModals();

            // Service Worker is registered in index.html, no need to register here


            // Ocultar Splash
            document.getElementById('splash-screen')?.classList.add('hidden');

        } catch (error) {
            console.error('❌ Error fatal en init:', error);
            alert('Error al iniciar la aplicación. Revise la consola.');
        }
    },

    // ========== SESIÓN ==========
    async checkSession() {
        const user = window.usersService?.getCurrentUser();

        if (user) {
            console.log('👤 Sesión activa:', user.nombre);
            this.updateUIForUser(user);
        } else {
            console.log('👤 Sin sesión, mostrando login');
            this.showLogin();
        }
    },

    updateUIForUser(user) {
        // Mostrar App
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');

        // Actualizar UI según rol
        const isAdmin = user.rol === 'admin';
        document.body.classList.toggle('is-admin', isAdmin);

        // Hide/Show Admin Only Items
        document.querySelectorAll('[data-admin-only="true"]').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
            if (!isAdmin) el.classList.remove('active');
        });

        // Nombre en UI si existe elemento
        const userNameEl = document.getElementById('current-user-name');
        if (userNameEl) userNameEl.textContent = user.nombre;
    },

    showLogin() {
        document.getElementById('app')?.classList.add('hidden');
        document.getElementById('login-screen')?.classList.remove('hidden');
        this.setupPinPad();
    },

    setupPinPad() {
        let pin = '';
        const dots = document.querySelectorAll('.pin-dot');
        const errorEl = document.querySelector('.login-error');

        const updateDots = () => {
            dots.forEach((dot, i) => {
                dot.classList.toggle('filled', i < pin.length);
            });
        };

        // Limpiar listeners anteriores para evitar duplicados (clonando)
        const padContainer = document.querySelector('.pin-pad');
        if (!padContainer) return;

        const newPad = padContainer.cloneNode(true);
        padContainer.parentNode.replaceChild(newPad, padContainer);

        newPad.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                errorEl?.classList.add('hidden');

                const digit = btn.dataset.digit;
                const action = btn.dataset.action;

                if (digit !== undefined) {
                    if (pin.length < 4) {
                        pin += digit;
                        updateDots();

                        if (pin.length === 4) {
                            // Intentar login
                            const result = await window.usersService.login(pin);
                            if (result.success) {
                                this.updateUIForUser(result.user);
                                window.Utils?.showToast(`Bienvenido ${result.user.nombre}`, 'success');
                            } else {
                                errorEl?.classList.remove('hidden');
                                pin = '';
                                updateDots();
                                // Vibrar si es móvil
                                if (navigator.vibrate) navigator.vibrate(200);
                            }
                        }
                    }
                } else if (action === 'clear') {
                    pin = '';
                    updateDots();
                } else if (action === 'back') {
                    pin = pin.slice(0, -1);
                    updateDots();
                }
            });
        });
    },

    logout() {
        window.usersService?.logout();
        this.showLogin();
    },

    // ========== NAVEGACIÓN ==========
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.dataset.section;
                this.navigateTo(sectionId);
            });
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    },

    navigateTo(sectionId) {
        // Validar permisos
        if (sectionId === 'users' || sectionId === 'inventory' || sectionId === 'settings') {
            if (!window.usersService?.isAdmin()) {
                window.Utils?.showToast('Acceso restringido a Administradores', 'error');
                return;
            }
        }

        // Actualizar Menú
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.toggle('active', nav.dataset.section === sectionId);
        });

        // Actualizar Secciones
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionId}-section`)?.classList.add('active');

        // Acciones específicas al entrar
        if (sectionId === 'daily-sales') {
            if (typeof Sales !== 'undefined' && Sales.openDailyTransactions) {
                Sales.openDailyTransactions();
            }
        }
        if (sectionId === 'sales-history') {
            if (typeof Sales !== 'undefined' && Sales.loadSalesHistory) {
                Sales.loadSalesHistory();
            }
        }
    },

    setupModals() {
        // Cerrar modales con botón X o cancelar
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = btn.closest('.modal');
                if (modal) modal.classList.remove('active');
            });
        });

        // Cerrar al hacer clic fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    }
};

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());
