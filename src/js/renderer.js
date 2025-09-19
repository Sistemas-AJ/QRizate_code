// src/js/renderer.js

// Estado centralizado de la aplicación
const AppState = {
    autoApiBaseUrl: null, // La URL automática que nos da Electron
    manualApiBaseUrl: null, // La URL que el usuario escribe
};

// --- INICIALIZACIÓN Y CONEXIÓN CON ELECTRON ---

// 1. Escuchamos el puerto automático que nos envía main.js
window.electronAPI.onSetApiPort((port) => {
    // Usamos la IP local en vez de 127.0.0.1 para que los QR funcionen en la red
    AppState.autoApiBaseUrl = `http://127.0.0.1:${port}`; 
    console.log(`🔌 Conexión automática establecida: ${AppState.autoApiBaseUrl}`);
    updateConnectionStatus();
});

// 2. Cuando el DOM esté listo, inicializamos todos los componentes
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupManualConfig();
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);
    // Ahora el formulario llama directamente a la función asíncrona correcta
    document.getElementById('qr-form').addEventListener('submit', handleQrFormSubmit);
}


// --- LÓGICA DE CONEXIÓN A LA API ---

function getApiBaseUrl() {
    return AppState.manualApiBaseUrl || AppState.autoApiBaseUrl || 'http://127.0.0.1:8000';
}

function setupManualConfig() {
    const ipInput = document.getElementById('manual_ip');
    const portInput = document.getElementById('manual_port');

    const updateManualConfig = () => {
        const ip = ipInput.value.trim();
        const port = portInput.value.trim();
        
        localStorage.setItem('qr_app_ip', ip);
        localStorage.setItem('qr_app_port', port);
        
        AppState.manualApiBaseUrl = (ip && port) ? `http://${ip}:${port}` : null;
        updateConnectionStatus();
    };

    ipInput.value = localStorage.getItem('qr_app_ip') || '';
    portInput.value = localStorage.getItem('qr_app_port') || '';
    ipInput.addEventListener('input', updateManualConfig);
    portInput.addEventListener('input', updateManualConfig);
    updateManualConfig();
}

function updateConnectionStatus() {
    const statusDiv = document.getElementById('ip-port-actual');
    const url = getApiBaseUrl();
    statusDiv.textContent = `Conectando a: ${url}`;
    statusDiv.textContent += AppState.manualApiBaseUrl ? " (Manual)" : " (Automático)";
}


// --- LÓGICA DE CARGA DE EXCEL (Sin cambios) ---

function handleExcelUpload(event) {
    const file = event.target.files[0];
    const filenameSpan = document.getElementById('excel-upload-filename');
    const uploadContainer = document.querySelector('.excel-upload-container');

    if (file) {
        filenameSpan.textContent = file.name;
        uploadContainer.classList.add('has-file');
        parseAndSendExcel(file);
    } else {
        filenameSpan.textContent = 'Sin archivos seleccionados';
        uploadContainer.classList.remove('has-file');
    }
}

function parseAndSendExcel(file) {
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (!rows.length) {
                return showNotification('El archivo Excel está vacío.', 'error');
            }
            const mappedRows = mapExcelRows(rows);
            const validRows = mappedRows.filter(row => row.correlativo && row.sede && row.area);
            if (validRows.length === 0) {
                return showNotification('Ninguna fila en el Excel tiene los campos requeridos (correlativo, sede, area).', 'error');
            }
            await sendBulkDataToApi(validRows);
        } catch (error) {
            console.error('Error procesando el Excel:', error);
            showNotification(`Error al procesar el archivo: ${error.message}`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function mapExcelRows(rows) {
    const fieldMap = {
        'ID': 'id', 'CATEGORIA': 'categoria', 'CENTRAL DE COSTOS': 'central_de_costos',
        'Nombre de central de costos': 'nombre_central_costos', 'AREA': 'area', 'Nombre del área': 'nombre_area',
        'CORRELATIVO': 'correlativo', 'CUENTA CONTABLE': 'cuenta_contable', 'ESTADO': 'estado',
        'DESCRIPCION': 'descripcion', 'DESCRIPCIÓN': 'descripcion', 'MARCA': 'marca', 'MODELO': 'modelo',
        'NUMERO DE SERIE': 'numero_serie', 'NÚMERO DE SERIE': 'numero_serie', 'SERIE': 'numero_serie',
        'CODIGO': 'codigo', 'CÓDIGO': 'codigo', 'SEDE': 'sede', 'URL': 'url'
    };
    return rows.map(row => {
        const mapped = {};
        for (const key in row) {
            const cleanKey = key.trim().toUpperCase();
            const mappedKey = Object.keys(fieldMap).find(k => k.toUpperCase() === cleanKey);
            if (mappedKey) {
                mapped[fieldMap[mappedKey]] = row[key];
            }
        }
        return mapped;
    });
}

async function sendBulkDataToApi(data) {
    // Convertir todos los valores de cada fila a string
    const stringifiedData = data.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
            newRow[key] = row[key] !== null && row[key] !== undefined ? String(row[key]) : "";
        });
        return newRow;
    });

    const apiUrl = `${getApiBaseUrl()}/activos/bulk-create`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stringifiedData)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Error del servidor: ${response.status}`);
        }
        const result = await response.json();
        console.log('Respuesta de bulk-create:', result);
        showNotification('Datos del Excel cargados correctamente.', 'success');
    } catch (error) {
        console.error('Error enviando datos a la API:', error);
        showNotification(`Error al cargar datos: ${error.message}`, 'error');
    }
}


// --- LÓGICA DE GENERACIÓN DE QR (VERSIÓN ÚNICA Y CORRECTA) ---

async function handleQrFormSubmit(event) {
    event.preventDefault();
    console.log("✔️ Botón 'Generar QR' presionado, iniciando proceso de guardado y generación.");

    const form = document.getElementById('qr-form');
    const formData = new FormData(form);
    const dataObject = {};
    formData.forEach((value, key) => {
        // Siempre enviar como string, aunque el input sea tipo number
        dataObject[key] = value !== null && value !== undefined ? String(value) : "";
    });

    console.log("📦 Datos del formulario recolectados:", dataObject);

    try {
        const apiUrl = `${getApiBaseUrl()}/activos/`;
        console.log(`📡 Enviando datos a: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataObject)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        const nuevoActivo = await response.json();
        showNotification('✅ Activo guardado en la base de datos con éxito.', 'success');
        console.log("🎉 Activo creado:", nuevoActivo);

        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        const qrUrl = nuevoActivo.url;
        
        if (qrUrl) {
            console.log(`🖼️ Generando QR para la URL: ${qrUrl}`);
            new QRious({
                element: qrContainer,
                value: qrUrl,
                size: 250,
            });
        }

    } catch (error) {
        console.error('❌ Error en el proceso de creación de activo y QR:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}


// --- UTILIDADES ---

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}