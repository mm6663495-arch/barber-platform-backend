#!/bin/bash

# =======================================
# 🚀 Deployment Script
# =======================================

set -e

echo "=================================="
echo "🚀 Starting Deployment Process"
echo "=================================="

# التحقق من المتغيرات المطلوبة
if [ -z "$DEPLOY_ENV" ]; then
  echo "❌ Error: DEPLOY_ENV is not set"
  exit 1
fi

echo "📋 Environment: $DEPLOY_ENV"

# النسخ الاحتياطي للقاعدة البيانات
echo "🗄️  Creating database backup..."
if [ "$DEPLOY_ENV" = "production" ]; then
  mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
fi

# تحديث الكود
echo "📥 Pulling latest code..."
git pull origin main

# تثبيت الحزم
echo "📦 Installing dependencies..."
npm ci --legacy-peer-deps

# توليد Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# تطبيق الهجرة
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Build التطبيق
echo "🏗️  Building application..."
npm run build

# إعادة تشغيل الخدمة
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
  pm2 restart barber-backend
elif command -v systemctl &> /dev/null; then
  sudo systemctl restart barber-backend
else
  echo "⚠️  Please restart the application manually"
fi

# Health Check
echo "✅ Running health check..."
sleep 5
curl -f http://localhost:3000/health || {
  echo "❌ Health check failed!"
  exit 1
}

echo "=================================="
echo "✅ Deployment Completed Successfully!"
echo "=================================="

