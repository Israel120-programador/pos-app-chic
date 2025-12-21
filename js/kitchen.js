// =====================================================
// KITCHEN MODULE - Vista de Cocina
// =====================================================

const Kitchen = {
    orders: [],
    subscription: null,
    notificationSound: null,

    async init() {
        console.log('🍳 Inicializando módulo Cocina...');

        // Create notification sound
        this.createNotificationSound();

        // Load initial orders
        await this.loadOrders();

        // Subscribe to real-time updates
        this.subscribeToUpdates();
    },

    createNotificationSound() {
        // Create a simple beep sound using Web Audio API
        this.notificationSound = {
            play: () => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
                    gainNode.gain.value = 0.3;

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.3);
                } catch (e) {
                    console.log('Sound not available');
                }
            }
        };
    },

    async loadOrders() {
        try {
            if (typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient()) {
                // Load from Supabase (real-time cloud data)
                this.orders = await SupabaseDB.getPendingOrders();
            } else {
                // Fallback to local DB (IndexedDB/LocalStorage through DB module)
                const allSales = await DB.getAll('sales');

                // Filter for pending/preparing orders only
                // Also check if sale has status field (new orders from sync)
                this.orders = allSales
                    .filter(sale => {
                        // If has status field, filter by status
                        if (sale.status) {
                            return sale.status === 'pending' || sale.status === 'preparing';
                        }
                        // Old sales without status are considered completed
                        return false;
                    })
                    .map(sale => ({
                        id: sale.id,
                        folio: sale.order_number,
                        status: sale.status || 'pending',
                        created_at: sale.timestamp,
                        order_items: sale.items,
                        items: sale.items, // Compatibility
                        comments: sale.comments,
                        user_id: sale.cashier_id
                    }));
            }
            this.render();
            this.updateStats();
        } catch (error) {
            console.error('Error loading kitchen orders:', error);
            Utils.showToast('Error cargando pedidos', 'error');
        }
    },

    async refresh() {
        Utils.showToast('Actualizando pedidos...', 'info');
        await this.loadOrders();
        Utils.showToast('Pedidos actualizados', 'success');
    },

    subscribeToUpdates() {
        if (typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient()) {
            this.subscription = SupabaseDB.subscribeToOrders((payload) => {
                console.log('📦 Kitchen: Order update received', payload);

                if (payload.eventType === 'INSERT') {
                    // New order - play sound and reload
                    this.notificationSound.play();
                    Utils.showToast('🆕 Nuevo pedido!', 'success');
                }

                // Reload orders
                this.loadOrders();
            });
        }
    },

    render() {
        const container = document.getElementById('kitchen-orders-grid');
        if (!container) return;

        if (this.orders.length === 0) {
            container.innerHTML = `
                <div class="kitchen-empty">
                    <span>👨‍🍳</span>
                    <p>No hay pedidos pendientes</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.orders.map(order => this.renderOrderCard(order)).join('');
    },

    renderOrderCard(order) {
        const statusClass = order.status === 'pending' ? 'status-pending' :
            order.status === 'preparing' ? 'status-preparing' :
                'status-ready';

        const statusText = order.status === 'pending' ? '🔴 Pendiente' :
            order.status === 'preparing' ? '🟡 Preparando' :
                '🟢 Listo';

        const timeAgo = this.getTimeAgo(order.created_at || order.date);

        const items = order.order_items || order.items || [];
        const itemsHtml = items.map(item => {
            const name = item.products?.name || item.name || 'Producto';
            return `
                <div class="kitchen-order-item">
                    <span class="item-qty">${item.quantity}x</span>
                    <span class="item-name">${name}</span>
                    ${item.notes ? `<span class="item-notes">📝 ${item.notes}</span>` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="kitchen-order-card ${statusClass}" data-order-id="${order.id}">
                <div class="kitchen-order-header">
                    <span class="order-folio">#${order.folio || order.id?.substring(0, 6) || '000'}</span>
                    <span class="order-time">${timeAgo}</span>
                </div>
                <div class="kitchen-order-status">${statusText}</div>
                <div class="kitchen-order-items">
                    ${itemsHtml}
                </div>
                ${order.comments ? `<div class="kitchen-order-comments">📝 ${order.comments}</div>` : ''}
                <div class="kitchen-order-actions">
                    ${order.status === 'pending' ?
                `<button class="btn btn-warning btn-sm" onclick="Kitchen.prepareOrder('${order.id}')">🍳 Preparar</button>` : ''}
                    ${order.status === 'preparing' ?
                `<button class="btn btn-success btn-sm" onclick="Kitchen.markReady('${order.id}')">✅ Listo</button>` : ''}
                </div>
            </div>
        `;
    },

    getTimeAgo(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours}h ${diffMins % 60}m`;
    },

    async prepareOrder(orderId) {
        try {
            if (typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient()) {
                await SupabaseDB.updateOrderStatus(orderId, 'preparing');
            } else {
                // Local update using DB module
                const sale = await DB.get('sales', orderId);
                if (sale) {
                    sale.status = 'preparing';
                    sale.updated_at = Utils.now();
                    await DB.put('sales', sale);
                }
            }

            Utils.showToast('Pedido en preparación', 'info');
            await this.loadOrders();
        } catch (error) {
            console.error('Error updating order:', error);
            Utils.showToast('Error al actualizar pedido', 'error');
        }
    },

    async markReady(orderId) {
        try {
            if (typeof SupabaseDB !== 'undefined' && SupabaseDB.getClient()) {
                await SupabaseDB.updateOrderStatus(orderId, 'ready');
            } else {
                // Local update using DB module
                const sale = await DB.get('sales', orderId);
                if (sale) {
                    sale.status = 'ready';
                    sale.ready_at = Utils.now();
                    sale.updated_at = Utils.now();
                    await DB.put('sales', sale);
                }
            }

            Utils.showToast('✅ Pedido listo!', 'success');
            await this.loadOrders();
        } catch (error) {
            console.error('Error updating order:', error);
            Utils.showToast('Error al actualizar pedido', 'error');
        }
    },

    updateStats() {
        const pending = this.orders.filter(o => o.status === 'pending').length;
        const preparing = this.orders.filter(o => o.status === 'preparing').length;
        const ready = this.orders.filter(o => o.status === 'ready').length;

        const pendingEl = document.getElementById('pending-orders-count');
        const preparingEl = document.getElementById('preparing-orders-count');
        const readyEl = document.getElementById('ready-orders-count');

        if (pendingEl) pendingEl.textContent = pending;
        if (preparingEl) preparingEl.textContent = preparing;
        if (readyEl) readyEl.textContent = ready;
    },

    destroy() {
        if (this.subscription) {
            SupabaseDB.unsubscribe(this.subscription);
        }
    }
};

// Make globally available
window.Kitchen = Kitchen;
