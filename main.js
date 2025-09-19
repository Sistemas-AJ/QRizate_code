require('electron-reload')(__dirname, {
  electron: require('path').join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
  ignored: /node_modules|[\/\\]\./
});


const { app, BrowserWindow, Menu, Tray } = require('electron/main');
const path = require('node:path');
const os = require('node:os'); // <--- 1. Importamos 'os' para obtener la IP
const { spawn } = require('child_process');
const portfinder = require('portfinder');
let backendPort = null;

// --- ELIMINADO ---
// Ya no necesitamos la librería 'bonjour'
// const bonjour = require('bonjour')();

// Variables globales
let mainWindow = null;
let backendProcess = null;
let tray = null;

// --- NUEVA FUNCIÓN ---
// Para encontrar la dirección IP local correcta del PC en la red.
function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

// Función para iniciar el backend de Python
async function startBackend() {
  try {
    const port = await portfinder.getPortPromise({ port: 8000 });
    backendPort = port;
    console.log(`Puerto libre encontrado para el backend: ${port}`);
    const PUBLIC_URL_BASE = 'http://qrizate.systempiura.com/asset.html';
    // --- SIMPLIFICADO ---
    // Ya no necesitamos ni definimos un 'hostname' mDNS.
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'main.py')
      : path.join(__dirname, 'app', 'main.py'); // Corregido a 'backend' por consistencia

    // --- SIMPLIFICADO ---
    // Iniciamos el proceso de Python pasándole solo el puerto.
    backendProcess = spawn('python', [scriptPath, '--port', port, '--public-url', PUBLIC_URL_BASE]);

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
      if (mainWindow) {
        mainWindow.webContents.send('set-api-port', port);
      }
    });
    backendProcess.stderr.on('data', (data) => console.error(`Backend stderr: ${data}`));
    backendProcess.on('close', (code) => console.log(`Backend process exited with code ${code}`));

    // --- ELIMINADO ---
    // El bloque de 'bonjour.publish' ya no es necesario.

  } catch (err) {
    console.error('Error al iniciar el backend:', err);
    app.quit();
  }
}

// Función para crear la ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('src/index.html');

  // --- AÑADIDO ---
  // Cuando la ventana haya terminado de cargar, le enviamos la IP local
  // para que pueda generar el QR de emparejamiento.
  mainWindow.webContents.on('did-finish-load', () => {
    const localIp = getLocalIp();
    mainWindow.webContents.send('set-local-ip', localIp);
    mainWindow.webContents.send('set-api-port', backendPort); // <-- Asegúrate de enviar el puerto también
});
  
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

// Función para crear el icono y menú de la bandeja del sistema
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Aplicación',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: 'Salir',
      click: () => {
        app.quit(); // Esto disparará el evento 'before-quit'
      }
    }
  ]);
  tray.setToolTip('Qrizate App - Servidor Corriendo');
  tray.setContextMenu(contextMenu);
}

// ---- CICLO DE VIDA DE LA APLICACIÓN ----

// Cuando la app está lista, inicia todo
app.whenReady().then(async () => {
  await startBackend(); // Espera a que el backend se inicie
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// No salir de la app cuando se cierran las ventanas
app.on('window-all-closed', () => {
  // En macOS es común que la app siga activa. En otros sistemas,
  // al tener un icono en la bandeja, tampoco queremos que se cierre.
});

// Antes de que la app se cierre definitivamente, mata el proceso del backend
app.on('before-quit', () => {
  console.log('Cerrando la aplicación y el proceso del backend...');
  if (backendProcess) {
    backendProcess.kill();
  }
});