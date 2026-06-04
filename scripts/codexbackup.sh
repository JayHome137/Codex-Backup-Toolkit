#!/usr/bin/env zsh
set -euo pipefail

TOOL_NAME="codexbackup"
PROFILE="${CODEX_BACKUP_PROFILE:-codex}"
TARGET="${CODEX_BACKUP_TARGET:-local}"
REMOTE_DIR="${CODEX_BACKUP_REMOTE_DIR:-codex-backups}"
TOOLKIT_REMOTE_DIR="${CODEX_BACKUP_TOOLKIT_REMOTE_DIR:-codex-restore-toolkit}"
LOCAL_DIR="${CODEX_BACKUP_LOCAL_DIR:-${HOME}/CodexBackups}"
ENCRYPT="${CODEX_BACKUP_ENCRYPT:-0}"
ENCRYPTION="${CODEX_BACKUP_ENCRYPTION:-age}"
AGE_RECIPIENT="${CODEX_BACKUP_AGE_RECIPIENT:-}"
AGE_RECIPIENT_FILE="${CODEX_BACKUP_AGE_RECIPIENT_FILE:-}"
RETENTION_COUNT="${CODEX_BACKUP_RETENTION_COUNT:-0}"
RETENTION_DAYS="${CODEX_BACKUP_RETENTION_DAYS:-0}"
SMB_HOST="${CODEX_BACKUP_SMB_HOST:-${CODEX_BACKUP_HOST:-}}"
SMB_USER="${CODEX_BACKUP_SMB_USER:-${CODEX_BACKUP_USER:-}}"
SMB_SHARE="${CODEX_BACKUP_SMB_SHARE:-${CODEX_BACKUP_SHARE:-CodexBackup}}"
SMB_MOUNT="${CODEX_BACKUP_SMB_MOUNT:-${CODEX_BACKUP_MOUNT:-${HOME}/Volumes/${SMB_SHARE}}}"
SYSTEM_SMB_MOUNT="/Volumes/${SMB_SHARE}"
KEYCHAIN_SERVICE="${CODEX_BACKUP_KEYCHAIN_SERVICE:-codexbackup-smb}"
KEYCHAIN_ACCOUNT="${CODEX_BACKUP_KEYCHAIN_ACCOUNT:-${SMB_USER}@${SMB_HOST}/${SMB_SHARE}}"
WEBDAV_URL="${CODEX_BACKUP_WEBDAV_URL:-}"
WEBDAV_USER="${CODEX_BACKUP_WEBDAV_USER:-}"
WEBDAV_KEYCHAIN_SERVICE="${CODEX_BACKUP_WEBDAV_KEYCHAIN_SERVICE:-codexbackup-webdav}"
WEBDAV_KEYCHAIN_ACCOUNT="${CODEX_BACKUP_WEBDAV_KEYCHAIN_ACCOUNT:-${WEBDAV_USER}@${WEBDAV_URL}}"
RCLONE_REMOTE="${CODEX_BACKUP_RCLONE_REMOTE:-}"
SPOOL_DIR="${CODEX_BACKUP_SPOOL_DIR:-${HOME}/Library/Application Support/CodexBackupToolkit/spool}"
SCRIPT_DIR="${0:A:h}"
TOOLKIT_DIR="${SCRIPT_DIR:h}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
HOSTNAME_SAFE="$(scutil --get LocalHostName 2>/dev/null || hostname -s || echo mac)"
HOSTNAME_SAFE="${HOSTNAME_SAFE//[^A-Za-z0-9._-]/_}"
ARCHIVE_BASENAME="codex-backup-${HOSTNAME_SAFE}-${TIMESTAMP}"
ARCHIVE_FILE_NAME="${ARCHIVE_BASENAME}.tar.gz"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-backup.XXXXXX")"
STAGING_DIR="${WORK_DIR}/staging"
MANIFEST="${WORK_DIR}/${ARCHIVE_BASENAME}.manifest.txt"
ARCHIVE="${WORK_DIR}/${ARCHIVE_FILE_NAME}"
DOCTOR=0
DRY_RUN=0
LIST_TARGETS=0

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: codexbackup [--target local|smb|webdav|rclone] [--local-output DIR]
       codexbackup --doctor
       codexbackup --list-targets

Creates a Codex Desktop backup archive and publishes it to the configured
storage target. The default target is local.

