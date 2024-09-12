const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');  // Para executar comandos no terminal
const fs = require('fs');
const os = require('os');
const { createObjectCsvWriter } = require('csv-writer');

// Função para criar pastas temporárias para os arquivos DICOM
function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dicom-compare-'));
  return tempDir;
}

// Função para processar o arquivo DICOM com Plastimatch e extrair as estruturas
function processDicom(filePath, tempDir) {
  return new Promise((resolve, reject) => {
    const command = `plastimatch convert --input ${filePath} --output-ss-img ${tempDir}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Erro ao processar DICOM: ${stderr}`);
      } else {
        resolve(tempDir);
      }
    });
  });
}

// Função para listar os arquivos gerados pelo Plastimatch (estruturas)
function getStructures(tempDir) {
  return new Promise((resolve, reject) => {
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        reject(`Erro ao listar arquivos na pasta: ${err}`);
      } else {
        // Apenas retornar os nomes dos arquivos sem extensões (nomes das estruturas)
        const structures = files.map(file => path.basename(file, path.extname(file)));
        resolve(structures);
      }
    });
  });
}

// Lidar com o carregamento dos arquivos DICOM e processamento
ipcMain.handle('process-dicom', async (event, filePath) => {
  try {
    const tempDir = createTempDir();
    await processDicom(filePath, tempDir);
    const structures = await getStructures(tempDir);
    return structures;  // Retorna as estruturas extraídas
  } catch (err) {
    console.error(err);
    return null;
  }
});

// Função para calcular o índice Dice entre duas estruturas usando Plastimatch
/**
 * Calculates the Dice similarity coefficient between two structures.
 *
 * @param {string} estrutura1 - The path to the first structure file.
 * @param {string} estrutura2 - The path to the second structure file.
 * @returns {Promise<number|null>} A promise that resolves with the Dice similarity coefficient value,
 * or null if the calculation fails.
 */
function calcularDice(estrutura1, estrutura2) {
  return new Promise((resolve, reject) => {
    const command = `plastimatch dice --moving ${estrutura1} --fixed ${estrutura2}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Erro ao calcular índice Dice: ${stderr}`);
      } else {
        // Extrair o valor do Dice do stdout
        const match = stdout.match(/Dice similarity coefficient:\s*(\d+\.\d+)/);
        const diceValue = match ? parseFloat(match[1]) : null;
        resolve(diceValue);
      }
    });
  });
}

// Lidar com a requisição de cálculo do Dice
ipcMain.handle('calcular-dice', async (event, estrutura1, estrutura2) => {
  try {
    const dice = await calcularDice(estrutura1, estrutura2);
    return dice;  // Retorna o valor do Dice
  } catch (err) {
    console.error(err);
    return null;
  }
});

// Função para exportar resultados do Dice para CSV
ipcMain.handle('export-csv', async (event, resultados) => {
  const csvWriter = createObjectCsvWriter({
    path: 'resultados_dice.csv',
    header: [
      { id: 'estrutura1', title: 'Estrutura 1 (Arquivo 1)' },
      { id: 'estrutura2', title: 'Estrutura 2' },
      { id: 'dice', title: 'Índice Dice' }
    ]
  });

  // Gravar os resultados no arquivo CSV
  try {
    await csvWriter.writeRecords(resultados);
    return 'Arquivo CSV exportado com sucesso!';
  } catch (error) {
    console.error('Erro ao exportar o arquivo CSV:', error);
    return 'Erro ao exportar CSV.';
  }
});

// Função para criar a janela da aplicação
function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),  // Corrija o nome aqui para 'preload.js'
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false
        }
      });

  win.loadFile('index.html');
  win.webContents.openDevTools();  // Abre o console no visualizador

}
// Handler para abrir o diálogo de arquivos
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'DICOM Files', extensions: ['dcm'] }
      ]
    });
  
    if (canceled) {
      return null;  // Retorna null se o usuário cancelar
    } else {
      return filePaths[0];  // Retorna o caminho do arquivo selecionado
    }
  });
// Inicialização do Electron
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fechar o aplicativo quando todas as janelas forem fechadas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
