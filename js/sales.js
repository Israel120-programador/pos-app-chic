// js/sales.js
// Gestión de ventas con sincronización Firebase en tiempo real

// Use window.FirebaseConfig directly to avoid const redeclaration in global scope

class SalesService {
    constructor() {
        const { db } = window.FirebaseConfig;
        this.salesRef = db.collection('ventas');
        this.unsubscribe = null;
        this.sales = [];
        this.listeners = [];
    }

    // ========== ESCUCHAR VENTAS EN TIEMPO REAL ==========
    startListening(callback, filters = {}) {
        console.log('👂 Iniciando escucha de ventas en tiempo real...');

        let query = this.salesRef.orderBy('fecha', 'desc');

        // Aplicar filtros opcionales
        if (filters.startDate) {
            query = query.where('fecha', '>=', filters.startDate);
        }
        if (filters.endDate) {
            query = query.where('fecha', '<=', filters.endDate);
        }
        if (filters.vendedor) {
            query = query.where('vendedor', '==', filters.vendedor);
        }

        this.unsubscribe = query.onSnapshot(
            (snapshot) => {
                this.sales = [];

                snapshot.forEach((doc) => {
                    this.sales.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                console.log(`💰 Ventas actualizadas: ${this.sales.length}`);

                // Notificar a todos los listeners
                this.listeners.forEach(listener => listener(this.sales));

                // Callback principal
                if (callback) callback(this.sales);

                window.FirebaseConfig.showSyncIndicator('✓ Ventas sincronizadas');
            },
            (error) => {
                console.error('❌ Error escuchando ventas:', error);
                window.FirebaseConfig.handleFirebaseError(error, 'ventas');
            }
        );
    }

    // Agregar listener adicional
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Alias for compatibility
    subscribe(callback) {
        this.addListener(callback);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    // ========== ESCUCHAR VENTAS DEL DÍA ==========
    startListeningToday(callback) {
        console.log('👂 Iniciando escucha de ventas del día...');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.unsubscribe = this.salesRef
            .where('fecha', '>=', today)
            .orderBy('fecha', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const todaySales = [];
                    let totalVentas = 0;
                    let totalCostos = 0;

                    snapshot.forEach((doc) => {
                        const sale = { id: doc.id, ...doc.data() };
                        todaySales.push(sale);
                        totalVentas += sale.total || 0;
                        totalCostos += sale.costoTotal || 0;
                    });

                    const ganancia = totalVentas - totalCostos;

                    console.log(`💰 Ventas del día: ${todaySales.length} | Total: $${totalVentas.toFixed(2)}`);

                    // Callback con resumen
                    if (callback) {
                        callback({
                            ventas: todaySales,
                            cantidadVentas: todaySales.length,
                            totalVentas,
                            totalCostos,
                            ganancia
                        });
                    }

                    window.FirebaseConfig.showSyncIndicator('✓ Ventas del día actualizadas');
                },
                (error) => {
                    console.error('❌ Error escuchando ventas del día:', error);
                    window.FirebaseConfig.handleFirebaseError(error, 'ventas del día');
                }
            );
    }

    // Detener escucha
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            console.log('🔇 Escucha de ventas detenida');
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
        if (this.sales.length > 0) {
            callback(this.sales);
        }
    }

    // ========== REGISTRAR VENTA ==========
    async createSale(saleData) {
        try {
            window.FirebaseConfig.showSyncIndicator('Registrando venta...');

            // Calcular totales
            let subtotal = 0;
            let costoTotal = 0;

            saleData.items.forEach(item => {
                subtotal += item.precio * item.cantidad;
                costoTotal += (item.costo || 0) * item.cantidad;
            });

            const descuento = parseFloat(saleData.descuento) || 0;
            const total = subtotal - descuento;
            const ganancia = total - costoTotal;

            // Preparar datos de la venta
            const sale = {
                items: saleData.items.map(item => ({
                    productId: item.id || item.productId,
                    nombre: item.nombre,
                    precio: parseFloat(item.precio),
                    costo: parseFloat(item.costo || 0),
                    cantidad: parseInt(item.cantidad),
                    subtotal: parseFloat(item.precio) * parseInt(item.cantidad)
                })),
                subtotal,
                descuento,
                total,
                costoTotal,
                ganancia,
                metodoPago: saleData.metodoPago || 'efectivo',
                vendedor: saleData.vendedor || 'Sistema',
                vendedorId: saleData.vendedorId || 'system',
                cliente: saleData.cliente || 'Público',
                notas: saleData.notas || '',
                fecha: window.FirebaseConfig.serverTimestamp(),
                estado: 'completada',
                turno: saleData.turno || 'Día'
            };

            // Ejecutar en transacción para actualizar stock
            const result = await window.FirebaseConfig.db.runTransaction(async (transaction) => {
                // 1. Verificar y reservar stock
                const stockUpdates = [];

                for (const item of sale.items) {
                    const productRef = window.FirebaseConfig.db.collection('productos').doc(item.productId);
                    const productDoc = await transaction.get(productRef);

                    if (!productDoc.exists) {
                        throw new Error(`Producto ${item.nombre} no encontrado`);
                    }

                    const currentStock = productDoc.data().stock || 0;

                    if (currentStock < item.cantidad) {
                        throw new Error(
                            `Stock insuficiente para ${item.nombre}. ` +
                            `Disponible: ${currentStock}, Requerido: ${item.cantidad}`
                        );
                    }

                    stockUpdates.push({
                        ref: productRef,
                        newStock: currentStock - item.cantidad
                    });
                }

                // 2. Crear venta
                const saleRef = window.FirebaseConfig.db.collection('ventas').doc();
                transaction.set(saleRef, sale);

                // 3. Actualizar stocks
                stockUpdates.forEach(update => {
                    transaction.update(update.ref, {
                        stock: update.newStock,
                        ultimaModificacion: window.FirebaseConfig.serverTimestamp()
                    });
                });

                return saleRef.id;
            });

            console.log('✅ Venta registrada:', result);
            window.FirebaseConfig.showSyncIndicator('✓ Venta registrada');

            // Imprimir recibo si está configurado
            if (window.receiptsService && saleData.imprimirRecibo !== false) {
                window.receiptsService.printReceipt({
                    id: result,
                    ...sale,
                    fecha: new Date() // Override serverTimestamp with actual date for printing
                });
            }

            return { success: true, id: result, sale };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'registrar venta');
        }
    }

