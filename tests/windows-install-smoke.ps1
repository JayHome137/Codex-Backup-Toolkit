$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

$PackageJson = Get-Content -LiteralPath (Join-Path $Root 'gui\package.json') -Raw | ConvertFrom-Json
$Version = $PackageJson.version
$BundleRoot = Join-Path $Root 'gui\src-tauri\target\release\bundle'
$Msi = Get-ChildItem -LiteralPath $BundleRoot -Recurse -Filter '*.msi' -File |
  Where-Object { $_.Name -like "*$Version*" } |
  Sort-Object FullName |
  Select-Object -First 1

if (-not $Msi) {
  throw "missing Windows MSI installer for version $Version under $BundleRoot"
}

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codexbackup-windows-install-smoke-" + [System.Guid]::NewGuid().ToString('N'))
$InstallRoot = Join-Path $TempRoot 'admin-install'
$LogPath = Join-Path $TempRoot 'msiexec-admin.log'
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

try {
  $arguments = @('/a', $Msi.FullName, '/qn', "TARGETDIR=$InstallRoot", '/L*v', $LogPath)
  $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    $tail = if (Test-Path -LiteralPath $LogPath) { (Get-Content -LiteralPath $LogPath -Tail 80) -join "`n" } else { 'msiexec log missing' }
    throw "MSI administrative install failed with exit code $($process.ExitCode)`n$tail"
  }

  $exe = Get-ChildItem -LiteralPath $InstallRoot -Recurse -Filter 'CodexBackup.exe' -File | Select-Object -First 1
  if (-not $exe) { throw 'installed layout is missing CodexBackup.exe' }
  if ($exe.Length -le 0) { throw "installed CodexBackup.exe is empty: $($exe.FullName)" }

  $requiredNames = @(
    'toolkit\helper\server.mjs',
    'toolkit\helper\actions.mjs',
    'toolkit\helper\allowlist.mjs',
    'toolkit\scripts\windows\codexbackup.ps1',
    'toolkit\scripts\windows\codexrestore.ps1',
    'toolkit\scripts\windows\codexcredential.ps1',
    'toolkit\scripts\windows\codexscheduledbackup.ps1',
    'toolkit\config.example.env',
    'toolkit\examples\local.env'
  )

  $files = Get-ChildItem -LiteralPath $InstallRoot -Recurse -File
  foreach ($name in $requiredNames) {
    $match = $files | Where-Object { $_.FullName.EndsWith($name, [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
    if (-not $match) { throw "installed layout is missing $name" }
    if ($match.Length -le 0) { throw "installed file is empty: $($match.FullName)" }
  }

  $credentialScript = $files | Where-Object { $_.FullName.EndsWith('toolkit\scripts\windows\codexcredential.ps1', [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
  $scheduleScript = $files | Where-Object { $_.FullName.EndsWith('toolkit\scripts\windows\codexscheduledbackup.ps1', [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
  $credentialText = Get-Content -LiteralPath $credentialScript.FullName -Raw
  $scheduleText = Get-Content -LiteralPath $scheduleScript.FullName -Raw
  if ($credentialText -notmatch 'ValidateOnly' -or $credentialText -notmatch 'No credentials were changed') {
    throw 'installed credential script lost validate-only safety boundary'
  }
  if ($scheduleText -notmatch 'ValidateOnly' -or $scheduleText -notmatch 'No scheduled tasks were changed') {
    throw 'installed scheduler script lost validate-only safety boundary'
  }

  Write-Output "Windows install layout smoke passed."
  Write-Output "MSI: $($Msi.FullName)"
  Write-Output "InstallRoot: $InstallRoot"
  Write-Output "App: $($exe.FullName)"
} finally {
  Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
