#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-local-e2e.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
DST_HOME="$TMP_ROOT/dst-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Library/Application Support/Codex" "$SRC_HOME/Documents/Codex/project"
print 'config-ok' > "$SRC_HOME/.codex/config.toml"
print 'app-state' > "$SRC_HOME/Library/Application Support/Codex/state.txt"
print 'workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$OUT_DIR" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
./scripts/codexbackup.sh >/dev/null

ARCHIVE="$(find "$OUT_DIR" -maxdepth 1 -name 'codex-backup-*.tar.gz' -print | sort | tail -1)"
[[ -f "$ARCHIVE" ]] || { echo "No archive created" >&2; exit 1; }

HOME="$DST_HOME" ./scripts/codexrestore.sh --archive "$ARCHIVE" --yes >/dev/null

grep -Fxq 'config-ok' "$DST_HOME/.codex/config.toml"
grep -Fxq 'workspace' "$DST_HOME/Documents/Codex/project/readme.txt"

echo "Local backup/restore e2e passed."
