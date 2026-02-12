// js/categories.js
// Gestión de categorías con sincronización Firebase

// Use window.FirebaseConfig directly to avoid const redeclaration in global scope

class CategoriesService {
    constructor() {
        const { db } = window.FirebaseConfig;
        this.categoriesRef = db.collection('categorias');
        this.categories = [];
        this.unsubscribe = null;
    }

    // ========== INICIALIZAR ==========
    async init() {
        this.bindEvents();
        // Comenzar a escuchar cambios
        this.startListening();
    }

    // ========== BIND EVENTS ==========
    bindEvents() {
        // Eventos UI para gestión de categorías (si existen los elementos)
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-category')?.addEventListener('click', () => this.save());
        document.getElementById('category-image')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('clear-category-image')?.addEventListener('click', () => this.clearImage());

        // Delegación para botones de editar/eliminar en el grid
        document.getElementById('categories-grid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const card = btn.closest('.category-card');
            const id = card?.dataset.id;

            if (btn.classList.contains('btn-edit')) {
                e.stopPropagation();
                this.edit(id);
            } else if (btn.classList.contains('btn-delete')) {
                e.stopPropagation();
                this.delete(id);
            }
        });
    }

    // ========== ESCUCHAR CATEGORÍAS EN TIEMPO REAL ==========
    startListening(callback) {
        console.log('👂 Iniciando escucha de categorías...');

        this.unsubscribe = this.categoriesRef
            .orderBy('nombre', 'asc')
            .onSnapshot(
                (snapshot) => {
                    this.categories = [];
                    snapshot.forEach((doc) => {
                        this.categories.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });

                    console.log(`📂 Categorías actualizadas: ${this.categories.length}`);

                    // Actualizar UI si es necesario
                    this.renderCategoriesGrid();

                    if (window.posScreen && window.posScreen.renderProducts) {
                        window.posScreen.renderProducts();
                    }

                    // Update Catalog UI if active
                    if (window.CatalogUI && window.CatalogUI.loadProducts) {
                        // We just want to refresh the select boxes, but loadProducts does that.
                        window.CatalogUI.loadProducts();
                    }

                    if (callback) callback(this.categories);

                    window.FirebaseConfig.showSyncIndicator('✓ Categorías sincronizadas');
                },
                (error) => {
                    console.error('❌ Error escuchando categorías:', error);
                    window.FirebaseConfig.handleFirebaseError(error, 'categorías');
                }
            );
    }

    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    // ========== OBTENER CATEGORÍAS (Cache) ==========
    getCategories() {
        return this.categories;
    }

    // ========== GUARDAR / ACTUALIZAR ==========
    async save() {
        const id = document.getElementById('category-id').value;
        const nombre = document.getElementById('category-name').value.trim();
        const color = document.getElementById('category-color').value;
        const icon = document.getElementById('category-icon').value.trim();

        if (!nombre) {
            window.Utils?.showToast('El nombre es requerido', 'error');
            return;
        }

        window.FirebaseConfig.showSyncIndicator('Guardando categoría...');

        try {
            const categoryData = {
                nombre,
                color,
                icon: icon || '📦',
                imagen: this.currentImageData || null,
                ultimaModificacion: window.FirebaseConfig.serverTimestamp()
            };

            if (id) {
                // Actualizar
                await this.categoriesRef.doc(id).update(categoryData);
                window.Utils?.showToast('Categoría actualizada', 'success');
            } else {
                // Crear
                categoryData.fechaCreacion = window.FirebaseConfig.serverTimestamp();
                categoryData.activo = true;
                await this.categoriesRef.add(categoryData);
                window.Utils?.showToast('Categoría creada', 'success');
            }

            document.getElementById('category-modal').classList.remove('active');

        } catch (error) {
            window.FirebaseConfig.handleFirebaseError(error, 'guardar categoría');
        }
    }

    // ========== EDITAR (Abrir Modal) ==========
    edit(id) {
        const category = this.categories.find(c => c.id === id);
        if (!category) return;

        this.openModal(category);
    }

    // ========== ELIMINAR ==========
    async delete(id) {
        if (!confirm('¿Eliminar esta categoría?')) return;

        try {
            window.FirebaseConfig.showSyncIndicator('Eliminando categoría...');
            await this.categoriesRef.doc(id).delete();
            window.Utils?.showToast('Categoría eliminada', 'success');
        } catch (error) {
            window.FirebaseConfig.handleFirebaseError(error, 'eliminar categoría');
        }
    }

    // ========== RENDERIZAR GRID (Gestión) ==========
    renderCategoriesGrid() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        grid.innerHTML = this.categories.map(c => `
            <div class="category-card" data-id="${c.id}">
                <div class="category-card-actions">
                    <button class="btn btn-sm btn-secondary btn-icon btn-edit">✏️</button>
                    <button class="btn btn-sm btn-danger btn-icon btn-delete">🗑️</button>
                </div>
                <div class="category-card-icon" style="background: ${c.color}20; color: ${c.color}">
                    ${c.icon || '📦'}
                </div>
                <div class="category-card-name">${c.nombre}</div>
            </div>
        `).join('');
    }

    // ========== HELPERS MODAL ==========
    openModal(category = null) {
        const modal = document.getElementById('category-modal');
        if (!modal) return;

        document.getElementById('category-modal-title').textContent =
            category ? 'Editar Categoría' : 'Nueva Categoría';

        document.getElementById('category-id').value = category?.id || '';
        document.getElementById('category-name').value = category?.nombre || '';
        document.getElementById('category-color').value = category?.color || '#FF6B35';
        document.getElementById('category-icon').value = category?.icon || '';

        // Imagen
        const preview = document.getElementById('category-image-preview');
        const clearBtn = document.getElementById('clear-category-image');

        if (category?.imagen) {
            preview.src = category.imagen;
            preview.classList.add('has-image');
            clearBtn?.classList.remove('hidden');
            this.currentImageData = category.imagen;
        } else {
            preview.src = '';
            preview.classList.remove('has-image');
            clearBtn?.classList.add('hidden');
            this.currentImageData = null;
        }

        modal.classList.add('active');
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('category-image-preview');
            const clearBtn = document.getElementById('clear-category-image');

            preview.src = event.target.result;
            preview.classList.add('has-image');
            clearBtn?.classList.remove('hidden');

            this.currentImageData = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    clearImage() {
        const preview = document.getElementById('category-image-preview');
        const input = document.getElementById('category-image');
        const clearBtn = document.getElementById('clear-category-image');

        preview.src = '';
        preview.classList.remove('has-image');
        input.value = '';
        clearBtn?.classList.add('hidden');
        this.currentImageData = null;
    }
}

// Crear instancia global
window.categoriesService = new CategoriesService();
console.log('✅ CategoriesService inicializado');
