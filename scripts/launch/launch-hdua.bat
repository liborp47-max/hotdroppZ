@echo off
title HDUA — HotDroppZ User App

:: Clear NODE_ENV before anything else
set NODE_ENV=

:: Kill any old server on port 3002
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3002 "') do taskkill /PID %%a /F >nul 2>&1

:: Go to the app directory
cd /d "d:\hot droppZ\SYSTEM\hotdroppz\frontend-web"

echo.
echo  hotdroppZ User App — http://localhost:3002
echo.

:: Start dev server in a new window (inherits cwd + NODE_ENV from this process)
start "HDUA Dev Server" cmd /k npm run dev -- --port 3002

:: Wait for Next.js to compile the first route
timeout /t 18 /nobreak >nul

start "" "http://localhost:3002"
exit
