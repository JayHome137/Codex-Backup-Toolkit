#!/usr/bin/env zsh
set -euo pipefail

TARGET="${CODEX_BACKUP_TARGET:-local}"
REMOTE_DIR="${CODEX_BACKUP_REMOTE_DIR:-codex-backups}"
LOCAL_DIR="${CODEX_BACKUP_LOCAL_DIR:-${HOME}/CodexBackups}"
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
SAFETY_DIR="${CODEX_RESTORE_SAFETY_DIR:-${HOME}/CodexRestoreSafetyBackups}"
AGE_IDENTITY="${CODEX_BACKUP_AGE_IDENTITY:-${CODEX_RESTORE_AGE_IDENTITY:-}}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-restore.XXXXXX")"
EXTRACT_DIR="${WORK_DIR}/extract"
REMOTE_DOWNLOAD_DIR="${WORK_DIR}/remote-download"
DECRYPTED_ARCHIVE="${WORK_DIR}/decrypted-codex-backup.tar.gz"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: codexrestore --latest [--target local|smb|webdav|rclone]
       codexrestore --archive /path/to/codex-backup-*.tar.gz[.age]

Restores a Codex backup. The script first creates a local safety backup of any
existing Codex files before replacing them.

Options:
  --latest          Restore the newest archive from the configured backup target.
  --archive FILE    Restore a specific local archive.
  --target TARGET   Override CODEX_BACKUP_TARGET for --latest.
  --age-identity    Path to age identity file for encrypted .age archives.
  --yes             Do not ask for final confirmation.
EOF
}

