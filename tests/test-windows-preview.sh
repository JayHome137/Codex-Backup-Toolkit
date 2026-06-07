#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

fail() {
  print -u2 -- "FAIL: $*"
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  grep -Eq -- "$pattern" "$file" || fail "$file does not contain pattern: $pattern"
}

assert_file scripts/windows/codexbackup.ps1
assert_file scripts/windows/codexrestore.ps1
assert_file scripts/windows/codexcredential.ps1
assert_file scripts/windows/codexscheduledbackup.ps1
assert_file scripts/windows/README.md
assert_file docs/windows.md
assert_file gui/src-tauri/tauri.windows.conf.json
assert_file gui/scripts/windows-desktop-smoke.mjs
assert_file gui/scripts/windows-installer-smoke.mjs
assert_file tests/windows-native.ps1

assert_contains scripts/windows/codexbackup.ps1 'param\('
assert_contains scripts/windows/codexbackup.ps1 'ProfilePlan'
assert_contains scripts/windows/codexbackup.ps1 'Doctor'
assert_contains scripts/windows/codexbackup.ps1 'Target'
assert_contains scripts/windows/codexbackup.ps1 'Compress-Archive'
assert_contains scripts/windows/codexbackup.ps1 'Get-FileHash'
assert_contains scripts/windows/codexbackup.ps1 'CODEX_BACKUP_HOME'
assert_contains scripts/windows/codexbackup.ps1 'Status: preview'
assert_contains scripts/windows/codexbackup.ps1 'Windows real backup is preview-only'

assert_contains scripts/windows/codexrestore.ps1 'Plan'
assert_contains scripts/windows/codexrestore.ps1 'No files were changed'
assert_contains scripts/windows/codexrestore.ps1 'Real restore execution is not enabled'
assert_contains scripts/windows/codexrestore.ps1 'CODEX_BACKUP_HOME'

assert_contains scripts/windows/codexcredential.ps1 'Credential Manager'
assert_contains scripts/windows/codexcredential.ps1 'ValidateOnly'
assert_contains scripts/windows/codexcredential.ps1 'No credentials were changed'

assert_contains scripts/windows/codexscheduledbackup.ps1 'Task Scheduler'
assert_contains scripts/windows/codexscheduledbackup.ps1 'ValidateOnly'
assert_contains scripts/windows/codexscheduledbackup.ps1 'No scheduled tasks were changed'

assert_contains docs/windows.md 'Windows 预览'
assert_contains docs/windows.md '不会安装、修改或删除任务计划程序任务'
assert_contains docs/windows.md '真实恢复仍未启用'
assert_contains docs/windows.md '签名.*安装后 smoke'
assert_contains docs/windows.md '待完成'

assert_contains gui/src-tauri/tauri.windows.conf.json '"targets": \["msi", "nsis"\]'
assert_contains gui/scripts/windows-installer-smoke.mjs '\.msi'
assert_contains gui/scripts/windows-installer-smoke.mjs '\.exe'
assert_contains gui/scripts/windows-installer-smoke.mjs 'desktop:build:windows'
assert_contains gui/package.json 'desktop:smoke:windows'
assert_contains gui/package.json 'desktop:build:windows'
assert_contains gui/package.json 'desktop:smoke:windows-installer'
assert_contains README.md 'Windows 预览'
assert_contains README_EN.md 'Windows preview'
assert_contains .github/workflows/ci.yml 'windows-latest'
assert_contains .github/workflows/ci.yml 'tests\\windows-native\.ps1'
assert_contains .github/workflows/ci.yml 'windows-native'
assert_contains .github/workflows/ci.yml 'desktop:build:windows'
assert_contains .github/workflows/ci.yml 'desktop:smoke:windows-installer'
assert_contains .github/workflows/ci.yml 'upload-artifact'
assert_contains README.md 'windows-latest'
assert_contains docs/windows.md 'tests/windows-native\.ps1'

node gui/scripts/windows-desktop-smoke.mjs

echo 'Windows preview checks passed.'
