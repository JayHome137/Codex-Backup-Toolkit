#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-retention.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project"
print 'retention-config' > "$SRC_HOME/.codex/config.toml"
print 'retention-workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

for index in 1 2 3; do
  HOME="$SRC_HOME" \
  CODEX_BACKUP_TARGET=local \
  CODEX_BACKUP_LOCAL_DIR="$OUT_DIR" \
  CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
  CODEX_BACKUP_RETENTION_COUNT=2 \
  ./scripts/codexbackup.sh >/dev/null
  sleep 1
done

ARCHIVE_COUNT="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$ARCHIVE_COUNT" == "2" ]] || { echo "expected 2 retained archives, got $ARCHIVE_COUNT" >&2; exit 1; }

for archive in "$OUT_DIR"/codex-backup-*.tar.gz; do
  [[ -f "${archive}.sha256" ]] || { echo "missing sha256 for $archive" >&2; exit 1; }
done

echo "Retention count check passed."
