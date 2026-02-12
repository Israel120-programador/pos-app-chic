/* =====================================================
   POS APP - SETTINGS MODULE (Enhanced with Bluetooth)
   ===================================================== */

const Settings = {
    bluetoothDevice: null,
    printerCharacteristic: null,

    async init() {
        this.bindEvents();
        await this.loadSettings();
    },

    async loadSettings() {
        let settings = await DB.get('settings', 'default');

        // Check Status
        this.checkSystemStatus();

        if (!settings) {
            settings = {
                device_id: 'default',
                business_name: 'Mi Negocio',
                rut: '',
                address: '',
                giro: '',
                currency: 'CLP',
                tax_rate: 19,
                receipt_footer: '¡Gracias por su compra!',
                last_sync_timestamp: null,
                offline_mode: false,
                print_receipts: true
            };
            await DB.put('settings', settings);
        }

        document.getElementById('setting-business-name').value = settings.business_name || '';
        document.getElementById('setting-rut').value = settings.rut || '';
        document.getElementById('setting-address').value = settings.address || '';
        document.getElementById('setting-giro').value = settings.giro || '';
        document.getElementById('setting-tax-rate').value = settings.tax_rate || 19;
        document.getElementById('setting-receipt-footer').value = settings.receipt_footer || '';
        document.getElementById('setting-device-id').value = settings.device_id;
        document.getElementById('setting-print-receipts').checked = settings.print_receipts !== false;
        document.getElementById('setting-offline-mode').checked = settings.offline_mode || false;
    },

    async checkSystemStatus() {
        // 1. Check Firebase SDK
        const fbStatus = document.getElementById('status-firebase-sdk');
        if (fbStatus) {
            if (typeof firebase !== 'undefined') {
                fbStatus.textContent = '✅ Cargado';
                fbStatus.className = 'status-value text-success';
            } else {
                fbStatus.textContent = '❌ No Cargado';
                fbStatus.className = 'status-value text-danger';
            }
        }

        // 2. Check Firebase Connection
        const connStatus = document.getElementById('status-connection');
        if (connStatus) {
            connStatus.textContent = '⏳ Probando...';
            try {
                const db = window.FirebaseConfig && window.FirebaseConfig.db;
                if (db) {
                    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
                    const check = db.collection('configuracion').doc('health_check').get();
                    await Promise.race([check, timeout]);
                    connStatus.textContent = '✅ Online (Firestore)';
                    connStatus.className = 'status-value text-success';
                } else {
                    connStatus.textContent = '❌ Sin DB';
                    connStatus.className = 'status-value text-danger';
                }
            } catch (e) {
                console.warn('Connection check failed:', e);
                if (navigator.onLine) {
                    connStatus.textContent = '⚠️ Error (Bloqueado?)';
                    connStatus.className = 'status-value text-warning';
                } else {
                    connStatus.textContent = '❌ Offline';
                    connStatus.className = 'status-value text-danger';
                }
            }
        }

        // 3. Queue
        const qStatus = document.getElementById('status-queue');
        if (qStatus) {
            qStatus.textContent = typeof Sync !== 'undefined' ? Sync.retryQueue.length : '0';
        }

        // 4. SW
        const swStatus = document.getElementById('status-version');
        if (swStatus) swStatus.textContent = 'v3.0.0 (Firebase)';
    },

    bindEvents() {
        document.getElementById('save-settings')?.addEventListener('click', () => this.save());
        document.getElementById('scan-bluetooth')?.addEventListener('click', () => this.scanBluetooth());
        document.getElementById('test-print')?.addEventListener('click', () => this.testPrint());
        document.getElementById('btn-check-connection')?.addEventListener('click', () => this.checkSystemStatus());

        // Delete sales history
        document.getElementById('btn-reset-data')?.addEventListener('click', () => this.resetSalesData());
    },

    async resetSalesData() {
        if (!confirm('⚠️ ¿Seguro que deseas borrar TODO el historial de ventas? Esta acción NO se puede deshacer.')) return;
        if (!confirm('🚨 ÚLTIMA CONFIRMACIÓN: Se eliminarán TODAS las ventas registradas. ¿Continuar?')) return;

        try {
            Utils.showToast('Eliminando historial de ventas...', 'info');

            // Delete all documents in 'ventas' collection
            const snapshot = await window.FirebaseConfig.db.collection('ventas').get();
            const batch = window.FirebaseConfig.db.batch();
            let count = 0;

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
            }

            Utils.showToast(`✅ ${count} ventas eliminadas`, 'success');

            // Refresh sales UI
            if (typeof Sales !== 'undefined' && Sales.loadSalesHistory) {
                Sales.loadSalesHistory();
            }
        } catch (error) {
            console.error('Error deleting sales:', error);
            Utils.showToast('Error al eliminar ventas: ' + error.message, 'error');
        }
    },

    async save() {
        const settings = {
            device_id: 'default',
            business_name: document.getElementById('setting-business-name').value.trim(),
            rut: document.getElementById('setting-rut').value.trim(),
            address: document.getElementById('setting-address').value.trim(),
            giro: document.getElementById('setting-giro').value.trim(),
            currency: 'CLP',
            tax_rate: parseInt(document.getElementById('setting-tax-rate').value) || 19,
            receipt_footer: document.getElementById('setting-receipt-footer').value.trim(),
            print_receipts: document.getElementById('setting-print-receipts').checked,
            offline_mode: document.getElementById('setting-offline-mode').checked,
            last_sync_timestamp: Utils.now()
        };

        await DB.put('settings', settings);

        // Push settings to cloud
        if (typeof Sync !== 'undefined') {
            await Sync.pushToCloud('settings', 'UPDATE', settings);
        }

        Utils.showToast('Configuración guardada y sincronizada', 'success');
    },

    async scanBluetooth() {
        if (!navigator.bluetooth) {
            Utils.showToast('Bluetooth no disponible en este navegador. Usa Chrome en Android.', 'error');
            return;
        }

        try {
            Utils.showToast('Buscando dispositivos Bluetooth...', 'info');

            // Request any Bluetooth device (printer or scanner)
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service', '0000180f-0000-1000-8000-00805f9b34fb']
            });

            this.bluetoothDevice = device;

            // Update UI
            const statusEl = document.getElementById('bluetooth-status');
            statusEl.innerHTML = `
                <span class="status-indicator connected"></span>
                <span>Conectado: ${device.name || 'Dispositivo'}</span>
            `;

            Utils.showToast(`Conectado a: ${device.name || 'Dispositivo Bluetooth'}`, 'success');

            // Listen for disconnection
            device.addEventListener('gattserverdisconnected', () => {
                this.updateBluetoothStatus(false);
                Utils.showToast('Dispositivo Bluetooth desconectado', 'warning');
            });

        } catch (error) {
            if (error.name !== 'NotFoundError') {
                Utils.showToast('Error al conectar Bluetooth: ' + error.message, 'error');
            }
        }
    },

    updateBluetoothStatus(connected) {
        const statusEl = document.getElementById('bluetooth-status');
        if (connected) {
            statusEl.innerHTML = `
                <span class="status-indicator connected"></span>
                <span>Conectado: ${this.bluetoothDevice?.name || 'Dispositivo'}</span>
            `;
        } else {
            statusEl.innerHTML = `
                <span class="status-indicator disconnected"></span>
                <span>Sin dispositivos conectados</span>
            `;
            this.bluetoothDevice = null;
        }
    },

    async testPrint() {
        Utils.showToast('Imprimiendo prueba...', 'info');

        // Use browser print API
        const testReceipt = `
            <div style="font-family: monospace; padding: 10px; width: 80mm;">
                <h2 style="text-align: center;">PRUEBA DE IMPRESIÓN</h2>
                <p style="text-align: center;">========================</p>
                <p>Fecha: ${Utils.formatDateTime(new Date())}</p>
                <p>Dispositivo: ${this.bluetoothDevice?.name || 'Navegador'}</p>
                <p style="text-align: center;">========================</p>
                <p style="text-align: center;">¡Impresión exitosa!</p>
            </div>
        `;

        const container = document.getElementById('receipt-container');
        container.innerHTML = testReceipt;
        window.print();

        setTimeout(() => {
            container.innerHTML = '';
        }, 1000);
    }
};