ARCHIVE=""
USE_LATEST=0
ASSUME_YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest)
      USE_LATEST=1
      shift
      ;;
    --archive)
      [[ $# -ge 2 ]] || { echo "Missing value for --archive" >&2; exit 2; }
      ARCHIVE="$2"
      shift 2
      ;;
    --target)
      [[ $# -ge 2 ]] || { echo "Missing value for --target" >&2; exit 2; }
      TARGET="$2"
      shift 2
      ;;
    --age-identity)
      [[ $# -ge 2 ]] || { echo "Missing value for --age-identity" >&2; exit 2; }
      AGE_IDENTITY="$2"
      shift 2
      ;;
    --yes)
      ASSUME_YES=1
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

if [[ "$USE_LATEST" -eq 1 && -n "$ARCHIVE" ]]; then
  echo "Use either --latest or --archive, not both." >&2
  exit 2
fi
if [[ "$USE_LATEST" -eq 0 && -z "$ARCHIVE" ]]; then
  usage >&2
  exit 2
fi

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

read_smb_password() {
  local password="${CODEX_BACKUP_PASSWORD:-}"
  if [[ -z "$password" ]]; then
    password="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w 2>/dev/null || true)"
  fi
  if [[ -z "$password" ]]; then
    [[ -r /dev/tty ]] || { echo "SMB password is not available. Set CODEX_BACKUP_PASSWORD or add it to Keychain." >&2; exit 1; }
    printf 'SMB password for %s@%s: ' "$SMB_USER" "$SMB_HOST" > /dev/tty
    stty -echo < /dev/tty
    IFS= read -r password < /dev/tty
    stty echo < /dev/tty
    printf '\n' > /dev/tty
  fi
  print -r -- "$password"
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
  password="$(read_smb_password)"
  escaped_user="$(url_escape "$SMB_USER")"
  escaped_password="$(url_escape "$password")"
  escaped_share="$(url_escape "$SMB_SHARE")"
  mount_smbfs "//${escaped_user}:${escaped_password}@${SMB_HOST}/${escaped_share}" "$SMB_MOUNT"
}

select_latest_archive_name() {
  local matches
  matches="$(grep -E '^codex-backup-.*\.tar\.gz(\.age)?$' || true)"
  [[ -n "$matches" ]] || return 0
  print -r -- "$matches" | sort | tail -1
}

download_webdav_latest() {
  [[ -n "$WEBDAV_URL" ]] || { echo "CODEX_BACKUP_WEBDAV_URL is required for webdav target." >&2; exit 2; }
  [[ -n "$WEBDAV_USER" ]] || { echo "CODEX_BACKUP_WEBDAV_USER is required for webdav target." >&2; exit 2; }
  command -v curl >/dev/null 2>&1 || { echo "curl is required for webdav restore." >&2; exit 1; }

  mkdir -p "$REMOTE_DOWNLOAD_DIR"
  local password backup_url latest archive_dest sha_dest href basename
  password="$(read_secret "WebDAV password for ${WEBDAV_USER}" "${CODEX_BACKUP_WEBDAV_PASSWORD:-}" "$WEBDAV_KEYCHAIN_SERVICE" "$WEBDAV_KEYCHAIN_ACCOUNT")"
  backup_url="${WEBDAV_URL%/}/${REMOTE_DIR}"
  latest="$({
    curl -fsS -u "${WEBDAV_USER}:${password}" -X PROPFIND -H 'Depth: 1' "${backup_url}/" |
      sed -nE 's/.*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>.*/\1/p' |
      while IFS= read -r href; do
        basename="${href:t}"
        print -r -- "$basename"
      done
  } | select_latest_archive_name)"

  [[ -n "$latest" ]] || { echo "No codex-backup-*.tar.gz files found at ${backup_url}" >&2; exit 1; }
  archive_dest="${REMOTE_DOWNLOAD_DIR}/${latest}"
  sha_dest="${archive_dest}.sha256"
  curl -fsS -u "${WEBDAV_USER}:${password}" -o "$archive_dest" "${backup_url}/${latest}"
  if ! curl -fsS -u "${WEBDAV_USER}:${password}" -o "$sha_dest" "${backup_url}/${latest}.sha256"; then
    rm -f "$sha_dest"
    echo "Warning: checksum file not found for remote archive ${latest}" >&2
  fi
  print -r -- "$archive_dest"
}

download_rclone_latest() {
  [[ -n "$RCLONE_REMOTE" ]] || { echo "CODEX_BACKUP_RCLONE_REMOTE is required for rclone target." >&2; exit 2; }
  command -v rclone >/dev/null 2>&1 || { echo "rclone is required for rclone restore. Install it and run rclone config first." >&2; exit 1; }

  mkdir -p "$REMOTE_DOWNLOAD_DIR"
  local backup_remote latest archive_dest sha_dest
  backup_remote="${RCLONE_REMOTE%/}/${REMOTE_DIR}"
  latest="$(rclone lsf "$backup_remote" --files-only | select_latest_archive_name)"
  [[ -n "$latest" ]] || { echo "No codex-backup-*.tar.gz files found at ${backup_remote}" >&2; exit 1; }

  archive_dest="${REMOTE_DOWNLOAD_DIR}/${latest}"
  sha_dest="${archive_dest}.sha256"
  rclone copyto "${backup_remote}/${latest}" "$archive_dest"
  if ! rclone copyto "${backup_remote}/${latest}.sha256" "$sha_dest"; then
    rm -f "$sha_dest"
    echo "Warning: checksum file not found for remote archive ${latest}" >&2
  fi
  print -r -- "$archive_dest"
}

copy_existing_to_safety_stage() {
  local safety_stage="$1"
  [[ -e "${HOME}/.codex" ]] && ditto --rsrc --extattr "${HOME}/.codex" "${safety_stage}/home/.codex"
  [[ -e "${HOME}/Library/Application Support/Codex" ]] && ditto --rsrc --extattr "${HOME}/Library/Application Support/Codex" "${safety_stage}/Library/Application Support/Codex"
  [[ -e "${HOME}/Library/Application Support/OpenAI" ]] && ditto --rsrc --extattr "${HOME}/Library/Application Support/OpenAI" "${safety_stage}/Library/Application Support/OpenAI"
  [[ -e "${HOME}/Library/Application Support/com.openai.codex" ]] && ditto --rsrc --extattr "${HOME}/Library/Application Support/com.openai.codex" "${safety_stage}/Library/Application Support/com.openai.codex"
  [[ -e "${HOME}/Documents/Codex" ]] && ditto --rsrc --extattr "${HOME}/Documents/Codex" "${safety_stage}/Documents/Codex"
  return 0
}

restore_if_present() {
  local src="$1"
  local dest="$2"
  if [[ -e "$src" ]]; then
    rm -rf "$dest"
    mkdir -p "$(dirname "$dest")"
    ditto --rsrc --extattr "$src" "$dest"
    echo "restored: $dest"
  fi
}

if [[ "$USE_LATEST" -eq 1 ]]; then
  case "$TARGET" in
    local)
      REMOTE_PATH="$LOCAL_DIR"
      ;;
    smb)
      nc -z -G 5 "$SMB_HOST" 445 >/dev/null 2>&1 || {
        echo "Cannot reach ${SMB_HOST}:445. Check network or use --archive with a local file." >&2
        exit 1
      }
      mount_smb_target
      REMOTE_PATH="${SMB_MOUNT}/${REMOTE_DIR}"
      ;;
    webdav)
      ARCHIVE="$(download_webdav_latest)"
      ;;
    rclone)
      ARCHIVE="$(download_rclone_latest)"
      ;;
    *)
      echo "Unknown CODEX_BACKUP_TARGET: ${TARGET}" >&2
      exit 2
      ;;
  esac
  if [[ -z "$ARCHIVE" ]]; then
    ARCHIVE="$(find "$REMOTE_PATH" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' \) -print | sort | tail -1)"
    [[ -n "$ARCHIVE" ]] || { echo "No codex-backup-*.tar.gz files found in ${REMOTE_PATH}" >&2; exit 1; }
  fi
