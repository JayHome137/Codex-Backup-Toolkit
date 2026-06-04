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
assert_file examples/local.env
assert_file examples/smb.env
assert_file examples/webdav.env
assert_file examples/rclone.env
assert_file tests/test-local-e2e.sh
assert_file tests/test-encryption-e2e.sh
assert_file tests/test-install-validate.sh
assert_file tests/test-retention.sh

assert_executable scripts/codexbackup.sh
assert_executable scripts/codexrestore.sh
assert_executable scripts/codexinstallautomation.sh
assert_executable scripts/codexscheduledbackup.sh

assert_contains README.md 'Codex-Backup-toolkit'
assert_contains README.md 'codexbackup'
assert_contains README.md 'English README'
assert_contains README.md '--doctor'
assert_contains README.md 'CODEX_BACKUP_ENCRYPT'
assert_contains README.md 'CODEX_BACKUP_RETENTION_COUNT'
assert_contains README.md 'WebDAV'
assert_contains README.md 'rclone'
assert_contains README_EN.md 'Codex-Backup-toolkit'
assert_contains README_EN.md 'macOS-first backup and restore toolkit'
assert_contains docs/gui-design.md 'Raycast'
assert_contains docs/gui-design.md 'CCSWITCH'
assert_contains config.example.env 'CODEX_BACKUP_TARGET=(local|smb|webdav|rclone)'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_TARGET'
assert_contains scripts/codexbackup.sh '--doctor'
assert_contains scripts/codexbackup.sh '--list-targets'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_ENCRYPT'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_RETENTION_COUNT'
assert_contains scripts/codexbackup.sh 'CODEX_BACKUP_RETENTION_DAYS'
assert_contains scripts/codexbackup.sh 'age'
assert_contains scripts/codexbackup.sh 'webdav'
assert_contains scripts/codexbackup.sh 'rclone'
assert_contains scripts/codexinstallautomation.sh 'validate'
assert_contains .github/workflows/ci.yml 'test-open-source-framework'
assert_contains .github/workflows/ci.yml 'test-local-e2e'
assert_contains .github/workflows/ci.yml 'test-encryption-e2e'
assert_contains .github/workflows/ci.yml 'test-install-validate'
assert_contains .github/workflows/ci.yml 'test-retention'

for file in README.md config.example.env docs/*.md examples/*.env scripts/*.sh; do
  assert_not_contains "$file" '192\.168\.1\.6'
  assert_not_contains "$file" 'j[a]ymain'
  assert_not_contains "$file" 'com\.jay\.codex-backup'
done

for script in scripts/*.sh tests/*.sh; do
  zsh -n "$script" || fail "syntax check failed: $script"
done

print -- "Open-source framework checks passed."
