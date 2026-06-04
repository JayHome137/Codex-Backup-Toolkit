#!/usr/bin/env zsh
set -euo pipefail

TARGET="${CODEX_BACKUP_TARGET:-local}"
SMB_HOST="${CODEX_BACKUP_SMB_HOST:-${CODEX_BACKUP_HOST:-}}"
SMB_USER="${CODEX_BACKUP_SMB_USER:-${CODEX_BACKUP_USER:-}}"
SMB_SHARE="${CODEX_BACKUP_SMB_SHARE:-${CODEX_BACKUP_SHARE:-CodexBackup}}"
REMOTE_DIR="${CODEX_BACKUP_REMOTE_DIR:-codex-backups}"
TOOLKIT_REMOTE_DIR="${CODEX_BACKUP_TOOLKIT_REMOTE_DIR:-codex-restore-toolkit}"
LOCAL_DIR="${CODEX_BACKUP_LOCAL_DIR:-${HOME}/CodexBackups}"
SMB_MOUNT="${CODEX_BACKUP_SMB_MOUNT:-${CODEX_BACKUP_MOUNT:-${HOME}/Volumes/${SMB_SHARE}}}"
WEBDAV_URL="${CODEX_BACKUP_WEBDAV_URL:-}"
WEBDAV_USER="${CODEX_BACKUP_WEBDAV_USER:-}"
RCLONE_REMOTE="${CODEX_BACKUP_RCLONE_REMOTE:-}"
SPOOL_DIR="${CODEX_BACKUP_SPOOL_DIR:-${HOME}/Library/Application Support/CodexBackupToolkit/spool}"
ENCRYPT="${CODEX_BACKUP_ENCRYPT:-0}"
ENCRYPTION="${CODEX_BACKUP_ENCRYPTION:-age}"
AGE_RECIPIENT="${CODEX_BACKUP_AGE_RECIPIENT:-}"
AGE_RECIPIENT_FILE="${CODEX_BACKUP_AGE_RECIPIENT_FILE:-}"
RETENTION_COUNT="${CODEX_BACKUP_RETENTION_COUNT:-0}"
RETENTION_DAYS="${CODEX_BACKUP_RETENTION_DAYS:-0}"
KEYCHAIN_SERVICE="${CODEX_BACKUP_KEYCHAIN_SERVICE:-codexbackup-smb}"
KEYCHAIN_ACCOUNT="${CODEX_BACKUP_KEYCHAIN_ACCOUNT:-${SMB_USER}@${SMB_HOST}/${SMB_SHARE}}"
WEBDAV_KEYCHAIN_SERVICE="${CODEX_BACKUP_WEBDAV_KEYCHAIN_SERVICE:-codexbackup-webdav}"
WEBDAV_KEYCHAIN_ACCOUNT="${CODEX_BACKUP_WEBDAV_KEYCHAIN_ACCOUNT:-${WEBDAV_USER}@${WEBDAV_URL}}"
LABEL="${CODEX_BACKUP_LAUNCHD_LABEL:-dev.codexbackup.toolkit}"
HOUR="${CODEX_BACKUP_HOUR:-3}"
MINUTE="${CODEX_BACKUP_MINUTE:-0}"
INTERVAL_DAYS="${CODEX_BACKUP_INTERVAL_DAYS:-3}"
SCRIPT_DIR="${0:A:h}"
TOOLKIT_DIR="${SCRIPT_DIR:h}"
INSTALL_DIR="${CODEX_BACKUP_INSTALL_DIR:-${HOME}/Library/Application Support/CodexBackupToolkit}"
SCHEDULED_SCRIPT="${INSTALL_DIR}/scripts/codexscheduledbackup.sh"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/CodexBackup"
SCHEDULE_TEXT="$(printf '%02d:%02d' "$HOUR" "$MINUTE")"

