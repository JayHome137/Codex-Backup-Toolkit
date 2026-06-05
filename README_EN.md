# Codex-Backup-toolkit

`codexbackup` is a macOS-first backup and restore toolkit for Codex Desktop. It archives the local state that makes Codex feel like your current machine, then publishes the archive to a local folder, SMB/NAS share, WebDAV endpoint, or rclone remote.

The current public scope is Codex Desktop backup, restore, automation, and the browser GUI/helper foundation.

## What It Backs Up

- `~/.codex`
- `~/Library/Application Support/Codex`
- `~/Library/Application Support/OpenAI`
- `~/Library/Application Support/OpenAI/Codex`
- `~/Library/Application Support/com.openai.codex`
- `~/Documents/Codex`

The archive includes Codex config, skills, plugins, memories, sessions, local app/browser state, auth files present on disk, and Codex workspaces under `~/Documents/Codex`.

Transient runtime files such as `.codex/tmp`, `.codex/.tmp`, sockets, and Git fsmonitor IPC files are excluded because they can disappear while Codex is running and are not useful for restore.

Important limitation: some login/session material may be protected by macOS Keychain or device-bound browser encryption. Restoring files to a new Mac may still require signing in again.

## Quick Start

Create a local backup:

```zsh
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

Check your environment before a real backup:

```zsh
./scripts/codexbackup.sh --doctor --target local
```

Print target-specific setup guidance:

```zsh
./scripts/codexbackup.sh --config-guide --target webdav
```

Preview what would be backed up:

```zsh
./scripts/codexbackup.sh --dry-run
```

Restore the latest local backup:

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --latest
```

Restore the latest WebDAV or rclone backup:

```zsh
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER=backup-user \
./scripts/codexrestore.sh --latest

CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup" \
./scripts/codexrestore.sh --latest
```

Restore a specific archive:

```zsh
./scripts/codexrestore.sh --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

Print a restore plan without changing files:

```zsh
./scripts/codexrestore.sh --plan --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

## Configure A Target

Copy the example config and edit it:

```zsh
cp config.example.env config.env
$EDITOR config.env
source ./config.env
```

Supported `CODEX_BACKUP_TARGET` values:

- `local`: write archives to a folder on this Mac.
- `smb`: mount an SMB/NAS share with `mount_smbfs`.
- `webdav`: upload and download archives with `curl` through a WebDAV server.
- `rclone`: upload and download archives with `rclone copy` and `rclone copyto` through any configured rclone remote.

See [storage-targets.md](docs/storage-targets.md) and the files in [examples](examples) for target-specific configuration.

Print supported targets:

```zsh
./scripts/codexbackup.sh --list-targets
```

## Optional Encryption

