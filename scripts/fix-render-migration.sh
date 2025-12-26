#!/bin/bash
# Script to fix failed migration in Render

echo "🔧 Fixing failed migration in Render..."

# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back 20251002070226_init

echo "✅ Migration marked as rolled back"
echo "📝 Next: Update Start Command to use 'npx prisma db push && npm run start:prod'"

