// js/db.js
// Compatibility layer: Maps old DB API to Firebase Firestore
// Translates Spanish Firestore field names → English field names for legacy modules

const DB = {
    _collectionMap: {
        'products': 'productos',
        'categories': 'categorias',
        'sales': 'ventas',
        'users': 'usuarios',
        'customers': 'clientes',
        'settings': 'configuracion',
        'inventory_movements': 'movimientos_inventario'
    },

    // Spanish → English field mapping for products
    _productFields: {
        'nombre': 'name',
        'precio': 'price',
        'costo': 'cost',
        'stock': 'stock',
        'stockMinimo': 'minStock',
        'categoria': 'category',
        'categoriaId': 'category_id',
        'codigo': 'code',
        'descripcion': 'description',
        'imagen': 'image',
        'activo': 'active',
        'fechaCreacion': 'created_at',
        'ultimaModificacion': 'updated_at'
    },

    // Spanish → English field mapping for categories
    _categoryFields: {
        'nombre': 'name',
        'color': 'color',
        'icono': 'icon',
        'icon': 'icon',
        'imagen': 'image',
        'orden': 'order',
        'activo': 'active'
    },

    // Spanish → English field mapping for sales
    _saleFields: {
        'fecha': 'timestamp',
        'total': 'total',
        'subtotal': 'subtotal',
        'impuesto': 'tax',
        'metodoPago': 'payment_method',
        'vendedor': 'seller',
        'vendedorId': 'seller_id',
        'items': 'items',
        'comentarios': 'comments',
        'estado': 'status',
        'numero': 'number'
    },

    // Spanish → English field mapping for sale items
    _saleItemFields: {
        'productoId': 'product_id',
        'productId': 'product_id',
        'nombre': 'product_name',
        'cantidad': 'quantity',
        'precioUnitario': 'unit_price',
        'subtotal': 'subtotal',
        'precio': 'price'
    },

    _getRef(storeName) {
        const db = window.FirebaseConfig.db;
        const mapped = this._collectionMap[storeName] || storeName;
        return db.collection(mapped);
    },

    // Translate a document's fields from Spanish to English
    _translateDoc(storeName, doc) {
        let fieldMap = null;
        if (storeName === 'products') fieldMap = this._productFields;
        else if (storeName === 'categories') fieldMap = this._categoryFields;
        else if (storeName === 'sales') fieldMap = this._saleFields;

        if (!fieldMap) return doc;

        const translated = { id: doc.id };
        for (const [key, value] of Object.entries(doc)) {
            if (key === 'id') continue;
            const englishKey = fieldMap[key] || key;

            // Translate sale items
            if (storeName === 'sales' && key === 'items' && Array.isArray(value)) {
                translated[englishKey] = value.map(item => {
                    const tItem = {};
                    for (const [iKey, iVal] of Object.entries(item)) {
                        const engKey = this._saleItemFields[iKey] || iKey;
                        tItem[engKey] = iVal;
                    }
                    // Ensure product_id exists
                    if (!tItem.product_id && item.productoId) tItem.product_id = item.productoId;
                    if (!tItem.product_name && item.nombre) tItem.product_name = item.nombre;
                    if (!tItem.quantity && item.cantidad) tItem.quantity = item.cantidad;
                    return tItem;
                });
            } else {
                translated[englishKey] = value;
            }

            // Also keep original Spanish key for compatibility
            translated[key] = value;
        }

        // For products, ensure 'name' and 'category' always exist
        if (storeName === 'products') {
            if (!translated.name) translated.name = translated.nombre || '';
            if (!translated.category) translated.category = translated.categoria || translated.categoriaId || '';
        }
        // For categories, ensure 'name' and 'icon' always exist
        if (storeName === 'categories') {
            if (!translated.name) translated.name = translated.nombre || '';
            if (!translated.icon) translated.icon = translated.icono || '📦';
        }

        return translated;
    },

    async getAll(storeName) {
        // Use service caches first (faster and works even if Firestore is blocked)
        if (storeName === 'products' && window.productsService?.products?.length > 0) {
            return window.productsService.products.map(p => this._translateDoc(storeName, { ...p }));
        }
        if (storeName === 'sales' && window.salesService?.sales?.length > 0) {
            return window.salesService.sales.map(s => this._translateDoc(storeName, { ...s }));
        }
        if (storeName === 'categories' && window.categoriesService?.categories?.length > 0) {
            return window.categoriesService.categories.map(c => this._translateDoc(storeName, { ...c }));
        }

        // Fallback to Firestore direct
        try {
            const snapshot = await this._getRef(storeName).get();
            return snapshot.docs.map(doc => {
                const raw = { id: doc.id, ...doc.data() };
                return this._translateDoc(storeName, raw);
            });
        } catch (e) {
            console.error(`DB.getAll(${storeName}) error:`, e);
            return [];
        }
    },

    async get(storeName, id) {
        try {
            const doc = await this._getRef(storeName).doc(id).get();
            if (!doc.exists) return null;
            const raw = { id: doc.id, ...doc.data() };
            return this._translateDoc(storeName, raw);
        } catch (e) {
            console.error(`DB.get(${storeName}, ${id}) error:`, e);
            return null;
        }
    },

    async put(storeName, item) {
        try {
            const id = item.id || item.device_id;
            if (!id) {
                const ref = this._getRef(storeName).doc();
                item.id = ref.id;
                await ref.set(item);
            } else {
                await this._getRef(storeName).doc(id).set(item, { merge: true });
            }
            return item;
        } catch (e) {
            console.error(`DB.put(${storeName}) error:`, e);
            return null;
        }
    },

    async add(storeName, item) {
        try {
            const id = item.id;
            if (id) {
                await this._getRef(storeName).doc(id).set(item);
            } else {
                const ref = await this._getRef(storeName).add(item);
                item.id = ref.id;
            }
            return item;
        } catch (e) {
            console.error(`DB.add(${storeName}) error:`, e);
            return null;
        }
    },

    async delete(storeName, id) {
        try {
            await this._getRef(storeName).doc(id).delete();
            return true;
        } catch (e) {
            console.error(`DB.delete(${storeName}, ${id}) error:`, e);
            return false;
        }
    }
};

console.log('✅ DB compatibility layer loaded (Firebase bridge with field translation)');
