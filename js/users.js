// js/users.js
// Gestión de usuarios con sincronización Firebase

// Use window.FirebaseConfig directly to avoid const redeclaration in global scope

class UsersService {
    constructor() {
        const { db } = window.FirebaseConfig;
        this.usersRef = db.collection('usuarios');
        this.currentUser = null;
        this.unsubscribe = null;
    }

    // ========== LOGIN CON PIN ==========
    async login(pin) {
        try {
            const snapshot = await this.usersRef
                .where('pin', '==', pin)
                .where('activo', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { success: false, error: 'PIN incorrecto' };
            }

            const userDoc = snapshot.docs[0];
            this.currentUser = {
                id: userDoc.id,
                ...userDoc.data()
            };

            // Guardar sesión en localStorage
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('sessionStart', new Date().toISOString());

            // Registrar login
            await this.usersRef.doc(userDoc.id).update({
                ultimoAcceso: window.FirebaseConfig.serverTimestamp()
            });

            console.log('✅ Login exitoso:', this.currentUser.nombre);

            return {
                success: true,
                user: this.currentUser
            };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'login');
        }
    }

    // ========== LOGOUT ==========
    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionStart');
        console.log('👋 Sesión cerrada');
    }

    // ========== OBTENER USUARIO ACTUAL ==========
    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }

        // Intentar recuperar de localStorage
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
                return this.currentUser;
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }

        return null;
    }

    // ========== VERIFICAR SI ES ADMIN ==========
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.rol === 'admin';
    }

    // ========== CREAR USUARIO (solo admin) ==========
    async createUser(userData) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Solo los administradores pueden crear usuarios' };
        }

        try {
            window.FirebaseConfig.showSyncIndicator('Creando usuario...');

            // Verificar que el PIN no exista
            const existingPin = await this.usersRef
                .where('pin', '==', userData.pin)
                .get();

            if (!existingPin.empty) {
                return { success: false, error: 'El PIN ya está en uso' };
            }

            const user = {
                nombre: userData.nombre || '',
                pin: userData.pin || '',
                rol: userData.rol || 'vendedor', // 'admin' o 'vendedor'
                activo: true,
                fechaCreacion: window.FirebaseConfig.serverTimestamp(),
                creadoPor: this.currentUser.id
            };

            const docRef = await this.usersRef.add(user);

            console.log('✅ Usuario creado:', docRef.id);
            window.FirebaseConfig.showSyncIndicator('✓ Usuario creado');

            return { success: true, id: docRef.id };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'crear usuario');
        }
    }

    // ========== ACTUALIZAR USUARIO ==========
    async updateUser(userId, updates) {
        if (!this.isAdmin() && userId !== this.currentUser?.id) {
            return { success: false, error: 'No tienes permisos para editar este usuario' };
        }

        try {
            window.FirebaseConfig.showSyncIndicator('Actualizando usuario...');

            const updateData = {
                ...updates,
                ultimaModificacion: window.FirebaseConfig.serverTimestamp()
            };

            // Si se cambia el PIN, verificar que no exista
            if (updates.pin) {
                const existingPin = await this.usersRef
                    .where('pin', '==', updates.pin)
                    .get();

                if (!existingPin.empty && existingPin.docs[0].id !== userId) {
                    return { success: false, error: 'El PIN ya está en uso' };
                }
            }

            await this.usersRef.doc(userId).update(updateData);

            // Si es el usuario actual, actualizar localStorage
            if (userId === this.currentUser?.id) {
                const updatedUser = { ...this.currentUser, ...updates };
                this.currentUser = updatedUser;
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }

            console.log('✅ Usuario actualizado:', userId);
            window.FirebaseConfig.showSyncIndicator('✓ Usuario actualizado');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'actualizar usuario');
        }
    }

    // ========== ELIMINAR USUARIO (soft delete) ==========
    async deleteUser(userId) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Solo los administradores pueden eliminar usuarios' };
        }

        if (userId === this.currentUser?.id) {
            return { success: false, error: 'No puedes eliminar tu propio usuario' };
        }

        try {
            window.FirebaseConfig.showSyncIndicator('Eliminando usuario...');

            await this.usersRef.doc(userId).update({
                activo: false,
                fechaEliminacion: window.FirebaseConfig.serverTimestamp(),
                eliminadoPor: this.currentUser.id
            });

            console.log('✅ Usuario eliminado:', userId);
            window.FirebaseConfig.showSyncIndicator('✓ Usuario eliminado');

            return { success: true };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'eliminar usuario');
        }
    }

    // ========== OBTENER TODOS LOS USUARIOS ==========
    async getAllUsers() {
        if (!this.isAdmin()) {
            return { success: false, error: 'Solo los administradores pueden ver todos los usuarios' };
        }

        try {
            const snapshot = await this.usersRef
                .where('activo', '==', true)
                .get();

            const users = [];
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, users };

        } catch (error) {
            return window.FirebaseConfig.handleFirebaseError(error, 'obtener usuarios');
        }
    }

    // ========== ESCUCHAR USUARIOS EN TIEMPO REAL ==========
    startListening(callback) {
        if (!this.isAdmin()) {
            console.warn('⚠️ Solo los administradores pueden escuchar usuarios');
            return;
        }

        console.log('👂 Iniciando escucha de usuarios en tiempo real...');

        this.unsubscribe = this.usersRef
            .where('activo', '==', true)
            .onSnapshot(
                (snapshot) => {
                    const users = [];

                    snapshot.forEach((doc) => {
                        users.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });

                    console.log(`👥 Usuarios actualizados: ${users.length}`);

                    if (callback) callback(users);

                    window.FirebaseConfig.showSyncIndicator('✓ Usuarios sincronizados');
                },
                (error) => {
                    console.error('❌ Error escuchando usuarios:', error);
                    window.FirebaseConfig.handleFirebaseError(error, 'usuarios');
                }
            );
    }

    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            console.log('🔇 Escucha de usuarios detenida');
        }
    }
}

// Crear instancia global
window.usersService = new UsersService();

console.log('✅ UsersService inicializado');