Options:
  --target TARGET      Override CODEX_BACKUP_TARGET for this run.
  --local-output DIR   Write backup files to a local directory. Alias for --target local.
  --doctor             Check dependencies and target configuration without backing up.
  --dry-run            Show what would be backed up and where, without creating files.
  --list-targets       Print supported storage targets.
  -h, --help           Show this help.

Targets:
  local    Write to CODEX_BACKUP_LOCAL_DIR.
  smb      Mount an SMB share and write to CODEX_BACKUP_REMOTE_DIR.
  webdav   Upload with curl to CODEX_BACKUP_WEBDAV_URL/CODEX_BACKUP_REMOTE_DIR.
  rclone   Upload with rclone to CODEX_BACKUP_RCLONE_REMOTE/CODEX_BACKUP_REMOTE_DIR.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || { echo "Missing value for --target" >&2; exit 2; }
      TARGET="$2"
      shift 2
      ;;
    --local-output)
      [[ $# -ge 2 ]] || { echo "Missing value for --local-output" >&2; exit 2; }
      TARGET="local"
      LOCAL_DIR="$2"
      shift 2
      ;;
    --doctor)
      DOCTOR=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --list-targets)
      LIST_TARGETS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$PROFILE" != "codex" ]]; then
  echo "Unsupported profile: ${PROFILE}. This release supports CODEX_BACKUP_PROFILE=codex only." >&2
  exit 2
fi

if [[ "$LIST_TARGETS" -eq 1 ]]; then
  cat <<'EOF'
local
smb
webdav
rclone
EOF
  exit 0
fi

doctor_check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'ok: %s\n' "$label"
    return 0
  fi
  printf 'fail: %s\n' "$label"
  return 1
}

doctor_path_check() {
  local label="$1"
  local target_path="$2"
  local dir
  dir="$(dirname "$target_path")"
  while [[ ! -d "$dir" ]]; do
    if [[ "$dir" == "/" || "$dir" == "." ]]; then
      printf 'fail: %s\n' "$label"
      return 1
    fi
    dir="$(dirname "$dir")"
  done
  if [[ -w "$dir" ]]; then
    printf 'ok: %s\n' "$label"
    return 0
  fi
  printf 'fail: %s\n' "$label"
  return 1
}

run_doctor() {
  local failures=0
  echo "codexbackup doctor"
  echo "Target: ${TARGET}"
  doctor_check "zsh available" command -v zsh || failures=$((failures + 1))
  doctor_check "tar available" command -v tar || failures=$((failures + 1))
  doctor_check "rsync available" command -v rsync || failures=$((failures + 1))
  doctor_check "shasum available" command -v shasum || failures=$((failures + 1))
  doctor_path_check "spool path can be created" "$SPOOL_DIR" || failures=$((failures + 1))

  [[ -e "${HOME}/.codex" ]] && echo "ok: ~/.codex exists" || echo "warn: ~/.codex missing"
  [[ -e "${HOME}/Documents/Codex" ]] && echo "ok: ~/Documents/Codex exists" || echo "warn: ~/Documents/Codex missing"

  case "$TARGET" in
    local)
      if [[ -d "$LOCAL_DIR" ]]; then
        doctor_check "local target writable" test -w "$LOCAL_DIR" || failures=$((failures + 1))
      else
        doctor_path_check "local target can be created" "$LOCAL_DIR" || failures=$((failures + 1))
        echo "warn: local target directory does not exist yet: ${LOCAL_DIR}"
      fi
      ;;
    smb)
      [[ -n "$SMB_HOST" ]] && echo "ok: CODEX_BACKUP_SMB_HOST set" || { echo "fail: CODEX_BACKUP_SMB_HOST missing"; failures=$((failures + 1)); }
      [[ -n "$SMB_USER" ]] && echo "ok: CODEX_BACKUP_SMB_USER set" || { echo "fail: CODEX_BACKUP_SMB_USER missing"; failures=$((failures + 1)); }
      [[ -n "$SMB_HOST" ]] && doctor_check "SMB port reachable" nc -z -G 5 "$SMB_HOST" 445 || failures=$((failures + 1))
      ;;
    webdav)
      doctor_check "curl available" command -v curl || failures=$((failures + 1))
      [[ -n "$WEBDAV_URL" ]] && echo "ok: CODEX_BACKUP_WEBDAV_URL set" || { echo "fail: CODEX_BACKUP_WEBDAV_URL missing"; failures=$((failures + 1)); }
      [[ -n "$WEBDAV_USER" ]] && echo "ok: CODEX_BACKUP_WEBDAV_USER set" || { echo "fail: CODEX_BACKUP_WEBDAV_USER missing"; failures=$((failures + 1)); }
      ;;
    rclone)
      doctor_check "rclone available" command -v rclone || failures=$((failures + 1))
      [[ -n "$RCLONE_REMOTE" ]] && echo "ok: CODEX_BACKUP_RCLONE_REMOTE set" || { echo "fail: CODEX_BACKUP_RCLONE_REMOTE missing"; failures=$((failures + 1)); }
      ;;
    *)
      echo "fail: unknown target ${TARGET}"
      failures=$((failures + 1))
      ;;
  esac

  if [[ "$ENCRYPT" == "1" || "$ENCRYPT" == "true" || "$ENCRYPT" == "yes" ]]; then
    case "$ENCRYPTION" in
      age)
        doctor_check "age available" command -v age || failures=$((failures + 1))
        if [[ -n "$AGE_RECIPIENT" || -n "$AGE_RECIPIENT_FILE" ]]; then
          echo "ok: age recipient configured"
        else
          echo "fail: CODEX_BACKUP_AGE_RECIPIENT or CODEX_BACKUP_AGE_RECIPIENT_FILE required"
          failures=$((failures + 1))
        fi
        ;;
      *)
        echo "fail: unsupported encryption ${ENCRYPTION}"
        failures=$((failures + 1))
        ;;
    esac
  fi

  if (( failures > 0 )); then
    echo "Doctor found ${failures} issue(s)."
    exit 1
  fi
  echo "Doctor passed."
  exit 0
}

