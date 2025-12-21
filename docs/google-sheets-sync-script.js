/**
 * ==============================================
 * SCRIPT DE SINCRONIZACIÓN GOOGLE SHEETS → POS APP
 * ==============================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 
 * 1. Abre tu Google Sheet
 * 2. Ve a Extensiones → Apps Script
 * 3. Borra todo el código que aparece
 * 4. Copia y pega TODO este código
 * 5. Reemplaza las credenciales de Supabase abajo
 * 6. Guarda (Ctrl+S)
 * 7. Ve a Activadores (icono de reloj) → Agregar activador:
 *    - Función: onEditTrigger
 *    - Evento: Al editar
 * 8. Autoriza los permisos cuando te lo pida
 * 
 * ¡Listo! Ahora cada cambio en la hoja se sincronizará automáticamente.
 */

// ====== CONFIGURACIÓN - YA CONFIGURADO ======
const SUPABASE_URL = 'https://bmnlzxwpeyavfnzvcthd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbmx6eHdwZXlhdmZuenZjdGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjU5MTcsImV4cCI6MjA4MTc0MTkxN30.xBOkAWOIYXtG_u4vDOxHEdOCAliNfQj9qjYDLsRHXT0';
// =====================================================

/**
 * Se ejecuta cuando editas una celda
 */
function onEditTrigger(e) {
    try {
        // Solo procesar si hay cambios reales
        if (!e || !e.range) return;

        // Esperar un poco para evitar múltiples llamadas
        Utilities.sleep(500);

        // Sincronizar toda la hoja
        syncAllProducts();

    } catch (error) {
        console.error('Error en onEditTrigger:', error);
    }
}

/**
 * Sincroniza todos los productos a Supabase
 * También puedes ejecutar esta función manualmente
 */
function syncAllProducts() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
        console.log('No hay datos para sincronizar');
        return;
    }

    // Primera fila son los encabezados
    const headers = data[0].map(h => h.toString().toLowerCase().trim());

    // Encontrar índices de columnas
    const colIndex = {
        nombre: findColumnIndex(headers, ['nombre', 'name', 'producto']),
        categoria: findColumnIndex(headers, ['categoria', 'categoría', 'category']),
        precio: findColumnIndex(headers, ['precio', 'price']),
        costo: findColumnIndex(headers, ['costo', 'cost']),
        stock: findColumnIndex(headers, ['stock', 'cantidad'])
    };

    console.log('Columnas detectadas:', colIndex);

    // Procesar cada fila de productos
    const products = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const nombre = row[colIndex.nombre]?.toString().trim();

        if (!nombre) continue; // Saltar filas vacías

        products.push({
            name: nombre,
            category_name: row[colIndex.categoria]?.toString().trim() || '',
            price: parseFloat(row[colIndex.precio]) || 0,
            cost: parseFloat(row[colIndex.costo]) || 0,
            stock: parseInt(row[colIndex.stock]) || 0,
            is_active: true,
            updated_at: new Date().toISOString()
        });
    }

    console.log('Productos a sincronizar:', products.length);

    // Enviar a Supabase
    if (products.length > 0) {
        sendToSupabase(products);
    }
}

/**
 * Encuentra el índice de una columna por su nombre
 */
function findColumnIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        for (const name of possibleNames) {
            if (headers[i].includes(name)) {
                return i;
            }
        }
    }
    return 0; // Default a primera columna
}

/**
 * Envía productos a Supabase
 */
function sendToSupabase(products) {
    const url = SUPABASE_URL + '/rest/v1/products';

    for (const product of products) {
        try {
            // Primero buscar si existe
            const searchUrl = url + '?name=eq.' + encodeURIComponent(product.name) + '&select=id';
            const searchResponse = UrlFetchApp.fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                },
                muteHttpExceptions: true
            });

            const existing = JSON.parse(searchResponse.getContentText());

            if (existing && existing.length > 0) {
                // Actualizar existente
                const updateUrl = url + '?id=eq.' + existing[0].id;
                UrlFetchApp.fetch(updateUrl, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    payload: JSON.stringify({
                        name: product.name,
                        price: product.price,
                        cost: product.cost,
                        stock: product.stock,
                        is_active: product.is_active,
                        updated_at: product.updated_at
                    }),
                    muteHttpExceptions: true
                });
                console.log('Actualizado:', product.name);
            } else {
                // Crear nuevo
                UrlFetchApp.fetch(url, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    payload: JSON.stringify({
                        id: Utilities.getUuid(),
                        name: product.name,
                        price: product.price,
                        cost: product.cost,
                        stock: product.stock,
                        is_active: product.is_active,
                        created_at: new Date().toISOString(),
                        updated_at: product.updated_at
                    }),
                    muteHttpExceptions: true
                });
                console.log('Creado:', product.name);
            }

            // Pequeña pausa para no saturar la API
            Utilities.sleep(100);

        } catch (error) {
            console.error('Error sincronizando ' + product.name + ':', error);
        }
    }

    console.log('Sincronización completada');
}

/**
 * Función para probar la conexión
 * Ejecuta esta primero para verificar que funciona
 */
function testConnection() {
    try {
        const url = SUPABASE_URL + '/rest/v1/products?limit=1';
        const response = UrlFetchApp.fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            muteHttpExceptions: true
        });

        console.log('Estado:', response.getResponseCode());
        console.log('Respuesta:', response.getContentText());

        if (response.getResponseCode() === 200) {
            SpreadsheetApp.getUi().alert('✅ Conexión exitosa con Supabase!');
        } else {
            SpreadsheetApp.getUi().alert('❌ Error: ' + response.getContentText());
        }
    } catch (error) {
        SpreadsheetApp.getUi().alert('❌ Error de conexión: ' + error.toString());
    }
}

/**
 * Agrega un menú personalizado a Google Sheets
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🔄 POS Sync')
        .addItem('Sincronizar ahora', 'syncAllProducts')
        .addItem('Probar conexión', 'testConnection')
        .addToUi();
}
