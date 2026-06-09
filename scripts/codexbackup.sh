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
REMOTE_RETENTION="${CODEX_BACKUP_REMOTE_RETENTION:-0}"
SYNC_ENABLED="${CODEX_BACKUP_SYNC_ENABLED:-0}"
SYNC_CHECK_INTERVAL_HOURS="${CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS:-24}"
SYNC_MIN_BACKUP_INTERVAL_HOURS="${CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS:-24}"
STATE_DIR="${CODEX_BACKUP_STATE_DIR:-${HOME}/Library/Application Support/CodexBackupToolkit/state}"
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
FINGERPRINT="${WORK_DIR}/${ARCHIVE_BASENAME}.fingerprint.txt"
ARCHIVE="${WORK_DIR}/${ARCHIVE_FILE_NAME}"
DOCTOR=0
DRY_RUN=0
LIST_TARGETS=0
CONFIG_GUIDE=0
SYNC_CHECK=0
SYNC_LOCAL_AUTHORITATIVE=0
PROFILE_PLAN=0
PROFILE_PLAN_PLATFORM="${CODEX_BACKUP_PROFILE_PLAN_PLATFORM:-darwin}"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: codexbackup [--target local|smb|webdav|rclone] [--local-output DIR]
       codexbackup --doctor
       codexbackup --config-guide [--target local|smb|webdav|rclone]
       codexbackup --sync-check [--target local|smb|webdav|rclone]
       codexbackup --sync-local-authoritative [--target local|smb|webdav|rclone]
       codexbackup --profile-plan --platform darwin|win32
       codexbackup --list-targets

Creates a Codex Desktop backup archive and publishes it to the configured
storage target. The default target is local.

Options:
  --target TARGET      Override CODEX_BACKUP_TARGET for this run.
  --local-output DIR   Write backup files to a local directory. Alias for --target local.
  --doctor             Check dependencies and target configuration without backing up.
  --config-guide       Print target setup, safety, and encryption guidance.
  --sync-check         Compare local data with the latest backup fingerprint. Read-only.
  --sync-local-authoritative
                       If local data differs from the latest backup, create a new timestamped backup.
  --profile-plan       Print the Codex profile path plan without backing up.
  --platform PLATFORM  Platform for --profile-plan. Supported: darwin, win32.
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
    --config-guide)
      CONFIG_GUIDE=1
      shift
      ;;
    --sync-check)
      SYNC_CHECK=1
      shift
      ;;
    --sync-local-authoritative)
      SYNC_LOCAL_AUTHORITATIVE=1
      shift
      ;;
    --profile-plan)
      PROFILE_PLAN=1
      shift
      ;;
    --platform)
      [[ $# -ge 2 ]] || { echo "Missing value for --platform" >&2; exit 2; }
      PROFILE_PLAN_PLATFORM="$2"
      shift 2
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

print_config_guide() {
  cat <<EOF
CodexBackup config guide
Target: ${TARGET}

Base settings:
  CODEX_BACKUP_TARGET=${TARGET}
  CODEX_BACKUP_REMOTE_DIR=${REMOTE_DIR}
  CODEX_BACKUP_RETENTION_COUNT=${RETENTION_COUNT}
  CODEX_BACKUP_RETENTION_DAYS=${RETENTION_DAYS}
  CODEX_BACKUP_REMOTE_RETENTION=${REMOTE_RETENTION}

Target settings:
EOF

  case "$TARGET" in
    local)
      cat <<EOF
  CODEX_BACKUP_LOCAL_DIR="${LOCAL_DIR}"
EOF
      ;;
    smb)
      cat <<EOF
  CODEX_BACKUP_SMB_HOST=${SMB_HOST:-nas.example.local}
  CODEX_BACKUP_SMB_USER=${SMB_USER:-backup-user}
  CODEX_BACKUP_SMB_SHARE=${SMB_SHARE}
  CODEX_BACKUP_PASSWORD should be supplied only for one run, or stored in Keychain.
EOF
      ;;
    webdav)
      cat <<EOF
  CODEX_BACKUP_WEBDAV_URL="${WEBDAV_URL:-https://webdav.example.com/remote.php/dav/files/user/CodexBackup}"
  CODEX_BACKUP_WEBDAV_USER=${WEBDAV_USER:-backup-user}
  CODEX_BACKUP_WEBDAV_PASSWORD should be supplied only for one run, or stored in Keychain.