fi

[[ -f "$ARCHIVE" ]] || { echo "Archive not found: $ARCHIVE" >&2; exit 1; }
SHA_FILE="${ARCHIVE}.sha256"
if [[ -f "$SHA_FILE" ]]; then
  (cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$(basename "$SHA_FILE")")
else
  echo "Warning: checksum file not found for ${ARCHIVE}" >&2
fi

ARCHIVE_TO_EXTRACT="$ARCHIVE"
if [[ "$ARCHIVE" == *.age ]]; then
  command -v age >/dev/null 2>&1 || { echo "age is required to restore encrypted archives." >&2; exit 1; }
  [[ -n "$AGE_IDENTITY" ]] || { echo "Set CODEX_BACKUP_AGE_IDENTITY or pass --age-identity for encrypted archives." >&2; exit 2; }
  [[ -f "$AGE_IDENTITY" ]] || { echo "Age identity file not found: $AGE_IDENTITY" >&2; exit 1; }
  age -d -i "$AGE_IDENTITY" -o "$DECRYPTED_ARCHIVE" "$ARCHIVE"
  ARCHIVE_TO_EXTRACT="$DECRYPTED_ARCHIVE"
fi

echo "Archive selected: $ARCHIVE"
echo "Target home: ${HOME}"
echo "Safety backup directory: ${SAFETY_DIR}"
echo
if [[ "$ASSUME_YES" -ne 1 ]]; then
  printf 'Quit Codex Desktop before continuing. Restore now? [y/N] ' > /dev/tty
  IFS= read -r answer < /dev/tty
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "Restore cancelled."; exit 0 ;;
  esac
fi

mkdir -p "$EXTRACT_DIR" "$SAFETY_DIR"
tar -C "$EXTRACT_DIR" -xzf "$ARCHIVE_TO_EXTRACT"

SAFETY_STAGE="${WORK_DIR}/safety"
mkdir -p "$SAFETY_STAGE/home" "$SAFETY_STAGE/Library/Application Support" "$SAFETY_STAGE/Documents"
copy_existing_to_safety_stage "$SAFETY_STAGE"
SAFETY_ARCHIVE="${SAFETY_DIR}/codex-before-restore-${TIMESTAMP}.tar.gz"
tar -C "$SAFETY_STAGE" -czf "$SAFETY_ARCHIVE" .

restore_if_present "${EXTRACT_DIR}/home/.codex" "${HOME}/.codex"
restore_if_present "${EXTRACT_DIR}/Library/Application Support/Codex" "${HOME}/Library/Application Support/Codex"
restore_if_present "${EXTRACT_DIR}/Library/Application Support/OpenAI" "${HOME}/Library/Application Support/OpenAI"
restore_if_present "${EXTRACT_DIR}/Library/Application Support/com.openai.codex" "${HOME}/Library/Application Support/com.openai.codex"
restore_if_present "${EXTRACT_DIR}/Documents/Codex" "${HOME}/Documents/Codex"

cat <<EOF
Restore finished.
Safety backup kept at:
  ${SAFETY_ARCHIVE}

Open Codex Desktop and sign in again if macOS Keychain or browser-encrypted state does not migrate cleanly.
EOF
