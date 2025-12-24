# PowerShell Script for XAMPP Setup
Write-Host "🚀 Setting up Barber Platform Backend on XAMPP..." -ForegroundColor Green

# Check if XAMPP is running
Write-Host "`n📋 Checking XAMPP services..." -ForegroundColor Yellow
$mysqlProcess = Get-Process -Name "mysqld" -ErrorAction SilentlyContinue
if ($mysqlProcess) {
    Write-Host "✅ MySQL is running" -ForegroundColor Green
} else {
    Write-Host "❌ MySQL is not running. Please start XAMPP first!" -ForegroundColor Red
    exit 1
}

# Step 1: Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 2: Copy environment file
Write-Host "`n⚙️ Setting up environment configuration..." -ForegroundColor Yellow
if (Test-Path "xampp-config.env") {
    Copy-Item "xampp-config.env" ".env"
    Write-Host "✅ Environment file copied" -ForegroundColor Green
} else {
    Write-Host "❌ xampp-config.env not found" -ForegroundColor Red
    exit 1
}

# Step 3: Generate Prisma Client
Write-Host "`n🔧 Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}

# Step 4: Create database and run migrations
Write-Host "`n🗄️ Setting up database..." -ForegroundColor Yellow
Write-Host "Creating database and running migrations..." -ForegroundColor Cyan

# Try to create database
try {
    $env:DATABASE_URL = "mysql://root:@localhost:3306/barber_platform"
    npx prisma migrate dev --name init
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database setup completed" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Migration failed, trying to reset..." -ForegroundColor Yellow
        npx prisma migrate reset --force
        npx prisma migrate dev --name init
    }
} catch {
    Write-Host "❌ Database setup failed. Please check MySQL connection." -ForegroundColor Red
    Write-Host "Make sure XAMPP MySQL is running and accessible." -ForegroundColor Yellow
    exit 1
}

# Step 5: Seed database (optional)
Write-Host "`n🌱 Seeding database..." -ForegroundColor Yellow
Write-Host "Creating admin user..." -ForegroundColor Cyan

# Create a simple seed script
$seedScript = @"
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.upsert({
        where: { email: 'admin@barber.com' },
        update: {},
        create: {
            email: 'admin@barber.com',
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
            platformAdmin: {
                create: {
                    fullName: 'System Administrator',
                    permissions: {}
                }
            }
        }
    });

    console.log('Admin user created:', admin);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.\$disconnect();
    });
"@

$seedScript | Out-File -FilePath "seed.js" -Encoding UTF8

# Run seed script
node seed.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database seeded successfully" -ForegroundColor Green
    Remove-Item "seed.js" -Force
} else {
    Write-Host "⚠️ Seeding failed, but you can create users manually" -ForegroundColor Yellow
    Remove-Item "seed.js" -Force
}

# Step 6: Start the application
Write-Host "`n🚀 Starting the application..." -ForegroundColor Yellow
Write-Host "Application will be available at:" -ForegroundColor Cyan
Write-Host "  🌐 API: http://localhost:3000" -ForegroundColor White
Write-Host "  📚 Docs: http://localhost:3000/api/docs" -ForegroundColor White
Write-Host "`nAdmin Credentials:" -ForegroundColor Cyan
Write-Host "  📧 Email: admin@barber.com" -ForegroundColor White
Write-Host "  🔑 Password: admin123" -ForegroundColor White

Write-Host "`n✅ Setup completed! Starting development server..." -ForegroundColor Green
npm run start:dev