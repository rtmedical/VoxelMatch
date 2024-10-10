const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');  // Para executar comandos no terminal
const fs = require('fs');
const os = require('os');
const { createObjectCsvWriter } = require('csv-writer');

// Variáveis de controle de concorrência
const MAX_CONCURRENT_TASKS = 5;
let activeTasks = 0;
const taskQueue = [];

// Função para limitar a concorrência
function limitConcurrency(taskFunction) {
  return new Promise((resolve, reject) => {
    const wrappedTask = async () => {
      try {
        activeTasks++;
        const result = await taskFunction();
        activeTasks--;
        resolve(result);
        // Iniciar a próxima tarefa se disponível
        if (taskQueue.length > 0) {
          const nextTask = taskQueue.shift();
          nextTask();
        }
      } catch (error) {
        activeTasks--;
        reject(error);
        // Iniciar a próxima tarefa se disponível
        if (taskQueue.length > 0) {
          const nextTask = taskQueue.shift();
          nextTask();
        }
      }
    };

    if (activeTasks < MAX_CONCURRENT_TASKS) {
      wrappedTask();
    } else {
      taskQueue.push(wrappedTask);
    }
  });
}

// Função para criar diretórios temporários para arquivos DICOM
function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dicom-compare-'));
  return tempDir;
}

// Função para processar o arquivo DICOM com Plastimatch e extrair estruturas
function processDicom(filePath, tempDir) {
  return new Promise((resolve, reject) => {
    const normalizedFilePath = path.normalize(filePath).replace(/\\/g, '/');
    const normalizedTempDir = path.normalize(tempDir).replace(/\\/g, '/');
    const command = `plastimatch convert --input "${normalizedFilePath}" --output-prefix "${normalizedTempDir}/"`;
    console.log(`Executando comando: ${command}`);
    const child = exec(command);

    // Capturar a saída em tempo real
    child.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(`Erro ao processar DICOM: código de saída ${code}`);
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
        // Mapear nomes de estruturas para seus caminhos completos
        const structures = {};
        files.forEach(file => {
          const structureName = path.basename(file, path.extname(file));
          const filePath = path.join(tempDir, file);
          structures[structureName] = filePath;
        });
        resolve(structures);
      }
    });
  });
}

// Lidar com o carregamento e processamento de arquivos DICOM
ipcMain.handle('process-dicom', async (event, filePath) => {
  try {
    const tempDir = createTempDir();
    await processDicom(filePath, tempDir);
    const structures = await getStructures(tempDir);
    return { tempDir, structures };  // Retorna o diretório temporário e as estruturas extraídas
  } catch (err) {
    console.error(err);
    return null;
  }
});

// Função para calcular o coeficiente Dice entre duas estruturas usando Plastimatch
function calcularDice(estrutura1Caminho, estrutura2Caminho) {
  return new Promise((resolve, reject) => {
    const normalizedEstrutura1 = path.normalize(estrutura1Caminho).replace(/\\/g, '/');
    const normalizedEstrutura2 = path.normalize(estrutura2Caminho).replace(/\\/g, '/');
    const command = `plastimatch dice --dice "${normalizedEstrutura1}" "${normalizedEstrutura2}"`;
    console.log(`Executando comando: ${command}`);
    const child = exec(command);

    let stdoutData = '';  // Accumulate stdout data here

    // Capture the output in real time
    child.stdout.on('data', (data) => {
      stdoutData += data;  // Accumulate data from stdout
      console.log(`stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(`Erro ao calcular índice Dice: código de saída ${code}`);
      } else {
        // Use the accumulated stdoutData for matching
        const match = stdoutData.match(/DICE:\s*([0-9]*\.?[0-9]+)/i);
        const diceValue = match ? parseFloat(match[1]) : null;
        resolve(diceValue);
      }
    });
  });
}


// Lidar com a requisição de cálculo do coeficiente Dice com controle de concorrência
ipcMain.handle('calcular-dice', async (event, estrutura1Caminho, estrutura2Caminho) => {
  return limitConcurrency(async () => {
    try {
      const dice = await calcularDice(estrutura1Caminho, estrutura2Caminho);
      return dice;  // Retorna o valor do coeficiente Dice
    } catch (err) {
      console.error(err);
      return null;
    }
  });
});

// Função para exportar resultados do Dice para CSV
ipcMain.handle('export-csv', async (event, resultados) => {
  // Abrir diálogo de salvamento para permitir que o usuário escolha o local de salvamento
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salvar resultados',
    defaultPath: 'resultados_dice.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (canceled || !filePath) {
    return 'Exportação cancelada.';
  }

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'estrutura1', title: 'Estrutura 1 (Arquivo 1)' },
      { id: 'estrutura2', title: 'Estrutura 2' },
      { id: 'arquivoComparado', title: 'Arquivo Comparado' },
      { id: 'dice', title: 'Índice Dice' }
    ]
  });

  // Escrever os resultados no arquivo CSV
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
      preload: path.join(__dirname, 'preload.js'),  // Use 'preload.js'
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  win.loadFile('index.html');
  // Descomente a linha abaixo para abrir o DevTools para depuração
  // win.webContents.openDevTools();
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

// Inicializar o Electron
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