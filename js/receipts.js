/* =====================================================
   POS APP - RECEIPTS MODULE
   Dual receipt printing: SII Client + Local/Kitchen
   ===================================================== */

const Receipts = {
    settings: null,

    async init() {
        this.settings = await DB.get('settings', 'default') || {};
    },

    // Normalize sale data — handle both Spanish and English field names
    _normalizeSale(sale) {
        const timestamp = sale.timestamp || (sale.fecha?.toDate ? sale.fecha.toDate() : sale.fecha) || new Date();
        return {
            ...sale,
            timestamp,
            items: (sale.items || []).map(item => ({
                ...item,
                product_name: item.product_name || item.nombre || 'Producto',
                quantity: item.quantity || item.cantidad || 0,
                unit_price: item.unit_price || item.precioUnitario || item.precio || 0,
                subtotal: item.subtotal || ((item.precio || 0) * (item.cantidad || 0)),
                modifiers: item.modifiers || []
            }))
        };
    },

    // Generate SII-compliant client receipt
    generateClientReceipt(rawSale) {
        const sale = this._normalizeSale(rawSale);
        const s = this.settings;
        return `
        <div class="receipt receipt-client">
            <div class="receipt-header">
                <h1>${Utils.escapeHtml(s.business_name || 'MI NEGOCIO')}</h1>
                <p>${Utils.escapeHtml(s.giro || '')}</p>
                <p>RUT: ${Utils.formatRUT(s.rut || '')}</p>
                <p>${Utils.escapeHtml(s.address || '')}</p>
            </div>
            
            <div class="receipt-info">
                <p><strong>BOLETA ELECTRÓNICA</strong></p>
                <p>Folio: ${sale.id.substring(0, 12).toUpperCase()}</p>
                <p>Fecha: ${Utils.formatDateTime(sale.timestamp)}</p>
            </div>
            
            <div class="receipt-items">
                ${sale.items.map(item => `
                    <div class="receipt-item">
                        <span>${item.quantity}x ${Utils.escapeHtml(item.product_name)}</span>
                        <span>${Utils.formatCurrency(item.subtotal)}</span>
                    </div>
                    ${item.modifiers?.map(m => `
                        <div class="receipt-item modifier">
                            <span>  + ${Utils.escapeHtml(m.name)}</span>
                            <span>${Utils.formatCurrency(m.price)}</span>
                        </div>
                    `).join('') || ''}
                `).join('')}
            </div>
            
            <div class="receipt-totals">
                <div class="total-row">
                    <span>Neto</span>
                    <span>${Utils.formatCurrency(sale.subtotal)}</span>
                </div>
                <div class="total-row">
                    <span>IVA (19%)</span>

                    <span>${Utils.formatCurrency(sale.tax)}</span>
                </div>
                <div class="total-row grand-total">
                    <span>TOTAL</span>
                    <span>${Utils.formatCurrency(sale.total)}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <p>${Utils.escapeHtml(s.receipt_footer || '¡Gracias por su compra!')}</p>
                <p style="font-size:8px;margin-top:2mm;">Timbre Electrónico SII</p>
            </div>
        </div>`;
    },

    // Generate detailed local/kitchen receipt (without costs)
    generateLocalReceipt(rawSale, cashierName) {
        const sale = this._normalizeSale(rawSale);
        return `
        <div class="receipt receipt-local">
            <div class="receipt-header">
                <h1>🍔 ORDEN #${sale.order_number || sale.id.substring(0, 6).toUpperCase()}</h1>
            </div>
            
            <div class="receipt-info">
                <p><strong>Fecha:</strong> ${Utils.formatDateTime(sale.timestamp)}</p>
                <p><strong>Cajero:</strong> ${Utils.escapeHtml(cashierName || 'N/A')}</p>
                <p><strong>Pago:</strong> ${Utils.getPaymentMethodDisplay(sale.payment_method).label}</p>
            </div>
            
            <div class="receipt-items">
                <p><strong>DETALLE DE PRODUCTOS:</strong></p>
                ${sale.items.map(item => `
                    <div class="receipt-item">
                        <span><strong>${item.quantity}x</strong> ${Utils.escapeHtml(item.product_name)}</span>
                        <span>${Utils.formatCurrency(item.unit_price)} c/u</span>
                    </div>
                    ${item.modifiers?.map(m => `
                        <div class="receipt-item modifier">
                            <span>  → ${Utils.escapeHtml(m.name)}</span>
                            <span>+${Utils.formatCurrency(m.price)}</span>
                        </div>
                    `).join('') || ''}
                    <div class="receipt-item subtotal">
                        <span></span>
                        <span><strong>${Utils.formatCurrency(item.subtotal)}</strong></span>
                    </div>
                `).join('<hr style="border:none;border-top:1px dashed #000;margin:1mm 0;">')}
            </div>
            
            ${sale.comments ? `
            <div class="receipt-comments">
                <p><strong>📝 NOTAS:</strong></p>
                <p>${Utils.escapeHtml(sale.comments)}</p>
            </div>
            ` : ''}
            
            <div class="receipt-totals">
                <div class="total-row grand-total">
                    <span>TOTAL</span>
                    <span>${Utils.formatCurrency(sale.total)}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <p>━━━━━━━━━━━━━━━━━━━━</p>
                <p>COPIA LOCAL</p>
            </div>
        </div>`;
    },

    // Print both receipts
    // Alias for printReceipt (called from SalesService)
    printReceipt(sale) {
        const cashier = sale.vendedor || window.usersService?.getCurrentUser()?.nombre || 'N/A';
        this.printDualReceipt(sale, cashier);
    },

    async printDualReceipt(sale, cashierName) {
        await this.init();

        const container = document.getElementById('receipt-container');

        const separator = `
            <div style="margin: 15px 0; border-bottom: 2px dashed #000; text-align: center; font-size: 10px; padding: 10px 0;">
                ✂️ --- CÓRTAR AQUÍ --- ✂️<br>
                COPIA COCINA 👇
            </div>
            <br>
        `;

        container.innerHTML =
            this.generateClientReceipt(sale) +
            separator +
            this.generateLocalReceipt(sale, cashierName);

        // Trigger print
        setTimeout(() => window.print(), 200);
    },

    // Reprint single receipt
    async reprintClientReceipt(sale) {
        await this.init();
        const container = document.getElementById('receipt-container');
        container.innerHTML = this.generateClientReceipt(sale);
        setTimeout(() => window.print(), 100);
    }
};

// Expose globally so SalesService can find it
window.receiptsService = Receipts;
console.log('✅ Receipts module loaded');
