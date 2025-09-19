const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron/main');
const path = require('node:path');
const { spawn } = require('child_process');
const portfinder = require('portfinder');
const bonjour = require('bonjour')();

// Variables globales para acceder a ellas desde cualquier parte
let mainWindow = null;
let backendProcess = null;
let tray = null;

// Función para iniciar el backend de Python de forma asíncrona
async function startBackend() {
  try {
    // 1. Encontrar un puerto libre usando portfinder
    const port = await portfinder.getPortPromise({ port: 8000 });
    console.log(`Puerto libre encontrado para el backend: ${port}`);
    const hostname = 'qrizate.local'; // Nombre mDNS para el servicio

    // 2. Determinar la ruta del script de Python para desarrollo y producción
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'main.py')
      : path.join(__dirname, 'app', 'main.py');

    // 3. Iniciar el proceso de Python, pasándole el puerto encontrado como argumento
     backendProcess = spawn('python', [scriptPath, '--port', port, '--hostname', hostname]);

    // Manejadores para la salida del proceso (muy útil para depurar)
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
      // Cuando el backend esté listo, enviamos el puerto a la ventana del frontend
      if (mainWindow) {
        mainWindow.webContents.send('set-api-port', port);
      }
    });
    backendProcess.stderr.on('data', (data) => console.error(`Backend stderr: ${data}`));
    backendProcess.on('close', (code) => console.log(`Backend process exited with code ${code}`));

    
    bonjour.publish({
        name: 'Servidor QRizate',
        type: 'http',
        port: port,
        host: hostname,
    });
    console.log(`📢 Servicio mDNS publicado en la red como ${hostname}`);

  } catch (err) {
    console.error('Error al iniciar el backend:', err);
    app.quit();
  }
}

// Función para crear la ventana principal de la aplicación
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, // Un tamaño más estándar para empezar
    height: 720,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      // POR QUÉ: Usar un script de 'preload' es la forma SEGURA de comunicar
      // el proceso principal de Electron con la ventana del frontend.
      preload: path.join(__dirname, 'preload.js'),
      // Estas dos opciones antiguas son inseguras y deben desactivarse:
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('src/index.html');

  // Opcional: Abrir DevTools en desarrollo
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Comportamiento al cerrar la ventana: ocultarla en lugar de cerrarla
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