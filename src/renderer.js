// Gestión del estado de conexión con el backend
let backendReady = false;

// Función para verificar si el backend está funcionando
async function checkBackendStatus() {
    try {
        const response = await fetch('http://127.0.0.1:8000/health');
        if (response.ok) {
            backendReady = true;
            console.log('Backend está funcionando');
            return true;
        }
    } catch (error) {
        console.log('Backend no responde:', error);
        backendReady = false;
    }
    return false;
}

// Función para esperar a que el backend esté listo
async function waitForBackend(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await checkBackendStatus()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}

// Inicializar la aplicación cuando el backend esté listo
async function initializeApp() {
    const backendIsReady = await waitForBackend();
    if (!backendIsReady) {
        console.error('No se pudo conectar con el backend');
        return;
    }

    // Aquí puedes inicializar tu aplicación
    console.log('Aplicación inicializada correctamente');
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeApp);
