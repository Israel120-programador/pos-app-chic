// js/products.js
// Gestión de productos con sincronización Firebase en tiempo real

// Use window.FirebaseConfig directly to avoid const redeclaration in global scope

class ProductsService {
    constructor() {
        const { db } = window.FirebaseConfig;
        this.productsRef = db.collection('productos');
        this.unsubscribe = null;
        this.products = [];
        this.listeners = [];
    }

    // ========== ESCUCHAR PRODUCTOS EN TIEMPO REAL ==========
    startListening(callback) {
        console.log('👂 Iniciando escucha de productos en tiempo real...');

        this.unsubscribe = this.productsRef
            .where('activo', '==', true)
            .onSnapshot(
                (snapshot) => {
                    this.products = [];

                    snapshot.forEach((doc) => {
                        this.products.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });

                    console.log(`📦 Productos actualizados: ${this.products.length}`);

                    // Notificar a todos los listeners
                    this.listeners.forEach(listener => listener(this.products));

                    // Callback principal
                    if (callback) callback(this.products);

                    window.FirebaseConfig.showSyncIndicator('✓ Productos sincronizados');
                },
                (error) => {
                    console.error('❌ Error escuchando productos:', error);
                    window.FirebaseConfig.handleFirebaseError(error, 'productos');
                }
            );
    }

