@echo off
setlocal
title Command Centrum - launching...

set "CC_DIR=d:\hot droppZ\SYSTEM\hotdroppz\command-centrum"

if not exist "%CC_DIR%\package.json" (
	echo [HDCC] Missing package.json in %CC_DIR%
	pause
	exit /b 1
)

echo [HDCC] Starting HotDroppZ Command Centrum on http://localhost:3000 ...
echo.

cd /d "%CC_DIR%"
call npm run dev

endlocal