EOF
      ;;
    rclone)
      cat <<EOF
  CODEX_BACKUP_RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:CodexBackup}"
  Run rclone config before using this target.
EOF
      ;;
    *)
      echo "  Unknown target: ${TARGET}"
      ;;
  esac

  cat <<'EOF'

Encryption guidance:
  CODEX_BACKUP_ENCRYPT=1
  CODEX_BACKUP_ENCRYPTION=age
  CODEX_BACKUP_AGE_RECIPIENT=age1...
  # or:
  CODEX_BACKUP_AGE_RECIPIENT_FILE=/path/to/recipients.txt

Safety notes:
  - Passwords are not printed into config.env by the GUI preview.
  - WebDAV and rclone retention is off unless CODEX_BACKUP_REMOTE_RETENTION=1.
  - Run --doctor before the first real backup.
EOF
}

if [[ "$CONFIG_GUIDE" -eq 1 ]]; then
  print_config_guide
  exit 0
fi

print_profile_plan() {
  case "$PROFILE_PLAN_PLATFORM" in
    darwin|win32) ;;
    *) echo "Unsupported profile plan platform: ${PROFILE_PLAN_PLATFORM}" >&2; exit 2 ;;
  esac

  CODEX_BACKUP_PROFILE_PLAN_PLATFORM="$PROFILE_PLAN_PLATFORM" \
  CODEX_BACKUP_PROFILE_PLAN_PROFILE="$PROFILE" \
  CODEX_BACKUP_TOOLKIT_DIR="$TOOLKIT_DIR" \
  node --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(`${process.env.CODEX_BACKUP_TOOLKIT_DIR}/helper/profile-paths.mjs`).href;
const { buildProfilePathPlan, profilePathPlanToText } = await import(moduleUrl);

const plan = buildProfilePathPlan({
  appDataDir: process.env.APPDATA,
  documentsDir: process.env.CODEX_BACKUP_DOCUMENTS_DIR,
  homeDir: process.env.HOME || process.env.USERPROFILE,
  localAppDataDir: process.env.LOCALAPPDATA,
  platform: process.env.CODEX_BACKUP_PROFILE_PLAN_PLATFORM,
  profile: process.env.CODEX_BACKUP_PROFILE_PLAN_PROFILE,
});

process.stdout.write(profilePathPlanToText(plan));
EOF
}

profile_archive_sources_tsv() {
  CODEX_BACKUP_PROFILE_PLAN_PROFILE="$PROFILE" \
  CODEX_BACKUP_STAGING_DIR="$STAGING_DIR" \
  CODEX_BACKUP_TOOLKIT_DIR="$TOOLKIT_DIR" \
  node --input-type=module <<'EOF'
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(`${process.env.CODEX_BACKUP_TOOLKIT_DIR}/helper/profile-paths.mjs`).href;
const { buildProfileArchivePlan } = await import(moduleUrl);

const plan = buildProfileArchivePlan({
  homeDir: process.env.HOME,
  platform: 'darwin',
  profile: process.env.CODEX_BACKUP_PROFILE_PLAN_PROFILE,
  stagingDir: process.env.CODEX_BACKUP_STAGING_DIR,
});

for (const source of plan.sources) {
  process.stdout.write(`${source.sourcePath}\t${source.archivePath}\t${source.stagingPath}\n`);
}
EOF
}

if [[ "$PROFILE_PLAN" -eq 1 ]]; then
  print_profile_plan
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

