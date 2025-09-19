// Define aquí la URL pública y fija a la que apuntarán los QR de tus activos.
const ASSET_PAGE_URL = 'https://qrizate.systempiura.com/asset.html&id=23784344';

// Estado centralizado de la aplicación
const AppState = {
    localIp: null, // La IP del PC en la red local
    apiPort: null, // El puerto en el que corre el backend
    apiBaseUrl: null, // La URL completa y correcta del backend local
};

// --- INICIALIZACIÓN Y CONEXIÓN CON ELECTRON ---

// 1. Recibimos el PUERTO del backend desde main.js
window.electronAPI.onSetApiPort((port) => {
    AppState.apiPort = port;
    console.log(`🔌 Puerto del API recibido: ${port}`);
    updateApiBaseUrl();
    updateConnectionStatus(); // <-- Añade esta línea
});

// 2. Recibimos la IP LOCAL del PC desde main.js
window.electronAPI.onSetLocalIp((ip) => {
    AppState.localIp = ip;
    console.log(`📍 IP local del PC recibida: ${ip}`);
    updateApiBaseUrl();
    updateConnectionStatus(); // <-- Añade esta línea
});

// 3. Función central para construir la URL del backend
function updateApiBaseUrl() {
    // Solo construimos la URL si tenemos tanto la IP como el puerto
    if (AppState.localIp && AppState.apiPort) {
        AppState.apiBaseUrl = `http://${AppState.localIp}:${AppState.apiPort}`;
        console.log(`✅ URL del backend establecida en: ${AppState.apiBaseUrl}`);
        // Actualizamos el texto informativo en la UI
        document.getElementById('ip-port-actual').textContent = `Conectado a: ${AppState.apiBaseUrl}`;
    }
}



function init() {
    // Listeners para carga de Excel y formulario QR
    const excelUpload = document.getElementById('excel-upload');
    if (excelUpload) {
        excelUpload.removeEventListener('change', handleExcelUpload); // Evita duplicados
        excelUpload.addEventListener('change', handleExcelUpload);
    }
    const qrForm = document.getElementById('qr-form');
    if (qrForm) {
        qrForm.removeEventListener('submit', handleQrFormSubmit); // Evita duplicados
        qrForm.addEventListener('submit', handleQrFormSubmit);
    }
    console.log("✅ Aplicación inicializada.");
}


// 4. Cuando el DOM esté listo, inicializamos los listeners
document.addEventListener('DOMContentLoaded', init);


async function handleQrFormSubmit(event) {
    event.preventDefault();

    if (!AppState.apiBaseUrl) {
        showNotification("Error: Aún no se ha establecido la conexión con el servidor.", "error");
        return;
    }

    const qrcodecontainer = document.getElementById('qrcode');
    qrcodecontainer.innerHTML = '';

    const form = document.getElementById('qr-form');
    const formData = new FormData(form);
    const dataObject = {};
    formData.forEach((value, key) => {
        dataObject[key] = String(value).trim() || null;
    });

    try {
        const apiUrl = `${AppState.apiBaseUrl}/activos/`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataObject)
        });

        if (response.status === 409) {
            // Advertencia: correlativo ya existe
            const errorData = await response.json();
            const userConfirmed = await customConfirm(`${errorData.detail}\n¿Desea actualizar los datos de este activo?`);
            if (userConfirmed) {
                // Si el usuario acepta, actualiza el activo
                const correlativo = dataObject.correlativo;
                // Busca el activo por correlativo para obtener el id
                const getActivoUrl = `${AppState.apiBaseUrl}/activos/?skip=0&limit=1000`;
                const activosResp = await fetch(getActivoUrl);
                const activos = await activosResp.json();
                const existente = activos.find(a => a.correlativo === correlativo);
                if (existente) {
                    const putUrl = `${AppState.apiBaseUrl}/activos/${existente.id}`;
                    const putResp = await fetch(putUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataObject)
                    });
                    if (!putResp.ok) {
                        const putError = await putResp.text();
                        throw new Error(`Error al actualizar: ${putError}`);
                    }
                    const actualizado = await putResp.json();
                    showNotification('✅ Activo actualizado con éxito.', 'success');
                    renderQr(actualizado.url, qrcodecontainer, actualizado.id);
                    form.reset();
                    return;
                } else {
                    throw new Error('No se encontró el activo existente para actualizar.');
                }
            } else {
                showNotification('Operación cancelada por el usuario.', 'error');
                return; // <-- Aquí debes colocar el return
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        const nuevoActivo = await response.json();
        showNotification('✅ Activo guardado con éxito.', 'success');
        renderQr(nuevoActivo.url, qrcodecontainer, nuevoActivo.id);
        form.reset();

    } catch (error) {
        console.error('❌ Error en el proceso de creación:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const msg = document.getElementById('custom-confirm-message');
        const yesBtn = document.getElementById('custom-confirm-yes');
        const noBtn = document.getElementById('custom-confirm-no');
        msg.textContent = message;
        modal.style.display = 'flex';

        yesBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };
        noBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };
    });
}

function renderQr(urlParaElQr, container, codigo) {
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // El QR contiene la URL completa
    new QRious({
        element: canvas,
        value: urlParaElQr,
        size: 250,
    });

    // Debajo del QR, muestra solo el código
    const codeDiv = document.createElement('div');
    codeDiv.style.marginTop = '10px';
    codeDiv.style.wordBreak = 'break-all';
    codeDiv.textContent = `Código: ${codigo}`;
    container.appendChild(codeDiv);
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

    if (!AppState.apiBaseUrl) {
        showNotification("Error: No hay conexión con el servidor para la carga masiva.", "error");
        return;
    }
    const apiUrl = `${AppState.apiBaseUrl}/activos/bulk-create`;
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

        // Mostrar las URLs recibidas del backend
        if (Array.isArray(result)) {
            const bulkQrContainer = document.getElementById('bulk-qr-container');
            bulkQrContainer.innerHTML = '';
            result.forEach((item, idx) => {
                if (item.url) {
                    const qrDiv = document.createElement('div');
                    qrDiv.style.marginBottom = '20px';

                    const canvas = document.createElement('canvas');
                    new QRious({
                        element: canvas,
                        value: item.url,
                        size: 150,
                    });
                    qrDiv.appendChild(canvas);

                    const urlDiv = document.createElement('div');
                    urlDiv.style.wordBreak = 'break-all';
                    urlDiv.textContent = `URL: ${item.url}`;
                    qrDiv.appendChild(urlDiv);

                    bulkQrContainer.appendChild(qrDiv);
                }
            });
        }

    } catch (error) {
        console.error('Error enviando datos a la API:', error);
        showNotification(`Error al cargar datos: ${error.message}`, 'error');
    }
}


// --- LÓGICA DE GENERACIÓN DE QR (VERSIÓN ÚNICA Y CORRECTA) ---


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