#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-remote-retention.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
SPOOL_DIR="$TMP_ROOT/spool"
REMOTE_ROOT="$TMP_ROOT/remote"
WEBDAV_ROOT="$REMOTE_ROOT/webdav"
RCLONE_ROOT="$REMOTE_ROOT/rclone"
FAKE_BIN="$TMP_ROOT/bin"
HOSTNAME_SAFE="$(scutil --get LocalHostName 2>/dev/null || hostname -s || echo mac)"
HOSTNAME_SAFE="${HOSTNAME_SAFE//[^A-Za-z0-9._-]/_}"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project" "$WEBDAV_ROOT/codex-backups" "$RCLONE_ROOT/codex-backups" "$FAKE_BIN"
print 'remote-retention-config' > "$SRC_HOME/.codex/config.toml"
print 'remote-retention-workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

seed_remote() {
  local dir="$1"
  local stamp="$2"
  local archive="codex-backup-${HOSTNAME_SAFE}-${stamp}.tar.gz"
  print "archive ${stamp}" > "$dir/$archive"
  print "checksum ${stamp}" > "$dir/${archive}.sha256"
  print "manifest ${stamp}" > "$dir/codex-backup-${HOSTNAME_SAFE}-${stamp}.manifest.txt"
}

seed_remote "$WEBDAV_ROOT/codex-backups" 20000101-000000
seed_remote "$WEBDAV_ROOT/codex-backups" 20010101-000000
seed_remote "$RCLONE_ROOT/codex-backups" 20000101-000000
seed_remote "$RCLONE_ROOT/codex-backups" 20010101-000000

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
    -H|-u)
      shift 2
      ;;
    -fsS)
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
case "$method" in
  MKCOL)
    /bin/mkdir -p "$local_path"
    ;;
  PROPFIND)
    dir="${local_path%/}"
    for file in "$dir"/*; do
      [[ -f "$file" ]] || continue
      printf '<d:href>/%s/%s</d:href>\n' "$path" "${file:t}"
    done
    ;;
  DELETE)
    /bin/rm -f "$local_path"
    ;;
  GET)
    [[ -n "$upload" ]] || { echo "unsupported fake curl GET" >&2; exit 2; }
    /bin/mkdir -p "${local_path:h}"
    /bin/cp "$upload" "$local_path"
    ;;
  *)
    echo "unsupported fake curl method: $method" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$FAKE_BIN/curl"

cat > "$FAKE_BIN/rclone" <<'EOF'
#!/usr/bin/env zsh
set -euo pipefail
REMOTE_ROOT="${FAKE_RCLONE_ROOT:?}"
case "$1" in
  copy)
    src="$2"
    dest="$3"
    dest_path="${REMOTE_ROOT}/${dest#fake:}"
    /bin/mkdir -p "$dest_path"
    if [[ -d "$src" ]]; then
      for file in "$src"/*; do
        [[ -f "$file" ]] || continue
        /bin/cp "$file" "$dest_path/${file:t}"
      done
    else
      /bin/cp "$src" "$dest_path/${src:t}"
    fi
    ;;
  lsf)
    remote_path="$2"
    dir="${REMOTE_ROOT}/${remote_path#fake:}"
    for file in "$dir"/*; do
      [[ -f "$file" ]] || continue
      print -r -- "${file:t}"
    done
    ;;
  deletefile)
    remote_path="$2"
    /bin/rm -f "${REMOTE_ROOT}/${remote_path#fake:}"
    ;;
  *)
    echo "unsupported fake rclone command: $1" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$FAKE_BIN/rclone"

PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$WEBDAV_ROOT" \
HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR/webdav-default" \
CODEX_BACKUP_RETENTION_COUNT=2 \
./scripts/codexbackup.sh >/dev/null

WEBDAV_DEFAULT_COUNT="$(find "$WEBDAV_ROOT/codex-backups" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$WEBDAV_DEFAULT_COUNT" == "3" ]] || { echo "remote retention should be opt-in, got $WEBDAV_DEFAULT_COUNT WebDAV archives" >&2; exit 1; }

PATH="$FAKE_BIN:$PATH" \
FAKE_WEBDAV_ROOT="$WEBDAV_ROOT" \
HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR/webdav" \
CODEX_BACKUP_RETENTION_COUNT=2 \
CODEX_BACKUP_REMOTE_RETENTION=1 \
./scripts/codexbackup.sh >/dev/null

WEBDAV_ARCHIVE_COUNT="$(find "$WEBDAV_ROOT/codex-backups" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$WEBDAV_ARCHIVE_COUNT" == "2" ]] || { echo "expected 2 WebDAV retained archives, got $WEBDAV_ARCHIVE_COUNT" >&2; exit 1; }
[[ ! -e "$WEBDAV_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.tar.gz" ]] || { echo "old WebDAV archive was not deleted" >&2; exit 1; }
[[ ! -e "$WEBDAV_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.tar.gz.sha256" ]] || { echo "old WebDAV sha was not deleted" >&2; exit 1; }
[[ ! -e "$WEBDAV_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.manifest.txt" ]] || { echo "old WebDAV manifest was not deleted" >&2; exit 1; }

PATH="$FAKE_BIN:$PATH" \
FAKE_RCLONE_ROOT="$RCLONE_ROOT" \
HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="fake:" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR/rclone" \
CODEX_BACKUP_RETENTION_COUNT=2 \
CODEX_BACKUP_REMOTE_RETENTION=1 \
./scripts/codexbackup.sh >/dev/null

RCLONE_ARCHIVE_COUNT="$(find "$RCLONE_ROOT/codex-backups" -maxdepth 1 -type f -name 'codex-backup-*.tar.gz' | wc -l | tr -d ' ')"
[[ "$RCLONE_ARCHIVE_COUNT" == "2" ]] || { echo "expected 2 rclone retained archives, got $RCLONE_ARCHIVE_COUNT" >&2; exit 1; }
[[ ! -e "$RCLONE_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.tar.gz" ]] || { echo "old rclone archive was not deleted" >&2; exit 1; }
[[ ! -e "$RCLONE_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.tar.gz.sha256" ]] || { echo "old rclone sha was not deleted" >&2; exit 1; }
[[ ! -e "$RCLONE_ROOT/codex-backups/codex-backup-${HOSTNAME_SAFE}-20000101-000000.manifest.txt" ]] || { echo "old rclone manifest was not deleted" >&2; exit 1; }

echo "Remote retention checks passed."
