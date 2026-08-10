param(
  [ValidateSet("full", "plan-state", "onboarding")]
  [string]$Mode = "full",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$BearerToken = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$checks = @()

function Add-Check {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    [int[]]$Expected,
    [object]$Body = $null,
    [string]$ContentType = "application/json"
  )

  $script:checks += [pscustomobject]@{
    Name = $Name
    Method = $Method
    Path = $Path
    Expected = $Expected
    Body = $Body
    ContentType = $ContentType
  }
}

function Get-StatusCode {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [string]$ContentType
  )

  $headers = @{}
  if ($BearerToken) {
    $headers["Authorization"] = "Bearer $BearerToken"
  }

  try {
    $invokeParams = @{
      Uri = $Url
      Method = $Method
      Headers = $headers
      UseBasicParsing = $true
      TimeoutSec = 20
    }

    if ($Body -ne $null) {
      if ($ContentType) {
        $invokeParams["ContentType"] = $ContentType
      }
      if ($Body -is [string]) {
        $invokeParams["Body"] = $Body
      } else {
        $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 10)
      }
    }

    $resp = Invoke-WebRequest @invokeParams
    return [int]$resp.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}

if ($Mode -eq "plan-state" -or $Mode -eq "full") {
  Add-Check -Name "meal-plan/state requires weekStart" -Method "GET" -Path "/api/meal-plan/state" -Expected @(400)
  Add-Check -Name "meal-plan/state validates weekStart format" -Method "GET" -Path "/api/meal-plan/state?weekStart=not-a-date" -Expected @(400)
  Add-Check -Name "meal-plan/state auth gate when weekStart present" -Method "GET" -Path "/api/meal-plan/state?weekStart=2026-04-13" -Expected @(401, 503)
  Add-Check -Name "meal-plan/state validates plan payload shape" -Method "POST" -Path "/api/meal-plan/state" -Expected @(400) -Body @{}
}

if ($Mode -eq "onboarding" -or $Mode -eq "full") {
  Add-Check -Name "preferences invalid json returns 400" -Method "POST" -Path "/api/preferences" -Expected @(400) -Body "{" -ContentType "application/json"
  Add-Check -Name "preferences auth gate" -Method "POST" -Path "/api/preferences" -Expected @(401, 503) -Body @{ dietaryMode = "mixed"; allergies = @() }
}

if ($DryRun) {
  Write-Host "[phase1-reliability] DRY RUN"
  Write-Host "[phase1-reliability] mode=$Mode baseUrl=$BaseUrl"
  foreach ($check in $checks) {
    $expected = ($check.Expected -join ",")
    Write-Host " - $($check.Method) $($check.Path) -> expect $expected ($($check.Name))"
  }
  exit 0
}

$failed = 0
Write-Host "[phase1-reliability] Running $($checks.Count) checks (mode=$Mode)"

foreach ($check in $checks) {
  $url = "$BaseUrl$($check.Path)"
  $expectedText = ($check.Expected -join ",")

  try {
    $status = Get-StatusCode -Method $check.Method -Url $url -Body $check.Body -ContentType $check.ContentType
    if ($check.Expected -contains $status) {
      Write-Host "PASS [$status] $($check.Name)"
    } else {
      Write-Host "FAIL [$status] $($check.Name) (expected: $expectedText)"
      $failed += 1
    }
  } catch {
    Write-Host "FAIL [exception] $($check.Name): $($_.Exception.Message)"
    $failed += 1
  }
}

if ($failed -gt 0) {
  Write-Host "[phase1-reliability] $failed checks failed."
  exit 1
}

Write-Host "[phase1-reliability] all checks passed."
exit 0
