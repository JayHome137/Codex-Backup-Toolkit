param(
  [ValidateSet('status','install','uninstall','run')]
  [string]$Action = 'status',
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

Write-Output 'CodexBackup Windows Task Scheduler preview'
Write-Output "Action: $Action"

if ($ValidateOnly) {
  Write-Output 'ValidateOnly: true'
  Write-Output 'Task Scheduler integration is planned for Windows.'
  Write-Output 'No scheduled tasks were changed.'
  exit 0
}

Write-Error 'Task Scheduler mutation is not enabled in this preview. Use -ValidateOnly.'
