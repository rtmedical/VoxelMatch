// Variables to store the selected file paths and extracted structures
let filePaths = {};
let estruturasDicom = {};  // Store structures and their paths for each file

let resultadosDice = [];  // Store the results of the Dice calculations

// Function to load and process DICOM files
for (let i = 1; i <= 4; i++) {
  const loadFileButton = document.getElementById(`load-file-${i}`);
  loadFileButton.addEventListener('click', async () => {
    const filePath = await window.electronAPI.openFile();  // Use the API exposed by preload.js
    if (filePath) {
      filePaths[i] = filePath;
      loadFileButton.innerText = `Arquivo ${i} Carregado: ${filePath}`;

      // Request processing of the DICOM file and get the structures
      const result = await window.electronAPI.processDicom(filePath);
      if (result) {
        const { tempDir, structures } = result;
        estruturasDicom[i] = { tempDir, structures };
        preencherTabela();  // Update the table with the loaded structures
      }
    }
  });
}

// Function to fill the table with the extracted structures from each DICOM file
function preencherTabela() {
  const tableBody = document.querySelector('#structures-table tbody');
  tableBody.innerHTML = '';  // Clear the table before filling it

  // Get the lists of structure names for each file
  const estruturasListas = {};
  for (let i = 1; i <= 4; i++) {
    if (estruturasDicom[i]) {
      estruturasListas[i] = Object.keys(estruturasDicom[i].structures);
    } else {
      estruturasListas[i] = [];
    }
  }

  const maxLinhas = Math.max(
    estruturasListas[1].length,
    estruturasListas[2].length,
    estruturasListas[3].length,
    estruturasListas[4].length
  );

  for (let idx = 0; idx < maxLinhas; idx++) {
    const tr = document.createElement('tr');

    for (let j = 1; j <= 4; j++) {
      const td = document.createElement('td');
      td.innerText = estruturasListas[j][idx] || '-';  // Display '-' if the structure does not exist
      tr.appendChild(td);
    }

    // Add cells for the Dice values (initially empty)
    for (let j = 2; j <= 4; j++) {
      const tdDice = document.createElement('td');
      tdDice.innerText = '-';
      tr.appendChild(tdDice);
    }

    tableBody.appendChild(tr);
  }
}

// Function to calculate the Dice index between the mapped structures
async function calcularDice() {
  const progressIndicator = document.getElementById('progress-indicator');
  progressIndicator.style.display = 'block';  // Show progress indicator

  const tableBody = document.querySelector('#structures-table tbody');
  resultadosDice = [];  // Clear previous results

  const estruturasListas = {};
  for (let i = 1; i <= 4; i++) {
    if (estruturasDicom[i]) {
      estruturasListas[i] = Object.keys(estruturasDicom[i].structures);
    } else {
      estruturasListas[i] = [];
    }
  }

  const maxLinhas = Math.max(
    estruturasListas[1].length,
    estruturasListas[2].length,
    estruturasListas[3].length,
    estruturasListas[4].length
  );

  const promises = [];

  for (let idx = 0; idx < maxLinhas; idx++) {
    const estrutura1Nome = estruturasListas[1][idx];
    const estrutura1Caminho = estrutura1Nome ? estruturasDicom[1].structures[estrutura1Nome] : null;

    if (!estrutura1Caminho) continue;

    const row = tableBody.rows[idx];

    for (let j = 2; j <= 4; j++) {
      const estrutura2Nome = estruturasListas[j][idx];
      const estrutura2Caminho = estrutura2Nome ? estruturasDicom[j].structures[estrutura2Nome] : null;

      if (estrutura2Caminho) {
        // Create a promise for each calculation
        const promise = (async () => {
          const diceValue = await window.electronAPI.calcularDice(estrutura1Caminho, estrutura2Caminho);

          // Update the corresponding cell in the table
          const diceCellIndex = 4 + (j - 2); // Adjust the index for the Dice columns
          let diceCell = row.cells[diceCellIndex];
          if (!diceCell) {
            diceCell = row.insertCell(diceCellIndex);
          }
          diceCell.innerText = diceValue !== null ? diceValue.toFixed(3) : 'Erro';

          // Store the result for export
          resultadosDice.push({
            estrutura1: estrutura1Nome,
            estrutura2: estrutura2Nome,
            arquivoComparado: `Arquivo ${j}`,
            dice: diceValue !== null ? diceValue.toFixed(3) : 'Erro'
          });
        })();

        promises.push(promise);
      }
    }
  }

  await Promise.all(promises);

  progressIndicator.style.display = 'none';  // Hide progress indicator
  alert('Cálculo do índice Dice concluído.');

  // Show the CSV export button after calculation
  const exportCsvButton = document.getElementById('export-csv');
  exportCsvButton.style.display = 'block';
}

// Function to export the results to a CSV file
document.getElementById('export-csv').addEventListener('click', async () => {
  const mensagem = await window.electronAPI.exportCsv(resultadosDice);  // Export data via backend
  alert(mensagem);  // Show the result of the export (success or error)
});

// Button to calculate the Dice index
document.getElementById('calculate-dice').addEventListener('click', () => {
  if (!filePaths[1] || !estruturasDicom[1]) {
    alert('Por favor, carregue o Arquivo de Referência (Arquivo 1) e suas estruturas.');
    return;
  }

  if (!filePaths[2] && !filePaths[3] && !filePaths[4]) {
    alert('Por favor, carregue pelo menos um arquivo para comparar com o Arquivo 1.');
    return;
  }

  calcularDice();  // Start the Dice calculation
});
