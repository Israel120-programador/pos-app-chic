// Debug script - logs errors to console without using alert()
window.onerror = function (message, source, lineno, colno, error) {
    const errorMsg = `Error: ${message}\nSource: ${source}\nLine: ${lineno}:${colno}`;
    console.error('🔴 CRITICAL ERROR:', errorMsg);
    if (error && error.stack) console.error(error.stack);

    // Show on screen instead of alert
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.innerHTML += `<div style="color:red; background:rgba(0,0,0,0.8); padding:10px; margin-top:10px; font-size:11px; max-width:90%; word-break:break-all; border-radius:8px;">${errorMsg}</div>`;
    }
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    console.error('🟠 Unhandled Promise Rejection:', event.reason);

    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.innerHTML += `<div style="color:orange; background:rgba(0,0,0,0.8); padding:10px; margin-top:10px; font-size:11px; max-width:90%; word-break:break-all; border-radius:8px;">Promise Error: ${event.reason}</div>`;
    }
});

console.log('🐞 Debug script loaded (no-alert mode)');