    // Detener escucha
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            console.log('🔇 Escucha de productos detenida');
        }
    }

    // Agregar listener adicional
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Alias for compatibility
    subscribe(callback) {
        this.addListener(callback);
        // Llamar inmediatamente con datos actuales si existen
        if (this.products.length > 0) {
            callback(this.products);
        }
    }

    // Obtener todos los productos (sync, desde caché local)
    getProducts() {
        return this.products;
    }

    // Obtener un producto por ID (sync, desde caché local)
    getProduct(productId) {
        return this.products.find(p => p.id === productId) || null;
    }

    // ========== CREAR PRODUCTO (solo admin) ==========
    async createProduct(productData) {
        try {
            window.FirebaseConfig.showSyncIndicator('Creando producto...');

            const product = {
                nombre: productData.nombre || '',
                precio: parseFloat(productData.precio) || 0,
                costo: parseFloat(productData.costo) || 0,
                stock: parseInt(productData.stock) || 0,
                stockMinimo: parseInt(productData.stockMinimo) || 0,
                categoria: productData.categoria || 'Sin categoría',
                codigo: productData.codigo || '',
                descripcion: productData.descripcion || '',
                imagen: productData.imagen || '',
                activo: true,
                fechaCreacion: window.FirebaseConfig.serverTimestamp(),
                ultimaModificacion: window.FirebaseConfig.serverTimestamp()
            };

            const docRef = await this.productsRef.add(product);

            console.log('✅ Producto creado:', docRef.id);
            window.FirebaseConfig.showSyncIndicator('✓ Producto creado');

            return { success: true, id: docRef.id };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'crear producto');
        }
    }

    // ========== ACTUALIZAR PRODUCTO ==========
    async updateProduct(productId, updates) {
        try {
            window.FirebaseConfig.showSyncIndicator('Actualizando producto...');

            const updateData = {
                ...updates,
                ultimaModificacion: window.FirebaseConfig.serverTimestamp()
            };

            // Convertir números si vienen como strings
            if (updateData.precio) updateData.precio = parseFloat(updateData.precio);
            if (updateData.costo) updateData.costo = parseFloat(updateData.costo);
            if (updateData.stock) updateData.stock = parseInt(updateData.stock);
            if (updateData.stockMinimo) updateData.stockMinimo = parseInt(updateData.stockMinimo);

            await this.productsRef.doc(productId).update(updateData);

            console.log('✅ Producto actualizado:', productId);
            window.FirebaseConfig.showSyncIndicator('✓ Producto actualizado');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'actualizar producto');
        }
    }

    // ========== ELIMINAR PRODUCTO (soft delete) ==========
    async deleteProduct(productId) {
        try {
            window.FirebaseConfig.showSyncIndicator('Eliminando producto...');

            // No eliminar físicamente, solo marcar como inactivo
            await this.productsRef.doc(productId).update({
                activo: false,
                fechaEliminacion: window.FirebaseConfig.serverTimestamp()
            });

            console.log('✅ Producto eliminado:', productId);
            window.FirebaseConfig.showSyncIndicator('✓ Producto eliminado');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'eliminar producto');
        }
    }

    // ========== ACTUALIZAR STOCK (ATÓMICO) ==========
    async updateStock(productId, quantityChange) {
        try {
            const productRef = this.productsRef.doc(productId);

            await window.FirebaseConfig.db.runTransaction(async (transaction) => {
                const productDoc = await transaction.get(productRef);

                if (!productDoc.exists) {
                    throw new Error('Producto no encontrado');
                }

                const currentStock = productDoc.data().stock || 0;
                const newStock = currentStock + quantityChange;

                if (newStock < 0) {
                    throw new Error('Stock insuficiente');
                }

                transaction.update(productRef, {
                    stock: newStock,
                    ultimaModificacion: window.FirebaseConfig.serverTimestamp()
                });
            });

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'actualizar stock');
        }
    }

    // ========== ACTUALIZAR STOCK MÚLTIPLE (para ventas) ==========
    async updateMultipleStocks(items) {
        try {
            window.FirebaseConfig.showSyncIndicator('Actualizando inventario...');

            await window.FirebaseConfig.db.runTransaction(async (transaction) => {
                // 1. Leer todos los productos primero
                const productRefs = items.map(item => this.productsRef.doc(item.productId));
                const productDocs = await Promise.all(
                    productRefs.map(ref => transaction.get(ref))
                );

                // 2. Verificar que todos existen y tienen stock suficiente
                for (let i = 0; i < productDocs.length; i++) {
                    const doc = productDocs[i];
                    const item = items[i];

                    if (!doc.exists) {
                        throw new Error(`Producto ${item.productId} no encontrado`);
                    }

                    const currentStock = doc.data().stock || 0;

                    if (currentStock < item.cantidad) {
                        throw new Error(
                            `Stock insuficiente para ${doc.data().nombre}. ` +
                            `Disponible: ${currentStock}, Requerido: ${item.cantidad}`
                        );
                    }
                }

                // 3. Actualizar todos los stocks
                for (let i = 0; i < productRefs.length; i++) {
                    const ref = productRefs[i];
                    const item = items[i];
                    const currentStock = productDocs[i].data().stock;

                    transaction.update(ref, {
                        stock: currentStock - item.cantidad,
                        ultimaModificacion: window.FirebaseConfig.serverTimestamp()
                    });
                }
            });

            console.log('✅ Stocks actualizados correctamente');
            window.FirebaseConfig.showSyncIndicator('✓ Inventario actualizado');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'actualizar inventario');
        }
    }

    // ========== OBTENER PRODUCTO POR ID (async, desde Firestore) ==========
    async fetchProduct(productId) {
        try {
            const doc = await this.productsRef.doc(productId).get();

            if (!doc.exists) {
                return { success: false, error: 'Producto no encontrado' };
            }

            return {
                success: true,
                product: { id: doc.id, ...doc.data() }
            };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener producto');
        }
    }

    // ========== BUSCAR PRODUCTOS ==========
    async searchProducts(searchTerm) {
        try {
            const term = searchTerm.toLowerCase();

            // Filtrar localmente (Firebase no tiene búsqueda full-text)
            const results = this.products.filter(product =>
                product.nombre.toLowerCase().includes(term) ||
                product.codigo?.toLowerCase().includes(term) ||
                product.categoria?.toLowerCase().includes(term)
            );

            return { success: true, products: results };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'buscar productos');
        }
    }

    // ========== IMPORTAR PRODUCTOS DESDE EXCEL ==========
    async importProducts(productsArray) {
        try {
            window.FirebaseConfig.showSyncIndicator('Importando productos...');

            const batch = window.FirebaseConfig.db.batch();
            let count = 0;

            for (const productData of productsArray) {
                const product = {
                    nombre: productData.nombre || '',
                    precio: parseFloat(productData.precio) || 0,
                    costo: parseFloat(productData.costo) || 0,
                    stock: parseInt(productData.stock) || 0,
                    stockMinimo: parseInt(productData.stockMinimo) || 0,
                    categoria: productData.categoria || 'Sin categoría',
                    codigo: productData.codigo || '',
                    activo: true,
                    fechaCreacion: window.FirebaseConfig.serverTimestamp()
                };

                const docRef = this.productsRef.doc();
                batch.set(docRef, product);
                count++;

                // Firebase batch limit: 500 operations
                if (count >= 500) {
                    await batch.commit();
                    count = 0;
                }
            }

            // Commit remaining
            if (count > 0) {
                await batch.commit();
            }

            console.log(`✅ ${productsArray.length} productos importados`);
            window.FirebaseConfig.showSyncIndicator(`✓ ${productsArray.length} productos importados`);

            return { success: true, count: productsArray.length };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'importar productos');
        }
    }
}

// Crear instancia global
window.productsService = new ProductsService();

console.log('✅ ProductsService inicializado');
