param(
  [ValidateSet('status','save','delete')]
  [string]$Action = 'status',
  [string]$Target = 'local',
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

Write-Output 'CodexBackup Windows Credential Manager preview'
Write-Output "Action: $Action"
Write-Output "Target: $Target"

if ($ValidateOnly) {
  Write-Output 'ValidateOnly: true'
  Write-Output 'Credential Manager integration is planned for Windows.'
  Write-Output 'No credentials were changed.'
  exit 0
}

Write-Error 'Credential Manager mutation is not enabled in this preview. Use -ValidateOnly.'
