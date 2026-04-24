#!/bin/bash
# Script para publicar imagens NexaView no Docker Hub
# 
# Uso:
#   ./publish-to-docker-hub.sh <seu-usuario> <tag>
#
# Exemplos:
#   ./publish-to-docker-hub.sh meunome latest
#   ./publish-to-docker-hub.sh meunome v1.0.0

set -e

if [ $# -lt 2 ]; then
    echo "Uso: $0 <seu-usuario> <tag>"
    echo "Exemplos:"
    echo "  $0 meunome latest"
    echo "  $0 meunome v1.0.0"
    exit 1
fi

DOCKER_USER=$1
TAG=$2
REGISTRY="${3:-docker.io}"

echo "========================================="
echo "Publicando NexaView no Docker Hub"
echo "========================================="
echo "Docker User: $DOCKER_USER"
echo "Tag: $TAG"
echo "Registry: $REGISTRY"
echo ""

# Login no Docker Hub
echo "🔐 Fazendo login no Docker Hub..."
docker login -u "$DOCKER_USER"

# Backend
echo ""
echo "📦 Buildando backend..."
cd server
docker build -t "$DOCKER_USER/nexaview-backend:$TAG" -t "$DOCKER_USER/nexaview-backend:latest" .
echo "✅ Backend buildado: $DOCKER_USER/nexaview-backend:$TAG"

echo ""
echo "🚀 Fazendo push do backend..."
docker push "$DOCKER_USER/nexaview-backend:$TAG"
docker push "$DOCKER_USER/nexaview-backend:latest"
echo "✅ Backend publicado!"

# Frontend
cd ..
echo ""
echo "📦 Buildando frontend..."
docker build -f Dockerfile.frontend -t "$DOCKER_USER/nexaview-frontend:$TAG" -t "$DOCKER_USER/nexaview-frontend:latest" .
echo "✅ Frontend buildado: $DOCKER_USER/nexaview-frontend:$TAG"

echo ""
echo "🚀 Fazendo push do frontend..."
docker push "$DOCKER_USER/nexaview-frontend:$TAG"
docker push "$DOCKER_USER/nexaview-frontend:latest"
echo "✅ Frontend publicado!"

echo ""
echo "========================================="
echo "✨ Publicação concluída com sucesso!"
echo "========================================="
echo ""
echo "Próximos passos:"
echo "1. Acesse Portainer"
echo "2. Vá para Stacks → Add Stack"
echo "3. Cole o conteúdo de docker-compose.stack.yml"
echo "4. Configure as variáveis de ambiente:"
echo "   BACKEND_IMAGE=$DOCKER_USER/nexaview-backend:$TAG"
echo "   FRONTEND_IMAGE=$DOCKER_USER/nexaview-frontend:$TAG"
echo "5. Deploy!"
echo ""
echo "Imagens disponíveis em: https://hub.docker.com/u/$DOCKER_USER/"