if [[ "$DOCTOR" -eq 1 ]]; then
  run_doctor
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  cat <<EOF
codexbackup dry run
Target: ${TARGET}
Archive: ${ARCHIVE_FILE_NAME}
Encrypt: ${ENCRYPT}
Retention count: ${RETENTION_COUNT}
Retention days: ${RETENTION_DAYS}
Would inspect:
  ${HOME}/.codex
  ${HOME}/Library/Application Support/Codex
  ${HOME}/Library/Application Support/OpenAI
  ${HOME}/Library/Application Support/OpenAI/Codex
  ${HOME}/Library/Application Support/com.openai.codex
  ${HOME}/Documents/Codex
EOF
  exit 0
fi

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    if [[ -d "$src" ]]; then
      mkdir -p "$dest"
      rsync -a --exclude '.git/fsmonitor--daemon.ipc' --exclude 'tmp/' --exclude '.tmp/' --exclude '*.sock' --exclude '*.socket' "${src}/" "${dest}/"
    else
      rsync -a --exclude '.git/fsmonitor--daemon.ipc' --exclude 'tmp/' --exclude '.tmp/' --exclude '*.sock' --exclude '*.socket' "$src" "$dest"
    fi
    printf 'included: %s\n' "$src" >> "$MANIFEST"
  else
    printf 'missing:  %s\n' "$src" >> "$MANIFEST"
  fi
}

