@echo off
cd /d "D:\hot droppZ\SYSTEM\hotdroppz\command-centrum"

echo ========================================
echo   Command-Centrum Local Server
echo ========================================
echo.

REM Kill anything already on port 3000 so we always get the right port
echo Checking for processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (
    echo   Killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 >nul

REM Clear stale build cache if it exists but is broken
if exist ".next\server\app\page.js" (
    echo Build cache OK.
) else if exist ".next" (
    echo Stale build cache detected, clearing...
    rmdir /s /q .next
    echo   Done.
)
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting dev server on http://localhost:3000 ...
echo.

start "Command-Centrum Server" cmd /c "npm run dev"

echo Waiting for server to start...
:waitloop
timeout /t 2 >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000 2>nul | findstr /r "2[0-9][0-9] 3[0-9][0-9]" >nul
if errorlevel 1 (
    echo   ...
    goto waitloop
)

echo Server is up! Opening browser...

REM Try multiple methods to open the URL
start http://localhost:3000 2>nul

REM Also try with Chrome if available (most reliable)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  timeout /t 1 /nobreak
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000" 2>nul
)

echo.
echo Done. Close the "Command-Centrum Server" window to stop.
pause
