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

    // Undo system for any action
    lastAction: null, // { type: 'CREATE'|'UPDATE'|'DELETE', product: {...}, previousState: {...} }

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
        document.getElementById('undo-last-action-btn')?.addEventListener('click', () => this.undoLastAction());
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

        // Google Sheets import
        document.getElementById('import-googlesheets-btn')?.addEventListener('click', () => this.promptGoogleSheetsImport());

        // Paste CSV directly
        document.getElementById('paste-csv-btn')?.addEventListener('click', () => this.promptPasteCSV());
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

        // Save state for undo
        this.lastAction = {
            type: existing ? 'UPDATE' : 'CREATE',
            product: { ...product },
            previousState: existing ? { ...existing } : null
        };
        this.showUndoActionButton();

        await DB.put('products', product);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            Sync.pushToCloud('products', existing ? 'UPDATE' : 'CREATE', product);
        }

        document.getElementById('product-modal').classList.remove('active');
        await this.loadProducts();
        POS.loadProducts();
        Inventory.loadStockList(); // Refresh stock list in inventory tab
        Utils.showToast('Producto guardado', 'success');
    },

    async delete(id) {
        if (!confirm('¿Eliminar este producto?')) return;

        // Save state for undo before deleting
        const existing = await DB.get('products', id);
        if (existing) {
            this.lastAction = {
                type: 'DELETE',
                product: null,
                previousState: { ...existing }
            };
            this.showUndoActionButton();
        }

        await DB.delete('products', id);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            Sync.pushToCloud('products', 'DELETE', { id });
        }

        await this.loadProducts();
        POS.loadProducts();
        Utils.showToast('Producto eliminado', 'success');
    },

    async undoLastAction() {
        if (!this.lastAction) {
            Utils.showToast('No hay acción para deshacer', 'warning');
            return;
        }

        const action = this.lastAction;

        try {
            switch (action.type) {
                case 'CREATE':
                    // Undo create: delete the product
                    if (action.product) {
                        await DB.delete('products', action.product.id);
                        Utils.showToast(`Creación de "${action.product.name}" deshecha`, 'success');
                    }
                    break;

                case 'UPDATE':
                    // Undo update: restore previous state
                    if (action.previousState) {
                        await DB.put('products', action.previousState);
                        Utils.showToast(`Cambios en "${action.previousState.name}" deshechos`, 'success');
                    }
                    break;

                case 'DELETE':
                    // Undo delete: restore the product
                    if (action.previousState) {
                        await DB.put('products', action.previousState);
                        Utils.showToast(`"${action.previousState.name}" restaurado`, 'success');
                    }
                    break;
            }

            // Clear last action and hide button
            this.lastAction = null;
            this.hideUndoActionButton();

            // Refresh views
            await this.loadProducts();
            POS.loadProducts();
            Inventory.loadStockList();

        } catch (error) {
            console.error('Undo error:', error);
            Utils.showToast('Error al deshacer: ' + error.message, 'error');
        }
    },

    showUndoActionButton() {
        const btn = document.getElementById('undo-last-action-btn');
        if (btn) {
            btn.classList.remove('hidden');
            // Auto-hide after 30 seconds
            clearTimeout(this.undoTimeout);
            this.undoTimeout = setTimeout(() => {
                this.hideUndoActionButton();
            }, 30000);
        }
    },

    hideUndoActionButton() {
        const btn = document.getElementById('undo-last-action-btn');
        if (btn) {
            btn.classList.add('hidden');
        }
        this.lastAction = null;
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
    },

    // =====================================================
    // GOOGLE SHEETS IMPORT
    // =====================================================
    async promptGoogleSheetsImport() {
        const url = prompt(
            'Pega la URL pública de tu Google Sheet exportada como CSV:\n\n' +
            'Instrucciones:\n' +
            '1. En Google Sheets, ve a Archivo → Compartir → Publicar en la web\n' +
            '2. Selecciona la hoja y formato "Valores separados por comas (.csv)"\n' +
            '3. Copia la URL y pégala aquí'
        );

        if (!url) return;

        if (!url.includes('docs.google.com') && !url.includes('.csv')) {
            Utils.showToast('URL inválida. Debe ser una URL de Google Sheets publicada como CSV', 'error');
            return;
        }

        if (!confirm('¿Importar productos desde Google Sheets?\n\nEsto actualizará los productos existentes.\n\nPodrás deshacer esta acción después.')) {
            return;
        }

        // Convert edit URL to CSV export URL automatically
        let csvUrl = url;
        if (url.includes('/edit')) {
            // Extract spreadsheet ID and gid
            const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            const gidMatch = url.match(/gid=(\d+)/);

            if (idMatch) {
                const spreadsheetId = idMatch[1];
                const gid = gidMatch ? gidMatch[1] : '0';
                csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
                console.log('Converted URL:', csvUrl);
            }
        }

        Utils.showToast('Descargando desde Google Sheets...', 'info');

        try {
            let csvText = '';

            // Try direct fetch first
            try {
                const response = await fetch(csvUrl);
                if (response.ok) {
                    csvText = await response.text();
                }
            } catch (e) {
                console.log('Direct fetch failed, trying proxies...');
            }

            // If direct fetch failed, try multiple CORS proxies
            if (!csvText) {
                const proxies = [
                    'https://api.allorigins.win/raw?url=',
                    'https://corsproxy.io/?',
                    'https://api.codetabs.com/v1/proxy?quest='
                ];

                for (const proxy of proxies) {
                    try {
                        console.log('Trying proxy:', proxy);
                        const proxyUrl = proxy + encodeURIComponent(csvUrl);
                        const response = await fetch(proxyUrl);
                        if (response.ok) {
                            csvText = await response.text();
                            if (csvText && csvText.trim().length > 0) {
                                console.log('Success with proxy:', proxy);
                                break;
                            }
                        }
                    } catch (e) {
                        console.log('Proxy failed:', proxy);
                    }
                }
            }

            if (!csvText || csvText.trim().length === 0) {
                throw new Error('No se pudo descargar. Verifica que el archivo sea público.');
            }

            if (!csvText || csvText.trim().length === 0) {
                throw new Error('El archivo está vacío');
            }

            this.productsBackup = await DB.getAll('products');
            console.log('Backup created:', this.productsBackup.length, 'products');

            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                throw new Error('Archivo CSV vacío o inválido');
            }

            // Detectar columnas automáticamente desde la primera fila (encabezado)
            const headerFields = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
            const colIndex = {
                nombre: headerFields.findIndex(h => h.includes('nombre') || h.includes('name') || h.includes('producto')),
                categoria: headerFields.findIndex(h => h.includes('categor') || h.includes('category')),
                precio: headerFields.findIndex(h => h.includes('precio') || h.includes('price')),
                costo: headerFields.findIndex(h => h.includes('costo') || h.includes('cost')),
                stock: headerFields.findIndex(h => h.includes('stock') || h.includes('cantidad')),
                barcode: headerFields.findIndex(h => h.includes('barcode') || h.includes('codigo') || h.includes('sku'))
            };

            // Si no encuentra nombre, usa primera columna
            if (colIndex.nombre === -1) colIndex.nombre = 0;
            if (colIndex.precio === -1) colIndex.precio = 2;

            console.log('Columnas detectadas:', colIndex);

            const dataLines = lines.slice(1);
            const categories = await DB.getAll('categories');
            const catNameToId = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]));

            let imported = 0;
            let updated = 0;

            for (const line of dataLines) {
                const fields = this.parseCSVLine(line);
                if (fields.length < 2) continue;

                const cleanField = (idx) => idx >= 0 && fields[idx] ? fields[idx].replace(/^"|"$/g, '').trim() : '';

                const cleanName = cleanField(colIndex.nombre);
                if (!cleanName) continue;

                const categoryName = cleanField(colIndex.categoria);
                const price = cleanField(colIndex.precio);
                const cost = cleanField(colIndex.costo);
                const stock = cleanField(colIndex.stock);
                const barcode = cleanField(colIndex.barcode);

                const products = await DB.getAll('products');
                const existing = products.find(p => p.name.toLowerCase() === cleanName.toLowerCase());

                const product = {
                    id: existing?.id || 'prod_' + Utils.generateUUID(),
                    name: cleanName,
                    price: parseInt(price) || 0,
                    cost: parseInt(cost) || 0,
                    category: catNameToId[categoryName.toLowerCase()] || '',
                    stock: parseInt(stock) || 0,
                    barcode: barcode || '',
                    is_active: true,
                    tax_rate: 0.19,
                    image: existing?.image || null,
                    sync_status: 'PENDING',
                    created_at: existing?.created_at || Utils.now(),
                    updated_at: Utils.now()
                };

                await DB.put('products', product);

                // Sync with cloud
                if (typeof Sync !== 'undefined') {
                    await Sync.pushToCloud('products', existing ? 'UPDATE' : 'CREATE', product);
                }

                if (existing) updated++;
                else imported++;
            }

            await this.loadProducts();
            POS.loadProducts();
            Inventory.loadAll();

            this.showUndoButton();

            Utils.showToast(`✅ Google Sheets: ${imported} nuevos, ${updated} actualizados`, 'success');

        } catch (error) {
            console.error('Google Sheets import error:', error);
            let errorMsg = error.message;

            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMsg = 'Error de red. Verifica tu conexión.';
            } else if (error.message.includes('403') || error.message.includes('401')) {
                errorMsg = 'Archivo no público. Compartir → Cualquiera con enlace';
            }

            Utils.showToast('❌ ' + errorMsg, 'error');
            alert('Error:\\n' + errorMsg + '\\n\\nEl archivo debe estar compartido como público.');
        }
    },

    async promptPasteCSV() {
        const csvData = prompt('Pega los datos de Google Sheet aqui (Selecciona todo, copia, pega)');
        if (!csvData || csvData.trim().length < 5) return;
        if (!confirm('Importar productos?')) return;

        try {
            Utils.showToast('Procesando...', 'info');
            this.productsBackup = await DB.getAll('products');

            let csvText = csvData.includes('\t')
                ? csvData.split('\n').map(l => l.split('\t').join(',')).join('\n')
                : csvData;

            const lines = csvText.split('\n').filter(l => l.trim());
            if (lines.length < 2) throw new Error('No hay datos');

            const hdr = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
            const col = {
                n: Math.max(hdr.findIndex(h => h.includes('nombre') || h.includes('producto')), 0),
                c: hdr.findIndex(h => h.includes('categor')),
                p: Math.max(hdr.findIndex(h => h.includes('precio')), 2),
                co: hdr.findIndex(h => h.includes('costo')),
                s: hdr.findIndex(h => h.includes('stock'))
            };

            const cats = await DB.getAll('categories');
            const catMap = Object.fromEntries(cats.map(c => [c.name.toLowerCase(), c.id]));
            let imp = 0, upd = 0;

            for (const line of lines.slice(1)) {
                const f = this.parseCSVLine(line);
                if (f.length < 2) continue;
                const g = (i) => i >= 0 && f[i] ? f[i].replace(/^"|"$/g, '').trim() : '';
                const nm = g(col.n); if (!nm) continue;

                const prods = await DB.getAll('products');
                const ex = prods.find(p => p.name.toLowerCase() === nm.toLowerCase());

                const prod = {
                    id: ex?.id || 'prod_' + Utils.generateUUID(),
                    name: nm, price: parseInt(g(col.p)) || 0, cost: parseInt(g(col.co)) || 0,
                    category: catMap[g(col.c).toLowerCase()] || '', stock: parseInt(g(col.s)) || 0,
                    is_active: true, tax_rate: 0.19, image: ex?.image || null,
                    sync_status: 'PENDING', created_at: ex?.created_at || Utils.now(), updated_at: Utils.now()
                };

                await DB.put('products', prod);
                if (typeof Sync !== 'undefined') await Sync.pushToCloud('products', ex ? 'UPDATE' : 'CREATE', prod);
                ex ? upd++ : imp++;
            }

            await this.loadProducts(); POS.loadProducts(); Inventory.loadAll(); this.showUndoButton();
            Utils.showToast('OK: ' + imp + ' nuevos, ' + upd + ' actualizados', 'success');
        } catch (e) { Utils.showToast('Error: ' + e.message, 'error'); }
    }
};
