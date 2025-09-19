// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exponemos de forma segura un objeto 'electronAPI' a la ventana del renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Esta función permitirá al frontend recibir el puerto de la API
  onSetApiPort: (callback) => ipcRenderer.on('set-api-port', (_event, value) => callback(value))
});