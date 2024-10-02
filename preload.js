const { contextBridge, ipcRenderer } = require('electron');

// Expose specific APIs to the renderer (frontend) without exposing the entire Node.js
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  processDicom: (filePath) => ipcRenderer.invoke('process-dicom', filePath),
  calcularDice: (estrutura1Caminho, estrutura2Caminho) => ipcRenderer.invoke('calcular-dice', estrutura1Caminho, estrutura2Caminho),
  exportCsv: (resultados) => ipcRenderer.invoke('export-csv', resultados)
});
