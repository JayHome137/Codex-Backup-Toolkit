#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-sync-local.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"
STATE_DIR="$TMP_ROOT/state"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project"
print 'sync-config-v1' > "$SRC_HOME/.codex/config.toml"
print 'sync-workspace-v1' > "$SRC_HOME/Documents/Codex/project/readme.txt"

BASE_ENV=(
  HOME="$SRC_HOME"
  CODEX_BACKUP_TARGET=local
  CODEX_BACKUP_LOCAL_DIR="$OUT_DIR"
  CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR"
  CODEX_BACKUP_STATE_DIR="$STATE_DIR"
  CODEX_BACKUP_RETENTION_COUNT=2
  CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=0
  CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=0
)

env "${BASE_ENV[@]}" ./scripts/codexbackup.sh --sync-check >"$TMP_ROOT/check-empty.out"
grep -Fq 'Sync status: missing-backup' "$TMP_ROOT/check-empty.out"

env "${BASE_ENV[@]}" ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-1.out"
grep -Fq 'Sync action: backup-created' "$TMP_ROOT/sync-1.out"

ARCHIVE_COUNT="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
FINGERPRINT_COUNT="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'codex-backup-*.fingerprint.txt' | wc -l | tr -d ' ')"
[[ "$ARCHIVE_COUNT" == "1" ]] || { echo "expected 1 archive after first sync, got $ARCHIVE_COUNT" >&2; exit 1; }
[[ "$FINGERPRINT_COUNT" == "1" ]] || { echo "expected 1 fingerprint after first sync, got $FINGERPRINT_COUNT" >&2; exit 1; }

env "${BASE_ENV[@]}" ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-2.out"
grep -Fq 'Sync action: already-consistent' "$TMP_ROOT/sync-2.out"

print 'sync-workspace-v2' > "$SRC_HOME/Documents/Codex/project/readme.txt"
sleep 1
env "${BASE_ENV[@]}" ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-3.out"
grep -Fq 'Sync action: backup-created' "$TMP_ROOT/sync-3.out"

ARCHIVE_COUNT="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$ARCHIVE_COUNT" == "2" ]] || { echo "expected 2 retained archives after second backup, got $ARCHIVE_COUNT" >&2; exit 1; }

print 'sync-workspace-v3' > "$SRC_HOME/Documents/Codex/project/readme.txt"
sleep 1
env "${BASE_ENV[@]}" ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-4.out"
grep -Fq 'Sync action: backup-created' "$TMP_ROOT/sync-4.out"

ARCHIVE_COUNT="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$ARCHIVE_COUNT" == "2" ]] || { echo "expected retention to keep 2 archives, got $ARCHIVE_COUNT" >&2; exit 1; }

print 'sync-workspace-v4' > "$SRC_HOME/Documents/Codex/project/readme.txt"
env "${BASE_ENV[@]}" CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=24 ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-cooldown.out"
grep -Fq 'Sync action: backup-cooldown' "$TMP_ROOT/sync-cooldown.out"

BEFORE_CHECK_STATE="$(cat "$STATE_DIR/last-sync-check-epoch")"
env "${BASE_ENV[@]}" CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=24 ./scripts/codexbackup.sh --sync-local-authoritative >"$TMP_ROOT/sync-check-interval.out"
grep -Fq 'Sync action: check-skipped' "$TMP_ROOT/sync-check-interval.out"
AFTER_CHECK_STATE="$(cat "$STATE_DIR/last-sync-check-epoch")"
[[ "$BEFORE_CHECK_STATE" == "$AFTER_CHECK_STATE" ]] || { echo "check interval skip should not update last check time" >&2; exit 1; }

echo "Local authoritative sync checks passed."
