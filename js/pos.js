// js/pos.js
// Controlador de la pantalla de Punto de Venta (POS)

class POSScreen {
    constructor() {
        this.cart = [];
        this.currentCategory = 'all'; // 'all' o ID de categoría
        this.searchQuery = '';
    }

    // ========== INICIALIZACIÓN ==========
    init() {
        console.log('🚀 Iniciando POS Screen...');
        window.scrollTo(0, 0); // Force top scroll
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        this.bindEvents();

        // Render inicial (esperar a que lleguen datos de servicios)
        setTimeout(() => {
            this.renderProducts();
        }, 500);

        // Escuchar cambios en productos para actualizar stock en tiempo real
        if (window.productsService) {
            window.productsService.addListener(() => {
                this.renderProducts();
            });
        }
    }

    // ========== EVENT LISTENERS ==========
    bindEvents() {
        // Buscador
        document.getElementById('product-search')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.renderProducts();
        });

        // Grid de productos (Delegación)
        const grid = document.getElementById('pos-products-grid');
        grid?.addEventListener('click', (e) => {
            // Click en Categoría
            const categoryCard = e.target.closest('.category-folder');
            if (categoryCard) {
                const catId = categoryCard.dataset.categoryId;
                this.setCategory(catId);
                return;
            }

            // Click en "Atrás" (Categoría)
            const backCard = e.target.closest('.back-card');
            if (backCard) {
                this.setCategory('all');
                return;
            }

            // Click en Producto
            const productCard = e.target.closest('.product-card');
            if (productCard && !productCard.classList.contains('category-folder') && !productCard.classList.contains('back-card')) {
                const prodId = productCard.dataset.productId;
                if (!productCard.classList.contains('out-of-stock')) {
                    this.addToCart(prodId);
                } else {
                    window.Utils?.showToast('Producto sin stock', 'warning');
                }
            }
        });

        // Botones del Carrito
        document.getElementById('clear-cart')?.addEventListener('click', () => this.clearCart());
        document.getElementById('process-payment')?.addEventListener('click', () => this.openPaymentModal());

        // Modal de Pago
        document.querySelector('.payment-options')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.payment-option');
            if (btn) {
                this.selectPaymentMethod(btn.dataset.method);
            }
        });

        // Montos rápidos
        // Montos rápidos
        document.querySelector('.quick-amounts')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-amount')) {
                const amountData = e.target.dataset.amount;
                const input = document.getElementById('cash-received');

                if (amountData === 'exact') {
                    const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
                    input.value = total;
                } else {
                    input.value = parseInt(amountData);
                }
                this.updateChange();
            }
        });

        // Input Paga con
        document.getElementById('cash-received')?.addEventListener('input', () => this.updateChange());

        // Confirmar Pago
        document.getElementById('confirm-payment')?.addEventListener('click', () => this.processPayment());

        // Delegación Carrito (Botones + / -)
        document.getElementById('cart-items')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index);

            if (action === 'increase') this.updateItemQuantity(index, 1);
            if (action === 'decrease') this.updateItemQuantity(index, -1);
            // if (action === 'remove') this.removeFromCart(index); 
        });
    }

    setCategory(id) {
        this.currentCategory = id;
        this.renderProducts();
    }

    // ========== GESTIÓN DE PRODUCTOS ==========
    renderProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        grid.innerHTML = '';
        let products = window.productsService ? window.productsService.getProducts() : [];

        // 1. Si hay búsqueda, mostrar productos filtrados (sin carpetas)
        if (this.searchQuery) {
            products = products.filter(p => p.nombre.toLowerCase().includes(this.searchQuery));
            if (products.length === 0) {
                grid.innerHTML = `<div class="no-results">No se encontraron productos para "${this.searchQuery}"</div>`;
                return;
            }
            this.renderProductCards(grid, products);
            return;
        }

        // 2. Si es vista 'all', mostrar CARPETAS DE CATEGORÍAS
        if (this.currentCategory === 'all') {
            const categories = window.categoriesService?.categories || [];

            // Render "Sin Categoría" folder if there are loose products
            const looseProducts = products.filter(p => !p.categoriaId && !p.categoria);

            categories.forEach(cat => {
                const count = products.filter(p => p.categoriaId === cat.id || p.categoria === cat.nombre).length;
                grid.innerHTML += `
                    <div class="category-folder" data-category-id="${cat.id}" style="border-left: 5px solid ${cat.color || '#3498db'}">
                        <div class="folder-icon">${cat.icon || '📁'}</div>
                        <div class="folder-name">${cat.nombre}</div>
                        <div class="folder-count">${count} items</div>
                    </div>
                `;
            });

            // Optional: "All Products" or "Misc" folder
            if (looseProducts.length > 0) {
                grid.innerHTML += `
                    <div class="category-folder" data-category-id="uncategorized" style="border-left: 5px solid #95a5a6">
                        <div class="folder-icon">📦</div>
                        <div class="folder-name">Sin Categoría</div>
                        <div class="folder-count">${looseProducts.length} items</div>
                    </div>
                `;
            }
            // Si no hay categorías ni productos sueltos
            if (categories.length === 0 && looseProducts.length === 0) {
                grid.innerHTML += `<div class="no-results">No hay productos ni categorías configuradas</div>`;
            }

            return;
        }

        if (this.currentCategory === 'uncategorized') {
            products = products.filter(p => !p.categoriaId && !p.categoria);
        } else {
            // Robust Filter: Match ID OR Name (for legacy products)
            const catObj = window.categoriesService?.categories?.find(c => c.id === this.currentCategory);
            const catName = catObj ? (catObj.nombre || catObj.name) : '';

            products = products.filter(p =>
                p.categoriaId === this.currentCategory ||
                p.categoria === this.currentCategory ||
                (catName && p.categoria === catName)
            );
        }

        products.sort((a, b) => a.nombre.localeCompare(b.nombre));

        // USE NEW LIST VIEW
        this.renderCategoryView(grid, products);
    }

    goBack() {
        console.log('goBack called');
        this.currentCategory = 'all';

        // Reset grid styles from list view
        const grid = document.getElementById('pos-products-grid');
        if (grid) {
            grid.classList.add('product-grid');
            grid.style.display = 'grid'; // Restore grid
            grid.style.height = 'auto';
        }

        this.renderProducts();
    }

    renderCategoryView(container, products) {
        container.classList.remove('product-grid'); // Remove grid layout if applied
        container.style.display = 'block'; // Ensure block display for full height
        container.style.height = '100%';

        if (products.length === 0) {
            container.innerHTML = `
                <div class="category-view-container">
                    <div class="category-back-column" id="category-back-btn-empty">
                        <div class="back-icon">⬅️</div>
                        <div class="back-text">Atrás</div>
                    </div>
                    <div class="category-list-column" style="align-items:center; justify-content:center; color:#64748b;">
                        <h3>No hay productos en esta categoría</h3>
                    </div>
                </div>`;
            setTimeout(() => {
                const btn = document.getElementById('category-back-btn-empty');
                if (btn) btn.addEventListener('click', () => this.goBack());
            }, 0);
            return;
        }

        container.innerHTML = `
            <div class="category-view-container">
                <!-- Left: Back Button -->
                <div class="category-back-column" id="category-back-btn">
                    <div class="back-icon">⬅️</div>
                    <div class="back-text">Atrás</div>
                </div>

                <!-- Right: Product List -->
                <div class="category-list-column">
                    <div class="product-list-header">
                        <span>Producto</span>
                        <span>Precio</span>
                    </div>
                    <div class="product-list-scroll">
                        ${products.map(p => {
            const hasStock = (p.stock || 0) > 0;
            const stockClass = hasStock ? '' : 'out-of-stock';
            return `
                            <div class="product-list-item ${stockClass}" onclick="window.posScreen.addToCart('${p.id}')">
                                <div class="product-list-info">
                                    <div class="product-list-icon">
                                        ${p.imagen ? `<img src="${p.imagen}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">` : '🍔'}
                                    </div>
                                    <div class="product-list-name">${p.nombre}</div>
                                </div>
                                <div class="product-list-price">
                                    ${window.Utils ? window.Utils.formatCurrency(p.precio) : '$' + p.precio}
                                </div>
                            </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Safer event listener binding
        setTimeout(() => {
            const backBtn = document.getElementById('category-back-btn');
            if (backBtn) backBtn.addEventListener('click', () => this.goBack());
        }, 0);
    }

    renderProductCards(container, products) {
        products.forEach(p => {
            const hasStock = (p.stock || 0) > 0;
            const stockClass = hasStock ? '' : 'out-of-stock';
            const stockLabel = hasStock ? `Stock: ${p.stock}` : 'AGOTADO';
            const categoryName = window.categoriesService?.categories?.find(c => c.id === p.categoriaId)?.nombre || p.categoria || '';

            container.innerHTML += `
                <div class="product-card ${stockClass}" data-product-id="${p.id}">
                    <div class="product-card-image">
                        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}">` : '🍔'}
                    </div>
                    <div class="product-card-name">${p.nombre}</div>
                    <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 2px;">${categoryName}</div>
                    <div class="product-card-price">${window.Utils ? window.Utils.formatCurrency(p.precio) : '$' + p.precio}</div>
                    <div class="product-card-stock ${stockClass}">${stockLabel}</div>
                </div>`;
        });
    }

    // ========== CARRITO ==========
    addToCart(productId) {
        const product = window.productsService.getProduct(productId);
        if (!product) return;

        // Verificar stock localmente primero
        const currentInCart = this.cart.find(item => item.productId === productId);
        const qtyInCart = currentInCart ? currentInCart.cantidad : 0;

        if ((product.stock || 0) - qtyInCart <= 0) {
            window.Utils?.showToast('No hay suficiente stock disponible', 'warning');
            return;
        }

        if (currentInCart) {
            currentInCart.cantidad++;
            currentInCart.subtotal = currentInCart.cantidad * currentInCart.precio;
        } else {
            const price = parseFloat(product.precio) || 0;
            const cost = parseFloat(product.costo) || 0;
            this.cart.push({
                productId: product.id,
                nombre: product.nombre,
                precio: price,
                costo: cost,
                cantidad: 1,
                subtotal: price
            });
        }

        this.renderCart();
    }

    updateItemQuantity(index, delta) {
        const item = this.cart[index];
        if (!item) return;

        // Verificar stock al aumentar
        if (delta > 0) {
            const product = window.productsService.getProduct(item.productId);
            if (product && (product.stock || 0) - item.cantidad <= 0) {
                window.Utils?.showToast('No hay más stock disponible', 'warning');
                return;
            }
        }

        item.cantidad += delta;

        if (item.cantidad <= 0) {
            this.cart.splice(index, 1);
        } else {
            item.subtotal = item.cantidad * item.precio;
        }

        this.renderCart();
    }

    clearCart() {
        this.cart = [];
        this.renderCart();
    }

    renderCart() {
        const container = document.getElementById('cart-items');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="cart-empty">
                    <div style="font-size:2em; margin-bottom:10px;">🛒</div>
                    <p>Carrito vacío</p>
                </div>`;
        } else {
            container.innerHTML = `
                <table class="cart-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.cart.map((item, index) => `
                            <tr>
                                <td>
                                    <div class="fw-500">${item.nombre}</div>
                                    <div class="text-muted text-sm">${window.Utils?.formatCurrency(item.precio)}</div>
                                </td>
                                <td class="text-center">
                                    <div class="quantity-controls">
                                        <button data-action="decrease" data-index="${index}">−</button>
                                        <span>${item.cantidad}</span>
                                        <button data-action="increase" data-index="${index}">+</button>
                                    </div>
                                </td>
                                <td class="text-right fw-600">${window.Utils?.formatCurrency(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }

        this.updateTotals();
    }

    updateTotals() {
        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        // Asumiendo IVA incluido para simplificar visualización
        const subtotal = Math.round(total / 1.19);
        const tax = total - subtotal;

        document.getElementById('cart-subtotal').textContent = window.Utils?.formatCurrency(subtotal);
        document.getElementById('cart-tax').textContent = window.Utils?.formatCurrency(tax);
        document.getElementById('cart-total').textContent = window.Utils?.formatCurrency(total);

        // Disable pay button if 0
        const payBtn = document.getElementById('process-payment');
        if (payBtn) {
            payBtn.disabled = total === 0;
            if (total > 0) {
                payBtn.innerHTML = `💳 Pagar ${window.Utils?.formatCurrency(total)}`;
            } else {
                payBtn.innerHTML = `💳 Pagar`;
            }
        }
    }

    // ========== PAGO ==========
    openPaymentModal() {
        if (this.cart.length === 0) {
            window.Utils?.showToast('El carrito está vacío', 'warning');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        document.getElementById('payment-total-amount').textContent = window.Utils?.formatCurrency(total);

        // Reset UI
        this.selectPaymentMethod('cash');
        document.getElementById('cash-received').value = '';
        document.getElementById('change-amount').textContent = '$0';
        document.getElementById('payment-comments').value = '';

        document.getElementById('payment-modal').classList.add('active');
    }

    selectPaymentMethod(method) {
        document.querySelectorAll('.payment-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.method === method);
        });

        const cashSection = document.getElementById('cash-payment-section');
        if (cashSection) {
            cashSection.style.display = (method === 'cash' || method === 'efectivo') ? 'block' : 'none';
        }
    }

    updateChange() {
        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const received = parseInt(document.getElementById('cash-received').value) || 0;
        const change = Math.max(0, received - total);
        document.getElementById('change-amount').textContent = window.Utils?.formatCurrency(change);
    }

    async processPayment() {
        const methodBtn = document.querySelector('.payment-option.active');
        const metodoPago = methodBtn ? methodBtn.dataset.method : 'cash';
        const notas = document.getElementById('payment-comments').value;
        const currentUser = window.usersService?.getCurrentUser();

        // Validar pago en efectivo
        if (metodoPago === 'cash' || metodoPago === 'efectivo') {
            const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
            const received = parseInt(document.getElementById('cash-received').value) || 0;
            if (received < total) {
                window.Utils?.showToast('El monto recibido es insuficiente', 'error');
                return;
            }
        }

        const saleData = {
            items: this.cart,
            metodoPago,
            notas,
            vendedor: currentUser?.nombre || 'Desconocido',
            vendedorId: currentUser?.id || 'unknown',
            descuento: 0,
            imprimirRecibo: true
        };

        // Cerrar modal y mostrar indicador
        document.getElementById('payment-modal').classList.remove('active');

        const result = await window.salesService.createSale(saleData);

        if (result.success) {
            window.Utils?.showToast('Venta realizada con éxito', 'success');
            this.clearCart();
        } else {
            console.error(result.error);
            window.Utils?.showToast('Error al procesar venta: ' + result.error, 'error');
        }
    }
}

// Crear instancia global
window.posScreen = new POSScreen();
console.log('✅ POSScreen inicializado');