doctor_saved_secret() {
  local service="$1"
  local account="$2"
  security find-generic-password -s "$service" -a "$account" -w 2>/dev/null || true
}

webdav_propfind_status() {
  local url="$1"
  local user="$2"
  local password="$3"
  curl -sS -o /dev/null -w '%{http_code}' -u "${user}:${password}" -X PROPFIND -H 'Depth: 0' "${url%/}/" 2>/dev/null || true
}

webdav_check_folder() {
  local label="$1"
  local url="$2"
  local user="$3"
  local password="$4"
  local missing_message="$5"
  local http_status
  http_status="$(webdav_propfind_status "$url" "$user" "$password")"
  case "$http_status" in
    200|207)
      printf 'ok: %s\n' "$label"
      return 0
      ;;
    401|403)
      echo "fail: WebDAV credentials rejected"
      return 1
      ;;
    404|405)
      printf 'fail: %s\n' "$missing_message"
      return 1
      ;;
    *)
      printf 'fail: %s unreachable\n' "$label"
      echo "warn: WebDAV PROPFIND returned HTTP ${http_status:-000}"
      return 1
      ;;
  esac
}

webdav_write_probe() {
  local url="$1"
  local user="$2"
  local password="$3"
  local probe_file probe_name http_status
  probe_file="${WORK_DIR}/webdav-write-check.txt"
  probe_name=".codexbackup-write-check-${TIMESTAMP}.txt"
  print -r -- "codexbackup webdav write check ${TIMESTAMP}" > "$probe_file"
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' -u "${user}:${password}" -T "$probe_file" "${url%/}/${probe_name}" 2>/dev/null || true)"
  case "$http_status" in
    200|201|204|207)
      curl -fsS -u "${user}:${password}" -X DELETE "${url%/}/${probe_name}" >/dev/null 2>&1 || true
      echo "ok: WebDAV backup folder writable"
      return 0
      ;;
    401|403)
      echo "fail: WebDAV backup folder is not writable"
      echo "warn: check the WebDAV account permission for ${url}"
      return 1
      ;;
    404|405)
      echo "fail: WebDAV backup folder missing"
      echo "warn: create this WebDAV folder manually before backing up: ${url}"
      return 1
      ;;
    *)
      echo "fail: WebDAV backup write check failed"
      echo "warn: WebDAV PUT returned HTTP ${http_status:-000}"
      return 1
      ;;
  esac
}

doctor_webdav_check() {
  local password base_url backup_url
  password="${CODEX_BACKUP_WEBDAV_PASSWORD:-}"
  if [[ -z "$password" ]]; then
    password="$(doctor_saved_secret "$WEBDAV_KEYCHAIN_SERVICE" "$WEBDAV_KEYCHAIN_ACCOUNT")"
  fi
  if [[ -z "$password" ]]; then
    echo "fail: WebDAV password missing"
    echo "warn: save the WebDAV password in Keychain or set CODEX_BACKUP_WEBDAV_PASSWORD for this check"
    return 1
  fi

  base_url="${WEBDAV_URL%/}"
  backup_url="${base_url}/${REMOTE_DIR}"
  webdav_check_folder "WebDAV target reachable" "$base_url" "$WEBDAV_USER" "$password" "WebDAV target folder missing" || {
    echo "warn: create the target WebDAV folder manually before backing up: ${base_url}"
    return 1
  }
  webdav_check_folder "WebDAV backup folder reachable" "$backup_url" "$WEBDAV_USER" "$password" "WebDAV backup folder missing" || {
    echo "warn: create this WebDAV folder manually before backing up: ${backup_url}"
    return 1
  }
  webdav_write_probe "$backup_url" "$WEBDAV_USER" "$password"
}

