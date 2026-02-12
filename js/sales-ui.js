/* =====================================================
   POS APP - SALES UI MODULE
   Global Sales object for dashboard stats and modals
   Bridges HTML onclick handlers to SalesService data
   ===================================================== */

const Sales = {
    currentMonthlySales: [],
    currentAnnualSales: [],

    // ========== LOAD SALES HISTORY STATS ==========
    async loadSalesHistory() {
        try {
            // Use salesService real-time cache first
            let sales = [];
            if (window.salesService?.sales?.length > 0) {
                sales = window.salesService.sales;
            } else {
                // Fallback to DB compat layer
                sales = await DB.getAll('sales');
            }
            this.allSales = sales.filter(s => s.status !== 'anulada' && s.estado !== 'anulada');
            this.updateDashboardStats(this.allSales);

            // Subscribe to real-time sales updates (only once)
            if (!this._subscribed && window.salesService) {
                this._subscribed = true;
                window.salesService.subscribe((updatedSales) => {
                    this.allSales = updatedSales.filter(s => s.estado !== 'anulada');
                    this.updateDashboardStats(this.allSales);
                });
            }
        } catch (e) {
            console.error('Error loading sales history:', e);
        }
    },

    updateDashboardStats(sales) {
        const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        const totalCosts = sales.reduce((sum, s) => sum + (s.costoTotal || s.cost || 0), 0);
        const profit = totalSales - totalCosts;
        const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;
        const totalItems = sales.reduce((sum, s) =>
            sum + (s.items?.reduce((iSum, i) => iSum + (i.quantity || i.cantidad || 0), 0) || 0), 0);

        const el = (id) => document.getElementById(id);
        if (el('total-sales-value')) el('total-sales-value').textContent = Utils.formatCurrency(totalSales);
        if (el('total-transactions')) el('total-transactions').textContent = sales.length;
        if (el('average-sale')) el('average-sale').textContent = Utils.formatCurrency(sales.length > 0 ? totalSales / sales.length : 0);
        if (el('total-costs')) el('total-costs').textContent = Utils.formatCurrency(totalCosts);
        if (el('total-profit')) el('total-profit').textContent = Utils.formatCurrency(profit);
        if (el('profit-margin')) el('profit-margin').textContent = margin + '%';
        if (el('total-items-sold')) el('total-items-sold').textContent = totalItems;
    },

    // ========== MONTHLY STATS MODAL ==========
    async openMonthlyStats() {
        try {
            const sales = this.allSales || await DB.getAll('sales');
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            // Filter sales for current month
            const monthlySales = sales.filter(s => {
                const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : null);
                return d && d.getFullYear() === year && d.getMonth() === month;
            });

            this.currentMonthlySales = monthlySales;

            // Group by day
            const byDay = {};
            monthlySales.forEach(s => {
                const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : new Date());
                const key = d.toLocaleDateString('es-CL');
                if (!byDay[key]) byDay[key] = { count: 0, total: 0 };
                byDay[key].count++;
                byDay[key].total += s.total || 0;
            });

            const tbody = document.getElementById('monthly-stats-tbody');
            if (tbody) {
                tbody.innerHTML = Object.entries(byDay)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, data]) => `
                        <tr>
                            <td>${date}</td>
                            <td>${data.count}</td>
                            <td>${Utils.formatCurrency(data.total)}</td>
                            <td><button class="btn btn-sm btn-secondary" onclick="Sales.openDayDetail('${date}')">Ver</button></td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="text-align:center">Sin ventas este mes</td></tr>';
            }

            document.getElementById('monthly-stats-modal')?.classList.add('active');
        } catch (e) {
            console.error('Error opening monthly stats:', e);
        }
    },

    // ========== DAILY TRANSACTIONS ==========
    async openDailyTransactions() {
        try {
            console.log('📅 Cargando ventas del día...');

            // 1. Try salesService cache first
            let sales = [];
            if (window.salesService?.sales?.length > 0) {
                sales = window.salesService.sales;
            } else if (this.allSales?.length > 0) {
                sales = this.allSales;
            } else {
                // 2. Fallback: direct Firestore query for today's sales
                try {
                    const { db } = window.FirebaseConfig;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const snapshot = await db.collection('ventas')
                        .where('fecha', '>=', today)
                        .orderBy('fecha', 'desc')
                        .get();
                    snapshot.forEach(doc => {
                        sales.push({ id: doc.id, ...doc.data() });
                    });
                    console.log(`📅 Fallback: ${sales.length} ventas desde Firestore`);
                } catch (fbErr) {
                    console.warn('Firestore fallback failed:', fbErr);
                    sales = await DB.getAll('sales');
                }
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todaySales = sales.filter(s => {
                let d;
                if (s.fecha && s.fecha.toDate) d = s.fecha.toDate();
                else if (s.fecha) d = new Date(s.fecha);
                else if (s.timestamp) d = new Date(s.timestamp);
                else return false;

                const dCopy = new Date(d);
                dCopy.setHours(0, 0, 0, 0);
                return dCopy.getTime() === today.getTime();
            });

            console.log(`📅 Ventas de hoy: ${todaySales.length} de ${sales.length} totales`);

            // Render into daily-sales table
            const tbody = document.getElementById('daily-sales-tbody');
            if (tbody) {
                if (todaySales.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">📭 Sin ventas hoy</td></tr>';
                } else {
                    tbody.innerHTML = todaySales.map(s => {
                        let d;
                        if (s.fecha && s.fecha.toDate) d = s.fecha.toDate();
                        else if (s.fecha) d = new Date(s.fecha);
                        else if (s.timestamp) d = new Date(s.timestamp);
                        else d = new Date();

                        const method = Utils.getPaymentMethodDisplay(s.metodoPago || s.payment_method || 'cash');
                        const itemsDetail = (s.items || []).map(i =>
                            `${i.cantidad || i.quantity || 0}x ${i.nombre || i.product_name || 'Producto'}`
                        ).join(', ');

                        return `
                            <tr>
                                <td>${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>${s.numero || s.number || s.id?.substring(0, 6) || '-'}</td>
                                <td><div style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${itemsDetail}">${itemsDetail}</div></td>
                                <td>${Utils.formatCurrency(s.total || 0)}</td>
                                <td><span class="badge">${method.icon} ${method.label}</span></td>
                                <td><button class="btn btn-sm btn-secondary" onclick="Sales.viewDetail('${s.id}')">Ver</button></td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Do NOT call App.navigateTo here — this function is called FROM navigateTo
        } catch (e) {
            console.error('Error opening daily transactions:', e);
            const tbody = document.getElementById('daily-sales-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--accent-danger);">Error cargando ventas</td></tr>';
            }
        }
    },

    // Alias for the "Actualizar" button in daily-sales section
    loadDailySales() {
        this.openDailyTransactions();
    },

    // ========== ANNUAL STATS MODAL ==========
    async openAnnualStats() {
        try {
            const sales = this.allSales || await DB.getAll('sales');
            const year = new Date().getFullYear();

            const annualSales = sales.filter(s => {
                const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : null);
                return d && d.getFullYear() === year;
            });

            this.currentAnnualSales = annualSales;

            // Group by month
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const byMonth = {};
            annualSales.forEach(s => {
                const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : new Date());
                const key = d.getMonth();
                if (!byMonth[key]) byMonth[key] = { count: 0, total: 0 };
                byMonth[key].count++;
                byMonth[key].total += s.total || 0;
            });

            const tbody = document.getElementById('annual-stats-tbody');
            if (tbody) {
                tbody.innerHTML = Object.entries(byMonth)
                    .sort(([a], [b]) => parseInt(b) - parseInt(a))
                    .map(([monthIdx, data]) => `
                        <tr>
                            <td>${months[monthIdx]}</td>
                            <td>${data.count}</td>
                            <td>${Utils.formatCurrency(data.total)}</td>
                            <td><button class="btn btn-sm btn-secondary" onclick="Sales.openMonthDetail(${monthIdx})">Ver</button></td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="text-align:center">Sin ventas este año</td></tr>';
            }

            document.getElementById('annual-stats-modal')?.classList.add('active');
        } catch (e) {
            console.error('Error opening annual stats:', e);
        }
    },

    // ========== LOAD DAILY SALES (Refresh) ==========
    async loadDailySales() {
        await this.openDailyTransactions();
    },

    // ========== ITEMS SOLD MODAL ==========
    async openItemsSoldModal() {
        const sales = this.allSales || await DB.getAll('sales');
        this.openItemsSold(sales, 'Todos');
    },

    openItemsSold(sales, period) {
        try {
            const itemsMap = {};
            (sales || []).forEach(s => {
                (s.items || []).forEach(item => {
                    const id = item.product_id || item.productoId || item.productId || 'unknown';
                    const name = item.product_name || item.nombre || 'Producto';
                    const qty = item.quantity || item.cantidad || 0;
                    const subtotal = item.subtotal || 0;

                    if (!itemsMap[id]) itemsMap[id] = { name, quantity: 0, total: 0 };
                    itemsMap[id].quantity += qty;
                    itemsMap[id].total += subtotal;
                });
            });

            const sorted = Object.values(itemsMap).sort((a, b) => b.quantity - a.quantity);

            const tbody = document.getElementById('items-sold-tbody');
            if (tbody) {
                tbody.innerHTML = sorted.map(item => `
                    <tr>
                        <td>${Utils.escapeHtml(item.name)}</td>
                        <td>${item.quantity}</td>
                        <td>${Utils.formatCurrency(item.total)}</td>
                    </tr>
                `).join('') || '<tr><td colspan="3" style="text-align:center">Sin datos</td></tr>';
            }

            document.getElementById('items-sold-modal')?.classList.add('active');
        } catch (e) {
            console.error('Error opening items sold:', e);
        }
    },

    // ========== VIEW SALE DETAIL ==========
    async viewDetail(saleId) {
        try {
            const sale = await DB.get('sales', saleId);
            if (!sale) return;

            const content = document.getElementById('sale-detail-content');
            if (!content) return;

            const d = sale.timestamp ? new Date(sale.timestamp) : (sale.fecha ? (sale.fecha.toDate ? sale.fecha.toDate() : new Date(sale.fecha)) : new Date());

            content.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>Fecha:</strong> ${d.toLocaleString('es-CL')}<br>
                    <strong>Folio:</strong> ${sale.numero || sale.number || sale.id}<br>
                    <strong>Vendedor:</strong> ${sale.vendedor || sale.seller || 'Sistema'}<br>
                    <strong>Método:</strong> ${sale.metodoPago || sale.payment_method || 'No especificado'}
                </div>
                <table class="data-table">
                    <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
                    <tbody>
                        ${(sale.items || []).map(item => `
                            <tr>
                                <td>${Utils.escapeHtml(item.product_name || item.nombre || 'Producto')}</td>
                                <td>${item.quantity || item.cantidad || 0}</td>
                                <td>${Utils.formatCurrency(item.unit_price || item.precioUnitario || item.precio || 0)}</td>
                                <td>${Utils.formatCurrency(item.subtotal || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="text-align: right; margin-top: 15px; font-size: 1.2em;">
                    <strong>Total: ${Utils.formatCurrency(sale.total || 0)}</strong>
                </div>
            `;

            document.getElementById('sale-detail-modal')?.classList.add('active');
        } catch (e) {
            console.error('Error viewing sale detail:', e);
        }
    },

    openDayDetail(dateStr) {
        // Filter and show sales for a specific day
        const daySales = (this.currentMonthlySales || []).filter(s => {
            const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : null);
            return d && d.toLocaleDateString('es-CL') === dateStr;
        });
        this.openItemsSold(daySales, dateStr);
    },

    openMonthDetail(monthIdx) {
        const monthSales = (this.currentAnnualSales || []).filter(s => {
            const d = s.timestamp ? new Date(s.timestamp) : (s.fecha ? (s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)) : null);
            return d && d.getMonth() === parseInt(monthIdx);
        });
        this.openItemsSold(monthSales, `Mes ${parseInt(monthIdx) + 1}`);
    },

    // ========== LOAD DAILY SALES (refresh button) ==========
    async loadDailySales() {
        // Reuse the daily transactions logic to populate the daily-sales section table
        await this.openDailyTransactions();
        Utils.showToast('Ventas del día actualizadas', 'success');
    },

    // ========== VIEW SALE DETAIL ==========
    async viewDetail(saleId) {
        try {
            // Find sale in cache
            const sale = (window.salesService?.sales || this.allSales || []).find(s => s.id === saleId);
            if (!sale) {
                Utils.showToast('No se pudo cargar la venta', 'error');
                return;
            }
            const d = sale.fecha?.toDate ? sale.fecha.toDate() : (sale.fecha ? new Date(sale.fecha) : new Date());

            const itemsHtml = (sale.items || []).map(i => `
                <tr>
                    <td>${i.nombre || i.product_name || 'Producto'}</td>
                    <td style="text-align:center">${i.cantidad || i.quantity || 0}</td>
                    <td style="text-align:right">${Utils.formatCurrency(i.precio || i.unit_price || 0)}</td>
                    <td style="text-align:right">${Utils.formatCurrency(i.subtotal || 0)}</td>
                </tr>
            `).join('');

            const html = `
                <div style="padding:15px">
                    <p><strong>Fecha:</strong> ${Utils.formatDateTime(d)}</p>
                    <p><strong>Vendedor:</strong> ${sale.vendedor || sale.seller || 'N/A'}</p>
                    <p><strong>Método:</strong> ${Utils.getPaymentMethodDisplay(sale.metodoPago || sale.payment_method || 'cash').label}</p>
                    <hr>
                    <table class="data-table" style="width:100%">
                        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <hr>
                    <p style="font-size:1.2em;text-align:right"><strong>Total: ${Utils.formatCurrency(sale.total || 0)}</strong></p>
                    ${sale.notas ? `<p><em>Notas: ${sale.notas}</em></p>` : ''}
                </div>
            `;

            // Show in a generic modal or create one
            let modal = document.getElementById('sale-detail-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'sale-detail-modal';
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>📋 Detalle de Venta</h2>
                            <button class="modal-close" onclick="document.getElementById('sale-detail-modal').classList.remove('active')">&times;</button>
                        </div>
                        <div class="modal-body" id="sale-detail-body"></div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            document.getElementById('sale-detail-body').innerHTML = html;
            modal.classList.add('active');
        } catch (e) {
            console.error('Error viewing sale detail:', e);
            Utils.showToast('Error al ver detalle', 'error');
        }
    }
};

// Also create Products UI compat object for HTML onclick handlers
const Products = window.Products || {
    toggleSelectAll() {
        const checkAll = document.querySelector('#products-table thead input[type="checkbox"]');
        const checkboxes = document.querySelectorAll('#products-tbody input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = checkAll?.checked || false; });
    },

    deleteSelected() {
        const checked = document.querySelectorAll('#products-tbody input[type="checkbox"]:checked');
        if (checked.length === 0) {
            Utils.showToast('Selecciona productos para eliminar', 'warning');
            return;
        }
        if (!confirm(`¿Eliminar ${checked.length} producto(s)?`)) return;

        checked.forEach(cb => {
            const id = cb.closest('tr')?.dataset.id;
            if (id && window.productsService) {
                window.productsService.deleteProduct(id);
            }
        });
    },

    loadProducts() {
        // Trigger refresh via productsService listener
        if (window.productsService) {
            window.productsService.startListening();
        }
    }
};

console.log('✅ Sales UI + Products UI modules loaded');
