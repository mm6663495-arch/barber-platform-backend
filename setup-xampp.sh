#!/bin/bash

echo "🚀 Setting up Barber Platform Backend on XAMPP..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if MySQL is running
echo -e "\n${YELLOW}📋 Checking MySQL service...${NC}"
if pgrep -x "mysqld" > /dev/null; then
    echo -e "${GREEN}✅ MySQL is running${NC}"
else
    echo -e "${RED}❌ MySQL is not running. Please start MySQL first!${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Step 2: Copy environment file
echo -e "\n${YELLOW}⚙️ Setting up environment configuration...${NC}"
if [ -f "xampp-config.env" ]; then
    cp xampp-config.env .env
    echo -e "${GREEN}✅ Environment file copied${NC}"
else
    echo -e "${RED}❌ xampp-config.env not found${NC}"
    exit 1
fi

# Step 3: Generate Prisma Client
echo -e "\n${YELLOW}🔧 Generating Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to generate Prisma Client${NC}"
    exit 1
fi

# Step 4: Create database and run migrations
echo -e "\n${YELLOW}🗄️ Setting up database...${NC}"
echo -e "${CYAN}Creating database and running migrations...${NC}"

export DATABASE_URL="mysql://root:@localhost:3306/barber_platform"
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database setup completed${NC}"
else
    echo -e "${YELLOW}⚠️ Migration failed, trying to reset...${NC}"
    npx prisma migrate reset --force
    npx prisma migrate dev --name init
fi

# Step 5: Seed database
echo -e "\n${YELLOW}🌱 Seeding database...${NC}"
echo -e "${CYAN}Creating admin user...${NC}"

# Create seed script
cat > seed.js << 'EOF'
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
        await prisma.$disconnect();
    });
EOF

# Run seed script
node seed.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database seeded successfully${NC}"
    rm seed.js
else
    echo -e "${YELLOW}⚠️ Seeding failed, but you can create users manually${NC}"
    rm seed.js
fi

# Step 6: Start the application
echo -e "\n${YELLOW}🚀 Starting the application...${NC}"
echo -e "${CYAN}Application will be available at:${NC}"
echo -e "  🌐 API: http://localhost:3000"
echo -e "  📚 Docs: http://localhost:3000/api/docs"
echo -e "\n${CYAN}Admin Credentials:${NC}"
echo -e "  📧 Email: admin@barber.com"
echo -e "  🔑 Password: admin123"

echo -e "\n${GREEN}✅ Setup completed! Starting development server...${NC}"
npm run start:dev
