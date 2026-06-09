#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-webdav-doctor.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

FAKE_BIN="$TMP_ROOT/bin"
HOME_DIR="$TMP_ROOT/home"
mkdir -p "$FAKE_BIN" "$HOME_DIR/.codex" "$HOME_DIR/Documents/Codex"

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env zsh
set -euo pipefail
http_status="${FAKE_WEBDAV_STATUS:-207}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -w)
      shift 2
      ;;
    -o)
      shift 2
      ;;
    -o|-u|-X|-H)
      shift 2
      ;;
    -sS|-fsS)
      shift
      ;;
    *)
      shift
      ;;
  esac
done
printf '%s' "$http_status"
EOF
chmod +x "$FAKE_BIN/curl"

set +e
PATH="$FAKE_BIN:$PATH" \
HOME="$HOME_DIR" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/no-password.out" 2>&1
exit_code=$?
set -e
[[ "$exit_code" -ne 0 ]] || { echo "webdav doctor should fail without password" >&2; exit 1; }
grep -Fq 'fail: WebDAV password missing' "$TMP_ROOT/no-password.out"

PATH="$FAKE_BIN:$PATH" \
HOME="$HOME_DIR" \
FAKE_WEBDAV_STATUS=207 \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/reachable.out"
grep -Fq 'ok: WebDAV target reachable' "$TMP_ROOT/reachable.out"
grep -Fq 'Doctor passed.' "$TMP_ROOT/reachable.out"

set +e
PATH="$FAKE_BIN:$PATH" \
HOME="$HOME_DIR" \
FAKE_WEBDAV_STATUS=404 \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/missing-folder.out" 2>&1
exit_code=$?
set -e
[[ "$exit_code" -ne 0 ]] || { echo "webdav doctor should fail when target folder is missing" >&2; exit 1; }
grep -Fq 'fail: WebDAV target folder missing' "$TMP_ROOT/missing-folder.out"
grep -Fq 'create the target WebDAV folder manually' "$TMP_ROOT/missing-folder.out"

echo 'WebDAV doctor checks passed.'
