# Codex-Backup-toolkit

`codexbackup` is a macOS-first backup and restore toolkit for Codex Desktop. It archives the local state that makes Codex feel like your current machine, then publishes the archive to a local folder, SMB/NAS share, WebDAV endpoint, or rclone remote.

The first public version is intentionally Codex-only. The project structure leaves room for more AI developer-tool profiles later, but the current promise is narrow: reliable Codex backup, restore, and automation.

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

Restore a specific archive:

```zsh
./scripts/codexrestore.sh --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
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
- `webdav`: upload archives with `curl` to a WebDAV server.
- `rclone`: upload archives with `rclone copy` to any configured rclone remote.

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

The current GUI is preview-only: it shows the `codexbackup`, `codexrestore`, and automation validation commands that a future native bridge could run, but it does not execute real backups, restores, or launchd installation from the browser. Automation validation previews use isolated `dev.codexbackup.toolkit.test.*` labels and do not modify any backup job the user has already installed.

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