url_escape() {
  local raw="$1"
  local out=""
  local i ch hex
  for (( i = 1; i <= ${#raw}; i++ )); do
    ch="${raw[i]}"
    case "$ch" in
      [A-Za-z0-9.~_-]) out+="$ch" ;;
      *) printf -v hex '%%%02X' "'${ch}"; out+="$hex" ;;
    esac
  done
  print -r -- "$out"
}

select_smb_mount_point() {
  if mount | awk '{print $3}' | grep -Fxq "$SMB_MOUNT"; then
    return 0
  fi
  if [[ -d "$SYSTEM_SMB_MOUNT" ]] && mount | awk '{print $3}' | grep -Fxq "$SYSTEM_SMB_MOUNT"; then
    SMB_MOUNT="$SYSTEM_SMB_MOUNT"
    return 0
  fi
  return 1
}

read_secret() {
  local prompt="$1"
  local env_value="$2"
  local service="$3"
  local account="$4"
  local password="$env_value"
  if [[ -z "$password" ]]; then
    password="$(security find-generic-password -s "$service" -a "$account" -w 2>/dev/null || true)"
  fi
  if [[ -z "$password" ]]; then
    [[ -r /dev/tty ]] || { echo "Password is not available. Set the matching environment variable or store it in Keychain." >&2; exit 1; }
    printf '%s: ' "$prompt" > /dev/tty
    stty -echo < /dev/tty
    IFS= read -r password < /dev/tty
    stty echo < /dev/tty
    printf '\n' > /dev/tty
  fi
  print -r -- "$password"
}

mount_smb_target() {
  [[ -n "$SMB_HOST" ]] || { echo "CODEX_BACKUP_SMB_HOST is required for smb target." >&2; exit 2; }
  [[ -n "$SMB_USER" ]] || { echo "CODEX_BACKUP_SMB_USER is required for smb target." >&2; exit 2; }
  if select_smb_mount_point; then
    return 0
  fi
  mkdir -p "$SMB_MOUNT"
  local password escaped_user escaped_password escaped_share
  password="$(read_secret "SMB password for ${SMB_USER}@${SMB_HOST}" "${CODEX_BACKUP_PASSWORD:-}" "$KEYCHAIN_SERVICE" "$KEYCHAIN_ACCOUNT")"
  escaped_user="$(url_escape "$SMB_USER")"
  escaped_password="$(url_escape "$password")"
  escaped_share="$(url_escape "$SMB_SHARE")"
  mount_smbfs "//${escaped_user}:${escaped_password}@${SMB_HOST}/${escaped_share}" "$SMB_MOUNT"
}

upload_file() {
  local src="$1"
  local dest_dir="$2"
  if rsync -a --inplace "$src" "$dest_dir/"; then
    return 0
  fi
  osascript <<EOF
set srcFile to POSIX file "$src" as alias
set destFolder to POSIX file "$dest_dir" as alias
tell application "Finder"
  duplicate srcFile to destFolder with replacing
end tell
EOF
}

publish_restore_toolkit_to_dir() {
  local dest="$1"
  mkdir -p "$dest/scripts"
  upload_file "${TOOLKIT_DIR}/README.md" "$dest"
  upload_file "${TOOLKIT_DIR}/scripts/codexbackup.sh" "$dest/scripts"
  upload_file "${TOOLKIT_DIR}/scripts/codexscheduledbackup.sh" "$dest/scripts"
  upload_file "${TOOLKIT_DIR}/scripts/codexrestore.sh" "$dest/scripts"
  upload_file "${TOOLKIT_DIR}/scripts/codexinstallautomation.sh" "$dest/scripts"
  chmod +x "$dest/scripts/"*.sh 2>/dev/null || true
}

webdav_mkcol() {
  local url="$1"
  local user="$2"
  local password="$3"
  curl -fsS -u "${user}:${password}" -X MKCOL "$url" >/dev/null 2>&1 || true
}

webdav_upload() {
  local src="$1"
  local url="$2"
  local user="$3"
  local password="$4"
  curl -fsS -u "${user}:${password}" -T "$src" "$url/$(basename "$src")"
}

publish_to_webdav() {
  [[ -n "$WEBDAV_URL" ]] || { echo "CODEX_BACKUP_WEBDAV_URL is required for webdav target." >&2; exit 2; }
  [[ -n "$WEBDAV_USER" ]] || { echo "CODEX_BACKUP_WEBDAV_USER is required for webdav target." >&2; exit 2; }
  local password base_url backup_url toolkit_url scripts_url
  password="$(read_secret "WebDAV password for ${WEBDAV_USER}" "${CODEX_BACKUP_WEBDAV_PASSWORD:-}" "$WEBDAV_KEYCHAIN_SERVICE" "$WEBDAV_KEYCHAIN_ACCOUNT")"
  base_url="${WEBDAV_URL%/}"
  backup_url="${base_url}/${REMOTE_DIR}"
  toolkit_url="${base_url}/${TOOLKIT_REMOTE_DIR}"
  scripts_url="${toolkit_url}/scripts"
  webdav_mkcol "$base_url" "$WEBDAV_USER" "$password"
  webdav_mkcol "$backup_url" "$WEBDAV_USER" "$password"
  webdav_mkcol "$toolkit_url" "$WEBDAV_USER" "$password"
  webdav_mkcol "$scripts_url" "$WEBDAV_USER" "$password"
  local file
  for file in "$@"; do
    webdav_upload "${SPOOL_DIR}/$(basename "$file")" "$backup_url" "$WEBDAV_USER" "$password"
  done
  webdav_upload "${TOOLKIT_DIR}/README.md" "$toolkit_url" "$WEBDAV_USER" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexbackup.sh" "$scripts_url" "$WEBDAV_USER" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexscheduledbackup.sh" "$scripts_url" "$WEBDAV_USER" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexrestore.sh" "$scripts_url" "$WEBDAV_USER" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexinstallautomation.sh" "$scripts_url" "$WEBDAV_USER" "$password"
  print -r -- "$backup_url"
}

publish_to_rclone() {
  [[ -n "$RCLONE_REMOTE" ]] || { echo "CODEX_BACKUP_RCLONE_REMOTE is required for rclone target." >&2; exit 2; }
  command -v rclone >/dev/null 2>&1 || { echo "rclone is required for rclone target. Install it and run rclone config first." >&2; exit 1; }
  local backup_dest="${RCLONE_REMOTE%/}/${REMOTE_DIR}"
  local toolkit_dest="${RCLONE_REMOTE%/}/${TOOLKIT_REMOTE_DIR}"
  local include_args=()
  local file
  for file in "$@"; do
    include_args+=(--include "$(basename "$file")")
  done
  rclone copy "$SPOOL_DIR" "$backup_dest" "${include_args[@]}" --exclude '*'
  rclone copy "${TOOLKIT_DIR}/README.md" "$toolkit_dest"
  rclone copy "${TOOLKIT_DIR}/scripts" "${toolkit_dest}/scripts" --include 'codexbackup.sh' --include 'codexscheduledbackup.sh' --include 'codexrestore.sh' --include 'codexinstallautomation.sh' --exclude '*'
  print -r -- "$backup_dest"
}

encrypt_archive_if_requested() {
  case "$ENCRYPT" in
    1|true|yes)
      ;;
    *)
      print -r -- "$ARCHIVE"
      return 0
      ;;
  esac

  case "$ENCRYPTION" in
    age)
      command -v age >/dev/null 2>&1 || { echo "age is required when CODEX_BACKUP_ENCRYPT=1." >&2; exit 1; }
      if [[ -z "$AGE_RECIPIENT" && -z "$AGE_RECIPIENT_FILE" ]]; then
        echo "Set CODEX_BACKUP_AGE_RECIPIENT or CODEX_BACKUP_AGE_RECIPIENT_FILE when encryption is enabled." >&2
        exit 2
      fi
      local encrypted="${ARCHIVE}.age"
      local args=(-o "$encrypted")
      [[ -n "$AGE_RECIPIENT" ]] && args+=(-r "$AGE_RECIPIENT")
      [[ -n "$AGE_RECIPIENT_FILE" ]] && args+=(-R "$AGE_RECIPIENT_FILE")
      age "${args[@]}" "$ARCHIVE"
      (cd "$(dirname "$encrypted")" && shasum -a 256 "$(basename "$encrypted")" > "$(basename "$encrypted").sha256")
      print -r -- "$encrypted"
      ;;
    *)
      echo "Unsupported CODEX_BACKUP_ENCRYPTION: ${ENCRYPTION}" >&2
      exit 2
      ;;
  esac
}

