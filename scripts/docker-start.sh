#!/bin/bash

# =======================================
# 🐳 Docker Start Script
# =======================================

set -e

echo "=================================="
echo "🐳 Starting Docker Containers"
echo "=================================="

# التحقق من وجود ملف .env
if [ ! -f .env ]; then
  echo "⚠️  Warning: .env file not found"
  echo "📝 Creating .env from .env.docker.example..."
  cp .env.docker.example .env
  echo "✅ Please update .env file with your configuration"
fi

# اختيار البيئة
ENV=${1:-"production"}

if [ "$ENV" = "dev" ]; then
  echo "🔧 Starting development environment..."
  docker-compose -f docker-compose.dev.yml up -d
  
  echo ""
  echo "✅ Development environment started!"
  echo ""
  echo "📊 Available services:"
  echo "  - MySQL: localhost:3306"
  echo "  - Redis: localhost:6379"
  echo "  - phpMyAdmin: http://localhost:8080"
  echo "  - Redis Commander: http://localhost:8081"
  echo "  - Mailhog: http://localhost:8025"
  
else
  echo "🚀 Starting production environment..."
  docker-compose up -d
  
  echo ""
  echo "✅ Production environment started!"
  echo ""
  echo "📊 Available services:"
  echo "  - Application: http://localhost:3000"
  echo "  - MySQL: localhost:3306"
  echo "  - Redis: localhost:6379"
fi

echo ""
echo "🔍 View logs with: docker-compose logs -f"
echo "🛑 Stop with: docker-compose down"
echo ""
echo "=================================="

