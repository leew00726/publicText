param(
    [string]$EnvFile = ".env.server",
    [switch]$NoCache,
    [switch]$ShowLogs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker command not found. Please install Docker and ensure it is running.'
}

Set-Location $PSScriptRoot

$composeArgs = @('--env-file', $EnvFile, '-f', 'docker-compose.server.yml')

if ($NoCache) {
    & docker compose @composeArgs build --no-cache
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose build failed.'
    }

    & docker compose @composeArgs up -d
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose up failed.'
    }
}
else {
    & docker compose @composeArgs up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose up --build failed.'
    }
}

& docker compose @composeArgs ps
if ($LASTEXITCODE -ne 0) {
    throw 'docker compose ps failed.'
}

if ($ShowLogs) {
    & docker compose @composeArgs logs --tail=100
}

Write-Host "`nServer deploy done." -ForegroundColor Green
