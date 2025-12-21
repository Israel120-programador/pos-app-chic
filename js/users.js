/* =====================================================
   POS APP - USERS MODULE (Enhanced with Pending Changes)
   ===================================================== */

const Users = {
    // Pending changes that haven't been saved yet
    pendingChanges: [],
    usersCache: [],

    async init() {
        this.bindEvents();
        await this.loadUsers();
    },

    bindEvents() {
        document.getElementById('add-user-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('save-user')?.addEventListener('click', () => this.saveToMemory());
        document.getElementById('save-users-btn')?.addEventListener('click', () => this.saveAllChanges());
    },

    async loadUsers() {
        this.usersCache = await DB.getAll('users');
        this.renderUsers();
    },

    renderUsers() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        // Combine database users with pending changes
        const allUsers = this.getMergedUsers();

        tbody.innerHTML = allUsers.sort((a, b) => a.name.localeCompare(b.name))
            .map(u => {
                const isPending = this.pendingChanges.some(p => p.user.id === u.id);
                const isDeleted = this.pendingChanges.some(p => p.user.id === u.id && p.type === 'DELETE');

                if (isDeleted) return ''; // Don't show deleted users

                return `
                <tr class="${isPending ? 'pending-change' : ''}">
                    <td>
                        <strong>${Utils.escapeHtml(u.name)}</strong>
                        ${isPending ? '<span class="badge badge-warning" style="margin-left:5px;">Pendiente</span>' : ''}
                    </td>
                    <td>${Utils.getRoleDisplay(u.role)}</td>
                    <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
                        ${u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="Users.editUser('${u.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="Users.markForDelete('${u.id}')">🗑️</button>
                    </td>
                </tr>
            `}).join('');
    },

    getMergedUsers() {
        // Start with database users
        let users = [...this.usersCache];

        // Apply pending changes
        for (const change of this.pendingChanges) {
            if (change.type === 'CREATE' || change.type === 'UPDATE') {
                const existingIndex = users.findIndex(u => u.id === change.user.id);
                if (existingIndex >= 0) {
                    users[existingIndex] = change.user;
                } else {
                    users.push(change.user);
                }
            } else if (change.type === 'DELETE') {
                users = users.filter(u => u.id !== change.user.id);
            }
        }

        return users;
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
            // First check pending changes
            const pending = this.pendingChanges.find(p => p.user.id === id);
            if (pending) {
                this.openModal(pending.user);
                return;
            }

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

    async saveToMemory() {
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

            // Check if it's an existing user
            const existing = await DB.get('users', id);
            const pendingExisting = this.pendingChanges.find(p => p.user.id === id);

            if (pin && pin.length !== 4) {
                Utils.showToast('El PIN debe tener 4 dígitos', 'error');
                return;
            }

            if (!existing && !pendingExisting && !pin) {
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
                pin: pin || existing?.pin || pendingExisting?.user?.pin || '',
                is_active: isActive,
                created_at: existing?.created_at || pendingExisting?.user?.created_at || Utils.now()
            };

            // Remove any existing pending change for this user
            this.pendingChanges = this.pendingChanges.filter(p => p.user.id !== id);

            // Add new pending change
            this.pendingChanges.push({
                type: existing ? 'UPDATE' : 'CREATE',
                user: user,
                previousState: existing ? { ...existing } : null
            });

            document.getElementById('user-modal').classList.remove('active');
            this.renderUsers();
            this.showUnsavedIndicator();
            Utils.showToast('Cambio pendiente de guardar', 'info');
        } catch (e) {
            console.error('Error saving user to memory:', e);
            Utils.showToast('Error: ' + e.message, 'error');
        }
    },

    markForDelete(id) {
        try {
            if (App.currentUser && App.currentUser.id === id) {
                Utils.showToast('No puedes eliminar tu propio usuario', 'error');
                return;
            }
            if (id === 'user_admin') {
                Utils.showToast('No puedes eliminar al administrador principal', 'error');
                return;
            }

            if (!confirm('¿Marcar para eliminar este usuario? El cambio se aplicará al guardar.')) return;

            // Check if it's an existing user
            const existing = this.usersCache.find(u => u.id === id);

            // Remove any pending changes for this user
            this.pendingChanges = this.pendingChanges.filter(p => p.user.id !== id);

            if (existing) {
                // Mark database user for deletion
                this.pendingChanges.push({
                    type: 'DELETE',
                    user: { id },
                    previousState: { ...existing }
                });
            }
            // If not in database, just removing from pending changes is enough

            this.renderUsers();
            this.showUnsavedIndicator();
            Utils.showToast('Usuario marcado para eliminar', 'info');
        } catch (e) {
            console.error('Error marking user for delete:', e);
            Utils.showToast('Error: ' + e.message, 'error');
        }
    },

    async saveAllChanges() {
        if (this.pendingChanges.length === 0) {
            Utils.showToast('No hay cambios pendientes', 'info');
            return;
        }

        if (!confirm(`¿Guardar ${this.pendingChanges.length} cambio(s)?`)) return;

        try {
            let created = 0, updated = 0, deleted = 0;

            for (const change of this.pendingChanges) {
                switch (change.type) {
                    case 'CREATE':
                        await DB.put('users', change.user);
                        // Sync with cloud
                        if (typeof Sync !== 'undefined') {
                            Sync.pushToCloud('users', 'CREATE', change.user);
                        }
                        created++;
                        break;
                    case 'UPDATE':
                        await DB.put('users', change.user);
                        // Sync with cloud
                        if (typeof Sync !== 'undefined') {
                            Sync.pushToCloud('users', 'UPDATE', change.user);
                        }
                        updated++;
                        break;
                    case 'DELETE':
                        await DB.delete('users', change.user.id);
                        // Sync with cloud
                        if (typeof Sync !== 'undefined') {
                            Sync.pushToCloud('users', 'DELETE', { id: change.user.id });
                        }
                        deleted++;
                        break;
                }
            }

            // Clear pending changes
            this.pendingChanges = [];
            this.hideUnsavedIndicator();

            // Reload from database
            await this.loadUsers();

            const msg = [];
            if (created > 0) msg.push(`${created} creado(s)`);
            if (updated > 0) msg.push(`${updated} actualizado(s)`);
            if (deleted > 0) msg.push(`${deleted} eliminado(s)`);

            Utils.showToast(`Cambios guardados: ${msg.join(', ')}`, 'success');
        } catch (e) {
            console.error('Error saving all changes:', e);
            Utils.showToast('Error al guardar cambios: ' + e.message, 'error');
        }
    },

    showUnsavedIndicator() {
        document.getElementById('users-unsaved-indicator')?.classList.remove('hidden');
        document.getElementById('save-users-btn')?.classList.remove('hidden');
    },

    hideUnsavedIndicator() {
        document.getElementById('users-unsaved-indicator')?.classList.add('hidden');
        document.getElementById('save-users-btn')?.classList.add('hidden');
    },

    // Keep the old delete method for compatibility, now redirects to markForDelete
    async delete(id) {
        this.markForDelete(id);
    }
};