    // ========== ANULAR VENTA ==========
    async cancelSale(saleId, motivo = '') {
        try {
            window.FirebaseConfig.showSyncIndicator('Anulando venta...');

            await window.FirebaseConfig.db.runTransaction(async (transaction) => {
                // 1. Obtener venta
                const saleRef = this.salesRef.doc(saleId);
                const saleDoc = await transaction.get(saleRef);

                if (!saleDoc.exists) {
                    throw new Error('Venta no encontrada');
                }

                const saleData = saleDoc.data();

                if (saleData.estado === 'anulada') {
                    throw new Error('La venta ya está anulada');
                }

                // 2. Devolver stock
                for (const item of saleData.items) {
                    const productRef = window.FirebaseConfig.db.collection('productos').doc(item.productId);
                    const productDoc = await transaction.get(productRef);

                    if (productDoc.exists) {
                        const currentStock = productDoc.data().stock || 0;
                        transaction.update(productRef, {
                            stock: currentStock + item.cantidad,
                            ultimaModificacion: window.FirebaseConfig.serverTimestamp()
                        });
                    }
                }

                // 3. Marcar venta como anulada
                transaction.update(saleRef, {
                    estado: 'anulada',
                    fechaAnulacion: window.FirebaseConfig.serverTimestamp(),
                    motivoAnulacion: motivo
                });
            });

            console.log('✅ Venta anulada:', saleId);
            window.FirebaseConfig.showSyncIndicator('✓ Venta anulada');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'anular venta');
        }
    }

    // ========== OBTENER VENTA POR ID ==========
    async getSale(saleId) {
        try {
            const doc = await this.salesRef.doc(saleId).get();

            if (!doc.exists) {
                return { success: false, error: 'Venta no encontrada' };
            }

            return {
                success: true,
                sale: { id: doc.id, ...doc.data() }
            };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener venta');
        }
    }

    // ========== OBTENER VENTAS POR RANGO DE FECHAS ==========
    async getSalesByDateRange(startDate, endDate) {
        try {
            const snapshot = await this.salesRef
                .where('fecha', '>=', startDate)
                .where('fecha', '<=', endDate)
                .orderBy('fecha', 'desc')
                .get();

            const sales = [];
            snapshot.forEach(doc => {
                sales.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, sales };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener ventas por fecha');
        }
    }

    // ========== OBTENER RESUMEN DE VENTAS ==========
    async getSalesSummary(startDate, endDate) {
        try {
            const result = await this.getSalesByDateRange(startDate, endDate);

            if (!result.success) return result;

            const sales = result.sales.filter(s => s.estado !== 'anulada');

            let totalVentas = 0;
            let totalCostos = 0;
            let cantidadVentas = sales.length;
            let ventasPorMetodo = {};
            let ventasPorVendedor = {};

            sales.forEach(sale => {
                totalVentas += sale.total || 0;
                totalCostos += sale.costoTotal || 0;

                // Por método de pago
                const metodo = sale.metodoPago || 'efectivo';
                ventasPorMetodo[metodo] = (ventasPorMetodo[metodo] || 0) + sale.total;

                // Por vendedor
                const vendedor = sale.vendedor || 'Sistema';
                if (!ventasPorVendedor[vendedor]) {
                    ventasPorVendedor[vendedor] = {
                        cantidad: 0,
                        total: 0
                    };
                }
                ventasPorVendedor[vendedor].cantidad++;
                ventasPorVendedor[vendedor].total += sale.total;
            });

            const ganancia = totalVentas - totalCostos;
            const ticketPromedio = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;

            return {
                success: true,
                summary: {
                    cantidadVentas,
                    totalVentas,
                    totalCostos,
                    ganancia,
                    ticketPromedio,
                    ventasPorMetodo,
                    ventasPorVendedor
                }
            };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener resumen de ventas');
        }
    }

    // ========== OBTENER TOP PRODUCTOS VENDIDOS ==========
    async getTopProducts(startDate, endDate, limit = 10) {
        try {
            const result = await this.getSalesByDateRange(startDate, endDate);

            if (!result.success) return result;

            const sales = result.sales.filter(s => s.estado !== 'anulada');
            const productSales = {};

            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = {
                            nombre: item.nombre,
                            cantidad: 0,
                            total: 0
                        };
                    }
                    productSales[item.productId].cantidad += item.cantidad;
                    productSales[item.productId].total += item.subtotal;
                });
            });

            // Convertir a array y ordenar
            const topProducts = Object.entries(productSales)
                .map(([id, data]) => ({ id, ...data }))
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, limit);

            return { success: true, topProducts };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener top productos');
        }
    }
}

// Crear instancia global
window.salesService = new SalesService();

console.log('✅ SalesService inicializado');