copy_final_files_to_spool() {
  local file
  mkdir -p "$SPOOL_DIR"
  for file in "$@"; do
    cp -X "$file" "$SPOOL_DIR/"
  done
}

publish_files_to_dir() {
  local dest_dir="$1"
  shift
  local file
  mkdir -p "$dest_dir"
  for file in "$@"; do
    upload_file "${SPOOL_DIR}/$(basename "$file")" "$dest_dir"
  done
}

apply_local_retention() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  local pattern='codex-backup-*.tar.gz*'

  if [[ "$RETENTION_DAYS" =~ '^[0-9]+$' ]] && (( RETENTION_DAYS > 0 )); then
    find "$dir" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' -o -name 'codex-backup-*.tar.gz.sha256' -o -name 'codex-backup-*.tar.gz.age.sha256' -o -name 'codex-backup-*.manifest.txt' \) -mtime +"$RETENTION_DAYS" -delete
  fi

  if [[ "$RETENTION_COUNT" =~ '^[0-9]+$' ]] && (( RETENTION_COUNT > 0 )); then
    local old_base
    find "$dir" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' \) -print | sort -r | tail -n +$((RETENTION_COUNT + 1)) | while IFS= read -r old_base; do
      rm -f "$old_base" "${old_base}.sha256"
      rm -f "${old_base%.tar.gz}.manifest.txt" "${old_base%.tar.gz.age}.manifest.txt"
    done
  fi

  return 0
}

print_backup_result() {
  local dest_dir="$1"
  local toolkit_dest="$2"
  shift 2
  local file
  echo "Backup written to:"
  for file in "$@"; do
    echo "  ${dest_dir}/$(basename "$file")"
  done
  cat <<EOF

Restore toolkit synced to:
  ${toolkit_dest}
EOF
}

