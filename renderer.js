

// Variáveis para armazenar os caminhos dos arquivos selecionados e as estruturas extraídas
let filePaths = {
    1: null,
    2: null,
    3: null,
    4: null
  };
  
  let estruturasDicom = {
    1: [],
    2: [],
    3: [],
    4: []
  };
  
  let resultadosDice = [];  // Armazenar os resultados do cálculo do Dice
  
  // Função para carregar e processar os arquivos DICOM
  for (let i = 1; i <= 4; i++) {
    const loadFileButton = document.getElementById(`load-file-${i}`);
    loadFileButton.addEventListener('click', async () => {
      const filePath = await window.electronAPI.openFile();  // Usar a API exposta pelo preload.js
      if (filePath) {
        filePaths[i] = filePath;
        loadFileButton.innerText = `Arquivo ${i} Carregado: ${filePath}`;
  
        // Solicitar o processamento do arquivo DICOM e obter as estruturas
        const estruturas = await window.electronAPI.processDicom(filePath);
        if (estruturas) {
          estruturasDicom[i] = estruturas;
          preencherTabela();  // Atualizar a tabela com as estruturas carregadas
        }
      }
    });
  }
  
  // Função para preencher a tabela com as estruturas extraídas de cada arquivo DICOM
  function preencherTabela() {
    const tableBody = document.querySelector('#structures-table tbody');
    tableBody.innerHTML = '';  // Limpar a tabela antes de preenchê-la
  
    const maxLinhas = Math.max(
      estruturasDicom[1].length,
      estruturasDicom[2].length,
      estruturasDicom[3].length,
      estruturasDicom[4].length
    );
  
    for (let i = 0; i < maxLinhas; i++) {
      const tr = document.createElement('tr');
  
      for (let j = 1; j <= 4; j++) {
        const td = document.createElement('td');
        td.innerText = estruturasDicom[j][i] || '-';  // Exibe '-' se a estrutura não existir
        tr.appendChild(td);
      }
  
      // Adicionar a coluna para o valor do Dice (inicialmente vazia)
      const tdDice = document.createElement('td');
      tdDice.innerText = '-';
      tr.appendChild(tdDice);
  
      tableBody.appendChild(tr);
    }
  }
  
  // Função para calcular o índice Dice entre as estruturas mapeadas
/**
 * Calculates the Dice index for each pair of structures and updates the table with the results.
 * @returns {Promise<void>} A promise that resolves when the calculation is completed.
 */
  async function calcularDice() {
    const progressIndicator = document.getElementById('progress-indicator');
    progressIndicator.style.display = 'block';  // Mostrar indicador de progresso
  
    const tableBody = document.querySelector('#structures-table tbody');
    resultadosDice = [];  // Limpar os resultados anteriores
  
    // Iterar sobre as linhas da tabela e calcular o índice Dice para cada par de estruturas
    for (let i = 0; i < estruturasDicom[1].length; i++) {
      for (let j = 2; j <= 4; j++) {
        const estrutura1 = estruturasDicom[1][i];  // Estrutura do arquivo de referência (Arquivo 1)
        const estrutura2 = estruturasDicom[j][i];  // Estrutura do arquivo a ser comparado
  
        if (estrutura1 && estrutura2 && estrutura2 !== '-') {
          const diceValue = await window.electronAPI.calcularDice(estrutura1, estrutura2);
  
          // Preencher a célula correspondente ao valor do Dice
          const diceCell = tableBody.rows[i].cells[4];  // 5ª coluna para Dice
          diceCell.innerText = diceValue ? diceValue.toFixed(3) : 'Erro';
  
          // Armazenar o resultado para exportação
          resultadosDice.push({
            estrutura1,
            estrutura2,
            dice: diceValue ? diceValue.toFixed(3) : 'Erro'
          });
        }
      }
    }
  
    progressIndicator.style.display = 'none';  // Esconder indicador de progresso
    alert('Cálculo do índice Dice concluído.');
  
    // Exibir o botão para exportação de CSV após o cálculo
    const exportCsvButton = document.getElementById('export-csv');
    exportCsvButton.style.display = 'block';
  }
  
  // Função para exportar os resultados para um arquivo CSV
  document.getElementById('export-csv').addEventListener('click', async () => {
    const mensagem = await window.electronAPI.exportCsv(resultadosDice);  // Exportar os dados via backend
    alert(mensagem);  // Mostrar o resultado da exportação (sucesso ou erro)
  });
  
  // Função para aplicar o pré-processamento das estruturas
  function aplicarPreProcessamento() {
    for (let j = 2; j <= 4; j++) {
      estruturasDicom[j] = estruturasDicom[j].map(estrutura => 
        encontrarCorrespondencia(estrutura, estruturasDicom[1])  // Mapear estruturas automaticamente
      );
    }
    preencherTabela();  // Atualizar a tabela após o pré-processamento
  }
  
  // Função para tentar encontrar uma correspondência de nome entre as estruturas
  function encontrarCorrespondencia(nomeEstrutura, listaEstruturas) {
    let melhorCorrespondencia = nomeEstrutura;
    let maiorSimilaridade = 0;
  
    // Verificar manualmente ou usar dicionários de correspondências (simplificado aqui)
    listaEstruturas.forEach(estrutura => {
      const similaridade = stringSimilarity.compareTwoStrings(nomeEstrutura.toLowerCase(), estrutura.toLowerCase());
      if (similaridade > maiorSimilaridade) {
        maiorSimilaridade = similaridade;
        melhorCorrespondencia = estrutura;
      }
    });
  
    return melhorCorrespondencia;  // Retornar a melhor correspondência encontrada
  }
  
  // Botão para aplicar o pré-processamento
  document.getElementById('apply-preprocess').addEventListener('click', aplicarPreProcessamento);
  
  // Botão para calcular o índice Dice
  document.getElementById('calculate-dice').addEventListener('click', () => {
    if (!filePaths[1] || estruturasDicom[1].length === 0) {
      alert('Por favor, carregue o Arquivo de Referência (Arquivo 1) e suas estruturas.');
      return;
    }
  
    if (!filePaths[2] && !filePaths[3] && !filePaths[4]) {
      alert('Por favor, carregue pelo menos um arquivo para comparar com o Arquivo 1.');
      return;
    }
  
    calcularDice();  // Iniciar o cálculo do índice Dice
  });
  