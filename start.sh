#!/bin/bash
# Para correr la plataforma de grados ITP, usar el comando `./start.sh` en la terminal. 
# Este script se encargará de construir las imágenes de Docker sin usar cache y luego levantar los contenedores en segundo plano.

echo "Iniciando Plataforma de Grados ITP..."
docker compose build --no-cache
docker compose up -d
echo "Contenedores levantados en segundo plano"
