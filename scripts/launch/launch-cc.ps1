$ErrorActionPreference = 'Continue'

$root = "d:\hot droppZ\SYSTEM\hotdroppz\command-centrum"
$url = "http://localhost:3000"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  HDCC Launcher (PowerShell)" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Kill old processes on port 3000
Write-Host "[1/4] Cleaning up port 3000..." -ForegroundColor Yellow
$processes = netstat -ano 2>$null | Select-String ":3000 " | ForEach-Object {
  $parts = $_ -split '\s+'
  $parts[-1]
} | Select-Object -Unique

foreach ($pid in $processes) {
  if ($pid -match '^\d+$') {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
      Write-Host "  Killed PID $pid"
    } catch {
      # Ignore
    }
  }
}

# Check/setup dependencies
Write-Host "[2/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$root\node_modules")) {
  Write-Host "  Installing npm dependencies..."
  Push-Location $root
  & npm install 2>&1 | Out-Null
  Pop-Location
}
Write-Host "  Dependencies OK"

# Start server
Write-Host "[3/4] Starting dev server..." -ForegroundColor Yellow
Push-Location $root
$process = Start-Process "npm" -ArgumentList "run","dev" -PassThru -NoNewWindow
Pop-Location

# Wait for server to be ready
Write-Host "[4/4] Waiting for server..." -ForegroundColor Yellow
$maxWait = 60
$elapsed = 0
$ready = $false

for ($i = 0; $i -lt $maxWait; $i++) {
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✓ Server is ready!" -ForegroundColor Green
    $ready = $true
    break
  } catch {
    $elapsed++
    if ($elapsed % 5 -eq 0) {
      Write-Host "  ..." -ForegroundColor Gray
    }
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  Write-Host "  ⚠ Server startup timeout, but proceeding..." -ForegroundColor Yellow
  Start-Sleep -Seconds 2
}

# Open browser with multiple fallbacks
Write-Host ""
Write-Host "Opening browser at $url..." -ForegroundColor Cyan

# Try 1: Use default handler
try {
  Start-Process $url -ErrorAction Stop
  Write-Host "✓ Browser opened!" -ForegroundColor Green
  exit 0
} catch {
  # Fall through to next attempts
}

# Try 2: Use specific browsers
$browsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Mozilla Firefox\firefox.exe",
  "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
)

foreach ($browser in $browsers) {
  if (Test-Path $browser) {
    try {
      & $browser $url
      Write-Host "✓ Browser opened!" -ForegroundColor Green
      exit 0
    } catch {
      # Try next browser
    }
  }
}

# Fallback: Show URL if all else fails
Write-Host "✗ Could not open browser automatically" -ForegroundColor Red
Write-Host "Please open manually: $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "Dev server is running. Press Ctrl+C in the npm window to stop." -ForegroundColor Gray
