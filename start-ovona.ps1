param(
  [int]$Port = 3000,
  [switch]$SkipInstall,
  [switch]$KillPort
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $scriptDir "frontend-new"

if (-not (Test-Path $frontendDir)) {
  throw "Could not find frontend folder at: $frontendDir"
}

Set-Location $frontendDir

Write-Host "Starting Ovona from: $frontendDir"

if ($KillPort) {
  Write-Host "Checking for processes on port $Port..."
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      Write-Host "Stopping process $pid on port $Port"
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  } else {
    Write-Host "No listening process found on port $Port"
  }
}

if (-not $SkipInstall) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Starting Next.js dev server..."
npm run dev

