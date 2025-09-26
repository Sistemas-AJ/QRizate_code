const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron/main');
const path = require('node:path');
const { spawn } = require('child_process');
const os = require('node:os');
const portfinder = require('portfinder');

// Variables globales
let backendProcess = null;
let mainWindow = null;
let tray = null;
let backendPort = null;

// Configuración de recarga solo en desarrollo
if (!app.isPackaged) {
  try {
    const electronReload = require('electron-reload');
    electronReload(__dirname, {
      electron: require('path').join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
      ignored: /node_modules|[\/\\]\./
    });
  } catch (error) {
    console.log('Electron-reload no disponible en producción');
  }
}

// Función para obtener la dirección IP local
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
// main.js - NUEVA VERSIÓN DE startBackend

async function startBackend() {
  try {
    const port = await portfinder.getPortPromise({ port: 8000 });
    backendPort = port;
    console.log(`Puerto libre encontrado para el backend: ${port}`);
    
    const PUBLIC_URL_BASE = 'http://qrizate.systempiura.com/asset.html';
    
    let command;
    let args;

    if (app.isPackaged) {
      // --- MODO PRODUCCIÓN (APP INSTALADA) ---
      // La ruta al .exe del backend que empaquetaremos con Inno Setup.
      command = path.join(process.resourcesPath, 'backend', 'QRizateServer.exe');
      args = ['--port', port, '--public-url', PUBLIC_URL_BASE];
      console.log('Modo Producción: Ejecutando backend desde .exe');

    } else {
      // --- MODO DESARROLLO (COMO LO TIENES AHORA) ---
      // Esto te permite seguir desarrollando cómodamente.
      const scriptPath = path.join(__dirname, 'app', 'main.py');
      const venvPython = process.platform === 'win32'
        ? path.join(__dirname, 'app', '.venv', 'Scripts', 'python.exe')
        : path.join(__dirname, 'app', '.venv', 'bin', 'python');
      
      command = venvPython;
      args = [scriptPath, '--port', port, '--public-url', PUBLIC_URL_BASE];
      console.log('Modo Desarrollo: Ejecutando backend desde .py');
    }

    console.log(`Comando a ejecutar: ${command} ${args.join(' ')}`);

    // Iniciar el proceso
    backendProcess = spawn(command, args);

    // El resto de la función (manejo de stdout, stderr, etc.) se queda exactamente igual.
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
      if (mainWindow) {
        mainWindow.webContents.send('set-api-port', port);
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });
    
    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });

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
      webSecurity: true
    }
  });

  mainWindow.loadFile('src/index.html');

  // Forzar el foco en cada navegación
  mainWindow.webContents.on('did-navigate', () => {
    console.log('>>> EVENTO: did-navigate - Forzando foco...');
    mainWindow.webContents.focus();
  });

  // Habilitar CORS para las peticiones al backend
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['http://*:*/*'] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Origin': '*'
        }
      });
    }
  );

  // Enviar la IP local y puerto cuando la ventana termine de cargar
  mainWindow.webContents.on('did-finish-load', () => {
    const localIp = getLocalIp();
    mainWindow.webContents.send('set-local-ip', localIp);
    mainWindow.webContents.send('set-api-port', backendPort);
  });

  // Abrir DevTools en desarrollo
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Ocultar en lugar de cerrar
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
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
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Qrizate App - Servidor Corriendo');
  tray.setContextMenu(contextMenu);
}

// Manejar el evento IPC para abrir/cerrar DevTools
ipcMain.on('devtools-flash', () => {
  if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      }
    }, 1000);
  }
});

// ---- CICLO DE VIDA DE LA APLICACIÓN ----

// Cuando la app está lista, inicia todo
app.whenReady().then(async () => {
  await startBackend();
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
  // En macOS es común que la app siga activa
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

// Antes de que la app se cierre definitivamente, mata el proceso del backend
app.on('before-quit', () => {
  console.log('Cerrando la aplicación y el proceso del backend...');
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Manejar la salida de la aplicación
app.on('will-quit', (event) => {
  // Asegurarse de que el backend se cierre correctamente
  if (backendProcess) {
    backendProcess.kill();
  }
});