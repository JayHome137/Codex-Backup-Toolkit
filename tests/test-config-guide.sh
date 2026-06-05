#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_OUT="$(mktemp /tmp/codexbackup-config-guide.XXXXXX)"
trap 'rm -f "$TMP_OUT"' EXIT

./scripts/codexbackup.sh --config-guide --target webdav >"$TMP_OUT"

grep -Fq 'CodexBackup config guide' "$TMP_OUT"
grep -Fq 'Target: webdav' "$TMP_OUT"
grep -Fq 'CODEX_BACKUP_WEBDAV_URL=' "$TMP_OUT"
grep -Fq 'CODEX_BACKUP_WEBDAV_USER=' "$TMP_OUT"
grep -Fq 'CODEX_BACKUP_WEBDAV_PASSWORD' "$TMP_OUT"
grep -Fq 'CODEX_BACKUP_ENCRYPT=1' "$TMP_OUT"
grep -Fq 'CODEX_BACKUP_AGE_RECIPIENT' "$TMP_OUT"

./scripts/codexbackup.sh --config-guide --target rclone >"$TMP_OUT"
grep -Fq 'CODEX_BACKUP_RCLONE_REMOTE=' "$TMP_OUT"
grep -Fq 'rclone config' "$TMP_OUT"

echo 'Config guide checks passed.'
