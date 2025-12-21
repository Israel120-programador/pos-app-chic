/* =====================================================
   POS APP - POINT OF SALE MODULE
   ===================================================== */

const POS = {
    cart: [],
    currentCategory: null, // null = root
    categoryPath: [], // Stack of category IDs
    categoriesCache: [],
    productsCache: [],
    currentProofImage: null, // For payment proof image

    async init() {
        this.bindEvents();
        await this.loadCategories();
        this.productsCache = await DB.getAll('products');
        this.renderCategories(); // Start at root
    },

    bindEvents() {
        document.getElementById('clear-cart')?.addEventListener('click', () => this.clearCart());
        document.getElementById('process-payment')?.addEventListener('click', () => this.openPaymentModal());
        document.getElementById('product-search')?.addEventListener('input',
            Utils.debounce(() => this.filterProducts(), 300));
        document.getElementById('confirm-payment')?.addEventListener('click', () => this.processPayment());

        // Payment method selection
        document.querySelectorAll('.payment-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const section = document.getElementById('cash-payment-section');
                section.style.display = btn.dataset.method === 'cash' ? 'block' : 'none';
            });
        });

        // Quick amounts
        document.querySelectorAll('.quick-amount').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('cash-received').value = btn.dataset.amount;
                this.updateChange();
            });
        });

        document.getElementById('cash-received')?.addEventListener('input', () => this.updateChange());

        // Payment proof image handling
        document.getElementById('payment-proof-image')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.currentProofImage = event.target.result;
                    document.getElementById('payment-proof-status').textContent = '✓ ' + file.name;
                };
                reader.readAsDataURL(file);
            }
        });
    },

    async loadCategories() {
        this.categoriesCache = await DB.getAll('categories');
    },

    /**
     * Renders categories or products based on current level
     */
    renderCategories() {
        const container = document.getElementById('category-tabs'); // We'll reuse this container contextually or rename it in logic
        // Ideally we should have a breadcrumb

        let parentId = this.currentCategory;

        // Filter categories belonging to current level
        // Root: parent_id is null or empty
        // Child: parent_id matches currentCategory
        let children = this.categoriesCache.filter(c => {
            if (!parentId || parentId === 'all') return !c.parent_id || c.parent_id === 'null' || c.parent_id === '';
            return c.parent_id === parentId;
        });

        // Setup Main Grid Area for Navigation (Replacing old product grid logic basically)
        // We need to decide: Do we show Categories mixed with Products? Or only Categories until leaf?
        // Plan:
        // 1. Show Children Categories (folders) - as cards at root, as table inside
        // 2. Show Products (items) belonging to current category

        // This requires unified rendering. Let's use 'pos-products-grid' for EVERYTHING.
        const grid = document.getElementById('pos-products-grid');
        grid.innerHTML = '';

        // Add "Back" button if not at root
        if (this.categoryPath.length > 0) {
            grid.innerHTML += `
                <div class="product-card back-card" onclick="POS.goBack()" style="background:var(--bg-tertiary); border-style:dashed;">
                    <div class="product-card-image" style="font-size: 2em;">🔙</div>
                    <div class="product-card-name">Atrás</div>
                </div>
           `;
        }

        // Check if we're at ROOT or inside a category
        const isAtRoot = !parentId || parentId === 'all';

        if (isAtRoot) {
            // ROOT LEVEL: Show categories as visual CARDS with photos
            children.sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
                let iconHtml = '';
                if (c.image) {
                    iconHtml = `<div class="product-card-image" style="padding:0;"><img src="${c.image}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="cat"></div>`;
                } else {
                    iconHtml = `<div class="product-card-image" style="background:${c.color}20; color:${c.color}">${c.icon || '📁'}</div>`;
                }

                grid.innerHTML += `
                    <div class="product-card category-folder" onclick="POS.selectCategory('${c.id}')" style="border-bottom: 3px solid ${c.color}">
                        ${iconHtml}
                        <div class="product-card-name">${Utils.escapeHtml(c.name)}</div>
                        <div class="product-card-price" style="color:var(--text-secondary); font-size:0.8em">Categoría</div>
                    </div>
                `;
            });
        } else if (children.length > 0) {
            // INSIDE A CATEGORY: Show subcategories as TABLE (Excel style)
            grid.innerHTML += `
                <div class="subcategories-table-container" style="grid-column: 1 / -1; overflow-x:auto;">
                    <table class="data-table" style="width:100%; font-size:0.95em;">
                        <thead>
                            <tr style="background:var(--bg-secondary);">
                                <th style="padding:10px; text-align:left;">Subcategoría</th>
                                <th style="padding:10px; text-align:center; width:100px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${children.sort((a, b) => a.name.localeCompare(b.name)).map(c => `
                                <tr style="border-bottom:1px solid var(--border-color); cursor:pointer;" onclick="POS.selectCategory('${c.id}')">
                                    <td style="padding:10px;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <div style="width:35px; height:35px; border-radius:6px; background:${c.color}20; color:${c.color}; display:flex; align-items:center; justify-content:center; font-size:1.2em;">
                                                ${c.icon || '📁'}
                                            </div>
                                            <div style="font-weight:500; font-size:1em;">${Utils.escapeHtml(c.name)}</div>
                                        </div>
                                    </td>
                                    <td style="padding:10px; text-align:center;">
                                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); POS.selectCategory('${c.id}')" style="padding:6px 12px;">
                                            📂 Abrir
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Render Products as table when inside a category
        // Only show products that have a category assigned
        let products = this.productsCache.filter(p => {
            // Skip products without category
            if (!p.category || p.category === '') return false;
            if (!parentId || parentId === 'all') return false; // At root, only show categories
            return p.category === parentId;
        });

        products = products.filter(p => p.is_active).sort((a, b) => a.name.localeCompare(b.name));

        if (products.length > 0 && parentId && parentId !== 'all') {
            // Table view for products inside a category - simplified, clickable rows
            grid.innerHTML += `
                <div class="products-table-container" style="grid-column: 1 / -1; overflow-x:auto;">
                    <table class="data-table" style="width:100%; font-size:0.9em;">
                        <thead>
                            <tr>
                                <th style="padding:8px;">Producto</th>
                                <th style="padding:8px; text-align:right;">Precio</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => `
                                <tr onclick="POS.addToCart('${p.id}')" 
                                    style="border-bottom:1px solid var(--border-color); cursor:pointer; transition: background 0.2s;"
                                    onmouseover="this.style.background='var(--bg-tertiary)'" 
                                    onmouseout="this.style.background=''">
                                    <td style="padding:10px;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <div style="width:40px; height:40px; border-radius:6px; background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                                ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : '🍔'}
                                            </div>
                                            <div style="font-weight:500;">${Utils.escapeHtml(p.name)}</div>
                                        </div>
                                    </td>
                                    <td style="padding:10px; text-align:right; font-weight:600; font-size:1.1em;">${Utils.formatCurrency(p.price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            // Card view for products at root (orphans)
            products.forEach(p => {
                grid.innerHTML += `
                    <div class="product-card ${(p.stock !== undefined && p.stock <= 0) ? 'out-of-stock' : ''}" 
                         onclick="POS.addToCart('${p.id}')" style="position:relative;">
                        <button class="btn-edit-image" onclick="event.stopPropagation(); Products.edit('${p.id}')" 
                                title="Editar Producto" 
                                style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:white; 
                                       border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; z-index:10;
                                       display:flex; align-items:center; justify-content:center; font-size:14px;">
                            📷
                        </button>
                        <div class="product-card-image">
                            ${p.image ? `<img src="${p.image}" alt="${Utils.escapeHtml(p.name)}">` : '🍔'}
                        </div>
                        <div class="product-card-name">${Utils.escapeHtml(p.name)}</div>
                        <div class="product-card-price">${Utils.formatCurrency(p.price)}</div>
                    </div>
                `;
            });
        }

        // Update breadcrumb visually if possible (optional)
        document.getElementById('pos-breadcrumbs')?.remove(); // Cleanup old
        if (this.categoryPath.length > 0) {
            const bc = document.createElement('div');
            bc.id = 'pos-breadcrumbs';
            bc.className = 'pos-breadcrumbs';
            bc.style.padding = '10px';
            bc.innerHTML = '📂 Navegación: / ' + this.categoryPath.map(id => {
                const c = this.categoriesCache.find(x => x.id === id);
                return c ? c.name : '...';
            }).join(' / ');
            grid.parentElement.insertBefore(bc, grid);
        }
    },

    selectCategory(id) {
        this.categoryPath.push(id);
        this.currentCategory = id;
        this.renderCategories();
    },

    goBack() {
        this.categoryPath.pop();
        this.currentCategory = this.categoryPath.length > 0 ? this.categoryPath[this.categoryPath.length - 1] : null;
        this.renderCategories();
    },

    // Override old methods to be safe
    loadProducts() { this.renderCategories(); },
    filterProducts() {
        // Search functionality needs to override hierarchy temporarily
        const search = document.getElementById('product-search')?.value.toLowerCase() || '';
        if (!search) {
            this.renderCategories();
            return;
        }

        const grid = document.getElementById('pos-products-grid');
        grid.innerHTML = '';

        const matches = this.productsCache.filter(p => p.name.toLowerCase().includes(search) && p.is_active);
        matches.forEach(p => {
            grid.innerHTML += `
                <div class="product-card ${(p.stock !== undefined && p.stock <= 0) ? 'out-of-stock' : ''}" 
                     onclick="POS.addToCart('${p.id}')" style="position:relative;">
                    <button class="btn-edit-image" onclick="event.stopPropagation(); Products.edit('${p.id}')" 
                            title="Editar Producto" 
                            style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:white; 
                                   border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; z-index:10;
                                   display:flex; align-items:center; justify-content:center; font-size:14px;">
                        📷
                    </button>
                    <div class="product-card-image">
                        ${p.image ? `<img src="${p.image}" alt="${Utils.escapeHtml(p.name)}">` : '🍔'}
                    </div>
                    <div class="product-card-name">${Utils.escapeHtml(p.name)}</div>
                    <div class="product-card-price">${Utils.formatCurrency(p.price)}</div>
                </div>
            `;
        });
    },

    addToCart(productId) {
        const product = this.productsCache.find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(item => item.product_id === productId);
        if (existing) {
            existing.quantity++;
            existing.subtotal = existing.quantity * existing.unit_price;
        } else {
            this.cart.push({
                product_id: productId,
                product_name: product.name,
                quantity: 1,
                unit_price: product.price,
                subtotal: product.price,
                modifiers: []
            });
        }
        this.renderCart();
    },

    updateQuantity(productId, delta) {
        const item = this.cart.find(i => i.product_id === productId);
        if (!item) return;

        item.quantity += delta;
        if (item.quantity <= 0) {
            this.cart = this.cart.filter(i => i.product_id !== productId);
        } else {
            item.subtotal = item.quantity * item.unit_price;
        }
        this.renderCart();
    },

    renderCart() {
        const container = document.getElementById('cart-items');

        if (this.cart.length === 0) {
            container.innerHTML = `<div class="cart-empty"><span>🛒</span><p>Carrito vacío</p></div>`;
        } else {
            container.innerHTML = `
                <table class="cart-table" style="width:100%; border-collapse:collapse; font-size:0.85em;">
                    <thead>
                        <tr style="background:var(--bg-secondary); text-align:left;">
                            <th style="padding:6px 4px; border-bottom:1px solid var(--border-color);">Producto</th>
                            <th style="padding:6px 4px; border-bottom:1px solid var(--border-color); text-align:center; width:80px;">Cant.</th>
                            <th style="padding:6px 4px; border-bottom:1px solid var(--border-color); text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.cart.map(item => `
                            <tr style="border-bottom:1px solid var(--border-color);">
                                <td style="padding:6px 4px;">
                                    <div style="font-weight:500;">${Utils.escapeHtml(item.product_name)}</div>
                                    <div style="font-size:0.8em; color:var(--text-secondary);">${Utils.formatCurrency(item.unit_price)} c/u</div>
                                </td>
                                <td style="padding:6px 4px; text-align:center;">
                                    <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                                        <button onclick="POS.updateQuantity('${item.product_id}', -1)" 
                                                style="width:24px; height:24px; border:1px solid var(--border-color); background:var(--bg-tertiary); border-radius:4px; cursor:pointer;">−</button>
                                        <span style="min-width:20px; text-align:center; font-weight:600;">${item.quantity}</span>
                                        <button onclick="POS.updateQuantity('${item.product_id}', 1)" 
                                                style="width:24px; height:24px; border:1px solid var(--border-color); background:var(--bg-tertiary); border-radius:4px; cursor:pointer;">+</button>
                                    </div>
                                </td>
                                <td style="padding:6px 4px; text-align:right; font-weight:600;">${Utils.formatCurrency(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        this.updateTotals();
    },

    updateTotals() {
        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const { subtotal, tax } = Utils.calculateTotals(total);

        document.getElementById('cart-subtotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('cart-tax').textContent = Utils.formatCurrency(tax);
        document.getElementById('cart-total').textContent = Utils.formatCurrency(total);
    },

    clearCart() {
        this.cart = [];
        this.renderCart();
    },

    openPaymentModal() {
        if (this.cart.length === 0) {
            Utils.showToast('El carrito está vacío', 'warning');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        document.getElementById('payment-total-amount').textContent = Utils.formatCurrency(total);
        document.getElementById('cash-received').value = '';
        document.getElementById('change-amount').textContent = '$0';
        document.getElementById('payment-comments').value = '';
        // Reset proof image
        this.currentProofImage = null;
        const proofInput = document.getElementById('payment-proof-image');
        if (proofInput) proofInput.value = '';
        document.getElementById('payment-proof-status').textContent = 'Sin archivo';
        document.getElementById('payment-modal').classList.add('active');
    },

    updateChange() {
        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const received = parseInt(document.getElementById('cash-received').value) || 0;
        const change = Math.max(0, received - total);
        document.getElementById('change-amount').textContent = Utils.formatCurrency(change);
    },

    async processPayment() {
        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const { subtotal, tax } = Utils.calculateTotals(total);
        const paymentMethod = document.querySelector('.payment-option.active')?.dataset.method || 'cash';
        const comments = document.getElementById('payment-comments').value.trim();

        if (paymentMethod === 'cash') {
            const received = parseInt(document.getElementById('cash-received').value) || 0;
            if (received < total) {
                Utils.showToast('Monto insuficiente', 'error');
                return;
            }
        }

        const currentUser = App.currentUser;
        const sale = {
            id: 'sale_' + Utils.generateUUID(),
            order_number: Utils.generateShortId(),
            timestamp: Utils.now(),
            total,
            subtotal,
            tax,
            payment_method: paymentMethod,
            customer_id: null,
            cashier_id: currentUser?.id || null,
            device_id: 'default',
            items: Utils.deepClone(this.cart),
            comments,
            proof_image: this.currentProofImage || null,
            status: 'completed', // completed for finished sales
            sync_status: 'PENDING',
            created_at_local: Utils.now()
        };

        // Save sale
        await DB.add('sales', sale);
        await DB.queueSync('CREATE_SALE', 'sales', sale.id, sale);

        // Sync with cloud immediately if online
        if (typeof Sync !== 'undefined') {
            await Sync.pushToCloud('sales', 'CREATE', sale);
        }

        // Update stock
        for (const item of this.cart) {
            const product = await DB.get('products', item.product_id);
            if (product && product.stock !== undefined) {
                product.stock -= item.quantity;
                product.updated_at = Utils.now();
                await DB.put('products', product);
            }
        }

        // Close modal and clear cart
        document.getElementById('payment-modal').classList.remove('active');
        this.clearCart();

        // Print receipts
        const settings = await DB.get('settings', 'default');
        if (settings?.print_receipts !== false) {
            await Receipts.printDualReceipt(sale, currentUser?.name);
        }

        Utils.showToast('Venta procesada correctamente', 'success');
        Sales.loadSales();
        Inventory.loadAll(); // Refresh chart after sale
    }
};
