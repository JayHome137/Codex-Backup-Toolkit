#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

if ! command -v age >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
  echo "Skipping encryption e2e: age and age-keygen are not installed."
  exit 0
fi

TMP_ROOT="$(mktemp -d /tmp/codexbackup-encryption-e2e.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
DST_HOME="$TMP_ROOT/dst-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"
IDENTITY="$TMP_ROOT/age-identity.txt"

age-keygen -o "$IDENTITY" >/dev/null 2>&1
RECIPIENT="$(sed -n 's/^# public key: //p' "$IDENTITY")"
[[ -n "$RECIPIENT" ]] || { echo "Could not read age recipient" >&2; exit 1; }

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project"
print 'encrypted-config-ok' > "$SRC_HOME/.codex/config.toml"
print 'encrypted-workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$OUT_DIR" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
CODEX_BACKUP_ENCRYPT=1 \
CODEX_BACKUP_AGE_RECIPIENT="$RECIPIENT" \
./scripts/codexbackup.sh >/dev/null

ARCHIVE="$(find "$OUT_DIR" -maxdepth 1 -name 'codex-backup-*.tar.gz.age' -print | sort | tail -1)"
[[ -f "$ARCHIVE" ]] || { echo "No encrypted archive created" >&2; exit 1; }

HOME="$DST_HOME" ./scripts/codexrestore.sh --archive "$ARCHIVE" --age-identity "$IDENTITY" --yes >/dev/null

grep -Fxq 'encrypted-config-ok' "$DST_HOME/.codex/config.toml"
grep -Fxq 'encrypted-workspace' "$DST_HOME/Documents/Codex/project/readme.txt"

echo "Encrypted backup/restore e2e passed."
