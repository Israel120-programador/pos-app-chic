/* =====================================================
   POS APP - INVENTORY MODULE (Enhanced with Chart)
   ===================================================== */

const Inventory = {
    chartColors: ['#FF6B35', '#4EC5F1', '#00D9A5', '#FFB800', '#FF4757', '#9B59B6', '#3498DB', '#1ABC9C'],

    async init() {
        this.bindEvents();
        await this.loadAll();
    },

    bindEvents() {
        document.getElementById('add-movement-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-movement')?.addEventListener('click', () => this.save());
    },

    async loadAll() {
        await Promise.all([
            this.loadStats(),
            this.loadTopProducts(),
            this.loadStockList(),
            // this.loadMovements(), 
            this.loadProductsSelect()
        ]);
    },

    async loadStats() {
        const products = await DB.getAll('products');
        const sales = await DB.getAll('sales');

        const totalProducts = products.length;
        const lowStock = products.filter(p => (p.stock || 0) < 10).length;
        const totalItemsSold = sales.reduce((sum, s) =>
            sum + (s.items?.reduce((iSum, i) => iSum + i.quantity, 0) || 0), 0);

        if (document.getElementById('total-products-count'))
            document.getElementById('total-products-count').textContent = totalProducts;

        if (document.getElementById('low-stock-count'))
            document.getElementById('low-stock-count').textContent = lowStock;

        if (document.getElementById('total-items-sold'))
            document.getElementById('total-items-sold').textContent = totalItemsSold;
    },

    async loadTopProducts() {
        const sales = await DB.getAll('sales');
        const products = await DB.getAll('products');
        const prodMap = Object.fromEntries(products.map(p => [p.id, p]));

        // Aggregate sales by product
        const salesByProduct = {};
        sales.forEach(sale => {
            sale.items?.forEach(item => {
                if (!salesByProduct[item.product_id]) {
                    const product = prodMap[item.product_id];
                    salesByProduct[item.product_id] = {
                        name: product ? product.name : (item.product_name || 'Producto'),
                        quantity: 0,
                        revenue: 0
                    };
                }
                salesByProduct[item.product_id].quantity += item.quantity;
                salesByProduct[item.product_id].revenue += item.subtotal;
            });
        });

        // Sort by quantity and take top 8
        const topProducts = Object.entries(salesByProduct)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8);

        this.renderChart(topProducts);
        this.renderLegend(topProducts);
    },

    renderChart(data) {
        const canvas = document.getElementById('top-products-chart');
        if (!canvas) return;

        // Make canvas responsive to container
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = Math.min(250, rect.width * 0.6) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = Math.min(250, rect.width * 0.6) + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = Math.min(250, rect.width * 0.6);
        const padding = 30;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (data.length === 0) {
            ctx.fillStyle = '#6b7a90';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de ventas', width / 2, height / 2);
            return;
        }

        const maxValue = Math.max(...data.map(d => d.quantity));
        const barWidth = (width - padding * 2) / data.length - 10;
        const chartHeight = height - padding * 2;

        data.forEach((item, index) => {
            const barHeight = maxValue > 0 ? (item.quantity / maxValue) * chartHeight : 0;
            const x = padding + index * (barWidth + 10);
            const y = height - padding - barHeight;

            // Draw bar with gradient
            const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
            gradient.addColorStop(0, this.chartColors[index % this.chartColors.length]);
            gradient.addColorStop(1, this.adjustColor(this.chartColors[index % this.chartColors.length], -30));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
            ctx.fill();

            // Draw value on top
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.quantity, x + barWidth / 2, y - 8);

            // Draw product name below bar
            ctx.fillStyle = '#8b9ab8';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const shortName = item.name.length > 8 ? item.name.substring(0, 7) + '…' : item.name;
            ctx.fillText(shortName, x + barWidth / 2, height - padding + 15);
        });

        // Draw X axis
        ctx.strokeStyle = '#2a3654';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
    },

    renderLegend(data) {
        const container = document.getElementById('top-products-legend');
        if (!container) return;

        container.innerHTML = data.map((item, index) => `
            <div class="legend-item">
                <span class="legend-color" style="background: ${this.chartColors[index % this.chartColors.length]}"></span>
                <span>${Utils.escapeHtml(item.name.substring(0, 15))}${item.name.length > 15 ? '...' : ''}</span>
            </div>
        `).join('');
    },

    adjustColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
        const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
        const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
        return `rgb(${r}, ${g}, ${b})`;
    },

    async loadStockList() {
        const products = await DB.getAll('products');
        const categories = await DB.getAll('categories');
        const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

        const container = document.getElementById('stock-list');
        if (!container) return;

        // Sort by stock (low first)
        const sorted = products.sort((a, b) => (a.stock || 0) - (b.stock || 0));

        container.innerHTML = sorted.map(p => {
            const stock = p.stock || 0;
            const cat = catMap[p.category];
            let stockClass = 'good';
            let barColor = '#00D9A5';

            if (stock < 10) {
                stockClass = 'low';
                barColor = '#FF4757';
            } else if (stock < 25) {
                stockClass = 'warning';
                barColor = '#FFB800';
            }

            const barWidth = Math.min(100, (stock / 100) * 100);

            return `
                <div class="stock-item">
                    <div class="stock-item-icon" style="background: ${cat?.color || '#FF6B35'}20; color: ${cat?.color || '#FF6B35'}">
                        ${cat?.icon || '📦'}
                    </div>
                    <div class="stock-item-info">
                        <div class="stock-item-name">${Utils.escapeHtml(p.name)}</div>
                        <div class="stock-item-category">${Utils.escapeHtml(cat?.name || 'Sin categoría')}</div>
                    </div>
                    <div class="stock-item-stock">
                        <div class="stock-value ${stockClass}">${stock}</div>
                        <div class="stock-bar">
                            <div class="stock-bar-fill" style="width: ${barWidth}%; background: ${barColor}"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    async openLowStockModal() {
        const products = await DB.getAll('products');
        const sorted = products.filter(p => (p.stock || 0) < 10).sort((a, b) => (a.stock || 0) - (b.stock || 0));

        const container = document.getElementById('modal-stock-list');
        if (!container) return;

        container.innerHTML = sorted.map(p => `
            <div class="stock-item" style="border:1px solid var(--border-color); margin-bottom: 5px;">
                <div class="stock-item-info">
                    <strong>${Utils.escapeHtml(p.name)}</strong>
                </div>
                <div class="stock-item-stock">
                    <span class="stock-value low">${p.stock || 0}</span>
                </div>
            </div>
        `).join('') || '<p>No hay productos con stock crítico.</p>';

        document.getElementById('low-stock-modal').classList.add('active');
    },

    async loadMovements() {
        const movements = await DB.getAll('inventory_movements');
        const products = await DB.getAll('products');
        const prodMap = Object.fromEntries(products.map(p => [p.id, p.name]));

        const tbody = document.getElementById('inventory-tbody');
        if (!tbody) return;

        tbody.innerHTML = movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50)
            .map(m => {
                const typeInfo = Utils.getMovementTypeDisplay(m.movement_type);
                return `
    < tr >
                    <td>${Utils.formatDateTime(m.timestamp)}</td>
                    <td>${Utils.escapeHtml(prodMap[m.product_id] || 'Desconocido')}</td>
                    <td><span class="badge ${typeInfo.class}">${typeInfo.label}</span></td>
                    <td class="${m.quantity_change > 0 ? 'text-success' : 'text-danger'}">
                        ${m.quantity_change > 0 ? '+' : ''}${m.quantity_change}
                    </td>
                    <td>${m.previous_stock}</td>
                    <td>${m.new_stock}</td>
                    <td>${Utils.escapeHtml(m.reason || '-')}</td>
                </tr >
    `}).join('') || '<tr><td colspan="7" class="text-center text-muted">Sin movimientos registrados</td></tr>';
    },

    async loadProductsSelect() {
        const products = await DB.getAll('products');
        const select = document.getElementById('movement-product');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar producto</option>' +
            products.sort((a, b) => a.name.localeCompare(b.name))
                .map(p => `< option value = "${p.id}" > ${Utils.escapeHtml(p.name)} (Stock: ${p.stock ?? 0})</option > `)
                .join('');
    },

    openModal() {
        document.getElementById('movement-product').value = '';
        document.getElementById('movement-type').value = 'PURCHASE';
        document.getElementById('movement-quantity').value = '';
        document.getElementById('movement-reason').value = '';
        document.getElementById('movement-modal').classList.add('active');
    },

    async save() {
        const productId = document.getElementById('movement-product').value;
        const type = document.getElementById('movement-type').value;
        let quantity = parseInt(document.getElementById('movement-quantity').value) || 0;
        const reason = document.getElementById('movement-reason').value.trim();

        if (!productId || quantity === 0) {
            Utils.showToast('Producto y cantidad son requeridos', 'error');
            return;
        }

        const product = await DB.get('products', productId);
        if (!product) return;

        const previousStock = product.stock || 0;
        if (type === 'LOSS') quantity = -Math.abs(quantity);
        else if (type === 'PURCHASE') quantity = Math.abs(quantity);

        const newStock = previousStock + quantity;

        const movement = {
            id: 'inv_' + Utils.generateUUID(),
            product_id: productId,
            movement_type: type,
            quantity_change: quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reason,
            user_id: App.currentUser?.id || null,
            timestamp: Utils.now(),
            sync_status: 'PENDING'
        };

        product.stock = newStock;
        product.updated_at = Utils.now();

        await DB.add('inventory_movements', movement);
        await DB.put('products', product);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            await Sync.pushToCloud('inventory_movements', 'CREATE', movement);
            await Sync.pushToCloud('products', 'UPDATE', product);
        }

        document.getElementById('movement-modal').classList.remove('active');
        await this.loadAll();
        Products.loadProducts();
        POS.loadProducts();
        Utils.showToast('Movimiento registrado', 'success');
    }
};