run_doctor() {
  local failures=0
  echo "codexbackup doctor"
  echo "Target: ${TARGET}"
  doctor_check "zsh available" command -v zsh || failures=$((failures + 1))
  doctor_check "node available" command -v node || failures=$((failures + 1))
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
      if [[ -n "$WEBDAV_URL" && -n "$WEBDAV_USER" ]]; then
        doctor_webdav_check || failures=$((failures + 1))
      fi
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
Remote retention: ${REMOTE_RETENTION}
Would inspect:
EOF
  profile_sources_tsv="$(profile_archive_sources_tsv)"
  while IFS=$'\t' read -r source_path _archive_path _staging_path; do
    [[ -n "$source_path" ]] || continue
    print -r -- "  ${source_path}"
  done <<< "$profile_sources_tsv"
  exit 0
fi

if [[ "$SYNC_CHECK" -eq 1 && "$SYNC_LOCAL_AUTHORITATIVE" -eq 1 ]]; then
  echo "Use either --sync-check or --sync-local-authoritative, not both." >&2
  exit 2
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

fingerprint_if_exists() {
  local src="$1"
  local label="$2"
  if [[ ! -e "$src" ]]; then
    printf 'missing\t%s\t%s\n' "$label" "$src"
    return 0
  fi

  if [[ -d "$src" ]]; then
    (
      cd "$src"
      find . \
        -path './.git/fsmonitor--daemon.ipc' -prune -o \
        -path './tmp' -prune -o \
        -path './.tmp' -prune -o \
        -type f ! -name '*.sock' ! -name '*.socket' -print0 |
        LC_ALL=C sort -z |
        while IFS= read -r -d '' file; do
          local digest size
          digest="$(shasum -a 256 "$file" | awk '{print $1}')"
          size="$(stat -f '%z' "$file" 2>/dev/null || wc -c < "$file" | tr -d ' ')"
          printf 'file\t%s/%s\t%s\t%s\n' "$label" "${file#./}" "$size" "$digest"
        done
    )
    return 0
  fi

  local digest size
  digest="$(shasum -a 256 "$src" | awk '{print $1}')"
  size="$(stat -f '%z' "$src" 2>/dev/null || wc -c < "$src" | tr -d ' ')"
  printf 'file\t%s\t%s\t%s\n' "$label" "$size" "$digest"
}

write_local_fingerprint() {
  local dest="$1"
  local profile_sources_tsv
  profile_sources_tsv="$(profile_archive_sources_tsv)"
  {
    local source_path archive_path _staging_path
    printf 'Codex backup fingerprint v1\n'
    printf 'Profile: %s\n' "$PROFILE"
    while IFS=$'\t' read -r source_path archive_path _staging_path; do
      [[ -n "$source_path" ]] || continue
      fingerprint_if_exists "$source_path" "$archive_path"
    done <<< "$profile_sources_tsv"
  } > "$dest"
}

fingerprint_digest() {
  shasum -a 256 "$1" | awk '{print $1}'
}

select_latest_archive_path() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  find "$dir" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' \) -print | sort | tail -1
}

fingerprint_for_archive_path() {
  local archive="$1"
  if [[ "$archive" == *.tar.gz.age ]]; then
    print -r -- "${archive%.tar.gz.age}.fingerprint.txt"
  else
    print -r -- "${archive%.tar.gz}.fingerprint.txt"
  fi
}

state_file() {
  print -r -- "${STATE_DIR}/$1"
}

hours_to_seconds() {
  local hours="$1"
  [[ "$hours" =~ '^[0-9]+$' ]] || { echo 0; return 0; }
  echo $((hours * 60 * 60))
}

sync_interval_elapsed() {
  local state_path interval_seconds last now
  state_path="$(state_file last-sync-check-epoch)"
  interval_seconds="$(hours_to_seconds "$SYNC_CHECK_INTERVAL_HOURS")"
  (( interval_seconds <= 0 )) && return 0
  [[ -f "$state_path" ]] || return 0
  last="$(cat "$state_path" 2>/dev/null || echo 0)"
  [[ "$last" =~ '^[0-9]+$' ]] || return 0
  now="$(date +%s)"
  (( now - last >= interval_seconds ))
}

