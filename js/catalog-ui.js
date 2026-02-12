/* =====================================================
   POS APP - CATALOG UI MODULE
   Handles product table, product/user CRUD, imports
   ===================================================== */

const CatalogUI = {
    currentPage: 0,
    pageSize: 50,
    filteredProducts: [],

    init() {
        this.bindEvents();
        this.loadProducts();
        this.loadUsers();
        // Subscribe to real-time updates
        if (window.productsService) {
            window.productsService.subscribe(() => this.loadProducts());
        }
    },

    bindEvents() {
        // ========== TAB SWITCHING (Productos / Categorías) ==========
        document.querySelectorAll('.nav-tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab button
                document.querySelectorAll('.nav-tab[data-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show/hide tab content
                const tabId = tab.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                document.getElementById(tabId)?.classList.add('active');

                // If switching to categories tab, render grid
                if (tabId === 'categories-tab' && window.categoriesService) {
                    window.categoriesService.renderCategoriesGrid();
                }
            });
        });

        // NOTE: add-category-btn and categories-grid delegation are handled by CategoriesService.bindEvents()

        // ========== NEW PRODUCT ==========
        document.getElementById('add-product-btn')?.addEventListener('click', () => this.openProductModal());
        document.getElementById('save-product')?.addEventListener('click', () => this.saveProduct());

        // Quick Add Category from Product Modal
        document.getElementById('quick-add-category-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.categoriesService) {
                window.categoriesService.openModal();
                const catModal = document.getElementById('category-modal');
                if (catModal) catModal.style.zIndex = '2000';
            }
        });

        // ========== NEW USER ==========
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.openUserModal());
        document.getElementById('save-user')?.addEventListener('click', () => this.saveUser());

        // ========== PRODUCT SEARCH & FILTER ==========
        document.getElementById('products-search')?.addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });
        document.getElementById('products-category-filter')?.addEventListener('change', () => {
            this.loadProducts();
        });

        // Load more pagination
        document.getElementById('load-more-products')?.addEventListener('click', () => {
            this.currentPage++;
            this.renderProductPage();
        });

        // ========== IMPORT / EXPORT ==========
        document.getElementById('import-googlesheets-btn')?.addEventListener('click', () => this.importGoogleSheets());
        document.getElementById('paste-csv-btn')?.addEventListener('click', () => this.pasteCSV());
        document.getElementById('import-products-file')?.addEventListener('change', (e) => this.importFile(e));
        document.getElementById('export-products-btn')?.addEventListener('click', () => this.exportProducts());

        // ========== PRODUCT IMAGE ==========
        document.getElementById('product-image')?.addEventListener('change', (e) => this.handleProductImage(e));
        document.getElementById('clear-product-image')?.addEventListener('click', () => {
            document.getElementById('product-image-preview').src = '';
            document.getElementById('product-image').value = '';
        });

        // Save users btn (for inline edits)
        document.getElementById('save-users-btn')?.addEventListener('click', () => this.saveUsers());
    },

    // ========== REFRESH CATEGORY SELECTS ==========
    refreshCategorySelects() {
        const categories = window.categoriesService?.categories || [];

        // Refresh the filter dropdown
        const filter = document.getElementById('products-category-filter');
        if (filter) {
            const currentVal = filter.value;
            filter.innerHTML = '<option value="">Todas las categorías</option>';
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.nombre || cat.name;
                filter.appendChild(opt);
            });
            filter.value = currentVal;
        }

        // Refresh the product modal category select
        const catSelect = document.getElementById('product-category');
        if (catSelect) {
            const currentVal = catSelect.value;
            catSelect.innerHTML = '<option value="">Sin categoría</option>';
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id; // Use ID as value
                opt.textContent = cat.nombre || cat.name;
                catSelect.appendChild(opt);
            });
            // Restore value if possible, logic handled in openProductModal too
            catSelect.value = currentVal;
        }
    },

    // ========== PRODUCT LIST ==========
    loadProducts() {
        const products = window.productsService?.getProducts() || [];

        // Always refresh category selects
        this.refreshCategorySelects();

        // Filter
        const search = document.getElementById('products-search')?.value?.toLowerCase() || '';
        const categoryFilter = document.getElementById('products-category-filter')?.value || '';

        this.filteredProducts = products.filter(p => {
            const name = (p.nombre || p.name || '').toLowerCase();
            const code = (p.codigo || p.code || '').toLowerCase();
            const cat = p.categoria || p.categoriaId || p.category || '';

            const matchSearch = !search || name.includes(search) || code.includes(search);
            const matchCategory = !categoryFilter || cat === categoryFilter;
            return matchSearch && matchCategory;
        }).sort((a, b) => {
            const nameA = (a.nombre || a.name || '').toLowerCase();
            const nameB = (b.nombre || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'es');
        });

        this.currentPage = 0;
        this.renderProductPage(true);
    },

    renderProductPage(reset = false) {
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        const start = reset ? 0 : this.currentPage * this.pageSize;
        const end = (this.currentPage + 1) * this.pageSize;
        const pageProducts = this.filteredProducts.slice(start, end);
        const categories = window.categoriesService?.categories || [];

        const getCatName = (product) => {
            const catId = product.categoriaId || product.category_id;
            if (catId) {
                const cat = categories.find(c => c.id === catId);
                if (cat) return cat.nombre || cat.name;
            }
            return product.categoria || product.category || '-';
        };

        const rows = pageProducts.map(p => {
            const name = p.nombre || p.name || 'Sin nombre';
            const price = p.precio || p.price || 0;
            const cost = p.costo || p.cost || 0;
            const stock = p.stock ?? 0;
            const category = getCatName(p);
            const img = p.imagen || p.image || '';
            const imgTag = img ? `<img src="${img}" style="width:30px;height:30px;border-radius:4px;margin-right:8px;object-fit:cover;">` : '';

            return `
                <tr data-id="${p.id}">
                    <td><input type="checkbox" class="product-checkbox" value="${p.id}"></td>
                    <td>${imgTag}${Utils.escapeHtml(name)}</td>
                    <td>${Utils.escapeHtml(category)}</td>
                    <td>${Utils.formatCurrency(price)}</td>
                    <td>${Utils.formatCurrency(cost)}</td>
                    <td><span class="badge ${stock < 10 ? 'badge-danger' : 'badge-success'}">${stock}</span></td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="CatalogUI.editProduct('${p.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="CatalogUI.deleteProduct('${p.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');

        if (reset) {
            tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center">No hay productos. Importa o crea uno nuevo.</td></tr>';
        } else {
            tbody.innerHTML += rows;
        }

        // Show/hide load more
        const loadMore = document.getElementById('load-more-products');
        if (loadMore) {
            loadMore.style.display = end < this.filteredProducts.length ? 'block' : 'none';
        }

        // Update checkbox listeners
        document.querySelectorAll('.product-checkbox').forEach(cb => {
            cb.addEventListener('change', () => this.updateBulkActions());
        });
    },

    filterProducts(query) {
        this.loadProducts();
    },

    updateBulkActions() {
        const checked = document.querySelectorAll('.product-checkbox:checked');
        const bar = document.getElementById('bulk-actions-bar');
        const count = document.getElementById('bulk-count');
        if (bar) bar.classList.toggle('hidden', checked.length === 0);
        if (count) count.textContent = `${checked.length} seleccionados`;
    },

    // ========== PRODUCT MODAL ==========
    openProductModal(product = null) {
        document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
        document.getElementById('product-id').value = product?.id || '';
        document.getElementById('product-name').value = product?.nombre || product?.name || '';
        document.getElementById('product-price').value = product?.precio || product?.price || '';
        document.getElementById('product-cost').value = product?.costo || product?.cost || '';
        document.getElementById('product-stock').value = product?.stock ?? '';
        document.getElementById('product-barcode').value = product?.codigo || product?.code || '';
        document.getElementById('product-active').checked = product?.activo !== false;
        document.getElementById('product-image-preview').src = product?.imagen || product?.image || '';

        // Set category
        // Set category (Smart handling for ID vs Name)
        const catSelect = document.getElementById('product-category');
        if (catSelect) {
            const catId = product?.categoriaId || product?.categoryId || product?.category_id;
            const catName = product?.categoria || product?.category;

            if (catId) {
                catSelect.value = catId;
            } else if (catName) {
                // Legacy support: Try to find ID by name
                const categories = window.categoriesService?.categories || [];
                const matcheCat = categories.find(c => (c.nombre || c.name) === catName);
                if (matcheCat) {
                    catSelect.value = matcheCat.id;
                } else {
                    catSelect.value = '';
                }
            } else {
                catSelect.value = '';
            }
        }

        document.getElementById('product-modal')?.classList.add('active');
    },

    async editProduct(id) {
        const product = window.productsService?.getProduct(id);
        if (product) this.openProductModal(product);
    },

    async saveProduct() {
        const id = document.getElementById('product-id').value;

        // Get category info
        const catId = document.getElementById('product-category').value;
        let catName = 'Sin categoría';
        if (catId) {
            const categories = window.categoriesService?.categories || [];
            const cat = categories.find(c => c.id === catId);
            if (cat) catName = cat.nombre || cat.name;
        }

        const productData = {
            nombre: document.getElementById('product-name').value.trim(),
            precio: parseFloat(document.getElementById('product-price').value) || 0,
            costo: parseFloat(document.getElementById('product-cost').value) || 0,
            stock: parseInt(document.getElementById('product-stock').value) || 0,
            categoriaId: catId,     // Primary Link
            categoria: catName,     // Display Name / Legacy
            codigo: document.getElementById('product-barcode').value.trim(),
            activo: document.getElementById('product-active').checked,
            imagen: document.getElementById('product-image-preview').src || ''
        };

        if (!productData.nombre) {
            Utils.showToast('Ingresa el nombre del producto', 'error');
            return;
        }

        try {
            if (id) {
                // Update existing
                await window.productsService.updateProduct(id, productData);
                Utils.showToast('Producto actualizado ✅', 'success');
            } else {
                // Create new
                await window.productsService.createProduct(productData);
                Utils.showToast('Producto creado ✅', 'success');
            }
            document.getElementById('product-modal')?.classList.remove('active');
        } catch (e) {
            console.error('Error saving product:', e);
            Utils.showToast('Error al guardar: ' + e.message, 'error');
        }
    },

    async deleteProduct(id) {
        if (!confirm('¿Eliminar este producto?')) return;
        try {
            await window.productsService.deleteProduct(id);
            Utils.showToast('Producto eliminado', 'success');
        } catch (e) {
            console.error('Error deleting product:', e);
            Utils.showToast('Error al eliminar', 'error');
        }
    },

    handleProductImage(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('product-image-preview').src = ev.target.result;
        };
        reader.readAsDataURL(file);
    },

    // ========== IMPORT FUNCTIONALITY ==========
    importGoogleSheets() {
        const url = prompt('Ingresa la URL pública de tu Google Sheet:\n\n(Debe estar publicada como CSV: Archivo → Compartir → Publicar en la web → CSV)');
        if (!url) return;

        // Convert to CSV export URL
        let csvUrl = url;
        if (url.includes('docs.google.com/spreadsheets')) {
            const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
                csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
            }
        }

        Utils.showToast('Descargando datos...', 'info');

        fetch(csvUrl)
            .then(r => r.text())
            .then(csv => this.processCSV(csv))
            .catch(e => {
                console.error('Error importing Google Sheet:', e);
                Utils.showToast('Error: Verifica que el Sheet esté publicado como CSV', 'error');
            });
    },

    pasteCSV() {
        const csv = prompt('Pega tus datos CSV aquí:\n\nFormato: nombre,precio,costo,stock,categoría\n\nEjemplo:\nCompleto,2500,800,100,Vienesa\nPapas Fritas,1500,500,50,Acompañamientos');
        if (!csv) return;
        this.processCSV(csv);
    },

    processCSV(csvText) {
        try {
            const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
            if (lines.length < 2) {
                Utils.showToast('CSV vacío o sin datos', 'warning');
                return;
            }

            const headers = lines[0].map(h => h.toLowerCase());
            const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('name') || h.includes('producto'));
            const priceIdx = headers.findIndex(h => h.includes('precio') || h.includes('price'));
            const costIdx = headers.findIndex(h => h.includes('costo') || h.includes('cost'));
            const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('cantidad'));
            const catIdx = headers.findIndex(h => h.includes('categor') || h.includes('category'));

            if (nameIdx === -1 || priceIdx === -1) {
                Utils.showToast('CSV debe tener columnas "nombre" y "precio"', 'error');
                return;
            }

            const products = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i];
                if (!row[nameIdx]) continue;

                products.push({
                    nombre: row[nameIdx],
                    precio: parseFloat(row[priceIdx]) || 0,
                    costo: costIdx >= 0 ? parseFloat(row[costIdx]) || 0 : 0,
                    stock: stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0,
                    categoria: catIdx >= 0 ? row[catIdx] || 'Sin categoría' : 'Sin categoría'
                });
            }

            if (products.length === 0) {
                Utils.showToast('No se encontraron productos válidos', 'warning');
                return;
            }

            if (confirm(`¿Importar ${products.length} productos?`)) {
                window.productsService.importProducts(products)
                    .then(result => {
                        if (result.success) {
                            Utils.showToast(`✅ ${result.count} productos importados`, 'success');
                        } else {
                            Utils.showToast('Error: ' + result.error, 'error');
                        }
                    });
            }
        } catch (e) {
            console.error('Error processing CSV:', e);
            Utils.showToast('Error al procesar CSV', 'error');
        }
    },

    async importFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
            const text = await file.text();
            this.processCSV(text);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Use SheetJS if available
            if (typeof XLSX === 'undefined') {
                Utils.showToast('Cargando librería Excel...', 'info');
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
                script.onload = () => this.parseExcel(file);
                document.head.appendChild(script);
            } else {
                this.parseExcel(file);
            }
        } else {
            Utils.showToast('Formato no soportado. Usa CSV o Excel.', 'error');
        }
        e.target.value = '';
    },

    parseExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                this.processCSV(csv);
            } catch (err) {
                console.error('Error reading Excel:', err);
                Utils.showToast('Error al leer archivo Excel', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    exportProducts() {
        const products = window.productsService?.getProducts() || [];
        if (products.length === 0) {
            Utils.showToast('No hay productos para exportar', 'warning');
            return;
        }

        const headers = ['nombre', 'precio', 'costo', 'stock', 'categoria', 'codigo'];
        const csv = [headers.join(',')];
        products.forEach(p => {
            csv.push([
                `"${(p.nombre || p.name || '').replace(/"/g, '""')}"`,
                p.precio || p.price || 0,
                p.costo || p.cost || 0,
                p.stock || 0,
                `"${(p.categoria || p.category || '').replace(/"/g, '""')}"`,
                `"${(p.codigo || p.code || '').replace(/"/g, '""')}"`
            ].join(','));
        });

        const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `productos_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        Utils.showToast('Exportación completada ✅', 'success');
    },

    // ========== USER MANAGEMENT ==========
    loadUsers() {
        if (!window.usersService) return;
        const db = window.FirebaseConfig.db;
        db.collection('usuarios').get().then(snapshot => {
            const users = [];
            snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

            const tbody = document.getElementById('users-tbody');
            if (!tbody) return;

            tbody.innerHTML = users.map(u => {
                const roleBadge = u.rol === 'admin'
                    ? '<span class="badge badge-warning">Admin</span>'
                    : '<span class="badge badge-info">Cajero</span>';
                const statusBadge = u.activo !== false
                    ? '<span class="badge badge-success">Activo</span>'
                    : '<span class="badge badge-danger">Inactivo</span>';

                return `
                    <tr data-id="${u.id}">
                        <td>${Utils.escapeHtml(u.nombre || u.name || '-')}</td>
                        <td>${roleBadge}</td>
                        <td>${statusBadge}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-secondary" onclick="CatalogUI.editUser('${u.id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="CatalogUI.deleteUser('${u.id}')">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="4" style="text-align:center">No hay usuarios</td></tr>';
        }).catch(e => console.error('Error loading users:', e));
    },

    openUserModal(user = null) {
        document.getElementById('user-modal-title').textContent = user ? 'Editar Usuario' : 'Nuevo Usuario';
        document.getElementById('user-id').value = user?.id || '';
        document.getElementById('user-name').value = user?.nombre || user?.name || '';
        document.getElementById('user-role').value = user?.rol || user?.role || 'cashier';
        document.getElementById('user-pin').value = '';
        document.getElementById('user-active').checked = user?.activo !== false;
        document.getElementById('user-modal')?.classList.add('active');
    },

    async editUser(id) {
        try {
            const doc = await window.FirebaseConfig.db.collection('usuarios').doc(id).get();
            if (doc.exists) {
                this.openUserModal({ id: doc.id, ...doc.data() });
            }
        } catch (e) {
            console.error('Error loading user:', e);
        }
    },

    async saveUser() {
        const id = document.getElementById('user-id').value;
        const nombre = document.getElementById('user-name').value.trim();
        const rol = document.getElementById('user-role').value;
        const pin = document.getElementById('user-pin').value;
        const activo = document.getElementById('user-active').checked;

        if (!nombre) {
            Utils.showToast('Ingresa el nombre', 'error');
            return;
        }
        if (!id && (!pin || pin.length !== 4)) {
            Utils.showToast('PIN debe tener 4 dígitos', 'error');
            return;
        }

        try {
            const userData = { nombre, rol, activo };
            if (pin) userData.pin = pin;

            const db = window.FirebaseConfig.db;
            if (id) {
                await db.collection('usuarios').doc(id).update(userData);
                Utils.showToast('Usuario actualizado ✅', 'success');
            } else {
                // Check PIN not already taken
                const existing = await db.collection('usuarios').where('pin', '==', pin).get();
                if (!existing.empty) {
                    Utils.showToast('Este PIN ya está en uso', 'error');
                    return;
                }
                userData.fechaCreacion = window.FirebaseConfig.serverTimestamp();
                await db.collection('usuarios').add(userData);
                Utils.showToast('Usuario creado ✅', 'success');
            }

            document.getElementById('user-modal')?.classList.remove('active');
            this.loadUsers();
        } catch (e) {
            console.error('Error saving user:', e);
            Utils.showToast('Error: ' + e.message, 'error');
        }
    },

    async deleteUser(id) {
        if (!confirm('¿Eliminar este usuario?')) return;
        try {
            await window.FirebaseConfig.db.collection('usuarios').doc(id).delete();
            Utils.showToast('Usuario eliminado', 'success');
            this.loadUsers();
        } catch (e) {
            Utils.showToast('Error al eliminar', 'error');
        }
    }
};

// Also enhance the Products compat object
if (typeof Products !== 'undefined') {
    Products.toggleSelectAll = function () {
        const checkAll = document.getElementById('select-all-header') || document.getElementById('select-all-products');
        const checkboxes = document.querySelectorAll('.product-checkbox');
        checkboxes.forEach(cb => { cb.checked = checkAll?.checked || false; });
        CatalogUI.updateBulkActions();
    };

    Products.deleteSelected = function () {
        const checked = document.querySelectorAll('.product-checkbox:checked');
        if (checked.length === 0) {
            Utils.showToast('Selecciona productos para eliminar', 'warning');
            return;
        }
        if (!confirm(`¿Eliminar ${checked.length} producto(s)?`)) return;
        checked.forEach(cb => {
            const id = cb.value;
            if (id) window.productsService?.deleteProduct(id);
        });
    };
}

console.log('✅ CatalogUI module loaded');
