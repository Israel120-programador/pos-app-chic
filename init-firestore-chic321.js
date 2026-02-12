// init-firestore-chic321.js
// Script para inicializar Firestore con el menú completo de Chic321
// Ejecutar este script UNA SOLA VEZ desde la consola del navegador

async function inicializarFirestoreChic321() {
    console.log('🚀 Iniciando carga del menú completo de Chic321...');

    try {
        const db = firebase.firestore();

        // ========== 1. VERIFICAR SI YA EXISTEN USUARIOS ==========
        const usersSnapshot = await db.collection('usuarios').get();
        if (!usersSnapshot.empty) {
            console.log('⚠️ Ya existen usuarios en la base de datos. Saltando creación de usuarios por defecto.');
        } else {
            console.log('👤 Creando usuario administrador...');
            const adminRef = await db.collection('usuarios').add({
                nombre: 'Administrador',
                pin: '1234',
                rol: 'admin',
                activo: true,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Admin creado con ID:', adminRef.id);

            console.log('👤 Creando usuario vendedor...');
            const vendedorRef = await db.collection('usuarios').add({
                nombre: 'Vendedor 1',
                pin: '5678',
                rol: 'vendedor',
                activo: true,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Vendedor creado con ID:', vendedorRef.id);
        }

        // ========== 3. CREAR CATEGORÍAS ==========
        console.log('📂 Creando categorías...');

        const categorias = [
            { nombre: 'Vienesa', icono: '🌭', orden: 1 },
            { nombre: 'Vienesa XL', icono: '🌭', orden: 2 },
            { nombre: 'Papa Pleto', icono: '🍟', orden: 3 },
            { nombre: 'Papa Pleto XL', icono: '🍟', orden: 4 },
            { nombre: 'As', icono: '🥖', orden: 5 },
            { nombre: 'As XL', icono: '🥖', orden: 6 },
            { nombre: 'Churrasco/Lomito', icono: '🥩', orden: 7 },
            { nombre: 'Pollo Apanado', icono: '🍗', orden: 8 },
            { nombre: 'Hamburguesa', icono: '🍔', orden: 9 }
        ];

        for (const cat of categorias) {
            await db.collection('categorias').add({
                ...cat,
                activo: true,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        console.log('✅ Categorías creadas:', categorias.length);

        // ========== 4. CREAR TODOS LOS PRODUCTOS DEL MENÚ ==========
        console.log('📦 Creando productos del menú (esto puede tomar 1-2 minutos)...');

        // Menú completo extraído del Excel
        const productos = [
            // VIENESA (Filas 2-12)
            { nombre: 'Vienesa Solo', categoria: 'Vienesa', precio: 1000, costo: 500, stock: 12, codigo: 'VIEN-001' },
            { nombre: 'Vienesa Barros Luco', categoria: 'Vienesa', precio: 1500, costo: 750, stock: 12, codigo: 'VIEN-002' },
            { nombre: 'Vienesa Barros Luco Tocino', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-003' },
            { nombre: 'Vienesa Completo', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-004' },
            { nombre: 'Vienesa Italiano', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-005' },
            { nombre: 'Vienesa Chacarero', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-006' },
            { nombre: 'Vienesa Che Milico', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-007' },
            { nombre: 'Vienesa Dinamico', categoria: 'Vienesa', precio: 2500, costo: 1250, stock: 12, codigo: 'VIEN-008' },
            { nombre: 'Vienesa Brasileño', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-009' },
            { nombre: 'Vienesa Vegetariano', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-010' },
            { nombre: 'Vienesa Venezolano', categoria: 'Vienesa', precio: 2000, costo: 1000, stock: 12, codigo: 'VIEN-011' },

            // VIENESA XL (Filas 13-23)
            { nombre: 'Vienesa XL Solo', categoria: 'Vienesa XL', precio: 1500, costo: 750, stock: 12, codigo: 'VIENXL-001' },
            { nombre: 'Vienesa XL Barros Luco', categoria: 'Vienesa XL', precio: 2000, costo: 1000, stock: 12, codigo: 'VIENXL-002' },
            { nombre: 'Vienesa XL Barros Luco Tocino', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-003' },
            { nombre: 'Vienesa XL Completo', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-004' },
            { nombre: 'Vienesa XL Italiano', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-005' },
            { nombre: 'Vienesa XL Chacarero', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-006' },
            { nombre: 'Vienesa XL Che Milico', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-007' },
            { nombre: 'Vienesa XL Dinamico', categoria: 'Vienesa XL', precio: 3000, costo: 1500, stock: 12, codigo: 'VIENXL-008' },
            { nombre: 'Vienesa XL Brasileño', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-009' },
            { nombre: 'Vienesa XL Vegetariano', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-010' },
            { nombre: 'Vienesa XL Venezolano', categoria: 'Vienesa XL', precio: 2500, costo: 1250, stock: 12, codigo: 'VIENXL-011' },

            // PAPA PLETO (Filas 24-34)
            { nombre: 'Papa Pleto Solo', categoria: 'Papa Pleto', precio: 2000, costo: 1000, stock: 12, codigo: 'PAPA-001' },
            { nombre: 'Papa Pleto Barros Luco', categoria: 'Papa Pleto', precio: 2500, costo: 1250, stock: 12, codigo: 'PAPA-002' },
            { nombre: 'Papa Pleto Barros Luco Tocino', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-003' },
            { nombre: 'Papa Pleto Completo', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-004' },
            { nombre: 'Papa Pleto Italiano', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-005' },
            { nombre: 'Papa Pleto Chacarero', categoria: 'Papa Pleto', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPA-006' },
            { nombre: 'Papa Pleto Che Milico', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-007' },
            { nombre: 'Papa Pleto Dinamico', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-008' },
            { nombre: 'Papa Pleto Brasileño', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-009' },
            { nombre: 'Papa Pleto Vegetariano', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-010' },
            { nombre: 'Papa Pleto Venezolano', categoria: 'Papa Pleto', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPA-011' },

            // PAPA PLETO XL (Filas 35-45)
            { nombre: 'Papa Pleto XL Solo', categoria: 'Papa Pleto XL', precio: 2500, costo: 1250, stock: 12, codigo: 'PAPAXL-001' },
            { nombre: 'Papa Pleto XL Barros Luco', categoria: 'Papa Pleto XL', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPAXL-002' },
            { nombre: 'Papa Pleto XL Barros Luco Tocino', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-003' },
            { nombre: 'Papa Pleto XL Completo', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-004' },
            { nombre: 'Papa Pleto XL Italiano', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-005' },
            { nombre: 'Papa Pleto XL Chacarero', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-006' },
            { nombre: 'Papa Pleto XL Che Milico', categoria: 'Papa Pleto XL', precio: 3000, costo: 1500, stock: 12, codigo: 'PAPAXL-007' },
            { nombre: 'Papa Pleto XL Dinamico', categoria: 'Papa Pleto XL', precio: 4000, costo: 2000, stock: 12, codigo: 'PAPAXL-008' },
            { nombre: 'Papa Pleto XL Brasileño', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-009' },
            { nombre: 'Papa Pleto XL Vegetariano', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-010' },
            { nombre: 'Papa Pleto XL Venezolano', categoria: 'Papa Pleto XL', precio: 3500, costo: 1750, stock: 12, codigo: 'PAPAXL-011' },

            // AS (Filas 46-56)
            { nombre: 'As Solo', categoria: 'As', precio: 2500, costo: 1250, stock: 12, codigo: 'AS-001' },
            { nombre: 'As Barros Luco', categoria: 'As', precio: 3000, costo: 1500, stock: 12, codigo: 'AS-002' },
            { nombre: 'As Barros Luco Tocino', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-003' },
            { nombre: 'As Completo', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-004' },
            { nombre: 'As Italiano', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-005' },
            { nombre: 'As Chacarero', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-006' },
            { nombre: 'As Che Milico', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-007' },
            { nombre: 'As Dinamico', categoria: 'As', precio: 4000, costo: 2000, stock: 12, codigo: 'AS-008' },
            { nombre: 'As Brasileño', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-009' },
            { nombre: 'As Vegetariano', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-010' },
            { nombre: 'As Venezolano', categoria: 'As', precio: 3500, costo: 1750, stock: 12, codigo: 'AS-011' },

            // AS XL (Filas 57-67)
            { nombre: 'As XL Solo', categoria: 'As XL', precio: 3000, costo: 1500, stock: 12, codigo: 'ASXL-001' },
            { nombre: 'As XL Barros Luco', categoria: 'As XL', precio: 3500, costo: 1750, stock: 12, codigo: 'ASXL-002' },
            { nombre: 'As XL Barros Luco Tocino', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-003' },
            { nombre: 'As XL Completo', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-004' },
            { nombre: 'As XL Italiano', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-005' },
            { nombre: 'As XL Chacarero', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-006' },
            { nombre: 'As XL Che Milico', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-007' },
            { nombre: 'As XL Dinamico', categoria: 'As XL', precio: 4500, costo: 2250, stock: 12, codigo: 'ASXL-008' },
            { nombre: 'As XL Brasileño', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-009' },
            { nombre: 'As XL Vegetariano', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-010' },
            { nombre: 'As XL Venezolano', categoria: 'As XL', precio: 4000, costo: 2000, stock: 12, codigo: 'ASXL-011' },

            // CHURRASCO/LOMITO (Filas 68-79)
            { nombre: 'Churrasco/Lomito Solo', categoria: 'Churrasco/Lomito', precio: 3000, costo: 1500, stock: 12, codigo: 'CHURR-001' },
            { nombre: 'Churrasco/Lomito Barros Luco', categoria: 'Churrasco/Lomito', precio: 3500, costo: 1750, stock: 12, codigo: 'CHURR-002' },
            { nombre: 'Churrasco/Lomito Barros Luco Tocino', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-003' },
            { nombre: 'Churrasco/Lomito Completo', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-004' },
            { nombre: 'Churrasco/Lomito Italiano', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-005' },
            { nombre: 'Churrasco/Lomito Chacarero', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-006' },
            { nombre: 'Churrasco/Lomito Che Milico', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-007' },
            { nombre: 'Churrasco/Lomito Dinamico', categoria: 'Churrasco/Lomito', precio: 4500, costo: 2250, stock: 12, codigo: 'CHURR-008' },
            { nombre: 'Churrasco/Lomito Brasileño', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-009' },
            { nombre: 'Churrasco/Lomito Vegetariano', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-010' },
            { nombre: 'Churrasco/Lomito Venezolano', categoria: 'Churrasco/Lomito', precio: 4000, costo: 2000, stock: 12, codigo: 'CHURR-011' },
            { nombre: 'Churrasco/Lomito Venezolano Especial', categoria: 'Churrasco/Lomito', precio: 6500, costo: 3250, stock: 12, codigo: 'CHURR-012' },

            // POLLO APANADO (Filas 80-91)
            { nombre: 'Pollo Apanado Solo', categoria: 'Pollo Apanado', precio: 3000, costo: 1500, stock: 12, codigo: 'POLLO-001' },
            { nombre: 'Pollo Apanado Barros Luco', categoria: 'Pollo Apanado', precio: 3500, costo: 1750, stock: 12, codigo: 'POLLO-002' },
            { nombre: 'Pollo Apanado Barros Luco Tocino', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-003' },
            { nombre: 'Pollo Apanado Completo', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-004' },
            { nombre: 'Pollo Apanado Italiano', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-005' },
            { nombre: 'Pollo Apanado Chacarero', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-006' },
            { nombre: 'Pollo Apanado Che Milico', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-007' },
            { nombre: 'Pollo Apanado Dinamico', categoria: 'Pollo Apanado', precio: 4500, costo: 2250, stock: 12, codigo: 'POLLO-008' },
            { nombre: 'Pollo Apanado Brasileño', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-009' },
            { nombre: 'Pollo Apanado Vegetariano', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-010' },
            { nombre: 'Pollo Apanado Venezolano', categoria: 'Pollo Apanado', precio: 4000, costo: 2000, stock: 12, codigo: 'POLLO-011' },
            { nombre: 'Pollo Apanado Venezolano Especial', categoria: 'Pollo Apanado', precio: 6500, costo: 3250, stock: 12, codigo: 'POLLO-012' },

            // HAMBURGUESA (Filas 92-100+)
            { nombre: 'Hamburguesa 180g Solo', categoria: 'Hamburguesa', precio: 3000, costo: 1500, stock: 12, codigo: 'BURG-001' },
            { nombre: 'Hamburguesa 180g Barros Luco', categoria: 'Hamburguesa', precio: 5000, costo: 2500, stock: 12, codigo: 'BURG-002' },
            { nombre: 'Hamburguesa 180g Barros Luco Tocino', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-003' },
            { nombre: 'Hamburguesa 180g Completo', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-004' },
            { nombre: 'Hamburguesa 180g Italiano', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-005' },
            { nombre: 'Hamburguesa 180g Chacarero', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-006' },
            { nombre: 'Hamburguesa 180g Che Milico', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-007' },
            { nombre: 'Hamburguesa 180g Dinamico', categoria: 'Hamburguesa', precio: 4500, costo: 2250, stock: 12, codigo: 'BURG-008' },
            { nombre: 'Hamburguesa 180g Brasileño', categoria: 'Hamburguesa', precio: 4000, costo: 2000, stock: 12, codigo: 'BURG-009' }
        ];

        // Crear productos en lotes de 500 (límite de Firebase)
        let totalCreados = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const producto of productos) {
            const ref = db.collection('productos').doc();
            batch.set(ref, {
                ...producto,
                stockMinimo: 5,
                activo: true,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                ultimaModificacion: firebase.firestore.FieldValue.serverTimestamp()
            });

            batchCount++;
            totalCreados++;

            // Commit cada 500 operaciones
            if (batchCount >= 500) {
                await batch.commit();
                console.log(`  ✓ ${totalCreados} productos creados hasta ahora...`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Commit productos restantes
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log('✅ Productos creados:', totalCreados);

        // ========== 5. CREAR CONFIGURACIÓN ==========
        console.log('⚙️ Creando configuración inicial...');

        await db.collection('configuracion').doc('general').set({
            nombreNegocio: 'Chic321',
            direccion: 'Santiago, Chile',
            telefono: '+56 9 XXXX XXXX',
            email: 'contacto@chic321.cl',
            moneda: 'CLP',
            simboloMoneda: '$',
            imprimirRecibo: true,
            mostrarLogo: true,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Configuración creada');

        // ========== RESUMEN ==========
        console.log('\n' + '='.repeat(60));
        console.log('✅ ¡FIRESTORE INICIALIZADO CON MENÚ COMPLETO DE CHIC321!');
        console.log('='.repeat(60));
        console.log('\n📊 RESUMEN:');
        console.log('👥 Usuarios creados: 2');
        console.log('   - Admin PIN: 1234');
        console.log('   - Vendedor PIN: 5678');
        console.log('📂 Categorías: ' + categorias.length);
        console.log('📦 Productos: ' + totalCreados);
        console.log('⚙️  Configuración: ✓');
        console.log('\n🍔 CATEGORÍAS DEL MENÚ:');
        console.log('   • Vienesa (11 productos)');
        console.log('   • Vienesa XL (11 productos)');
        console.log('   • Papa Pleto (11 productos)');
        console.log('   • Papa Pleto XL (11 productos)');
        console.log('   • As (11 productos)');
        console.log('   • As XL (11 productos)');
        console.log('   • Churrasco/Lomito (12 productos)');
        console.log('   • Pollo Apanado (12 productos)');
        console.log('   • Hamburguesa (9 productos)');
        console.log('\n💰 RANGO DE PRECIOS:');
        console.log('   • Desde $1,000 (Vienesa Solo)');
        console.log('   • Hasta $6,500 (Especiales)');
        console.log('\n🎯 SIGUIENTE PASO:');
        console.log('1. Recarga la página (F5)');
        console.log('2. Login con PIN: 1234 (Admin) o 5678 (Vendedor)');
        console.log('3. ¡Empieza a vender! 🚀');
        console.log('\n');

        return {
            success: true,
            usuarios: 2,
            categorias: categorias.length,
            productos: totalCreados
        };

    } catch (error) {
        console.error('❌ Error inicializando Firestore:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Para ejecutar, simplemente llama a:
// inicializarFirestoreChic321();

console.log('✅ Script de inicialización Chic321 cargado');
console.log('📝 Para inicializar Firestore con tu menú completo, ejecuta:');
console.log('   inicializarFirestoreChic321()');
