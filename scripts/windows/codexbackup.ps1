param(
  [ValidateSet('local','smb','webdav','rclone')]
  [string]$Target = $(if ($env:CODEX_BACKUP_TARGET) { $env:CODEX_BACKUP_TARGET } else { 'local' }),
  [string]$LocalOutput = $(if ($env:CODEX_BACKUP_LOCAL_DIR) { $env:CODEX_BACKUP_LOCAL_DIR } else { Join-Path $HOME 'CodexBackups' }),
  [switch]$Doctor,
  [switch]$ProfilePlan,
  [ValidateSet('win32')]
  [string]$Platform = 'win32',
  [switch]$DryRun,
  [switch]$ListTargets
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolkitDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$HostNameSafe = ($env:COMPUTERNAME -replace '[^A-Za-z0-9._-]', '_')
if ([string]::IsNullOrWhiteSpace($HostNameSafe)) { $HostNameSafe = 'windows' }
$ArchiveBaseName = "codex-backup-$HostNameSafe-$Timestamp"

function Get-CodexProfileSources {
  $homeDir = $HOME
  $appDataDir = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $homeDir 'AppData\Roaming' }
  $localAppDataDir = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $homeDir 'AppData\Local' }
  $documentsDir = if ($env:CODEX_BACKUP_DOCUMENTS_DIR) { $env:CODEX_BACKUP_DOCUMENTS_DIR } else { Join-Path $homeDir 'Documents' }

  @(
    [pscustomobject]@{ SourcePath = Join-Path $homeDir '.codex'; ArchivePath = 'home/.codex' }
    [pscustomobject]@{ SourcePath = Join-Path $appDataDir 'Codex'; ArchivePath = 'AppData/Roaming/Codex' }
    [pscustomobject]@{ SourcePath = Join-Path $appDataDir 'OpenAI'; ArchivePath = 'AppData/Roaming/OpenAI' }
    [pscustomobject]@{ SourcePath = Join-Path $appDataDir 'OpenAI\Codex'; ArchivePath = 'AppData/Roaming/OpenAI/Codex' }
    [pscustomobject]@{ SourcePath = Join-Path $localAppDataDir 'Codex'; ArchivePath = 'AppData/Local/Codex' }
    [pscustomobject]@{ SourcePath = Join-Path $documentsDir 'Codex'; ArchivePath = 'Documents/Codex' }
  )
}

function Write-ProfilePlan {
  Write-Output 'Codex profile path plan'
  Write-Output 'Profile: codex'
  Write-Output 'Platform: win32'
  Write-Output 'Status: preview'
  Write-Output ''
  Write-Output 'Sources:'
  foreach ($source in Get-CodexProfileSources) {
    Write-Output "  $($source.SourcePath) -> $($source.ArchivePath)"
  }
  Write-Output ''
  Write-Output 'Notes:'
  Write-Output '  - Windows real backup is preview-only until verified on a Windows runner.'
  Write-Output '  - Real restore execution is not enabled.'
}

function Invoke-Doctor {
  $failures = 0
  Write-Output 'codexbackup doctor'
  Write-Output 'Platform: win32'
  Write-Output 'Status: preview'
  Write-Output "Target: $Target"

  if (Get-Command powershell -ErrorAction SilentlyContinue) { Write-Output 'ok: powershell available' } else { Write-Output 'warn: powershell command not found in PATH' }
  if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) { Write-Output 'ok: Compress-Archive available' } else { Write-Output 'fail: Compress-Archive available'; $failures++ }
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) { Write-Output 'ok: Get-FileHash available' } else { Write-Output 'fail: Get-FileHash available'; $failures++ }

  foreach ($source in Get-CodexProfileSources) {
    if (Test-Path -LiteralPath $source.SourcePath) { Write-Output "ok: $($source.SourcePath) exists" } else { Write-Output "warn: $($source.SourcePath) missing" }
  }

  if ($Target -eq 'local') {
    $parent = Split-Path -Parent $LocalOutput
    if ([string]::IsNullOrWhiteSpace($parent)) { $parent = $PWD.Path }
    if (Test-Path -LiteralPath $LocalOutput) {
      Write-Output "ok: local target exists: $LocalOutput"
    } elseif (Test-Path -LiteralPath $parent) {
      Write-Output "ok: local target can be created: $LocalOutput"
      Write-Output "warn: local target directory does not exist yet: $LocalOutput"
    } else {
      Write-Output "fail: local target parent missing: $parent"
      $failures++
    }
  } else {
    Write-Output "warn: $Target target validation is planned for Windows preview; use macOS CLI for verified backups today."
  }

  if ($failures -gt 0) {
    Write-Output "Doctor found $failures issue(s)."
    exit 1
  }
  Write-Output 'Doctor passed.'
}

