#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-scheduled-sync.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SCRIPT_DIR="$TMP_ROOT/scripts"
mkdir -p "$SCRIPT_DIR"
cp scripts/codexscheduledbackup.sh "$SCRIPT_DIR/"
cat > "$SCRIPT_DIR/codexbackup.sh" <<'EOF'
#!/usr/bin/env zsh
print -- "$*" >> "$CODEX_BACKUP_FAKE_LOG"
EOF
chmod +x "$SCRIPT_DIR/codexbackup.sh" "$SCRIPT_DIR/codexscheduledbackup.sh"

CODEX_BACKUP_FAKE_LOG="$TMP_ROOT/calls-sync.log" \
CODEX_BACKUP_SYNC_ENABLED=1 \
CODEX_BACKUP_STATE_DIR="$TMP_ROOT/state-sync" \
"$SCRIPT_DIR/codexscheduledbackup.sh" >/dev/null

grep -Fxq -- '--sync-local-authoritative' "$TMP_ROOT/calls-sync.log"

mkdir -p "$TMP_ROOT/state-sync-recent"
date +%s > "$TMP_ROOT/state-sync-recent/last-success-epoch"
CODEX_BACKUP_FAKE_LOG="$TMP_ROOT/calls-sync-recent.log" \
CODEX_BACKUP_SYNC_ENABLED=1 \
CODEX_BACKUP_STATE_DIR="$TMP_ROOT/state-sync-recent" \
"$SCRIPT_DIR/codexscheduledbackup.sh" >/dev/null

grep -Fxq -- '--sync-local-authoritative' "$TMP_ROOT/calls-sync-recent.log"

CODEX_BACKUP_FAKE_LOG="$TMP_ROOT/calls-normal.log" \
CODEX_BACKUP_STATE_DIR="$TMP_ROOT/state-normal" \
"$SCRIPT_DIR/codexscheduledbackup.sh" >/dev/null

grep -Fxq -- '' "$TMP_ROOT/calls-normal.log"

mkdir -p "$TMP_ROOT/state-normal-recent"
date +%s > "$TMP_ROOT/state-normal-recent/last-success-epoch"
CODEX_BACKUP_FAKE_LOG="$TMP_ROOT/calls-normal-recent.log" \
CODEX_BACKUP_STATE_DIR="$TMP_ROOT/state-normal-recent" \
"$SCRIPT_DIR/codexscheduledbackup.sh" >/dev/null

[[ ! -f "$TMP_ROOT/calls-normal-recent.log" ]] || { echo "normal scheduled mode should still respect last-success interval" >&2; exit 1; }

echo "Scheduled sync mode check passed."
