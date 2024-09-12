# Etapa 1: Usar uma imagem base com as ferramentas básicas instaladas
FROM ubuntu:20.04

# Definir variáveis de ambiente para evitar interatividade durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Atualizar a lista de pacotes e instalar dependências essenciais
RUN apt-get update && apt-get install -y \
    cmake \
    g++ \
    git \
    libinsighttoolkit4-dev \
    libvtk6-dev \
    libdcmtk-dev \
    libpng-dev \
    libjpeg-dev \
    libtiff-dev \
    curl \
    make \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Clonar o repositório do Plastimatch
RUN git clone https://gitlab.com/plastimatch/plastimatch.git /plastimatch

# Criar o diretório de build
WORKDIR /plastimatch/build

# Configurar o CMake para o Plastimatch
RUN cmake ..

# Compilar o Plastimatch usando múltiplos núcleos (ajuste o número de núcleos conforme necessário)
RUN make -j$(nproc)

# Instalar os binários do Plastimatch
RUN make install

# Definir o comando padrão do container para verificar se a instalação foi bem-sucedida
CMD ["plastimatch", "help"]