usage() {
  cat <<'EOF'
Usage: codexinstallautomation [install|uninstall|status|validate]

Installs a macOS launchd job that checks once per day and runs codexbackup when
the configured interval has passed since the last successful backup.

The validate action writes and lints a plist, then removes it without loading a
launchd job. Use it for isolated release checks.
EOF
}

ACTION="${1:-install}"
case "$ACTION" in
  install|uninstall|status|validate|-h|--help) ;;
  *) echo "Unknown action: $ACTION" >&2; usage >&2; exit 2 ;;
esac
if [[ "$ACTION" == "-h" || "$ACTION" == "--help" ]]; then
  usage
  exit 0
fi

store_password_if_needed() {
  case "$TARGET" in
    smb)
      local password="${CODEX_BACKUP_PASSWORD:-}"
      if [[ -z "$password" ]]; then
        printf 'SMB password for %s@%s: ' "$SMB_USER" "$SMB_HOST" > /dev/tty
        stty -echo < /dev/tty
        IFS= read -r password < /dev/tty
        stty echo < /dev/tty
        printf '\n' > /dev/tty
      fi
      security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w "$password" >/dev/null
      ;;
    webdav)
      local password="${CODEX_BACKUP_WEBDAV_PASSWORD:-}"
      if [[ -z "$password" ]]; then
        printf 'WebDAV password for %s: ' "$WEBDAV_USER" > /dev/tty
        stty -echo < /dev/tty
        IFS= read -r password < /dev/tty
        stty echo < /dev/tty
        printf '\n' > /dev/tty
      fi
      security add-generic-password -U -s "$WEBDAV_KEYCHAIN_SERVICE" -a "$WEBDAV_KEYCHAIN_ACCOUNT" -w "$password" >/dev/null
      ;;
  esac
}

install_toolkit_copy() {
  mkdir -p "${INSTALL_DIR}/scripts" "${INSTALL_DIR}/docs" "${INSTALL_DIR}/examples"
  cp "${TOOLKIT_DIR}/README.md" "${INSTALL_DIR}/"
  cp "${TOOLKIT_DIR}/config.example.env" "${INSTALL_DIR}/" 2>/dev/null || true
  cp "${TOOLKIT_DIR}/scripts/codexbackup.sh" "${INSTALL_DIR}/scripts/"
  cp "${TOOLKIT_DIR}/scripts/codexscheduledbackup.sh" "${INSTALL_DIR}/scripts/"
  cp "${TOOLKIT_DIR}/scripts/codexrestore.sh" "${INSTALL_DIR}/scripts/"
  cp "${TOOLKIT_DIR}/scripts/codexinstallautomation.sh" "${INSTALL_DIR}/scripts/"
  [[ -d "${TOOLKIT_DIR}/docs" ]] && cp "${TOOLKIT_DIR}/docs/"*.md "${INSTALL_DIR}/docs/" 2>/dev/null || true
  [[ -d "${TOOLKIT_DIR}/examples" ]] && cp "${TOOLKIT_DIR}/examples/"*.env "${INSTALL_DIR}/examples/" 2>/dev/null || true
  chmod +x "${INSTALL_DIR}/scripts/"*.sh
}

