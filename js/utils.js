/* =====================================================
   POS APP - UTILITIES
   ===================================================== */

const Utils = {
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    },

    generateShortId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency', currency: 'CLP',
            minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(amount);
    },

    formatDate(date) {
        return new Intl.DateTimeFormat('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(new Date(date));
    },

    formatDateTime(date) {
        return new Intl.DateTimeFormat('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(date));
    },

    formatTime(date) {
        return new Intl.DateTimeFormat('es-CL', {
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(date));
    },

    now() { return new Date().toISOString(); },

    formatRUT(rut) {
        if (!rut) return '';
        let clean = rut.replace(/[^0-9kK]/g, '');
        if (clean.length < 2) return clean;
        const dv = clean.slice(-1).toUpperCase();
        let num = clean.slice(0, -1);
        let formatted = '';
        while (num.length > 3) {
            formatted = '.' + num.slice(-3) + formatted;
            num = num.slice(0, -3);
        }
        return num + formatted + '-' + dv;
    },

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    },

    // Increased default debounce for performance
    debounceSlow(func, wait = 500) {
        return this.debounce(func, wait);
    },

    deepClone(obj) { return JSON.parse(JSON.stringify(obj)); },
    isOnline() { return navigator.onLine; },

    calculateTotals(subtotal, taxRate = 0.19) {
        const net = Math.round(subtotal / (1 + taxRate));
        const tax = subtotal - net;
        return { subtotal: net, tax, total: subtotal };
    },

    getMovementTypeDisplay(type) {
        const types = {
            'PURCHASE': { label: 'Compra', class: 'badge-success', sign: '+' },
            'ADJUSTMENT': { label: 'Ajuste', class: 'badge-info', sign: '±' },
            'LOSS': { label: 'Merma', class: 'badge-danger', sign: '-' },
            'SALE': { label: 'Venta', class: 'badge-warning', sign: '-' }
        };
        return types[type] || { label: type, class: 'badge-info', sign: '' };
    },

    getRoleDisplay(role) {
        const roles = { 'admin': 'Administrador', 'cashier': 'Cajero' };
        return roles[role] || role;
    },

    getPaymentMethodDisplay(method) {
        const methods = {
            'cash': { label: 'Efectivo', icon: '💵' },
            'card': { label: 'Tarjeta', icon: '💳' },
            'transfer': { label: 'Transferencia', icon: '📲' }
        };
        return methods[method] || { label: method, icon: '💰' };
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    parseNumber(str) {
        if (typeof str === 'number') return str;
        return parseInt(str.replace(/\D/g, ''), 10) || 0;
    }
};
