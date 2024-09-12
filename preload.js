/**
 * This file serves as the preload script for the Electron application.
 * It provides a bridge between the renderer process and the main process.
 * @module Preload
 */
const { contextBridge, ipcRenderer } = require('electron');

// Expondo funções específicas para o renderer (frontend) sem abrir todo o Node.js
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  processDicom: (filePath) => ipcRenderer.invoke('process-dicom', filePath),
  calcularDice: (estrutura1, estrutura2) => ipcRenderer.invoke('calcular-dice', estrutura1, estrutura2),
  exportCsv: (resultados) => ipcRenderer.invoke('export-csv', resultados)
});
