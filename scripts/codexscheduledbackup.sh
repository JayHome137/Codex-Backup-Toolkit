#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
BACKUP_SCRIPT="${SCRIPT_DIR}/codexbackup.sh"
INTERVAL_DAYS="${CODEX_BACKUP_INTERVAL_DAYS:-3}"
STATE_DIR="${CODEX_BACKUP_STATE_DIR:-${HOME}/Library/Application Support/CodexBackupToolkit/state}"
LAST_SUCCESS_FILE="${STATE_DIR}/last-success-epoch"
NOW="$(date +%s)"
INTERVAL_SECONDS="$((INTERVAL_DAYS * 24 * 60 * 60))"

mkdir -p "$STATE_DIR"

if [[ -f "$LAST_SUCCESS_FILE" ]]; then
  LAST_SUCCESS="$(cat "$LAST_SUCCESS_FILE" 2>/dev/null || echo 0)"
else
  LAST_SUCCESS=0
fi

if [[ "$LAST_SUCCESS" =~ '^[0-9]+$' ]] && (( LAST_SUCCESS > 0 )); then
  ELAPSED="$((NOW - LAST_SUCCESS))"
  if (( ELAPSED < INTERVAL_SECONDS )); then
    NEXT_RUN="$((LAST_SUCCESS + INTERVAL_SECONDS))"
    echo "Skipping Codex backup: last successful backup was less than ${INTERVAL_DAYS} days ago."
    echo "Last success: $(date -r "$LAST_SUCCESS" '+%Y-%m-%d %H:%M:%S')"
    echo "Next eligible backup time is after: $(date -r "$NEXT_RUN" '+%Y-%m-%d %H:%M:%S')"
    exit 0
  fi
fi

"$BACKUP_SCRIPT"
date +%s > "$LAST_SUCCESS_FILE"
