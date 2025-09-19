// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Exponemos de forma segura un objeto 'electronAPI' a la ventana del renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Canal para recibir el PUERTO en el que corre el backend
  onSetApiPort: (callback) => ipcRenderer.on('set-api-port', (_event, value) => callback(value)),
  // Canal para recibir la IP LOCAL del PC para el emparejamiento
  onSetLocalIp: (callback) => ipcRenderer.on('set-local-ip', (_event, value) => callback(value)),
  setSedeId: (sedeId) => ipcRenderer.send('set-sede-id', sedeId),
});