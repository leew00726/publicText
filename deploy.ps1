param(
    [ValidateSet('all', 'frontend', 'backend')]
    [string]$Target = 'frontend',

    [switch]$NoCache,

    [switch]$ShowLogs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host "`n==> $Title" -ForegroundColor Cyan
    & $Action
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker command not found. Please install Docker Desktop and ensure it is running.'
}

Set-Location $PSScriptRoot

$services = switch ($Target) {
    'all' { @('backend', 'frontend') }
    'backend' { @('backend') }
    'frontend' { @('frontend') }
    default { @('frontend') }
}
$services = @($services) | ForEach-Object { [string]$_ }

Invoke-Step -Title "Compose target: $Target ($($services -join ', '))" -Action {
    if ($NoCache) {
        & docker compose build --no-cache $services
        if ($LASTEXITCODE -ne 0) {
            throw 'docker compose build failed.'
        }

        & docker compose up -d $services
        if ($LASTEXITCODE -ne 0) {
            throw 'docker compose up failed.'
        }
    }
    else {
        & docker compose up -d --build $services
        if ($LASTEXITCODE -ne 0) {
            throw 'docker compose up --build failed.'
        }
    }
}

Invoke-Step -Title 'Service status' -Action {
    & docker compose ps
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose ps failed.'
    }
}

if ($ShowLogs) {
    Invoke-Step -Title 'Recent logs' -Action {
        foreach ($service in $services) {
            Write-Host "`n[$service]" -ForegroundColor Yellow
            & docker compose logs --tail=100 $service
        }
    }
}

Write-Host "`nDeploy done." -ForegroundColor Green