write_plist() {
  mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>${SCHEDULED_SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CODEX_BACKUP_TARGET</key>
    <string>${TARGET}</string>
    <key>CODEX_BACKUP_LOCAL_DIR</key>
    <string>${LOCAL_DIR}</string>
    <key>CODEX_BACKUP_SMB_HOST</key>
    <string>${SMB_HOST}</string>
    <key>CODEX_BACKUP_SMB_USER</key>
    <string>${SMB_USER}</string>
    <key>CODEX_BACKUP_SMB_SHARE</key>
    <string>${SMB_SHARE}</string>
    <key>CODEX_BACKUP_REMOTE_DIR</key>
    <string>${REMOTE_DIR}</string>
    <key>CODEX_BACKUP_TOOLKIT_REMOTE_DIR</key>
    <string>${TOOLKIT_REMOTE_DIR}</string>
    <key>CODEX_BACKUP_SMB_MOUNT</key>
    <string>${SMB_MOUNT}</string>
    <key>CODEX_BACKUP_WEBDAV_URL</key>
    <string>${WEBDAV_URL}</string>
    <key>CODEX_BACKUP_WEBDAV_USER</key>
    <string>${WEBDAV_USER}</string>
    <key>CODEX_BACKUP_RCLONE_REMOTE</key>
    <string>${RCLONE_REMOTE}</string>
    <key>CODEX_BACKUP_SPOOL_DIR</key>
    <string>${SPOOL_DIR}</string>
    <key>CODEX_BACKUP_INTERVAL_DAYS</key>
    <string>${INTERVAL_DAYS}</string>
    <key>CODEX_BACKUP_ENCRYPT</key>
    <string>${ENCRYPT}</string>
    <key>CODEX_BACKUP_ENCRYPTION</key>
    <string>${ENCRYPTION}</string>
    <key>CODEX_BACKUP_AGE_RECIPIENT</key>
    <string>${AGE_RECIPIENT}</string>
    <key>CODEX_BACKUP_AGE_RECIPIENT_FILE</key>
    <string>${AGE_RECIPIENT_FILE}</string>
    <key>CODEX_BACKUP_RETENTION_COUNT</key>
    <string>${RETENTION_COUNT}</string>
    <key>CODEX_BACKUP_RETENTION_DAYS</key>
    <string>${RETENTION_DAYS}</string>
    <key>CODEX_BACKUP_KEYCHAIN_SERVICE</key>
    <string>${KEYCHAIN_SERVICE}</string>
    <key>CODEX_BACKUP_KEYCHAIN_ACCOUNT</key>
    <string>${KEYCHAIN_ACCOUNT}</string>
    <key>CODEX_BACKUP_WEBDAV_KEYCHAIN_SERVICE</key>
    <string>${WEBDAV_KEYCHAIN_SERVICE}</string>
    <key>CODEX_BACKUP_WEBDAV_KEYCHAIN_ACCOUNT</key>
    <string>${WEBDAV_KEYCHAIN_ACCOUNT}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/backup.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/backup.err.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF
  plutil -lint "$PLIST" >/dev/null
}

unload_job() {
  launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
}

case "$ACTION" in
  install)
    [[ -x "${SCRIPT_DIR}/codexbackup.sh" ]] || { echo "Backup script is not executable: ${SCRIPT_DIR}/codexbackup.sh" >&2; exit 1; }
    [[ -x "${SCRIPT_DIR}/codexscheduledbackup.sh" ]] || { echo "Scheduled script is not executable: ${SCRIPT_DIR}/codexscheduledbackup.sh" >&2; exit 1; }
    store_password_if_needed
    install_toolkit_copy
    unload_job
    write_plist
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    launchctl enable "gui/$(id -u)/${LABEL}"
    cat <<EOF
Installed launchd job: ${LABEL}
Target: ${TARGET}
Schedule: check every day at ${SCHEDULE_TEXT}; run backup every ${INTERVAL_DAYS} days after last success
Plist: ${PLIST}
Installed toolkit: ${INSTALL_DIR}
Logs:
  ${LOG_DIR}/backup.out.log
  ${LOG_DIR}/backup.err.log

Run now for a full test:
  launchctl kickstart -k gui/$(id -u)/${LABEL}
EOF
    ;;
  uninstall)
    unload_job
    rm -f "$PLIST"
    echo "Uninstalled launchd job: ${LABEL}"
    ;;
  status)
    launchctl print "gui/$(id -u)/${LABEL}" 2>/dev/null || {
      echo "Job is not loaded: ${LABEL}"
      exit 1
    }
    ;;
  validate)
    install_toolkit_copy
    write_plist
    rm -f "$PLIST"
    echo "Validated launchd plist for label: ${LABEL}"
    echo "No launchd job was loaded."
    ;;
esac
