@echo off
echo ===========================================
echo Barber Platform XAMPP Setup Script
echo ===========================================
echo.

REM Check if XAMPP is running
echo Checking XAMPP status...
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I /N "httpd.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Apache is running
) else (
    echo Apache is not running. Please start XAMPP first.
    pause
    exit /b 1
)

tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo MySQL is running
) else (
    echo MySQL is not running. Please start XAMPP first.
    pause
    exit /b 1
)

echo.
echo ===========================================
echo Setting up Barber Platform Backend
echo ===========================================

REM Copy environment file
echo Copying environment configuration...
if exist "xampp-config.env" (
    copy "xampp-config.env" ".env" >nul
    echo Environment file copied successfully
) else (
    echo Warning: xampp-config.env not found
)

REM Install dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Setup database
echo.
echo Setting up database...
echo Please run the following SQL script in phpMyAdmin:
echo 1. Open http://localhost/phpmyadmin
echo 2. Create database 'barber_platform'
echo 3. Run the SQL script from xampp-mysql-config.sql
echo.
pause

REM Run Prisma migrations
echo.
echo Running Prisma migrations...
call npx prisma migrate dev --name init
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to run migrations
    pause
    exit /b 1
)

call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to generate Prisma client
    pause
    exit /b 1
)

REM Create necessary directories
echo.
echo Creating necessary directories...
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups

REM Set permissions (if needed)
echo.
echo Setting up file permissions...
echo Note: You may need to set proper permissions for uploads and logs directories

REM Start the application
echo.
echo ===========================================
echo Starting Barber Platform Backend
echo ===========================================
echo.
echo The application will start on http://localhost:3000
echo API documentation will be available at http://localhost:3000/api/docs
echo Health check will be available at http://localhost:3000/health
echo.
echo Press Ctrl+C to stop the application
echo.

call npm run start:dev

pause
