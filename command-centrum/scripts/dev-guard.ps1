param([int]$Port = 3000)

# dev-guard — guarantees a single clean `next dev` for command-centrum.
# Root cause it prevents: running `next dev` twice for this project makes the
# second instance bind a different port but write the SAME `.next`, corrupting
# the build manifest (HTML references chunks that 404). This kills any prior
# next-dev for THIS project + frees the port, and clears `.next` only when it
# actually had to kill something (i.e. an unclean prior state).

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot   # command-centrum
$killed = 0

# 1. Kill other node processes running THIS project's `next` (not the npm parent,
#    whose command line doesn't include the project path, and not the backend).
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -like "*$root*" -and $_.CommandLine -like '*next*'
} | ForEach-Object {
  taskkill /PID $_.ProcessId /T /F | Out-Null
  $killed++
}

# 2. Free the dev port (whatever is still holding it).
$owners = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
foreach ($o in ($owners | Select-Object -Unique)) {
  taskkill /PID $o /T /F | Out-Null
  $killed++
}

# 3. If the prior state was unclean, drop `.next` so the new server can't inherit
#    a corrupted manifest. (Skipped on a clean start to keep rebuilds fast.)
if ($killed -gt 0) {
  $next = Join-Path $root '.next'
  if (Test-Path $next) { Remove-Item -Recurse -Force $next }
  Write-Host "[dev-guard] cleared $killed stale dev process(es) + reset .next"
} else {
  Write-Host "[dev-guard] clean - no existing dev server on port $Port"
}
