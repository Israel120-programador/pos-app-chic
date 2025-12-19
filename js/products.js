/* =====================================================
   POS APP - PRODUCTS MODULE (Enhanced with Image & Export)
   ===================================================== */

const Products = {
    pageSize: 500,
    currentPage: 1,
    productsCache: [],
    categoriesCache: [],
    catMap: {},
    filteredList: [],

    async init() {
        this.bindEvents();
        this.setupTabs();
        await this.loadProducts();
        await this.loadCategoryFilter();
    },

    setupTabs() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                // Update tabs
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update contents
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(target).classList.add('active');
            });
        });
    },

    bindEvents() {
        document.getElementById('add-product-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-product')?.addEventListener('click', () => this.save());
        document.getElementById('export-products-btn')?.addEventListener('click', () => this.exportToExcel());
        document.getElementById('import-products-file')?.addEventListener('change', (e) => this.importFromCSV(e));
        document.getElementById('undo-import-btn')?.addEventListener('click', () => this.undoImport());
        document.getElementById('view-saved-files-btn')?.addEventListener('click', () => this.viewSavedFiles());
        document.getElementById('products-search')?.addEventListener('input',
            Utils.debounce(() => this.filterProducts(), 300));

        document.getElementById('products-category-filter')?.addEventListener('change',
            () => { this.currentPage = 1; this.filterProducts(); });

        // Load More button
        document.getElementById('load-more-products')?.addEventListener('click', () => this.renderPage());

        // Image upload handlers
        document.getElementById('product-image')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('clear-product-image')?.addEventListener('click', () => this.clearImage());
    },

    async loadProducts() {
        this.productsCache = await DB.getAll('products');
        this.categoriesCache = await DB.getAll('categories'); // Cache for performance
        this.catMap = Object.fromEntries(this.categoriesCache.map(c => [c.id, c.name]));

        this.filteredList = this.productsCache;
        this.currentPage = 1;
        this.filterProducts();
    },

    async loadCategoryFilter() {
        const categories = this.categoriesCache.length ? this.categoriesCache : await DB.getAll('categories');
        const select = document.getElementById('products-category-filter');
        const productCatSelect = document.getElementById('product-category');

        const options = '<option value="">Todas las categorías</option>' +
            categories.sort((a, b) => a.name.localeCompare(b.name))
                .map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');

        if (select) select.innerHTML = options;
        if (productCatSelect) {
            productCatSelect.innerHTML = '<option value="">Sin categoría</option>' +
                categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
        }
    },

    filterProducts() {
        const search = document.getElementById('products-search')?.value.toLowerCase() || '';
        const category = document.getElementById('products-category-filter')?.value || '';

        this.filteredList = this.productsCache.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(search);
            const matchCat = !category || p.category === category;
            return matchSearch && matchCat;
        }).sort((a, b) => a.name.localeCompare(b.name));

        this.currentPage = 1;
        this.renderPage();
    },

    renderPage() {
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageItems = this.filteredList.slice(start, end);

        if (this.currentPage === 1) tbody.innerHTML = ''; // Clear if fresh load

        const html = pageItems.map(p => `
                <tr data-id="${p.id}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">` : ''}
                            <strong>${Utils.escapeHtml(p.name)}</strong>
                        </div>
                    </td>
                    <td>${Utils.escapeHtml(this.catMap[p.category] || '-')}</td>
                    <td>${Utils.formatCurrency(p.price)}</td>
                    <td>${Utils.formatCurrency(p.cost || 0)}</td>
                    <td>${p.stock ?? '-'}</td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="Products.edit('${p.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="Products.delete('${p.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');

        tbody.insertAdjacentHTML('beforeend', html);

        // Update "Load More" button visibility
        const btn = document.getElementById('load-more-products');
        if (btn) {
            btn.style.display = (end < this.filteredList.length) ? 'inline-block' : 'none';
        }

        this.currentPage++;
    },

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('product-image-preview');
            preview.src = event.target.result;
            preview.classList.add('has-image');
            this.currentImageData = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    clearImage() {
        const preview = document.getElementById('product-image-preview');
        const input = document.getElementById('product-image');
        preview.src = '';
        preview.classList.remove('has-image');
        input.value = '';
        this.currentImageData = null;
    },

    openModal(product = null) {
        const modal = document.getElementById('product-modal');
        document.getElementById('product-modal-title').textContent =
            product ? 'Editar Producto' : 'Nuevo Producto';

        document.getElementById('product-id').value = product?.id || '';
        document.getElementById('product-name').value = product?.name || '';
        document.getElementById('product-price').value = product?.price || '';
        document.getElementById('product-cost').value = product?.cost || '';
        document.getElementById('product-category').value = product?.category || '';
        document.getElementById('product-stock').value = product?.stock || '';
        document.getElementById('product-barcode').value = product?.barcode || '';
        document.getElementById('product-active').checked = product?.is_active ?? true;

        // Handle image
        const preview = document.getElementById('product-image-preview');
        if (product?.image) {
            preview.src = product.image;
            preview.classList.add('has-image');
            this.currentImageData = product.image;
        } else {
            preview.src = '';
            preview.classList.remove('has-image');
            this.currentImageData = null;
        }
        document.getElementById('product-image').value = '';

        modal.classList.add('active');
    },

    async edit(id) {
        const product = await DB.get('products', id);
        if (product) this.openModal(product);
    },

    async save() {
        const id = document.getElementById('product-id').value || 'prod_' + Utils.generateUUID();
        const product = {
            id,
            name: document.getElementById('product-name').value.trim(),
            price: parseInt(document.getElementById('product-price').value) || 0,
            cost: parseInt(document.getElementById('product-cost').value) || 0,
            category: document.getElementById('product-category').value,
            stock: parseInt(document.getElementById('product-stock').value) || 0,
            barcode: document.getElementById('product-barcode').value.trim(),
            image: this.currentImageData || null,
            is_active: document.getElementById('product-active').checked,
            tax_rate: 0.19,
            sync_status: 'PENDING',
            updated_at: Utils.now()
        };

        if (!product.name) {
            Utils.showToast('El nombre es requerido', 'error');
            return;
        }

        const existing = await DB.get('products', id);
        if (!existing) product.created_at = Utils.now();
        if (existing && !this.currentImageData) product.image = existing.image;

        await DB.put('products', product);
        await DB.queueSync(existing ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', 'products', id, product);

        document.getElementById('product-modal').classList.remove('active');
        await this.loadProducts();
        POS.loadProducts();
        Inventory.loadStockList(); // Refresh stock list in inventory tab
        Utils.showToast('Producto guardado', 'success');
    },

    async delete(id) {
        if (!confirm('¿Eliminar este producto?')) return;
        await DB.delete('products', id);
        await DB.queueSync('DELETE_PRODUCT', 'products', id, {});
        await this.loadProducts();
        POS.loadProducts();
        Utils.showToast('Producto eliminado', 'success');
    },

    async exportToExcel() {
        const products = await DB.getAll('products');
        const categories = await DB.getAll('categories');
        const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

        // Create CSV content (Excel compatible)
        let csv = 'Nombre,Categoría,Precio,Costo,Ganancia,Stock,Código de Barras,Activo\n';

        products.forEach(p => {
            const profit = (p.price || 0) - (p.cost || 0);
            csv += `"${p.name}","${catMap[p.category] || ''}",${p.price || 0},${p.cost || 0},${profit},${p.stock || 0},"${p.barcode || ''}",${p.is_active ? 'Sí' : 'No'}\n`;
        });

        // Create and download file
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `productos_${Utils.formatDate(new Date()).replace(/\//g, '-')}.csv`;
        link.click();

        Utils.showToast('Archivo exportado correctamente', 'success');
    },

    // Backup storage for undo
    productsBackup: null,

    async importFromCSV(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('¿Importar productos desde CSV? Esto actualizará los productos existentes con el mismo nombre.\n\nPodrás deshacer esta acción después.')) {
            e.target.value = '';
            return;
        }

        // Create backup before import
        this.productsBackup = await DB.getAll('products');
        console.log('Backup created:', this.productsBackup.length, 'products');

        const reader = new FileReader();
        const filename = file.name;

        reader.onload = async (event) => {
            try {
                const csv = event.target.result;
                const lines = csv.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    Utils.showToast('Archivo CSV vacío o inválido', 'error');
                    return;
                }

                // Save imported file to database (if store exists)
                try {
                    if (DB.hasStore('imported_files')) {
                        const savedFile = {
                            id: 'file_' + Utils.generateUUID(),
                            filename: filename,
                            content: csv,
                            timestamp: Utils.now(),
                            rowCount: lines.length - 1
                        };
                        await DB.put('imported_files', savedFile);
                        console.log('File saved:', filename);
                    }
                } catch (e) {
                    console.log('Could not save file history:', e);
                }

                // Skip header line
                const dataLines = lines.slice(1);
                const categories = await DB.getAll('categories');
                const catNameToId = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]));

                let imported = 0;
                let updated = 0;

                for (const line of dataLines) {
                    // Parse CSV line (handle quoted fields)
                    const fields = this.parseCSVLine(line);
                    if (fields.length < 6) continue;

                    const [name, categoryName, price, cost, , stock, barcode, active] = fields;
                    const cleanName = name.replace(/^"|"$/g, '').trim();

                    if (!cleanName) continue;

                    // Find existing product by name
                    const products = await DB.getAll('products');
                    const existing = products.find(p => p.name.toLowerCase() === cleanName.toLowerCase());

                    const product = {
                        id: existing?.id || 'prod_' + Utils.generateUUID(),
                        name: cleanName,
                        price: parseInt(price) || 0,
                        cost: parseInt(cost) || 0,
                        category: catNameToId[categoryName.replace(/^"|"$/g, '').toLowerCase()] || '',
                        stock: parseInt(stock) || 0,
                        barcode: barcode?.replace(/^"|"$/g, '') || '',
                        is_active: active?.includes('Sí') ?? true,
                        tax_rate: 0.19,
                        image: existing?.image || null,
                        sync_status: 'PENDING',
                        created_at: existing?.created_at || Utils.now(),
                        updated_at: Utils.now()
                    };

                    await DB.put('products', product);
                    if (existing) updated++;
                    else imported++;
                }

                await this.loadProducts();
                POS.loadProducts();
                Inventory.loadAll();

                // Show undo button
                this.showUndoButton();

                Utils.showToast(`Importado: ${imported} nuevos, ${updated} actualizados`, 'success');
            } catch (error) {
                console.error('Import error:', error);
                Utils.showToast('Error al importar CSV', 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    },

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    },

    async undoImport() {
        if (!this.productsBackup || this.productsBackup.length === 0) {
            Utils.showToast('No hay importación para deshacer', 'warning');
            return;
        }

        if (!confirm(`¿Restaurar ${this.productsBackup.length} productos al estado anterior?`)) {
            return;
        }

        try {
            // Clear all current products
            const currentProducts = await DB.getAll('products');
            for (const p of currentProducts) {
                await DB.delete('products', p.id);
            }

            // Restore backup
            for (const product of this.productsBackup) {
                await DB.put('products', product);
            }

            // Clear backup after restore
            const restoredCount = this.productsBackup.length;
            this.productsBackup = null;

            await this.loadProducts();
            POS.loadProducts();
            Inventory.loadAll();

            // Hide undo button
            document.getElementById('undo-import-btn').classList.add('hidden');

            Utils.showToast(`✓ Restaurados ${restoredCount} productos`, 'success');
        } catch (error) {
            console.error('Undo error:', error);
            Utils.showToast('Error al deshacer importación', 'error');
        }
    },

    showUndoButton() {
        const btn = document.getElementById('undo-import-btn');
        if (btn) {
            btn.classList.remove('hidden');
            // Auto-hide after 60 seconds
            setTimeout(() => {
                btn.classList.add('hidden');
            }, 60000);
        }
    },

    async viewSavedFiles() {
        if (!DB.hasStore('imported_files')) {
            Utils.showToast('Función no disponible. Borra datos de la app y vuelve a abrirla.', 'warning');
            return;
        }

        const files = await DB.getAll('imported_files');
        if (files.length === 0) {
            Utils.showToast('No hay archivos guardados', 'info');
            return;
        }

        const fileList = files
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map((f, i) => `${i + 1}. ${f.filename} (${f.rowCount} productos) - ${Utils.formatDateTime(f.timestamp)}`)
            .join('\n');

        const choice = prompt(`Archivos guardados:\n\n${fileList}\n\nIngresa el número para descargar o 0 para cancelar:`);

        if (choice && parseInt(choice) > 0 && parseInt(choice) <= files.length) {
            const file = files.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[parseInt(choice) - 1];
            this.downloadSavedFile(file);
        }
    },

    downloadSavedFile(file) {
        const blob = new Blob(['\ufeff' + file.content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = file.filename;
        link.click();
        Utils.showToast(`Descargado: ${file.filename}`, 'success');
    }
};