echo "Codex backup"
echo "Tool: ${TOOL_NAME}"
echo "Target: ${TARGET}"
echo "Timestamp: ${TIMESTAMP}"
echo "Archive: ${ARCHIVE_BASENAME}.tar.gz"
echo

mkdir -p "$STAGING_DIR/home" "$STAGING_DIR/Library/Application Support" "$STAGING_DIR/Documents"

cat > "$MANIFEST" <<EOF
Codex backup manifest
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Source home: ${HOME}
Source host: ${HOSTNAME_SAFE}
Profile: ${PROFILE}
Target: ${TARGET}

EOF

copy_if_exists "${HOME}/.codex" "${STAGING_DIR}/home/.codex"
copy_if_exists "${HOME}/Library/Application Support/Codex" "${STAGING_DIR}/Library/Application Support/Codex"
copy_if_exists "${HOME}/Library/Application Support/OpenAI" "${STAGING_DIR}/Library/Application Support/OpenAI"
copy_if_exists "${HOME}/Library/Application Support/OpenAI/Codex" "${STAGING_DIR}/Library/Application Support/OpenAI/Codex"
copy_if_exists "${HOME}/Library/Application Support/com.openai.codex" "${STAGING_DIR}/Library/Application Support/com.openai.codex"
copy_if_exists "${HOME}/Documents/Codex" "${STAGING_DIR}/Documents/Codex"

cat >> "$MANIFEST" <<EOF

Archive format: tar.gz
Restore script: scripts/codexrestore.sh
Excluded transient files: .git/fsmonitor--daemon.ipc, tmp/, .tmp/, *.sock, *.socket
EOF

cp "$MANIFEST" "${STAGING_DIR}/MANIFEST.txt"

tar -C "$STAGING_DIR" -czf "$ARCHIVE" .
(cd "$(dirname "$ARCHIVE")" && shasum -a 256 "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")

FINAL_ARCHIVE="$(encrypt_archive_if_requested)"
FINAL_SHA="${FINAL_ARCHIVE}.sha256"
FINAL_FILES=("$FINAL_ARCHIVE" "$FINAL_SHA" "$MANIFEST")
copy_final_files_to_spool "${FINAL_FILES[@]}"

case "$TARGET" in
  local)
    DEST_DIR="$LOCAL_DIR"
    TOOLKIT_DEST_DISPLAY="${DEST_DIR}/${TOOLKIT_REMOTE_DIR}"
    publish_files_to_dir "$DEST_DIR" "${FINAL_FILES[@]}"
    publish_restore_toolkit_to_dir "${DEST_DIR}/${TOOLKIT_REMOTE_DIR}"
    apply_local_retention "$DEST_DIR"
    ;;
  smb)
    nc -z -G 5 "$SMB_HOST" 445 >/dev/null 2>&1 || {
      echo "Cannot reach ${SMB_HOST}:445. Check network or use --target local." >&2
      exit 1
    }
    mount_smb_target
    DEST_DIR="${SMB_MOUNT}/${REMOTE_DIR}"
    TOOLKIT_DEST_DISPLAY="${SMB_MOUNT}/${TOOLKIT_REMOTE_DIR}"
    mkdir -p "$DEST_DIR"
    xattr -d com.apple.provenance "$DEST_DIR" 2>/dev/null || true
    publish_files_to_dir "$DEST_DIR" "${FINAL_FILES[@]}"
    publish_restore_toolkit_to_dir "${SMB_MOUNT}/${TOOLKIT_REMOTE_DIR}"
    apply_local_retention "$DEST_DIR"
    ;;
  webdav)
    DEST_DIR="$(publish_to_webdav "${FINAL_FILES[@]}")"
    TOOLKIT_DEST_DISPLAY="${WEBDAV_URL%/}/${TOOLKIT_REMOTE_DIR}"
    ;;
  rclone)
    DEST_DIR="$(publish_to_rclone "${FINAL_FILES[@]}")"
    TOOLKIT_DEST_DISPLAY="${RCLONE_REMOTE%/}/${TOOLKIT_REMOTE_DIR}"
    ;;
  *)
    echo "Unknown CODEX_BACKUP_TARGET: ${TARGET}" >&2
    exit 2
    ;;
esac

print_backup_result "$DEST_DIR" "$TOOLKIT_DEST_DISPLAY" "${FINAL_FILES[@]}"
