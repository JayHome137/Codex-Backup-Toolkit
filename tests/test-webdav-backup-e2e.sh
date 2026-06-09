#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-webdav-e2e.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
SPOOL_DIR="$TMP_ROOT/spool"
REMOTE_ROOT="$TMP_ROOT/remote"
FAKE_BIN="$TMP_ROOT/bin"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project" "$REMOTE_ROOT/CodexBackup/codex-backups" "$REMOTE_ROOT/CodexBackup/codex-restore-toolkit/scripts" "$FAKE_BIN"
print 'webdav-e2e-config' > "$SRC_HOME/.codex/config.toml"
print 'webdav-e2e-workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env zsh
set -euo pipefail
REMOTE_ROOT="${FAKE_WEBDAV_ROOT:?}"
method="GET"
upload=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -X)
      method="$2"
      shift 2
      ;;
    -H|-u|-w|-o)
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
local_path="${REMOTE_ROOT}/${path}"

if [[ -n "$upload" ]]; then
  [[ -d "${local_path:h}" ]] || exit 22
  /bin/cp "$upload" "$local_path"
  exit 0
fi

case "$method" in
  MKCOL)
    [[ -d "$local_path" ]] && exit 0
    exit 22
    ;;
  PROPFIND)
    dir="${local_path%/}"
    [[ -d "$dir" ]] || {
      printf '404'
      exit 0
    }
    if [[ "$*" == *"-w"* ]]; then
      printf '207'
      exit 0
    fi
    for file in "$dir"/*; do
      [[ -f "$file" ]] || continue
      printf '<d:href>/%s/%s</d:href>\n' "$path" "${file:t}"
    done
    ;;
  DELETE)
    /bin/rm -f "$local_path"
    ;;
  *)
    echo "unsupported fake curl method: $method" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$FAKE_BIN/curl"

PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_ROOT" \
HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
./scripts/codexbackup.sh >/dev/null

assert_uploaded_backup() {
  local root="$1"
  local expected_count="$2"
  local archive_count
  archive_count="$(find "$root/CodexBackup/codex-backups" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
  [[ "$archive_count" == "$expected_count" ]] || { echo "expected $expected_count WebDAV archive(s), got $archive_count" >&2; exit 1; }
  find "$root/CodexBackup/codex-backups" -maxdepth 1 -type f -name 'codex-backup-*.manifest.txt' | grep -q .
}

assert_uploaded_backup "$REMOTE_ROOT" 1
[[ -f "$REMOTE_ROOT/CodexBackup/codex-restore-toolkit/README.md" ]] || { echo "missing WebDAV restore toolkit README" >&2; exit 1; }
[[ -f "$REMOTE_ROOT/CodexBackup/codex-restore-toolkit/scripts/codexbackup.sh" ]] || { echo "missing WebDAV restore toolkit script" >&2; exit 1; }

REMOTE_BACKUP_ONLY="$TMP_ROOT/remote-backup-only"
mkdir -p "$REMOTE_BACKUP_ONLY/CodexBackup/codex-backups"
PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$REMOTE_BACKUP_ONLY" \
HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR/backup-only" \
./scripts/codexbackup.sh >"$TMP_ROOT/backup-only.out" 2>"$TMP_ROOT/backup-only.err"

assert_uploaded_backup "$REMOTE_BACKUP_ONLY" 1
grep -Fq 'warn: WebDAV restore toolkit upload skipped' "$TMP_ROOT/backup-only.err"

echo "WebDAV backup e2e passed."
