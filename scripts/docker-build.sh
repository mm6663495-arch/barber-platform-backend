#!/bin/bash

# =======================================
# 🐳 Docker Build Script
# =======================================

set -e

echo "=================================="
echo "🐳 Building Docker Image"
echo "=================================="

# المتغيرات
IMAGE_NAME=${IMAGE_NAME:-"barber-platform-backend"}
VERSION=${VERSION:-"latest"}
REGISTRY=${REGISTRY:-""}

# Build Image
echo "🏗️  Building image: $IMAGE_NAME:$VERSION"
docker build -t $IMAGE_NAME:$VERSION .

# Tag للريجستري إذا كان محدداً
if [ ! -z "$REGISTRY" ]; then
  echo "🏷️  Tagging image for registry: $REGISTRY"
  docker tag $IMAGE_NAME:$VERSION $REGISTRY/$IMAGE_NAME:$VERSION
  
  # Push للريجستري
  echo "📤 Pushing image to registry..."
  docker push $REGISTRY/$IMAGE_NAME:$VERSION
fi

echo "=================================="
echo "✅ Docker Build Completed!"
echo "=================================="