sync_backup_cooldown_elapsed() {
  local state_path interval_seconds last now
  state_path="$(state_file last-sync-backup-epoch)"
  interval_seconds="$(hours_to_seconds "$SYNC_MIN_BACKUP_INTERVAL_HOURS")"
  (( interval_seconds <= 0 )) && return 0
  [[ -f "$state_path" ]] || return 0
  last="$(cat "$state_path" 2>/dev/null || echo 0)"
  [[ "$last" =~ '^[0-9]+$' ]] || return 0
  now="$(date +%s)"
  (( now - last >= interval_seconds ))
}

write_sync_state() {
  local name="$1"
  mkdir -p "$STATE_DIR"
  date +%s > "$(state_file "$name")"
}

sync_target_dir() {
  case "$TARGET" in
    local)
      print -r -- "$LOCAL_DIR"
      ;;
    smb)
      nc -z -G 5 "$SMB_HOST" 445 >/dev/null 2>&1 || {
        echo "Cannot reach ${SMB_HOST}:445. Check network or use --target local." >&2
        exit 1
      }
      mount_smb_target
      print -r -- "${SMB_MOUNT}/${REMOTE_DIR}"
      ;;
    *)
      echo "Sync check currently supports local and smb targets. Use normal backups for ${TARGET}." >&2
      exit 2
      ;;
  esac
}

run_sync_check() {
  local target_dir latest_archive latest_fingerprint local_fingerprint local_digest backup_digest
  target_dir="$(sync_target_dir)"
  latest_archive="$(select_latest_archive_path "$target_dir")"
  local_fingerprint="${WORK_DIR}/current.fingerprint.txt"
  write_local_fingerprint "$local_fingerprint"
  local_digest="$(fingerprint_digest "$local_fingerprint")"

  echo "Codex sync check"
  echo "Target: ${TARGET}"
  echo "Target path: ${target_dir}"
  echo "Local fingerprint: ${local_digest}"

  if [[ -z "$latest_archive" ]]; then
    echo "Sync status: missing-backup"
    echo "Reason: no latest backup archive found."
    return 20
  fi

  latest_fingerprint="$(fingerprint_for_archive_path "$latest_archive")"
  echo "Latest backup: ${latest_archive}"
  echo "Latest fingerprint: ${latest_fingerprint}"
  if [[ ! -f "$latest_fingerprint" ]]; then
    echo "Sync status: missing-fingerprint"
    echo "Reason: latest backup has no fingerprint sidecar."
    return 21
  fi

  backup_digest="$(fingerprint_digest "$latest_fingerprint")"
  echo "Backup fingerprint: ${backup_digest}"
  if [[ "$local_digest" == "$backup_digest" ]]; then
    echo "Sync status: consistent"
    return 0
  fi

  echo "Sync status: drift"
  echo "Reason: local data differs from the latest backup fingerprint."
  return 22
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

webdav_list_file_names() {
  local url="$1"
  local user="$2"
  local password="$3"
  local href basename
  curl -fsS -u "${user}:${password}" -X PROPFIND -H 'Depth: 1' "${url%/}/" |
    sed -nE 's/.*<[^>]*href[^>]*>([^<]+)<\/[^>]*href>.*/\1/p' |
    while IFS= read -r href; do
      basename="${href:t}"
      [[ -n "$basename" ]] && print -r -- "$basename"
    done
}

webdav_delete_file() {
  local url="$1"
  local user="$2"
  local password="$3"
  local file_name="$4"
  curl -fsS -u "${user}:${password}" -X DELETE "${url%/}/${file_name}" >/dev/null
}

publish_restore_toolkit_to_webdav() {
  local toolkit_url="$1"
  local scripts_url="$2"
  local user="$3"
  local password="$4"
  webdav_upload "${TOOLKIT_DIR}/README.md" "$toolkit_url" "$user" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexbackup.sh" "$scripts_url" "$user" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexscheduledbackup.sh" "$scripts_url" "$user" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexrestore.sh" "$scripts_url" "$user" "$password"
  webdav_upload "${TOOLKIT_DIR}/scripts/codexinstallautomation.sh" "$scripts_url" "$user" "$password"
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
  apply_webdav_retention "$backup_url" "$WEBDAV_USER" "$password"
  if ! publish_restore_toolkit_to_webdav "$toolkit_url" "$scripts_url" "$WEBDAV_USER" "$password"; then
    echo "warn: WebDAV restore toolkit upload skipped. Backup archive upload already completed; create ${toolkit_url} and ${scripts_url} manually if you want the restore helper files online." >&2
  fi
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
  apply_rclone_retention "$backup_dest"
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
    find "$dir" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' -o -name 'codex-backup-*.tar.gz.sha256' -o -name 'codex-backup-*.tar.gz.age.sha256' -o -name 'codex-backup-*.manifest.txt' -o -name 'codex-backup-*.fingerprint.txt' \) -mtime +"$RETENTION_DAYS" -delete
  fi

  if [[ "$RETENTION_COUNT" =~ '^[0-9]+$' ]] && (( RETENTION_COUNT > 0 )); then
    local old_base
    find "$dir" -maxdepth 1 -type f \( -name 'codex-backup-*.tar.gz' -o -name 'codex-backup-*.tar.gz.age' \) -print | sort -r | tail -n +$((RETENTION_COUNT + 1)) | while IFS= read -r old_base; do
      rm -f "$old_base" "${old_base}.sha256"
      rm -f "${old_base%.tar.gz}.manifest.txt" "${old_base%.tar.gz.age}.manifest.txt"
      rm -f "${old_base%.tar.gz}.fingerprint.txt" "${old_base%.tar.gz.age}.fingerprint.txt"
    done
  fi

  return 0
}

remote_retention_enabled() {
  case "$REMOTE_RETENTION" in
    1|true|yes) return 0 ;;
    *) return 1 ;;
  esac
}

