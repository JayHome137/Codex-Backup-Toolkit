#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

APP_ROOT="${CODEXBACKUP_APP_ROOT:-/Applications/CodexBackup.app}"
APP_BIN="$APP_ROOT/Contents/MacOS/CodexBackup"
RESOURCE_ROOT="$APP_ROOT/Contents/Resources/toolkit"
LOG_FILE="$(mktemp /tmp/codexbackup-local-install-smoke.XXXXXX.log)"

cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

fail() {
  print -u2 -- "FAIL: $*"
  [[ -s "$LOG_FILE" ]] && cat "$LOG_FILE" >&2 || true
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

assert_dir() {
  [[ -d "$1" ]] || fail "missing directory: $1"
}

assert_executable() {
  [[ -x "$1" ]] || fail "not executable: $1"
}

assert_no_listener() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    fail "port $port still has a listener"
  fi
}

assert_dir "$APP_ROOT"
assert_executable "$APP_BIN"
assert_file "$APP_ROOT/Contents/Info.plist"
assert_dir "$RESOURCE_ROOT"
assert_file "$RESOURCE_ROOT/helper/server.mjs"
assert_file "$RESOURCE_ROOT/scripts/codexbackup.sh"
assert_file "$RESOURCE_ROOT/scripts/codexrestore.sh"

"$APP_BIN" >"$LOG_FILE" 2>&1 &
APP_PID=$!
sleep 8

if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
  fail "CodexBackup exited before smoke window"
fi

kill "$APP_PID" >/dev/null 2>&1 || true
sleep 3

if kill -0 "$APP_PID" >/dev/null 2>&1; then
  kill -9 "$APP_PID" >/dev/null 2>&1 || true
  fail "CodexBackup did not stop after SIGTERM"
fi

assert_no_listener 37371
assert_no_listener 5173

print -- "macOS local install smoke passed."
print -- "App: $APP_ROOT"
print -- "Safety: no launchd install/uninstall/load/unload, no real restore."
