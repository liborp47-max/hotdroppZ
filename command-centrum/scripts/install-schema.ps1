#!/usr/bin/env pwsh
# install-schema.ps1 — single-command schema installer (Windows / PowerShell variant).
# Mirrors scripts/install-schema.sh behavior and exit codes.
#
# Sub-mission: UM-CC_SCHEMA_MIGRATION / #04
#
# Exit codes:
#   0 = success (all applied + health PASS)
#   1 = apply failure (one or more files failed)
#   2 = health check drift (FAIL count > 0)
#   3 = setup error (manifest missing, node missing, manifest invalid)
#
# Usage:
#   .\scripts\install-schema.ps1 [-SkipHealth] [-DryRun] [-Help]
#
# Note on execution policy:
#   On a fresh Windows install, default policy is 'Restricted'. To run this:
#     Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   Or invoke explicitly:
#     pwsh -ExecutionPolicy Bypass -File .\scripts\install-schema.ps1

[CmdletBinding()]
param(
  [switch]$SkipHealth,
  [switch]$DryRun,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

# ----------------------------------------------------------------------------
# Logging helpers (Write-Host is intentional — script output, not pipeline)
# ----------------------------------------------------------------------------

function Write-Step([string]$msg) { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-OK   ([string]$msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn2([string]$msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err2 ([string]$msg) { Write-Host $msg -ForegroundColor Red }

function Show-Usage {
  @"
install-schema.ps1 - single-command schema installer

Usage:
  .\scripts\install-schema.ps1 [-SkipHealth] [-DryRun] [-Help]

Flags:
  -SkipHealth   Skip running scripts/schema-health-check.mjs after apply
  -DryRun       Print the apply plan (files in order) but do not execute
  -Help         Show this help

Exit codes:
  0  success (all applied + healthy)
  1  apply failure
  2  health check drift (FAIL count > 0)
  3  setup error (missing manifest/node/script)

Environment:
  SUPABASE_DB_URL or DATABASE_URL must be set for apply-sql.mjs to connect.
"@ | Write-Host
}

if ($Help) { Show-Usage; exit 0 }

# ----------------------------------------------------------------------------
# Pre-flight
# ----------------------------------------------------------------------------

$ScriptDir = Split-Path -Parent $PSCommandPath
$Root      = Resolve-Path (Join-Path $ScriptDir '..')
Set-Location $Root

$ManifestPath  = 'supabase/MANIFEST.json'
$ApplyScript   = 'scripts/apply-sql.mjs'
$HealthScript  = 'scripts/schema-health-check.mjs'

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
  Write-Err2 "Setup error: 'node' not found in PATH. Install Node 18+ first."
  exit 3
}

if (-not (Test-Path $ManifestPath)) {
  Write-Err2 "Setup error: $ManifestPath missing. Run sub-mission #02 first."
  exit 3
}

if (-not (Test-Path $ApplyScript)) {
  Write-Err2 "Setup error: $ApplyScript missing. Dependency chain broken."
  exit 3
}

if (-not (Test-Path $HealthScript) -and -not $SkipHealth) {
  Write-Err2 "Setup error: $HealthScript missing. Run sub-mission #03 first or use -SkipHealth."
  exit 3
}

# ----------------------------------------------------------------------------
# Read MANIFEST.files[] sorted by applyOrder
# ----------------------------------------------------------------------------

try {
  $manifestRaw = Get-Content -Raw -Path $ManifestPath -ErrorAction Stop
  $manifest    = $manifestRaw | ConvertFrom-Json
} catch {
  Write-Err2 "Setup error: failed to parse MANIFEST.json: $($_.Exception.Message)"
  exit 3
}

if (-not $manifest.files -or $manifest.files.Count -eq 0) {
  Write-Err2 "Setup error: MANIFEST.files[] empty or missing."
  exit 3
}

$files = @($manifest.files | Sort-Object -Property applyOrder)
$total = $files.Count

if ($total -eq 0) {
  Write-Err2 "Setup error: MANIFEST.files[] resolved to 0 entries."
  exit 3
}

# ----------------------------------------------------------------------------
# Dry run
# ----------------------------------------------------------------------------

if ($DryRun) {
  Write-Step "Dry run - apply plan ($total files):"
  $i = 1
  foreach ($f in $files) {
    "  {0,2}. {1}" -f $i, $f.path | Write-Host
    $i++
  }
  Write-Host ""
  if ($SkipHealth) {
    Write-Host "Health check: SKIPPED (-SkipHealth)"
  } else {
    Write-Host "Then: $HealthScript"
  }
  exit 0
}

# ----------------------------------------------------------------------------
# Apply loop
# ----------------------------------------------------------------------------

$startTs = Get-Date
$applied = 0

Write-Step "Schema install starting - $total files"

foreach ($f in $files) {
  $idx = $applied + 1
  $path = $f.path
  Write-Step "Applying [$idx/$total] $path"

  if (-not (Test-Path $path)) {
    Write-Err2 "SQL file not found: $path"
    Write-Err2 "Apply aborted at step $idx/$total"
    exit 1
  }

  # Invoke node; capture exit code without using $ErrorActionPreference
  & node $ApplyScript $path
  $applyRc = $LASTEXITCODE
  if ($applyRc -ne 0) {
    Write-Err2 "Apply failed at [$idx/$total] $path (node exit $applyRc)"
    exit 1
  }
  $applied++
  Write-OK "OK [$idx/$total] $path"
}

# ----------------------------------------------------------------------------
# Health check
# ----------------------------------------------------------------------------

$healthLabel = 'SKIPPED'
$healthRc    = 0

if (-not $SkipHealth) {
  Write-Step "Running schema health check"
  & node $HealthScript
  $healthRc = $LASTEXITCODE
  switch ($healthRc) {
    0 { $healthLabel = 'PASS' }
    1 { $healthLabel = 'FAIL (drift)' }
    2 { $healthLabel = 'SETUP ERROR' }
    default { $healthLabel = "UNKNOWN (rc=$healthRc)" }
  }
}

# ----------------------------------------------------------------------------
# Final report
# ----------------------------------------------------------------------------

$endTs = Get-Date
$dur   = [int]($endTs - $startTs).TotalSeconds

Write-Host ""
Write-Host "===================================="
Write-Host "Schema installation complete."
Write-Host "Applied: $applied/$total files"
Write-Host "Health:  $healthLabel"
Write-Host "Duration: ${dur}s"
Write-Host "===================================="

if (-not $SkipHealth) {
  switch ($healthRc) {
    0 { exit 0 }
    1 { exit 2 }   # drift
    2 { exit 3 }   # setup error from health check
    default { exit 3 }
  }
}

exit 0
