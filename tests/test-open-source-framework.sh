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

assert_executable() {
  [[ -x "$1" ]] || fail "not executable: $1"
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  grep -Eq -- "$pattern" "$file" || fail "$file does not contain pattern: $pattern"
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  if grep -Eq -- "$pattern" "$file"; then
    fail "$file contains forbidden pattern: $pattern"
  fi
}

assert_file README.md
assert_file README_EN.md
assert_file LICENSE
assert_file .gitignore
assert_file config.example.env
assert_file docs/security.md
assert_file docs/cli-reference.md
assert_file docs/storage-targets.md
assert_file docs/restore-guide.md
assert_file docs/roadmap.md
assert_file docs/gui-design.md
assert_file docs/release-checklist.md
assert_file CONTRIBUTING.md
assert_file CHANGELOG.md
assert_file .github/workflows/ci.yml
assert_file .github/ISSUE_TEMPLATE/bug_report.yml
assert_file .github/ISSUE_TEMPLATE/feature_request.yml
assert_file gui/package.json
assert_file gui/src/lib/helperApi.ts
assert_file helper/profile-paths.mjs
assert_file gui/src/lib/desktopBridge.ts
assert_file gui/scripts/desktop-check.mjs
assert_file gui/scripts/desktop-checksum.mjs
assert_file gui/scripts/desktop-smoke.mjs
assert_file gui/src-tauri/Cargo.toml
assert_file gui/src-tauri/tauri.conf.json
assert_file gui/src-tauri/src/lib.rs
assert_file gui/src-tauri/icons/icon.icns
assert_file gui/src-tauri/icons/icon.png
assert_file gui/src-tauri/icons/128x128.png
assert_file gui/src-tauri/icons/512x512.png
assert_file examples/local.env
assert_file examples/smb.env
assert_file examples/webdav.env
assert_file examples/rclone.env
assert_file tests/test-local-e2e.sh
assert_file tests/test-encryption-e2e.sh
assert_file tests/test-install-validate.sh
assert_file tests/test-retention.sh
assert_file tests/test-remote-latest-restore.sh
assert_file tests/test-remote-retention.sh
assert_file tests/test-sync-local-authoritative.sh
assert_file tests/test-scheduled-sync-mode.sh
assert_file tests/test-profile-plan.sh
assert_file tests/test-restore-plan.sh

assert_executable scripts/codexbackup.sh
assert_executable scripts/codexrestore.sh
assert_executable scripts/codexinstallautomation.sh
assert_executable scripts/codexscheduledbackup.sh