remote_retention_count_enabled() {
  remote_retention_enabled || return 1
  [[ "$RETENTION_COUNT" =~ '^[0-9]+$' ]] && (( RETENTION_COUNT > 0 ))
}

archive_manifest_name() {
  local archive_name="$1"
  if [[ "$archive_name" == *.tar.gz.age ]]; then
    print -r -- "${archive_name%.tar.gz.age}.manifest.txt"
  else
    print -r -- "${archive_name%.tar.gz}.manifest.txt"
  fi
}

select_remote_archives_to_delete() {
  local matches
  matches="$(grep -E '^codex-backup-.*\.tar\.gz(\.age)?$' || true)"
  [[ -n "$matches" ]] || return 0
  print -r -- "$matches" | sort -r | tail -n +$((RETENTION_COUNT + 1))
}

remote_artifacts_for_archive() {
  local archive_name="$1"
  print -r -- "$archive_name"
  print -r -- "${archive_name}.sha256"
  print -r -- "$(archive_manifest_name "$archive_name")"
  if [[ "$archive_name" == *.tar.gz.age ]]; then
    print -r -- "${archive_name%.tar.gz.age}.fingerprint.txt"
  else
    print -r -- "${archive_name%.tar.gz}.fingerprint.txt"
  fi
}

apply_webdav_retention() {
  local backup_url="$1"
  local user="$2"
  local password="$3"
  remote_retention_count_enabled || return 0

  local old_archive artifact
  webdav_list_file_names "$backup_url" "$user" "$password" | select_remote_archives_to_delete | while IFS= read -r old_archive; do
    remote_artifacts_for_archive "$old_archive" | while IFS= read -r artifact; do
      webdav_delete_file "$backup_url" "$user" "$password" "$artifact" || true
    done
  done
}

