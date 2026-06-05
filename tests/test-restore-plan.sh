#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-restore-plan.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"
PLAN_HOME="$TMP_ROOT/plan-home"

mkdir -p "$SRC_HOME/.codex" "$PLAN_HOME/.codex"
print 'config-ok' > "$SRC_HOME/.codex/config.toml"
print 'do-not-touch' > "$PLAN_HOME/.codex/config.toml"

HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$OUT_DIR" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
./scripts/codexbackup.sh >/dev/null

ARCHIVE="$(find "$OUT_DIR" -maxdepth 1 -name 'codex-backup-*.tar.gz' -print | sort | tail -1)"
PLAN_OUTPUT="$TMP_ROOT/plan.txt"

HOME="$PLAN_HOME" ./scripts/codexrestore.sh --plan --archive "$ARCHIVE" >"$PLAN_OUTPUT"

grep -Fq 'Codex restore plan' "$PLAN_OUTPUT"
grep -Fq "Archive: $ARCHIVE" "$PLAN_OUTPUT"
grep -Fq 'Will create safety backup under:' "$PLAN_OUTPUT"
grep -Fq 'Would restore if present:' "$PLAN_OUTPUT"
grep -Fxq 'do-not-touch' "$PLAN_HOME/.codex/config.toml"

echo 'Restore plan check passed.'
