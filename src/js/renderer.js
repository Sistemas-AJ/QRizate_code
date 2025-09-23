// Define aquí la URL pública y fija a la que apuntarán los QR de tus activos.
const PAIRING_PAGE_URL = 'https://qrizate.systempiura.com/pair.html';

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
    const showModalBtn = document.getElementById('show-pairing-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalOverlay = document.getElementById('pairing-modal');
    
    // Al hacer clic en "Conectar Celular", mostramos el modal
    showModalBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'flex';
        generatePairingQr();
    });

    // Al hacer clic en la 'X', ocultamos el modal
    closeModalBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
    });

    // También podemos cerrar el modal si se hace clic en el fondo oscuro
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });

    const sedeIdInput = document.getElementById('input-sede-id');
    const savedSedeId = localStorage.getItem('qr_app_sede_id') || '';
    sedeIdInput.value = savedSedeId;

    // Deshabilita el botón si el campo está vacío
    sedeIdInput.addEventListener('input', () => {
        document.getElementById('guardar-sede-btn').disabled = !sedeIdInput.value.trim();
    });
    document.getElementById('guardar-sede-btn').disabled = !sedeIdInput.value.trim();
    console.log("✅ Aplicación inicializada.");
    const sedeId = localStorage.getItem('qr_app_sede_id');
    if (sedeId) {
        guardarConfiguracion();
    }

}

document.getElementById('guardar-sede-btn').addEventListener('click', async () => {
    let sedeId = document.getElementById('input-sede-id').value;
    sedeId = limpiarSedeId(sedeId);
    if (!sedeId) {
        showNotification('Ingresa un ID de sede válido (solo letras, números, guiones y guiones bajos).', 'error');
        return;
    }
    document.getElementById('input-sede-id').value = sedeId; // Actualiza el campo con el formato limpio
    localStorage.setItem('qr_app_sede_id', sedeId);
    window.electronAPI.setSedeId(sedeId);
    await guardarConfiguracion();
    showNotification(`Sede guardada: ${sedeId}`, 'success');
});


function mostrarSedeActual() {
    const sedeId = localStorage.getItem('qr_app_sede_id') || '';
    const appBar = document.querySelector('.app-bar__title');
    if (appBar) {
        appBar.innerHTML = `
            <span>Generador de QR</span>
            <span class="sede-label">${sedeId ? 'Sede:' : 'Sin sede configurada'}</span>
            ${sedeId ? `<span class="sede-value">${sedeId}</span>` : ''}
        `;
    }
}
document.addEventListener('DOMContentLoaded', mostrarSedeActual);

async function guardarConfiguracion() {
    const sedeIdInput = document.getElementById('input-sede-id');
    const nuevaSedeId = sedeIdInput.value.trim();

    if (!nuevaSedeId) {
        showNotification('Por favor, introduce un ID de Sede válido.', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:8000/configure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sede_id: nuevaSedeId }),
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Configuración guardada con éxito. Sus QR contienen la dirección: ${result.sede_id_registrado}`, 'success');
        } else {
            throw new Error(result.detail || 'Error al guardar la configuración.');
        }

    } catch (error) {
        console.error('Error al enviar la configuración al backend:', error);
        showNotification(`Error: No se pudo comunicar con el backend. Asegúrate de que esté corriendo.\n\n${error.message}`, 'error');
    }
}

function limpiarSedeId(sedeId) {
    // Elimina espacios, convierte a mayúsculas y reemplaza espacios por guiones bajos
    return sedeId.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_-]/g, '');
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
    window.generarQRCanvas(canvas, urlParaElQr, 250);
    const codeDiv = document.createElement('div');
    codeDiv.style.marginTop = '10px';
    codeDiv.style.wordBreak = 'break-all';
    codeDiv.textContent = `Código: ${codigo}`;
    container.appendChild(codeDiv);
}

// --- LÓGICA DE EMPAREJAMIENTO ---
function generatePairingQr() {
    // 1. Verificamos que tengamos la IP y el Puerto recibidos de Electron
    if (AppState.localIp && AppState.apiPort) {
        
        // --- LÓGICA DE URL CORRECTA (LO NUEVO) ---
        const PAIRING_PAGE_URL = 'https://qrizate.systempiura.com/pair.html';
        
        // a. Creamos la URL del servidor local que queremos guardar en el celular.
        const serverInternalUrl = `http://${AppState.localIp}:${AppState.apiPort}`;
        
        // b. La codificamos para que viaje de forma segura en la URL.
        const encodedUrl = encodeURIComponent(serverInternalUrl);
        
        // c. Creamos el contenido final para el QR: tu página pública + la dirección local como parámetro.
        const finalQrContent = `${PAIRING_PAGE_URL}?server_url=${encodedUrl}`;
        
        // --- LÓGICA DE RENDERIZADO (LA TUYA) ---
        const qrContainer = document.getElementById('pairing-qr-container');
        const urlDisplay = document.getElementById('pairing-url-display');

        if (qrContainer && urlDisplay) {
            qrContainer.innerHTML = ''; // Limpiar el contenedor
            
            // Creamos el canvas para dibujar el QR
            const canvas = document.createElement('canvas');
            qrContainer.appendChild(canvas);

            // Generamos el QR usando el contenido final y correcto
            new QRious({
                element: canvas,
                value: finalQrContent, // <-- Usamos la URL final y correcta
                size: 200,
            });

            // Mostramos al usuario una URL limpia y fácil de entender
            urlDisplay.textContent = `Conexión: ${serverInternalUrl}`;
            console.log(`✅ QR de emparejamiento generado. Contenido final: ${finalQrContent}`);
        }
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
                showNotification('El archivo Excel está vacío.', 'error');
                return;
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
            showNotification(errorText || `Error del servidor: ${response.status}`, 'error');
            return;
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

    // Iconos según el tipo
    let icon = '';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else icon = 'ℹ️';

    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
    `;

    notificationArea.appendChild(notification);

    // Animación tipo bomba usando clases CSS
    setTimeout(() => {
        notification.classList.add('notification-pop');
    }, 50);

    setTimeout(() => {
        notification.classList.remove('notification-pop');
        notification.classList.add('notification-hide');
        setTimeout(() => notification.remove(), 400);
    }, 4000);
}

function showModalDialog(message, title = "qrizate") {
    // Crea el modal si no existe
    let modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-alert-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.25)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '99999';

        modal.innerHTML = `
            <div style="
                background: #fff;
                border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.18);
                padding: 24px 32px;
                min-width: 320px;
                max-width: 90vw;
                text-align: left;
                font-size: 1.1em;
            ">
                <div style="font-weight: bold; margin-bottom: 12px;">${title}</div>
                <div id="custom-alert-message" style="margin-bottom: 18px;">${message}</div>
                <button id="custom-alert-ok" style="
                    padding: 8px 24px;
                    border-radius: 6px;
                    border: none;
                    background: #1976d2;
                    color: #fff;
                    font-size: 1em;
                    cursor: pointer;
                ">Aceptar</button>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        document.getElementById('custom-alert-message').textContent = message;
        modal.style.display = 'flex';
    }

    document.getElementById('custom-alert-ok').onclick = () => {
        modal.style.display = 'none';
    };


}