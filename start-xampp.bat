@echo off
echo Starting Barber Platform Backend on XAMPP...
echo.

echo 1. Installing dependencies...
call npm install

echo.
echo 2. Setting up database...
call npx prisma migrate dev --name init

echo.
echo 3. Generating Prisma client...
call npx prisma generate

echo.
echo 4. Starting development server...
call npm run start:dev

pause

