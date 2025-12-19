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

    bindEvents() {
        document.getElementById('save-settings')?.addEventListener('click', () => this.save());
        document.getElementById('scan-bluetooth')?.addEventListener('click', () => this.scanBluetooth());
        document.getElementById('test-print')?.addEventListener('click', () => this.testPrint());
    },

    async loadSettings() {
        let settings = await DB.get('settings', 'default');

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
        Utils.showToast('Configuración guardada', 'success');
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