apply_rclone_retention() {
  local backup_dest="$1"
  remote_retention_count_enabled || return 0

  local old_archive artifact
  rclone lsf "$backup_dest" --files-only | select_remote_archives_to_delete | while IFS= read -r old_archive; do
    remote_artifacts_for_archive "$old_archive" | while IFS= read -r artifact; do
      rclone deletefile "${backup_dest}/${artifact}" || true
    done
  done
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

run_backup() {
  local source_path archive_path staging_path profile_sources_tsv
  profile_sources_tsv="$(profile_archive_sources_tsv)"

  echo "Codex backup"
  echo "Tool: ${TOOL_NAME}"
  echo "Target: ${TARGET}"
  echo "Timestamp: ${TIMESTAMP}"
  echo "Archive: ${ARCHIVE_BASENAME}.tar.gz"
  echo

  mkdir -p "$STAGING_DIR"

  cat > "$MANIFEST" <<EOF
Codex backup manifest
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Source home: ${HOME}
Source host: ${HOSTNAME_SAFE}
Profile: ${PROFILE}
Target: ${TARGET}

EOF

  while IFS=$'\t' read -r source_path archive_path staging_path; do
    [[ -n "$source_path" ]] || continue
    copy_if_exists "$source_path" "$staging_path"
  done <<< "$profile_sources_tsv"
  write_local_fingerprint "$FINGERPRINT"

  cat >> "$MANIFEST" <<EOF

Archive format: tar.gz
Restore script: scripts/codexrestore.sh
Excluded transient files: .git/fsmonitor--daemon.ipc, tmp/, .tmp/, *.sock, *.socket
EOF

  cp "$MANIFEST" "${STAGING_DIR}/MANIFEST.txt"
  cp "$FINGERPRINT" "${STAGING_DIR}/FINGERPRINT.txt"

  tar -C "$STAGING_DIR" -czf "$ARCHIVE" .
  (cd "$(dirname "$ARCHIVE")" && shasum -a 256 "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")

  FINAL_ARCHIVE="$(encrypt_archive_if_requested)"
  FINAL_SHA="${FINAL_ARCHIVE}.sha256"
  FINAL_FILES=("$FINAL_ARCHIVE" "$FINAL_SHA" "$MANIFEST" "$FINGERPRINT")
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
}

if [[ "$SYNC_CHECK" -eq 1 ]]; then
  set +e
  run_sync_check
  SYNC_STATUS=$?
  set -e
  case "$SYNC_STATUS" in
    0|20|21|22) exit 0 ;;
    *) exit "$SYNC_STATUS" ;;
  esac
fi

if [[ "$SYNC_LOCAL_AUTHORITATIVE" -eq 1 ]]; then
  if ! sync_interval_elapsed; then
    echo "Codex sync check"
    echo "Sync action: check-skipped"
    echo "Reason: CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=${SYNC_CHECK_INTERVAL_HOURS} has not elapsed."
    exit 0
  fi

  set +e
  SYNC_OUTPUT="$(run_sync_check 2>&1)"
  SYNC_STATUS=$?
  set -e
  print -r -- "$SYNC_OUTPUT"
  write_sync_state last-sync-check-epoch

  case "$SYNC_STATUS" in
    0)
      echo "Sync action: already-consistent"
      exit 0
      ;;
    20|21|22)
      if ! sync_backup_cooldown_elapsed; then
        echo "Sync action: backup-cooldown"
        echo "Reason: CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=${SYNC_MIN_BACKUP_INTERVAL_HOURS} has not elapsed."
        exit 0
      fi
      echo "Sync action: backup-needed"
      run_backup
      write_sync_state last-sync-backup-epoch
      echo "Sync action: backup-created"
      exit 0
      ;;
    *)
      exit "$SYNC_STATUS"
      ;;
  esac
fi

run_backup
