#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
cd "$ROOT_DIR"

TMP_ROOT="$(mktemp -d /tmp/codexbackup-remote-latest.XXXXXX)"
trap 'rm -rf "$TMP_ROOT"' EXIT

SRC_HOME="$TMP_ROOT/src-home"
WEBDAV_DST_HOME="$TMP_ROOT/webdav-dst-home"
WEBDAV_NO_SHA_DST_HOME="$TMP_ROOT/webdav-no-sha-dst-home"
RCLONE_DST_HOME="$TMP_ROOT/rclone-dst-home"
OUT_DIR="$TMP_ROOT/out"
SPOOL_DIR="$TMP_ROOT/spool"
REMOTE_ROOT="$TMP_ROOT/remote"
REMOTE_BACKUPS="$REMOTE_ROOT/codex-backups"
FAKE_BIN="$TMP_ROOT/bin"
LOG_FILE="$TMP_ROOT/fake-tools.log"

mkdir -p "$SRC_HOME/.codex" "$SRC_HOME/Documents/Codex/project" "$REMOTE_BACKUPS" "$FAKE_BIN"
print 'remote-latest-config' > "$SRC_HOME/.codex/config.toml"
print 'remote-latest-workspace' > "$SRC_HOME/Documents/Codex/project/readme.txt"

HOME="$SRC_HOME" \
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$OUT_DIR" \
CODEX_BACKUP_SPOOL_DIR="$SPOOL_DIR" \
./scripts/codexbackup.sh >/dev/null

ARCHIVE="$(find "$OUT_DIR" -maxdepth 1 -name 'codex-backup-*.tar.gz' -print | sort | tail -1)"
[[ -f "$ARCHIVE" ]] || { echo "No local archive created" >&2; exit 1; }
cp "$ARCHIVE" "$REMOTE_BACKUPS/codex-backup-host-20000101-000000.tar.gz"
cp "${ARCHIVE}.sha256" "$REMOTE_BACKUPS/codex-backup-host-20000101-000000.tar.gz.sha256"
cp "$ARCHIVE" "$REMOTE_BACKUPS/codex-backup-host-20990101-000000.tar.gz"
(
  cd "$REMOTE_BACKUPS"
  shasum -a 256 codex-backup-host-20990101-000000.tar.gz > codex-backup-host-20990101-000000.tar.gz.sha256
)

cat > "$FAKE_BIN/curl" <<'EOF'
#!/usr/bin/env zsh
set -euo pipefail
REMOTE_ROOT="${FAKE_REMOTE_ROOT:?}"
method="GET"
out=""
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
    -o)
      out="$2"
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
if [[ "$method" == "PROPFIND" ]]; then
  dir="${local_path%/}"
  for file in "$dir"/*; do
    [[ -f "$file" ]] || continue
    printf '<d:href>/%s/%s</d:href>\n' "$path" "${file:t}"
  done
  exit 0
fi
[[ -n "$out" ]] || { echo "missing -o" >&2; exit 2; }
[[ -f "$local_path" ]] || exit 22
/bin/cp "$local_path" "$out"
EOF
chmod +x "$FAKE_BIN/curl"

cat > "$FAKE_BIN/rclone" <<'EOF'
#!/usr/bin/env zsh
set -euo pipefail
REMOTE_ROOT="${FAKE_REMOTE_ROOT:?}"
case "$1" in
  lsf)
    remote_path="$2"
    dir="${REMOTE_ROOT}/${remote_path#fake:}"
    shift 2
    for file in "$dir"/*; do
      [[ -f "$file" ]] || continue
      print -r -- "${file:t}"
    done
    ;;
  copyto)
    src="$2"
    dest="$3"
    src_path="${REMOTE_ROOT}/${src#fake:}"
    [[ -f "$src_path" ]] || exit 3
    /bin/mkdir -p "${dest:h}"
    /bin/cp "$src_path" "$dest"
    ;;
  *)
    echo "unsupported fake rclone command: $1" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$FAKE_BIN/rclone"

PATH="$FAKE_BIN:$PATH" \
FAKE_REMOTE_ROOT="$REMOTE_ROOT" \
HOME="$WEBDAV_DST_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexrestore.sh --latest --yes > "$LOG_FILE"

grep -Fxq 'remote-latest-config' "$WEBDAV_DST_HOME/.codex/config.toml"
grep -Fxq 'remote-latest-workspace' "$WEBDAV_DST_HOME/Documents/Codex/project/readme.txt"
grep -Fq 'Archive selected:' "$LOG_FILE"
grep -Fq 'codex-backup-host-20990101-000000.tar.gz' "$LOG_FILE"

rm -f "$REMOTE_BACKUPS/codex-backup-host-20990101-000000.tar.gz.sha256"
PATH="$FAKE_BIN:$PATH" \
FAKE_REMOTE_ROOT="$REMOTE_ROOT" \
HOME="$WEBDAV_NO_SHA_DST_HOME" \
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="http://fake-webdav" \
CODEX_BACKUP_WEBDAV_USER="backup-user" \
CODEX_BACKUP_WEBDAV_PASSWORD="backup-password" \
./scripts/codexrestore.sh --latest --yes > "$LOG_FILE" 2>&1

grep -Fxq 'remote-latest-config' "$WEBDAV_NO_SHA_DST_HOME/.codex/config.toml"
grep -Fq 'Warning: checksum file not found for remote archive codex-backup-host-20990101-000000.tar.gz' "$LOG_FILE"

(
  cd "$REMOTE_BACKUPS"
  shasum -a 256 codex-backup-host-20990101-000000.tar.gz > codex-backup-host-20990101-000000.tar.gz.sha256
)

PATH="$FAKE_BIN:$PATH" \
FAKE_REMOTE_ROOT="$REMOTE_ROOT" \
HOME="$RCLONE_DST_HOME" \
CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="fake:" \
./scripts/codexrestore.sh --latest --yes > "$LOG_FILE"

grep -Fxq 'remote-latest-config' "$RCLONE_DST_HOME/.codex/config.toml"
grep -Fxq 'remote-latest-workspace' "$RCLONE_DST_HOME/Documents/Codex/project/readme.txt"
grep -Fq 'Archive selected:' "$LOG_FILE"
grep -Fq 'codex-backup-host-20990101-000000.tar.gz' "$LOG_FILE"

echo "Remote latest restore checks passed."
