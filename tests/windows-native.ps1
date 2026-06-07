$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codexbackup-windows-native-" + [System.Guid]::NewGuid().ToString('N'))
$SrcHome = Join-Path $TempRoot 'src-home'
$OutDir = Join-Path $TempRoot 'out'

New-Item -ItemType Directory -Force -Path (Join-Path $SrcHome '.codex') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SrcHome 'AppData\Roaming\Codex') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SrcHome 'Documents\Codex\project') | Out-Null
Set-Content -LiteralPath (Join-Path $SrcHome '.codex\config.toml') -Value 'config-ok' -Encoding UTF8
Set-Content -LiteralPath (Join-Path $SrcHome 'AppData\Roaming\Codex\state.txt') -Value 'app-state' -Encoding UTF8
Set-Content -LiteralPath (Join-Path $SrcHome 'Documents\Codex\project\readme.txt') -Value 'workspace' -Encoding UTF8

$env:CODEX_BACKUP_HOME = $SrcHome
$env:APPDATA = Join-Path $SrcHome 'AppData\Roaming'
$env:LOCALAPPDATA = Join-Path $SrcHome 'AppData\Local'
$env:CODEX_BACKUP_DOCUMENTS_DIR = Join-Path $SrcHome 'Documents'
$env:CODEX_BACKUP_LOCAL_DIR = $OutDir

try {
  $profilePlan = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexbackup.ps1 -ProfilePlan
  if (($profilePlan -join "`n") -notmatch 'Platform: win32') { throw 'profile plan missing win32 platform' }
  if (($profilePlan -join "`n") -notmatch 'Status: preview') { throw 'profile plan missing preview status' }

  $doctor = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexbackup.ps1 -Doctor -Target local
  if (($doctor -join "`n") -notmatch 'Doctor passed') { throw 'doctor did not pass' }

  $backup = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexbackup.ps1 -Target local -LocalOutput $OutDir
  if (($backup -join "`n") -notmatch 'Backup written to') { throw 'backup output missing archive paths' }

  $archive = Get-ChildItem -LiteralPath $OutDir -Filter 'codex-backup-*.zip' -File | Sort-Object Name | Select-Object -Last 1
  if (-not $archive) { throw 'no Windows zip archive was created' }
  if (-not (Test-Path -LiteralPath "$($archive.FullName).sha256")) { throw 'missing Windows sha256 sidecar' }
  $manifest = Get-ChildItem -LiteralPath $OutDir -Filter 'codex-backup-*.manifest.txt' -File | Select-Object -First 1
  if (-not $manifest) { throw 'missing Windows manifest sidecar' }

  $extractDir = Join-Path $TempRoot 'extract'
  Expand-Archive -LiteralPath $archive.FullName -DestinationPath $extractDir -Force
  if ((Get-Content -LiteralPath (Join-Path $extractDir 'home\.codex\config.toml') -Raw).Trim() -ne 'config-ok') { throw 'archive missing .codex config' }
  if ((Get-Content -LiteralPath (Join-Path $extractDir 'Documents\Codex\project\readme.txt') -Raw).Trim() -ne 'workspace') { throw 'archive missing workspace file' }

  $restorePlan = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexrestore.ps1 -Plan -Archive $archive.FullName
  if (($restorePlan -join "`n") -notmatch 'No files were changed') { throw 'restore plan must not change files' }
  if (($restorePlan -join "`n") -notmatch 'Real restore execution is not enabled') { throw 'restore plan missing safety boundary' }

  $credentialCheck = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexcredential.ps1 -ValidateOnly
  if (($credentialCheck -join "`n") -notmatch 'No credentials were changed') { throw 'credential validate-only boundary missing' }

  $scheduleCheck = pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\codexscheduledbackup.ps1 -ValidateOnly
  if (($scheduleCheck -join "`n") -notmatch 'No scheduled tasks were changed') { throw 'schedule validate-only boundary missing' }

  Write-Output 'Windows native preview checks passed.'
} finally {
  Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
