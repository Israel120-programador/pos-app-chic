/* =====================================================
   POS APP - CATEGORIES MODULE (Enhanced with Products View)
   ===================================================== */

const Categories = {
    async init() {
        this.bindEvents();
        await this.loadCategories();
    },

    bindEvents() {
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-category')?.addEventListener('click', () => this.save());
        document.getElementById('close-category-products')?.addEventListener('click', () => this.closeProductsPanel());

        // Image upload handlers
        document.getElementById('category-image')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('clear-category-image')?.addEventListener('click', () => this.clearImage());

        // Parent Category Selector Filter (in modal)
        // Not strictly needed as we reload options on open
    },

    async loadCategories() {
        const categories = await DB.getAll('categories');
        const products = await DB.getAll('products');

        const countMap = {};
        products.forEach(p => {
            countMap[p.category] = (countMap[p.category] || 0) + 1;
        });

        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = categories.sort((a, b) => a.name.localeCompare(b.name))
            .map(c => `
                <div class="category-card" data-id="${c.id}" data-name="${Utils.escapeHtml(c.name)}">
                    <div class="category-card-actions">
                        <button class="btn btn-sm btn-secondary btn-icon" onclick="event.stopPropagation(); Categories.edit('${c.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger btn-icon" onclick="event.stopPropagation(); Categories.delete('${c.id}')">🗑️</button>
                    </div>
                    <div class="category-card-icon" style="background: ${c.color}20; color: ${c.color}">
                        ${c.icon || '📦'}
                    </div>
                    <div class="category-card-name">${Utils.escapeHtml(c.name)}</div>
                    <div class="category-card-count">${countMap[c.id] || 0} productos</div>
                </div>
            `).join('');

        // Add click handlers via event delegation
        grid.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const name = card.dataset.name;
                this.showProducts(id, name);
            });
        });
    },

    async showProducts(categoryId, categoryName) {
        const products = await DB.getAll('products');
        const filtered = products.filter(p => p.category === categoryId);

        const panel = document.getElementById('category-products-panel');
        const title = document.getElementById('category-products-title');
        const grid = document.getElementById('category-products-grid');

        if (!panel || !title || !grid) {
            console.error('Category products panel not found');
            return;
        }

        title.textContent = `📦 ${categoryName} (${filtered.length} productos)`;

        grid.innerHTML = filtered.sort((a, b) => a.name.localeCompare(b.name))
            .map(p => `
                <div class="product-card ${(p.stock !== undefined && p.stock <= 0) ? 'out-of-stock' : ''}">
                    <div class="product-card-image">
                        ${p.image ? `<img src="${p.image}" alt="${Utils.escapeHtml(p.name)}">` : '📦'}
                    </div>
                    <div class="product-card-name">${Utils.escapeHtml(p.name)}</div>
                    <div class="product-card-price">${Utils.formatCurrency(p.price)}</div>
                    <div class="product-card-stock">Stock: ${p.stock ?? 0}</div>
                </div>
            `).join('') || '<p class="text-muted text-center">No hay productos en esta categoría</p>';

        panel.classList.remove('hidden');
    },

    closeProductsPanel() {
        document.getElementById('category-products-panel').classList.add('hidden');
    },

    async openModal(category = null) {
        const modal = document.getElementById('category-modal');
        document.getElementById('category-modal-title').textContent =
            category ? 'Editar Categoría' : 'Nueva Categoría';

        document.getElementById('category-id').value = category?.id || '';
        document.getElementById('category-name').value = category?.name || '';
        document.getElementById('category-color').value = category?.color || '#FF6B35';
        document.getElementById('category-icon').value = category?.icon || '';

        // Handle image
        const preview = document.getElementById('category-image-preview');
        const clearBtn = document.getElementById('clear-category-image');

        if (category?.image) {
            preview.src = category.image;
            preview.classList.add('has-image');
            clearBtn.classList.remove('hidden');
            this.currentImageData = category.image;
        } else {
            preview.src = '';
            preview.classList.remove('has-image');
            clearBtn.classList.add('hidden');
            this.currentImageData = null;
        }
        document.getElementById('category-image').value = '';

        // Load Parent Options
        const allCategories = await DB.getAll('categories');
        const parentSelect = document.getElementById('category-parent');

        if (parentSelect) {
            // Filter out self to avoid cycles if editing
            const validParents = category
                ? allCategories.filter(c => c.id !== category.id)
                : allCategories;

            // Also simplistic cycle prevention: don't allow children of self as parents (recurse if needed, but simple filter is start)

            parentSelect.innerHTML = '<option value="">Ninguna (Categoría Raíz)</option>' +
                validParents.sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`)
                    .join('');

            parentSelect.value = category?.parent_id || '';
        }

        modal.classList.add('active');
    },

    async edit(id) {
        const category = await DB.get('categories', id);
        if (category) this.openModal(category);
    },

    async save() {
        const id = document.getElementById('category-id').value || 'cat_' + Utils.generateUUID();
        const category = {
            id,
            name: document.getElementById('category-name').value.trim(),
            color: document.getElementById('category-color').value,
            icon: document.getElementById('category-icon').value.trim(),
            parent_id: document.getElementById('category-parent')?.value || null,
            image: this.currentImageData || null,
            sort_order: 0,
            created_at: Utils.now()
        };

        if (!category.name) {
            Utils.showToast('El nombre es requerido', 'error');
            return;
        }

        await DB.put('categories', category);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            Sync.pushToCloud('categories', 'UPDATE', category);
        }

        document.getElementById('category-modal').classList.remove('active');
        await this.loadCategories();
        POS.loadCategories();
        Products.loadCategoryFilter();
        Utils.showToast('Categoría guardada', 'success');
    },

    async delete(id) {
        if (!confirm('¿Eliminar esta categoría?')) return;
        await DB.delete('categories', id);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            Sync.pushToCloud('categories', 'DELETE', { id });
        }

        await this.loadCategories();
        POS.loadCategories();
        Utils.showToast('Categoría eliminada', 'success');
    },

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('category-image-preview');
            const clearBtn = document.getElementById('clear-category-image');

            preview.src = event.target.result;
            preview.classList.add('has-image');
            clearBtn.classList.remove('hidden');

            this.currentImageData = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    clearImage() {
        const preview = document.getElementById('category-image-preview');
        const input = document.getElementById('category-image');
        const clearBtn = document.getElementById('clear-category-image');

        preview.src = '';
        preview.classList.remove('has-image');
        input.value = '';
        clearBtn.classList.add('hidden');
        this.currentImageData = null;
    }
};
