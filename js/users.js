/* =====================================================
   POS APP - USERS MODULE
   ===================================================== */

const Users = {
    async init() {
        this.bindEvents();
        await this.loadUsers();
    },

    bindEvents() {
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-user')?.addEventListener('click', () => this.save());
    },

    async loadUsers() {
        const users = await DB.getAll('users');
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        tbody.innerHTML = users.sort((a, b) => a.name.localeCompare(b.name))
            .map(u => `
                <tr>
                    <td><strong>${Utils.escapeHtml(u.name)}</strong></td>
                    <td>${Utils.getRoleDisplay(u.role)}</td>
                    <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
                        ${u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="Users.editUser('${u.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="Users.delete('${u.id}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
    },

    openModal(user = null) {
        document.getElementById('user-modal-title').textContent =
            user ? 'Editar Usuario' : 'Nuevo Usuario';
        document.getElementById('user-id').value = user?.id || '';
        document.getElementById('user-name').value = user?.name || '';
        document.getElementById('user-role').value = user?.role || 'cashier';
        document.getElementById('user-pin').value = '';
        document.getElementById('user-active').checked = user?.is_active ?? true;
        document.getElementById('user-modal').classList.add('active');
    },

    async editUser(id) {
        try {
            const user = await DB.get('users', id);
            if (user) {
                this.openModal(user);
            } else {
                Utils.showToast('Usuario no encontrado', 'error');
            }
        } catch (e) {
            console.error('Error editing user:', e);
            Utils.showToast('Error al editar usuario: ' + e.message, 'error');
        }
    },

    async save() {
        try {
            const id = document.getElementById('user-id').value || 'user_' + Utils.generateUUID();
            const pin = document.getElementById('user-pin').value;
            const name = document.getElementById('user-name').value.trim();
            const role = document.getElementById('user-role').value;
            const isActive = document.getElementById('user-active').checked;

            if (!name) {
                Utils.showToast('El nombre es requerido', 'error');
                return;
            }

            const existing = await DB.get('users', id);

            if (pin && pin.length !== 4) {
                Utils.showToast('El PIN debe tener 4 dígitos', 'error');
                return;
            }

            if (!existing && !pin) {
                Utils.showToast('El PIN es requerido para nuevos usuarios', 'error');
                return;
            }

            // Prevent blocking default admin
            if (existing && existing.id === 'user_admin' && !isActive) {
                Utils.showToast('No puedes desactivar al administrador principal', 'error');
                return;
            }

            const user = {
                id,
                name,
                role,
                pin: pin || existing?.pin || '',
                is_active: isActive,
                created_at: existing?.created_at || Utils.now()
            };

            await DB.put('users', user);
            document.getElementById('user-modal').classList.remove('active');
            await this.loadUsers();
            Utils.showToast('Usuario guardado', 'success');
        } catch (e) {
            console.error('Error saving user:', e);
            Utils.showToast('Error al guardar: ' + e.message, 'error');
        }
    },

    async delete(id) {
        try {
            if (App.currentUser && App.currentUser.id === id) {
                Utils.showToast('No puedes eliminar tu propio usuario', 'error');
                return;
            }
            if (id === 'user_admin') {
                Utils.showToast('No puedes eliminar al administrador principal', 'error');
                return;
            }

            if (!confirm('¿Eliminar este usuario?')) return;
            await DB.delete('users', id);
            await this.loadUsers();
            Utils.showToast('Usuario eliminado', 'success');
        } catch (e) {
            console.error('Error deleting user:', e);
            Utils.showToast('Error al eliminar: ' + e.message, 'error');
        }
    }
};
