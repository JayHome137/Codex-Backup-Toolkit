#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

fail() {
  print -u2 -- "FAIL: $*"
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "missing file: $1"
}

assert_executable() {
  [[ -x "$1" ]] || fail "not executable: $1"
}

VERSION="$(node -p "require('./gui/package.json').version")"
APP_ROOT="gui/src-tauri/target/release/bundle/macos/CodexBackup.app"
RESOURCE_ROOT="$APP_ROOT/Contents/Resources/toolkit"
DMG_PATH="gui/src-tauri/target/release/bundle/dmg/CodexBackup_${VERSION}_aarch64.dmg"
CHECKSUM_PATH="${DMG_PATH}.sha256"

[[ -d "$APP_ROOT" ]] || fail "missing app bundle: $APP_ROOT"
assert_executable "$APP_ROOT/Contents/MacOS/CodexBackup"
assert_file "$APP_ROOT/Contents/Info.plist"
assert_file "$APP_ROOT/Contents/Resources/icon.icns"
assert_file "$RESOURCE_ROOT/helper/server.mjs"
assert_file "$RESOURCE_ROOT/helper/actions.mjs"
assert_file "$RESOURCE_ROOT/helper/allowlist.mjs"
assert_file "$RESOURCE_ROOT/helper/automation-status.mjs"
assert_file "$RESOURCE_ROOT/scripts/codexbackup.sh"
assert_file "$RESOURCE_ROOT/scripts/codexrestore.sh"
assert_file "$RESOURCE_ROOT/scripts/codexinstallautomation.sh"
assert_file "$RESOURCE_ROOT/config.example.env"
assert_file "$RESOURCE_ROOT/examples/local.env"
assert_file "$DMG_PATH"
assert_file "$CHECKSUM_PATH"

[[ -s "$DMG_PATH" ]] || fail "empty dmg: $DMG_PATH"

(
  cd "$(dirname "$DMG_PATH")"
  shasum -a 256 -c "$(basename "$CHECKSUM_PATH")" >/tmp/codexbackup-macos-release-smoke-sha.out
) || {
  cat /tmp/codexbackup-macos-release-smoke-sha.out >&2 || true
  fail "dmg checksum mismatch"
}

if find "$RESOURCE_ROOT/helper" -name '*.test.mjs' -print -quit | grep -q .; then
  fail "packaged helper contains test files"
fi

print -- "macOS release smoke passed."
print -- "App: $APP_ROOT"
print -- "DMG: $DMG_PATH"
print -- "Safety: no launchd install/uninstall/load/unload, no real restore."
