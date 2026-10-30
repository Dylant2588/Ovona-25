param(
  [string]$ToolsRoot = (Join-Path $env:LOCALAPPDATA 'OvonaTools')
)

$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $ToolsRoot 'supabase-disposable'
$supabase = Join-Path $ToolsRoot 'supabase\supabase.exe'
$psql = Join-Path $ToolsRoot 'postgres\pgsql\bin\psql.exe'
$docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
foreach ($file in @($supabase, $psql, $docker)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'A verified local test tool is missing.' }
}
$env:PATH = (Split-Path -Parent $docker) + ';' + $env:PATH
foreach ($container in @('supabase_db_supabase-disposable', 'supabase_kong_supabase-disposable')) {
  $ports = (& $docker port $container) -join "`n"
  if ($LASTEXITCODE -ne 0 -or -not $ports -or $ports -match '0\.0\.0\.0|\[::\]' -or $ports -notmatch '127\.0\.0\.1:') {
    throw 'Disposable containers must be healthy and bound only to localhost.'
  }
}
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  $statusText = & $supabase status --workdir $testRoot --output json 2>$null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'Disposable local stack is not ready.' }
$status = ($statusText -join "`n") | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:54321') { throw 'Unexpected local API identity.' }
# Keys stay in this process environment; never print or persist them.
$env:OVONA_BASELINE_TEST_URL = $status.API_URL
$env:OVONA_BASELINE_TEST_ANON_KEY = $status.ANON_KEY
$env:OVONA_BASELINE_TEST_SERVICE_ROLE_KEY = $status.SERVICE_ROLE_KEY
$env:OVONA_BASELINE_TEST_DATABASE_URL = $status.DB_URL
$env:OVONA_BASELINE_TEST_EXPECTED_HOST = '127.0.0.1'
$env:OVONA_BASELINE_TEST_EXPECTED_REF = 'local'
$env:OVONA_BASELINE_TEST_EXPECTED_DATABASE = 'postgres'
$env:OVONA_BASELINE_TEST_DISPOSABLE = 'true'
$env:OVONA_BASELINE_TEST_CONFIRM = 'isolated-fixtures-only'
$env:OVONA_BASELINE_TEST_PSQL = $psql
Push-Location (Join-Path $PSScriptRoot '..\..\frontend-new')
try {
  & node --test tests/database/baseline.integration.test.ts
  $testExit = $LASTEXITCODE
} finally { Pop-Location }
exit $testExit
