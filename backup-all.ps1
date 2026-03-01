<#
.SYNOPSIS
Backup full project runtime state for migration.

.DESCRIPTION
Exports PostgreSQL data, MinIO objects, environment file, and metadata
to a backup folder. Intended to run on the source machine.

.PARAMETER BackupDir
Target backup directory. If omitted, a timestamped folder under .\backups is used.

.PARAMETER DatabaseName
PostgreSQL database name. Default: public_text.

.PARAMETER DatabaseUser
PostgreSQL user. Default: postgres.

.PARAMETER SkipEnvCopy
Skip copying root .env into backup folder.
#>
[CmdletBinding()]
param(
    [string]$BackupDir,
    [string]$DatabaseName = "public_text",
    [string]$DatabaseUser = "postgres",
    [switch]$SkipEnvCopy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host "`n==> $Title" -ForegroundColor Cyan
    & $Action
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Assert-DockerDaemon {
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw @"
Docker daemon is not running.
Please start Docker Desktop and wait until the engine is running, then retry:
  .\backup-all.ps1
"@
    }
}

function Invoke-DockerCompose {
    param([Parameter(Mandatory = $true)][string[]]$CommandArgs)
    & docker compose @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($CommandArgs -join ' ') failed."
    }
}

function Wait-ForPostgres {
    param(
        [string]$User,
        [int]$Retries = 30,
        [int]$DelaySeconds = 2
    )

    for ($i = 0; $i -lt $Retries; $i++) {
        & docker compose exec -T postgres pg_isready -U $User -d postgres *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    throw "PostgreSQL is not ready. Please check docker compose logs postgres."
}

$projectRoot = Split-Path -Parent $PSCommandPath
Set-Location $projectRoot

Assert-Command "docker"
Assert-DockerDaemon

if (-not (Test-Path (Join-Path $projectRoot "docker-compose.yml"))) {
    throw "docker-compose.yml not found in $projectRoot"
}

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupDir = Join-Path $projectRoot "backups\public-text-$timestamp"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupDir = (Resolve-Path $BackupDir).Path

$dbDumpContainerPath = "/tmp/public_text.dump"
$dbDumpLocalPath = Join-Path $BackupDir "public_text.dump"
$minioArchiveLocalPath = Join-Path $BackupDir "minio_data.zip"
$minioSnapshotRoot = Join-Path $BackupDir "__minio_snapshot"
$envSourcePath = Join-Path $projectRoot ".env"
$envBackupPath = Join-Path $BackupDir ".env"
$gitInfoPath = Join-Path $BackupDir "git-info.txt"
$fontReportPath = Join-Path $BackupDir "font-check.txt"
$checksumPath = Join-Path $BackupDir "checksums.txt"
$manifestPath = Join-Path $BackupDir "manifest.json"

Write-Step -Title "Ensure postgres and minio are running" -Action {
    Invoke-DockerCompose -CommandArgs @("up", "-d", "postgres", "minio")
}

Write-Step -Title "Wait for postgres ready" -Action {
    Wait-ForPostgres -User $DatabaseUser
}

Write-Step -Title "Collect git metadata" -Action {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $lines = @()
        $commit = & git rev-parse HEAD 2>$null
        if ($LASTEXITCODE -eq 0) {
            $lines += "commit=$($commit.Trim())"
        }
        $branch = & git branch --show-current 2>$null
        if ($LASTEXITCODE -eq 0) {
            $lines += "branch=$($branch.Trim())"
        }
        $lines += ""
        $lines += "status:"
        $lines += (& git status --short 2>$null)
        $lines | Set-Content -Path $gitInfoPath -Encoding utf8
    }
    else {
        "git command not available" | Set-Content -Path $gitInfoPath -Encoding utf8
    }
}

Write-Step -Title "Copy environment file" -Action {
    if ($SkipEnvCopy) {
        "skipped by -SkipEnvCopy" | Set-Content -Path $envBackupPath -Encoding utf8
        return
    }

    if (Test-Path $envSourcePath) {
        Copy-Item $envSourcePath $envBackupPath -Force
    }
    else {
        "source .env not found" | Set-Content -Path $envBackupPath -Encoding utf8
    }
}

Write-Step -Title "Export PostgreSQL data" -Action {
    & docker compose exec -T postgres sh -lc "rm -f $dbDumpContainerPath" *> $null

    & docker compose exec -T postgres pg_dump -U $DatabaseUser -d $DatabaseName -Fc -f $dbDumpContainerPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed."
    }

    & docker compose cp "postgres:$dbDumpContainerPath" "$dbDumpLocalPath"
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose cp for PostgreSQL dump failed."
    }

    & docker compose exec -T postgres sh -lc "rm -f $dbDumpContainerPath" *> $null
}

Write-Step -Title "Export MinIO objects" -Action {
    if (Test-Path $minioSnapshotRoot) {
        Remove-Item -Recurse -Force $minioSnapshotRoot
    }
    New-Item -ItemType Directory -Force -Path $minioSnapshotRoot | Out-Null

    & docker compose cp "minio:/data" "$minioSnapshotRoot"
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose cp for MinIO data directory failed."
    }

    $copiedDataPath = Join-Path $minioSnapshotRoot "data"
    if (-not (Test-Path $copiedDataPath)) {
        throw "Copied MinIO data directory not found at: $copiedDataPath"
    }

    if (Test-Path $minioArchiveLocalPath) {
        Remove-Item -Force $minioArchiveLocalPath
    }
    Compress-Archive -Path $copiedDataPath -DestinationPath $minioArchiveLocalPath -Force
    Remove-Item -Recurse -Force $minioSnapshotRoot
}

Write-Step -Title "Write required-font report" -Action {
    $requiredFonts = @("方正小标宋简", "仿宋_GB2312", "楷体_GB2312", "黑体")

    try {
        $fontNames = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts").PSObject.Properties.Name
        $lines = foreach ($font in $requiredFonts) {
            "{0}={1}" -f $font, [bool]($fontNames -match [Regex]::Escape($font))
        }
        $lines | Set-Content -Path $fontReportPath -Encoding utf8
    }
    catch {
        "font check unavailable on this system: $($_.Exception.Message)" | Set-Content -Path $fontReportPath -Encoding utf8
    }
}

Write-Step -Title "Write checksums" -Action {
    $hashes = Get-FileHash -Algorithm SHA256 $dbDumpLocalPath, $minioArchiveLocalPath
    $hashes |
        Select-Object Path, Hash |
        Format-Table -AutoSize |
        Out-String |
        Set-Content -Path $checksumPath -Encoding utf8
}

Write-Step -Title "Write manifest" -Action {
    $manifest = [ordered]@{
        generatedAtUtc      = [DateTime]::UtcNow.ToString("o")
        machine             = $env:COMPUTERNAME
        backupDir           = $BackupDir
        databaseName        = $DatabaseName
        databaseDumpFile    = "public_text.dump"
        databaseDumpBytes   = (Get-Item $dbDumpLocalPath).Length
        minioArchiveFile    = "minio_data.zip"
        minioArchiveBytes   = (Get-Item $minioArchiveLocalPath).Length
        includesEnvFile     = (Test-Path $envBackupPath)
        gitInfoFile         = "git-info.txt"
        fontReportFile      = "font-check.txt"
        checksumsFile       = "checksums.txt"
    }

    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding utf8
}

Write-Host "`nBackup completed." -ForegroundColor Green
Write-Host "Backup directory: $BackupDir"
