docker build -f Dockerfile.linx64 -t plastimatch-lin-x64 .
The README file contains instructions for building and running Docker containers for different architectures using the Plastimatch software. 

To build and run the Plastimatch container for 64-bit Linux, use the following commands:
```
docker run --rm plastimatch-lin-x64 > plastimatch_binarios.tar.gz
tar -tzvf plastimatch_binarios.tar.gz
tar -xzvf plastimatch_binarios.tar.gz -C linux/x64
```

For 32-bit Linux, use the following commands:
```
docker build -f Dockerfile.linx32 -t plastimatch-lin-x32 .
docker run --rm plastimatch-lin-x32 > plastimatch_binarios.tar.gz
tar -tzvf plastimatch_binarios.tar.gz
tar -xzvf plastimatch_binarios.tar.gz -C linux/x32
```

To build and run the Plastimatch container for ARM architecture, use the following commands:
```
docker build -f Dockerfile.linarm -t plastimatch-lin-arm .
docker run --rm plastimatch-lin-arm > plastimatch_binarios.tar.gz
tar -tzvf plastimatch_binarios.tar.gz
tar -xzvf plastimatch_binarios.tar.gz -C linux/arm
```

These instructions will help you set up the Plastimatch software in different environments.