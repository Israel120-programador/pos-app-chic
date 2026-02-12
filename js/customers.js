/* =====================================================
   POS APP - CUSTOMERS MODULE
   ===================================================== */

const Customers = {
    async init() {
        this.bindEvents();
        await this.loadCustomers();
    },

    bindEvents() {
        document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-customer')?.addEventListener('click', () => this.save());
        document.getElementById('customers-search')?.addEventListener('input',
            Utils.debounce(() => this.filterCustomers(), 300));
    },

    async loadCustomers() {
        const customers = await DB.getAll('customers');
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;

        tbody.innerHTML = customers.sort((a, b) => a.name.localeCompare(b.name))
            .map(c => `
                <tr data-id="${c.id}">
                    <td><strong>${Utils.escapeHtml(c.name)}</strong></td>
                    <td>${Utils.escapeHtml(c.phone || '-')}</td>
                    <td>${Utils.escapeHtml(c.email || '-')}</td>
                    <td><span class="badge badge-info">${c.loyalty_points || 0} pts</span></td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="Customers.edit('${c.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="Customers.delete('${c.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
    },

    filterCustomers() {
        const search = document.getElementById('customers-search')?.value.toLowerCase() || '';
        document.querySelectorAll('#customers-tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? '' : 'none';
        });
    },

    openModal(customer = null) {
        document.getElementById('customer-modal-title').textContent =
            customer ? 'Editar Cliente' : 'Nuevo Cliente';
        document.getElementById('customer-id').value = customer?.id || '';
        document.getElementById('customer-name').value = customer?.name || '';
        document.getElementById('customer-phone').value = customer?.phone || '';
        document.getElementById('customer-email').value = customer?.email || '';
        document.getElementById('customer-modal').classList.add('active');
    },

    async edit(id) {
        const customer = await DB.get('customers', id);
        if (customer) this.openModal(customer);
    },

    async save() {
        const id = document.getElementById('customer-id').value || 'cust_' + Utils.generateUUID();
        const customer = {
            id,
            name: document.getElementById('customer-name').value.trim(),
            phone: document.getElementById('customer-phone').value.trim(),
            email: document.getElementById('customer-email').value.trim(),
            loyalty_points: 0,
            created_at: Utils.now(),
            sync_status: 'PENDING'
        };

        if (!customer.name) {
            Utils.showToast('El nombre es requerido', 'error');
            return;
        }

        const existing = await DB.get('customers', id);
        if (existing) customer.loyalty_points = existing.loyalty_points;

        await DB.put('customers', customer);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            await Sync.pushToCloud('customers', existing ? 'UPDATE' : 'CREATE', customer);
        }

        document.getElementById('customer-modal').classList.remove('active');
        await this.loadCustomers();
        Utils.showToast('Cliente guardado', 'success');
    },

    async delete(id) {
        if (!confirm('¿Eliminar este cliente?')) return;

        await DB.delete('customers', id);

        // Sync with cloud
        if (typeof Sync !== 'undefined') {
            await Sync.pushToCloud('customers', 'DELETE', { id });
        }

        await this.loadCustomers();
        Utils.showToast('Cliente eliminado', 'success');
    }
};
