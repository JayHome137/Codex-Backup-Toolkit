#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

./scripts/codexbackup.sh --profile-plan --platform darwin >"$OUT"
grep -Fq 'Codex profile path plan' "$OUT"
grep -Fq 'Platform: darwin' "$OUT"
grep -Fq 'Status: supported' "$OUT"
grep -Fq 'Library/Application Support/Codex' "$OUT"

./scripts/codexbackup.sh --profile-plan --platform win32 >"$OUT"
grep -Fq 'Platform: win32' "$OUT"
grep -Fq 'Status: planned' "$OUT"
grep -Fq 'AppData/Roaming/Codex' "$OUT"
grep -Fq 'Windows support is planned' "$OUT"

if ./scripts/codexbackup.sh --profile-plan --platform linux >"$OUT" 2>&1; then
  echo 'FAIL: linux profile plan should not be accepted yet.' >&2
  exit 1
fi
grep -Fq 'Unsupported profile plan platform' "$OUT"

echo 'Profile plan checks passed.'
