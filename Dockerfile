# المرحلة 1: Build
FROM node:20-alpine AS builder

# تثبيت المكتبات المطلوبة
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# نسخ ملفات package
COPY package*.json ./
COPY prisma ./prisma/

# تثبيت الحزم
RUN npm ci --legacy-peer-deps

# نسخ الكود المصدري
COPY . .

# توليد Prisma Client
RUN npx prisma generate

# Build التطبيق
RUN npm run build

# المرحلة 2: Production
FROM node:20-alpine AS runner

# تثبيت المكتبات المطلوبة
RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# إنشاء مستخدم غير root للأمان
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# نسخ الملفات الضرورية من builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# نسخ ملف الإنتاج env (اختياري)
# COPY .env.production .env

# تغيير ملكية الملفات
RUN chown -R nestjs:nodejs /app

# التبديل للمستخدم nestjs
USER nestjs

# كشف المنفذ
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# تشغيل التطبيق
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
