require('electron-reload')(__dirname, {
  electron: require('path').join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
  ignored: /node_modules|[\/\\]\./
});

const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const { spawn } = require('child_process')
let backendProcess = null
let mainWindow = null

function startBackend() {
  // Iniciar el backend de Python
  const isProduction = app.isPackaged;
  const pythonPath = isProduction 
    ? path.join(process.resourcesPath, 'backend', 'main.py')
    : path.join(__dirname, 'backend', 'main.py');
  
  backendProcess = spawn('python', [pythonPath], {
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend stderr: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Permitir peticiones al backend local
    }
  });
  
  mainWindow.loadFile('src/index.html');
  
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

  // Si necesitas depurar, abre DevTools manualmente desde el menú de Electron.
}

// Cuando la app está lista
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cuando todas las ventanas están cerradas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cuando la app se va a cerrar
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});