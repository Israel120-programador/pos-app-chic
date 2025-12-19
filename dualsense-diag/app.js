/**
 * TECNO-INGENIERO PRO: DualSense Diag
 * Base de Datos de Componentes + Lógica de UI
 */

// =============================================
// BASE DE DATOS DE COMPONENTES
// Extraída del análisis del video + Expertise
// =============================================

const circuitData = [
    {
        id: 1,
        name: "Resistencia de Paso (Input)",
        location: "Línea VBUS (Post USB-C)",
        value: "0.1 Ω",
        type: "Resistor",
        criticality: "High",
        check: "Medir resistencia. Si es infinita (OL), está abierta. Reemplazar con resistencia de 0.1Ω tolerancia baja.",
        voltageRef: "5.1V entrada / 5.1V salida"
    },
    {
        id: 2,
        name: "IC PMIC (Dialog)",
        location: "Chip Principal de Power",
        value: "DA9087",
        type: "IC",
        criticality: "Critical",
        check: "Verificar entrada 5V. Salida 4.0V SOLO con batería puesta. Si hay 5V entrada pero 0V salida con batería buena, el IC podría estar dañado.",
        voltageRef: "In: 5.1V | Out: 0V (sin batt) / 4.0V (con batt)"
    },
    {
        id: 3,
        name: "Puerto USB-C (Pin 11)",
        location: "Conector de Carga",
        value: "VBUS",
        type: "Connector",
        criticality: "Medium",
        check: "Verificar soldadura fría y voltaje de entrada. Inspeccionar visualmente pines doblados o corroídos. Medir continuidad del pin 11 a la resistencia.",
        voltageRef: "5.1V Stable"
    },
    {
        id: 4,
        name: "Botón PS (Traza)",
        location: "Pad trasero CPU a Membrana",
        value: "Continuidad",
        type: "Trace/Pad",
        criticality: "Low",
        check: "Continuidad < 1 Ohm desde el punto de contacto hasta SoC. Inspeccionar posibles trazas levantadas o corrosión.",
        voltageRef: "Logic High/Low (1.8V approx)"
    },
    {
        id: 5,
        name: "Conector de Batería",
        location: "FPC hacia batería",
        value: "3-Pin",
        type: "Connector",
        criticality: "High",
        check: "Verificar conexión física. Pin 1: GND, Pin 2: Data (Termistor NTC), Pin 3: V+ (~3.7-4.2V). Sin data line correcto, PMIC no habilita carga.",
        voltageRef: "GND / ~10kΩ NTC / 3.7-4.2V"
    },
    {
        id: 6,
        name: "Capacitor Filtro VBUS",
        location: "Paralelo post-resistencia",
        value: "100µF",
        type: "Capacitor",
        criticality: "Medium",
        check: "Verificar que no esté en corto. Medir con multímetro en modo capacitancia o verificar que no hay corto a GND.",
        voltageRef: "5.1V DC"
    },
    {
        id: 7,
        name: "ESD Protection IC",
        location: "Línea USB Data D+/D-",
        value: "TVS Diode",
        type: "IC",
        criticality: "Medium",
        check: "Verificar que no esté en corto a GND. Estos IC pueden fallar en corto después de una descarga. Medir resistencia entre data lines y GND.",
        voltageRef: "Clamping ~5.5V"
    },
    {
        id: 8,
        name: "Regulador 3.3V",
        location: "Rail lógico secundario",
        value: "3.3V LDO",
        type: "IC",
        criticality: "High",
        check: "Verificar salida 3.3V ±5%. Si no hay salida, verificar entrada y capacitores asociados. Puede causar fallas de comunicación USB.",
        voltageRef: "In: 5V | Out: 3.3V"
    }
];

// =============================================
// ESTADO DE LA APLICACIÓN
// =============================================

let state = {
    searchTerm: '',
    selectedId: null,
    activeFilter: 'all'
};

// =============================================
// FUNCIONES DE RENDERIZADO
// =============================================

function getCriticalityBadgeClass(criticality) {
    const classes = {
        'Critical': 'badge-critical',
        'High': 'badge-high',
        'Medium': 'badge-medium',
        'Low': 'badge-low'
    };
    return classes[criticality] || 'badge-default';
}

function renderComponentCard(comp) {
    const isSelected = state.selectedId === comp.id;
    const badgeClass = getCriticalityBadgeClass(comp.criticality);

    return `
        <div class="component-card ${isSelected ? 'selected' : ''}" data-id="${comp.id}">
            <div class="criticality-indicator ${comp.criticality.toLowerCase()}"></div>
            <div class="card-header">
                <h3 class="card-title">${comp.name}</h3>
                <span class="badge ${badgeClass}">${comp.value}</span>
            </div>
            <div class="card-info">
                <p><strong>Ubicación:</strong> ${comp.location}</p>
                <p><strong>Ref. Voltaje:</strong> ${comp.voltageRef}</p>
                <p><strong>Tipo:</strong> ${comp.type}</p>
            </div>
            ${isSelected ? `
                <div class="procedure-box">
                    <div class="procedure-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        Procedimiento de Diagnóstico:
                    </div>
                    <p class="procedure-text">${comp.check}</p>
                </div>
            ` : ''}
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3>No se encontraron componentes</h3>
            <p>Intenta con otro término de búsqueda</p>
        </div>
    `;
}

function getFilteredData() {
    return circuitData.filter(comp => {
        // Filtro de búsqueda
        const searchMatch =
            comp.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            comp.value.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            comp.type.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            comp.location.toLowerCase().includes(state.searchTerm.toLowerCase());

        // Filtro de criticidad
        const criticalityMatch =
            state.activeFilter === 'all' ||
            comp.criticality === state.activeFilter;

        return searchMatch && criticalityMatch;
    });
}

function render() {
    const componentsList = document.getElementById('componentsList');
    const componentCount = document.getElementById('componentCount');
    const filteredData = getFilteredData();

    if (filteredData.length === 0) {
        componentsList.innerHTML = renderEmptyState();
    } else {
        componentsList.innerHTML = filteredData.map(renderComponentCard).join('');
    }

    // Actualizar contador
    const total = circuitData.length;
    const showing = filteredData.length;
    componentCount.textContent = showing === total
        ? `${total} componentes`
        : `${showing} de ${total} componentes`;

    // Re-attach event listeners
    attachCardListeners();
}

// =============================================
// EVENT LISTENERS
// =============================================

function attachCardListeners() {
    document.querySelectorAll('.component-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.dataset.id);
            state.selectedId = state.selectedId === id ? null : id;
            render();
        });
    });
}

function initEventListeners() {
    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        state.searchTerm = e.target.value;
        render();
    });

    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Actualizar estado activo visual
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Actualizar filtro
            state.activeFilter = btn.dataset.filter;
            render();
        });
    });
}

// =============================================
// INICIALIZACIÓN
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    render();
});
