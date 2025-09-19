// Define aquí la URL pública y fija a la que apuntarán los QR de tus activos.
const ASSET_PAGE_URL = 'https://qrizate.systempiura.com/asset.html';

// Estado centralizado de la aplicación
const AppState = {
    localIp: null, // La IP del PC en la red local
    apiPort: null, // El puerto en el que corre el backend
    manualApiBaseUrl: null, // La URL manual que el usuario escribe
};

const qrContainer = document.getElementById('qrcode');
qrContainer.innerHTML = '';
const canvas = document.createElement('canvas');
canvas.width = 250;
canvas.height = 250;
qrContainer.appendChild(canvas);

// --- INICIALIZACIÓN Y CONEXIÓN CON ELECTRON ---

// 1. Recibimos el PUERTO del backend desde main.js
window.electronAPI.onSetApiPort((port) => {
    AppState.apiPort = port;
    console.log(`🔌 Puerto del API recibido: ${port}`);
    generatePairingQr(); // Intentamos generar el QR de emparejamiento
});

// 2. Recibimos la IP LOCAL del PC desde main.js
window.electronAPI.onSetLocalIp((ip) => {
    AppState.localIp = ip;
    console.log(`📍 IP local del PC recibida: ${ip}`);
    generatePairingQr(); // Intentamos generar el QR de emparejamiento
});

// 3. Cuando el DOM esté listo, inicializamos los componentes
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupManualConfig();
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);
    document.getElementById('qr-form').addEventListener('submit', handleQrFormSubmit);
}

// --- LÓGICA DE EMPAREJAMIENTO ---
function generatePairingQr() {
    // Solo generamos el QR si ya tenemos tanto la IP como el Puerto
    if (AppState.localIp && AppState.apiPort) {
        const pairingUrl = `http://${AppState.localIp}:${AppState.apiPort}/pair.html`;
        
        const qrContainer = document.getElementById('pairing-qr-container');
        const urlDisplay = document.getElementById('pairing-url-display');

        qrContainer.innerHTML = ''; // Limpiar
        new QRious({
            element: qrContainer,
            value: pairingUrl,
            size: 150,
        });

        urlDisplay.textContent = `URL de Conexión: ${pairingUrl}`;
        console.log(`✅ QR de emparejamiento generado para: ${pairingUrl}`);
    }
}

// --- LÓGICA DE CONEXIÓN A LA API (Con Fallback Manual) ---
function getApiBaseUrl() {
    // Prioridad 1: La URL manual del usuario
    if (AppState.manualApiBaseUrl) return AppState.manualApiBaseUrl;
    // Prioridad 2: La URL automática con la IP y puerto recibidos
    if (AppState.localIp && AppState.apiPort) return `http://${AppState.localIp}:${AppState.apiPort}`;
    // Fallback por si algo falla
    return `http://127.0.0.1:8000`;
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
    console.log("✔️ Botón 'Generar QR' presionado, iniciando proceso.");
    
    const form = document.getElementById('qr-form');
    const formData = new FormData(form);
    const dataObject = {};

    // Limpieza de datos: campos vacíos se envían como null
    for (const [key, preValue] of formData.entries()) {
        const value = String(preValue).trim();
        if (value === '') {
            dataObject[key] = null;
        } else {
            dataObject[key] = value;
        }
    }

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

        // --- LOGS DE DEPURACIÓN ---
        if (!nuevoActivo || !nuevoActivo.id) {
            showNotification('⚠️ El backend no devolvió un ID de activo.', 'error');
            console.error('❌ El backend no devolvió un ID de activo:', nuevoActivo);
        }

        // Construimos la URL PÚBLICA y PERMANENTE para el QR del activo
        const urlParaElQr = `${ASSET_PAGE_URL}?id=${nuevoActivo.id}`;
        console.log(`🖼️ Generando QR de Activo para la URL: ${urlParaElQr}`);

        const qrContainer = document.getElementById('qrcode');
        if (!qrContainer) {
            showNotification('❌ No se encontró el contenedor #qrcode en el DOM.', 'error');
            console.error('❌ No se encontró el contenedor #qrcode en el DOM.');
        } else {
            qrContainer.innerHTML = '';
            try {
                new QRious({
                    element: qrContainer,
                    value: urlParaElQr,
                    size: 250,
                });
                showNotification('✅ QR generado correctamente.', 'success');
                console.log('✅ QR generado correctamente en el contenedor #qrcode');
            } catch (qrError) {
                showNotification('❌ Error al generar el QR.', 'error');
                console.error('❌ Error al generar el QR:', qrError);
            }
        }

        form.reset(); // Limpia el formulario

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