function Write-DryRun {
  Write-Output 'codexbackup dry run'
  Write-Output 'Platform: win32'
  Write-Output 'Status: preview'
  Write-Output "Target: $Target"
  Write-Output "Archive: $ArchiveBaseName.zip"
  Write-Output 'Would inspect:'
  foreach ($source in Get-CodexProfileSources) {
    Write-Output "  $($source.SourcePath)"
  }
  Write-Output 'No files were changed.'
}

function Invoke-PreviewBackup {
  if ($Target -ne 'local') {
    Write-Error 'Windows preview backup currently supports local target only. SMB, WebDAV, and rclone are planned.'
  }

  New-Item -ItemType Directory -Force -Path $LocalOutput | Out-Null
  $workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-backup-win32-" + [System.Guid]::NewGuid().ToString('N'))
  $stage = Join-Path $workRoot 'staging'
  New-Item -ItemType Directory -Force -Path $stage | Out-Null

  $manifest = Join-Path $workRoot "$ArchiveBaseName.manifest.txt"
  $manifestLines = @(
    'Codex backup manifest',
    "Created: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))",
    "Source home: $HOME",
    "Source host: $HostNameSafe",
    'Profile: codex',
    'Platform: win32',
    'Status: preview',
    "Target: $Target",
    ''
  )

  foreach ($source in Get-CodexProfileSources) {
    $dest = Join-Path $stage ($source.ArchivePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
    if (Test-Path -LiteralPath $source.SourcePath) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
      Copy-Item -LiteralPath $source.SourcePath -Destination $dest -Recurse -Force
      $manifestLines += "included: $($source.SourcePath)"
    } else {
      $manifestLines += "missing:  $($source.SourcePath)"
    }
  }

  $manifestLines += ''
  $manifestLines += 'Archive format: zip'
  $manifestLines += 'Windows real backup is preview-only until verified on Windows.'
  Set-Content -LiteralPath $manifest -Value $manifestLines -Encoding UTF8
  Copy-Item -LiteralPath $manifest -Destination (Join-Path $stage 'MANIFEST.txt') -Force

  $archive = Join-Path $LocalOutput "$ArchiveBaseName.zip"
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -Force
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
  Set-Content -LiteralPath "$archive.sha256" -Value "$hash  $(Split-Path -Leaf $archive)" -Encoding UTF8
  Copy-Item -LiteralPath $manifest -Destination (Join-Path $LocalOutput (Split-Path -Leaf $manifest)) -Force

  Remove-Item -LiteralPath $workRoot -Recurse -Force
  Write-Output 'Codex backup'
  Write-Output 'Platform: win32'
  Write-Output 'Status: preview'
  Write-Output 'Backup written to:'
  Write-Output "  $archive"
  Write-Output "  $archive.sha256"
  Write-Output "  $(Join-Path $LocalOutput (Split-Path -Leaf $manifest))"
}

if ($ListTargets) {
  Write-Output 'local'
  Write-Output 'smb'
  Write-Output 'webdav'
  Write-Output 'rclone'
  exit 0
}

if ($ProfilePlan) { Write-ProfilePlan; exit 0 }
if ($Doctor) { Invoke-Doctor; exit 0 }
if ($DryRun) { Write-DryRun; exit 0 }

Invoke-PreviewBackup