assert_contains README.md 'Codex-Backup-toolkit'
assert_contains README.md 'codexbackup'
assert_contains README.md 'English README'
assert_contains README.md '--doctor'
assert_contains README.md '--config-guide'
assert_contains README.md 'CODEX_BACKUP_ENCRYPT'
assert_contains README.md 'CODEX_BACKUP_RETENTION_COUNT'
assert_contains README.md 'CODEX_BACKUP_REMOTE_RETENTION'
assert_contains README.md 'WebDAV'
assert_contains README.md 'rclone'
assert_contains README.md 'codexrestore.sh --latest'
assert_contains README.md 'codexrestore.sh --plan'
assert_contains README.md 'docs/cli-reference.md'
assert_contains README.md 'Windows 支持已纳入后续路线'
assert_contains README_EN.md 'Codex-Backup-toolkit'
assert_contains README_EN.md 'macOS-first backup and restore toolkit'
assert_contains README_EN.md 'Windows support is now part of the roadmap'
assert_contains README_EN.md 'Restore the latest WebDAV or rclone backup'
assert_contains gui/package.json '"version": "0\.27\.0"'
assert_file gui/src/lib/backupHealth.ts
assert_file gui/src/lib/firstRunJourney.ts
assert_file gui/src/lib/firstUsePath.ts
assert_file gui/src/lib/dailyUsageStatus.ts
assert_contains gui/package.json '"desktop:build"'
assert_contains gui/package.json '"desktop:checksum"'
assert_contains gui/package.json '"desktop:smoke"'
assert_contains gui/src-tauri/tauri.conf.json '"productName": "CodexBackup"'
assert_contains gui/src-tauri/tauri.conf.json '"../../helper/server\.mjs"'
assert_contains gui/src-tauri/tauri.conf.json '"toolkit/helper/server\.mjs"'
assert_contains gui/src-tauri/tauri.conf.json '"icons/icon\.icns"'
assert_contains gui/src-tauri/tauri.conf.json '"../../scripts"'
assert_contains gui/src-tauri/tauri.conf.json '"toolkit/scripts"'
assert_contains gui/src-tauri/src/lib.rs 'helper_start'
assert_contains gui/src-tauri/src/lib.rs 'helper_stop'
assert_contains gui/src-tauri/src/lib.rs 'helper_request'
assert_contains gui/src-tauri/src/lib.rs 'open_path'
assert_contains gui/src-tauri/src/lib.rs 'toolkit_status'
assert_contains gui/src-tauri/src/lib.rs 'desktop_diagnostics'
assert_contains docs/gui-design.md 'Raycast'
assert_contains docs/gui-design.md 'CCSWITCH'
assert_contains config.example.env 'CODEX_BACKUP_TARGET=(local|smb|webdav|rclone)'
assert_contains config.example.env 'CODEX_BACKUP_REMOTE_RETENTION=0'
assert_contains config.example.env 'CODEX_BACKUP_SYNC_ENABLED=0'
assert_contains config.example.env 'CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=24'
assert_contains config.example.env 'CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=24'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_TARGET'
assert_contains scripts/codexbackup.sh '--doctor'
assert_contains scripts/codexbackup.sh '--config-guide'
assert_contains scripts/codexbackup.sh '--list-targets'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_ENCRYPT'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_RETENTION_COUNT'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_RETENTION_DAYS'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_REMOTE_RETENTION'
assert_contains scripts/codexbackup.sh '--sync-check'
assert_contains scripts/codexbackup.sh '--sync-local-authoritative'
assert_contains scripts/codexbackup.sh '--profile-plan'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS'
assert_contains scripts/codexbackup.sh 'age'
assert_contains scripts/codexbackup.sh 'webdav'
assert_contains scripts/codexbackup.sh 'rclone'
assert_contains scripts/codexrestore.sh 'download_webdav_latest'
assert_contains scripts/codexrestore.sh 'download_rclone_latest'
assert_contains scripts/codexrestore.sh '--plan'
assert_contains docs/cli-reference.md 'codexbackup'
assert_contains docs/cli-reference.md 'codexrestore'
assert_contains docs/cli-reference.md 'codexinstallautomation'
assert_contains docs/cli-reference.md 'CODEX_BACKUP_SYNC_ENABLED'
assert_contains docs/cli-reference.md '--profile-plan'
assert_contains docs/cli-reference.md 'Windows'
assert_contains docs/roadmap.md 'Phase A\.2: Windows Support'
assert_contains docs/restore-guide.md 'CODEX_BACKUP_TARGET=webdav'
assert_contains docs/restore-guide.md 'CODEX_BACKUP_TARGET=rclone'
assert_contains scripts/codexinstallautomation.sh 'validate'
assert_contains .github/workflows/ci.yml 'test-open-source-framework'
assert_contains .github/workflows/ci.yml 'test-config-guide'
assert_contains .github/workflows/ci.yml 'test-restore-plan'
assert_contains .github/workflows/ci.yml 'test-local-e2e'
assert_contains .github/workflows/ci.yml 'test-encryption-e2e'
assert_contains .github/workflows/ci.yml 'test-install-validate'
assert_contains .github/workflows/ci.yml 'test-retention'
assert_contains .github/workflows/ci.yml 'test-remote-latest-restore'
assert_contains .github/workflows/ci.yml 'test-remote-retention'
assert_contains .github/workflows/ci.yml 'test-sync-local-authoritative'
assert_contains .github/workflows/ci.yml 'test-scheduled-sync-mode'
assert_contains .github/workflows/ci.yml 'test-profile-plan'
assert_contains .github/workflows/ci.yml 'helper/\*\.test\.mjs'

for file in README.md config.example.env docs/*.md examples/*.env scripts/*.sh; do
  assert_not_contains "$file" '192\.168\.1\.6'
  assert_not_contains "$file" 'j[a]ymain'
  assert_not_contains "$file" 'com\.jay\.codex-backup'
done

for script in scripts/*.sh tests/*.sh; do
  zsh -n "$script" || fail "syntax check failed: $script"
done

print -- "Open-source framework checks passed."