Set `CODEX_BACKUP_ENCRYPT=1` to encrypt the archive with [age](https://age-encryption.org/):

```zsh
CODEX_BACKUP_ENCRYPT=1 \
CODEX_BACKUP_AGE_RECIPIENT='age1...' \
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

Encrypted backups are written as:

```text
codex-backup-<host>-<timestamp>.tar.gz.age
codex-backup-<host>-<timestamp>.tar.gz.age.sha256
```

Restore with the matching age identity:

```zsh
./scripts/codexrestore.sh \
  --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz.age \
  --age-identity /path/to/age-identity.txt
```

## Retention

Local and SMB targets support simple cleanup after a successful backup:

```zsh
CODEX_BACKUP_RETENTION_COUNT=10
CODEX_BACKUP_RETENTION_DAYS=30
```

`CODEX_BACKUP_RETENTION_COUNT` keeps the newest N backup archives. `CODEX_BACKUP_RETENTION_DAYS` removes backup artifacts older than N days. Both default to `0`, which disables cleanup.

WebDAV and rclone remote retention is opt-in. Set `CODEX_BACKUP_REMOTE_RETENTION=1` to keep the newest `CODEX_BACKUP_RETENTION_COUNT` remote archives and delete older remote artifacts. The default is `CODEX_BACKUP_REMOTE_RETENTION=0`, so cloud targets are not cleaned up unless explicitly enabled.

## Automatic Backups

Install a macOS `launchd` job:

```zsh
source ./config.env
./scripts/codexinstallautomation.sh install
```

By default the job checks every day at `03:00` and runs a real backup only when at least `3` days have passed since the last successful backup.

Change the schedule during install:

```zsh
CODEX_BACKUP_HOUR=2 \
CODEX_BACKUP_MINUTE=15 \
CODEX_BACKUP_INTERVAL_DAYS=3 \
./scripts/codexinstallautomation.sh install
```

Check or remove the job:

```zsh
./scripts/codexinstallautomation.sh status
./scripts/codexinstallautomation.sh uninstall
```

The installer copies this toolkit to:

```text
~/Library/Application Support/CodexBackupToolkit/
```

Logs are written to:

```text
~/Library/Logs/CodexBackup/backup.out.log
~/Library/Logs/CodexBackup/backup.err.log
```

## Web GUI Prototype

The repository includes a browser-based GUI prototype for validating the interface, target configuration flow, and command previews:

```zsh
cd gui
npm ci
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173
```

The current GUI focuses on configuration, persisted config, Keychain secret actions, safety checks, controlled backup execution, restore planning, helper connection state, and helper health/history surfaces. Mock mode still previews commands only. When the local HTTP helper is running and `HTTP Helper` mode is selected, the GUI can execute real `codexbackup` backup commands and `codexrestore --plan` restore-plan commands through structured helper actions. Real restore, install, uninstall, and status commands are still blocked.

The interface currently supports target forms, configuration checks, age encryption guidance, `config.env` previews, command copying, latest/archive restore plans, mock/helper output, run history, helper online/offline status, disabled helper actions when the helper is offline, and clearer loading/error states for helper actions.

The GUI includes two local bridge-related modes:

- `Local Bridge`: uses a mock helper to show protocol responses and allowlist behavior without executing shell commands.
- `HTTP Helper`: connects to a manually started local helper at `http://127.0.0.1:37371`.

The local helper is not started by default and does not auto-run with the GUI. For development validation, start it in a separate terminal:

```zsh
node helper/server.mjs
```

The current helper allows `codexbackup --doctor`, real `codexbackup` backup commands, `codexrestore --plan` restore-plan commands, and isolated `codexinstallautomation validate` commands that use `dev.codexbackup.toolkit.test.*` labels. Real restore, install, uninstall, status, and appended shell commands are blocked. Encrypted backup commands must include `CODEX_BACKUP_AGE_RECIPIENT` or `CODEX_BACKUP_AGE_RECIPIENT_FILE`. See [helper-protocol.md](docs/helper-protocol.md) for the protocol.

The helper also exposes opt-in product-state endpoints for the GUI:

- `GET /config` and `PUT /config` persist sanitized config at `~/Library/Application Support/CodexBackupToolkit/config.json`; the GUI can now load and save this config directly.
- `POST /secret` and `DELETE /secret` write/delete password-like values through macOS Keychain; the GUI can now manage SMB/WebDAV secrets through these endpoints.
- `GET /history` returns recent backup history recorded by successful helper backup runs; the GUI can now display this history on the logs page.

After selecting `HTTP 助手` in the GUI, use `检查助手` to call `/health` first. This only confirms the helper is online; it does not run backup scripts or modify any scheduled job. If the helper is offline, config, Keychain, and real history buttons are disabled until a later health check succeeds.

## Output Files

Each backup creates:

- `codex-backup-<host>-<timestamp>.tar.gz`
- `codex-backup-<host>-<timestamp>.tar.gz.sha256`
- `codex-backup-<host>-<timestamp>.manifest.txt`

The backup first writes finished files to a local spool directory, then publishes them to the configured target. If the remote target is unavailable, the local spool copy remains available for manual retry.

## Restore Safety

Before overwriting anything, `codexrestore` creates a safety archive of the current target files at:

```text
~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz
```

Read [restore-guide.md](docs/restore-guide.md) before restoring on a new Mac.

## Security

Codex backups can contain sensitive material: local auth files, cookies, sessions, plugin state, memory, and project files. Keep backup targets private and consider encrypting archives before uploading to third-party cloud storage.

Read [security.md](docs/security.md) before publishing backups to WebDAV or rclone-backed cloud drives.

## License

MIT
