$appDir = "d:\hot droppZ\SYSTEM\hotdroppz\frontend-web"
$port   = 3002

Write-Host ""
Write-Host "  hotdroppZ User App - starting on port $port" -ForegroundColor Red
Write-Host ""

# Kill any existing server on this port
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

# Clear NODE_ENV
$env:NODE_ENV = ""

# Launch dev server in a new cmd window
Start-Process cmd -ArgumentList "/k npm run dev -- --port $port" -WorkingDirectory $appDir

# Poll until server responds
Write-Host "  Waiting for server" -NoNewline
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    Write-Host "." -NoNewline
    try {
        $r = Invoke-WebRequest "http://localhost:$port" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}

Write-Host ""
Start-Process "http://localhost:$port"

if ($ready) {
    Write-Host "  Opened http://localhost:$port" -ForegroundColor Green
} else {
    Write-Host "  Browser opened (server may still be compiling)" -ForegroundColor Yellow
}
