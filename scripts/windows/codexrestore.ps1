param(
  [string]$Archive,
  [switch]$Latest,
  [ValidateSet('local','smb','webdav','rclone')]
  [string]$Target = $(if ($env:CODEX_BACKUP_TARGET) { $env:CODEX_BACKUP_TARGET } else { 'local' }),
  [string]$LocalDir = $(if ($env:CODEX_BACKUP_LOCAL_DIR) { $env:CODEX_BACKUP_LOCAL_DIR } else { Join-Path $HOME 'CodexBackups' }),
  [switch]$Plan
)

$ErrorActionPreference = 'Stop'
$CodexHome = if ($env:CODEX_BACKUP_HOME) { $env:CODEX_BACKUP_HOME } else { $HOME }
$AppDataDir = if ($env:APPDATA) { $env:APPDATA } else { Join-Path $CodexHome 'AppData\Roaming' }
$LocalAppDataDir = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $CodexHome 'AppData\Local' }
$DocumentsDir = if ($env:CODEX_BACKUP_DOCUMENTS_DIR) { $env:CODEX_BACKUP_DOCUMENTS_DIR } else { Join-Path $CodexHome 'Documents' }

if (-not $Plan) {
  Write-Error 'Real restore execution is not enabled in the Windows preview. Re-run with -Plan.'
}

if ($Latest -and $Archive) {
  Write-Error 'Use either -Latest or -Archive, not both.'
}

if ($Latest) {
  if ($Target -ne 'local') {
    Write-Error 'Windows restore plan preview currently supports latest lookup for local target only.'
  }
  $Archive = Get-ChildItem -LiteralPath $LocalDir -Filter 'codex-backup-*.zip' -File -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -Last 1 |
    ForEach-Object { $_.FullName }
}

if ([string]::IsNullOrWhiteSpace($Archive)) {
  Write-Error 'Missing -Archive or -Latest.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$safetyDir = if ($env:CODEX_RESTORE_SAFETY_DIR) { $env:CODEX_RESTORE_SAFETY_DIR } else { Join-Path $HOME 'CodexRestoreSafetyBackups' }

Write-Output 'Codex restore plan'
Write-Output 'Platform: win32'
Write-Output 'Status: preview'
Write-Output "Archive: $Archive"
Write-Output "Target home: $CodexHome"
Write-Output 'Will create safety backup under:'
Write-Output "  $(Join-Path $safetyDir "codex-before-restore-$timestamp.zip")"
Write-Output "Would verify checksum: $([bool](Test-Path -LiteralPath "$Archive.sha256"))"
Write-Output 'Would restore if present:'
Write-Output "  home/.codex -> $(Join-Path $CodexHome '.codex')"
Write-Output "  AppData/Roaming/Codex -> $(Join-Path $AppDataDir 'Codex')"
Write-Output "  AppData/Roaming/OpenAI -> $(Join-Path $AppDataDir 'OpenAI')"
Write-Output "  AppData/Local/Codex -> $(Join-Path $LocalAppDataDir 'Codex')"
Write-Output "  Documents/Codex -> $(Join-Path $DocumentsDir 'Codex')"
Write-Output 'Real restore execution is not enabled.'
Write-Output 'No files were changed.'
