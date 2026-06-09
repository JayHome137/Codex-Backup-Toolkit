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
remote_root="${FAKE_WEBDAV_ROOT:?}"
method="GET"
output=""
write_format=""
upload=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -X)
      method="$2"
      shift 2
      ;;
    -w)
      write_format="$2"
      shift 2
      ;;
    -o)
      output="$2"
      shift 2
      ;;
    -u|-H)
      shift 2
      ;;
    -sS|-fsS)
      shift
      ;;
    -T)
      upload="$2"
      shift 2
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done

path="${url#http://fake-webdav/}"
local_path="${remote_root}/${path}"
http_status="207"

if [[ -n "$upload" ]]; then
  if [[ "${FAKE_WEBDAV_WRITE_DENIED:-0}" == "1" || ! -d "${local_path:h}" ]]; then
    http_status="403"
  else
    /bin/cp "$upload" "$local_path"
    http_status="201"
  fi
else
  case "$method" in
    PROPFIND)
      [[ -d "${local_path%/}" ]] || http_status="404"
      ;;
    DELETE)
      /bin/rm -f "$local_path"
      http_status="204"
      ;;
    *)
      echo "unsupported fake curl method: $method" >&2
      exit 2
      ;;
  esac
fi

if [[ -n "$write_format" ]]; then
  printf '%s' "$http_status"
fi
[[ "$http_status" == 2* ]] || exit 22
EOF
chmod +x "$FAKE_BIN/curl"

REMOTE_ROOT="$TMP_ROOT/remote"
mkdir -p "$REMOTE_ROOT/CodexBackup/codex-backups"

set +e
PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
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
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
HOME="$HOME_DIR" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/reachable.out"
grep -Fq 'ok: WebDAV target reachable' "$TMP_ROOT/reachable.out"
grep -Fq 'ok: WebDAV backup folder reachable' "$TMP_ROOT/reachable.out"
grep -Fq 'ok: WebDAV backup folder writable' "$TMP_ROOT/reachable.out"
grep -Fq 'Doctor passed.' "$TMP_ROOT/reachable.out"

set +e
PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
HOME="$HOME_DIR" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/MissingBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/missing-folder.out" 2>&1
exit_code=$?
set -e
[[ "$exit_code" -ne 0 ]] || { echo "webdav doctor should fail when target folder is missing" >&2; exit 1; }
grep -Fq 'fail: WebDAV target folder missing' "$TMP_ROOT/missing-folder.out"
grep -Fq 'create the target WebDAV folder manually' "$TMP_ROOT/missing-folder.out"

/bin/rm -rf "$REMOTE_ROOT/CodexBackup/codex-backups"
set +e
PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
HOME="$HOME_DIR" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/missing-backup-folder.out" 2>&1
exit_code=$?
set -e
[[ "$exit_code" -ne 0 ]] || { echo "webdav doctor should fail when backup folder is missing" >&2; exit 1; }
grep -Fq 'fail: WebDAV backup folder missing' "$TMP_ROOT/missing-backup-folder.out"
grep -Fq 'create this WebDAV folder manually' "$TMP_ROOT/missing-backup-folder.out"

mkdir -p "$REMOTE_ROOT/CodexBackup/codex-backups"
set +e
PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
FAKE_WEBDAV_WRITE_DENIED=1 \
HOME="$HOME_DIR" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexbackup.sh --doctor --target webdav >"$TMP_ROOT/write-denied.out" 2>&1
exit_code=$?
set -e
[[ "$exit_code" -ne 0 ]] || { echo "webdav doctor should fail when backup folder is not writable" >&2; exit 1; }
grep -Fq 'fail: WebDAV backup folder is not writable' "$TMP_ROOT/write-denied.out"

echo 'WebDAV doctor checks passed.'
