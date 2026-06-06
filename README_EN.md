# Codex-Backup-toolkit

`codexbackup` is a macOS-first backup and restore toolkit for Codex Desktop. It archives the local state that makes Codex feel like your current machine, then publishes the archive to a local folder, SMB/NAS share, WebDAV endpoint, or rclone remote.

The current public scope is Codex Desktop backup, restore, automation, and a Tauri-based macOS desktop GUI/helper foundation.

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

## Desktop App And GUI

Since 0.8.0, the GUI includes a Tauri v2 desktop shell that reuses the React/Vite app under `gui/` and talks to the local helper through desktop bridge commands.

Install GUI dependencies:

```zsh
cd gui
npm ci
```

Run the browser development GUI:

```zsh
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173
```

Check the desktop build environment:

```zsh
npm run desktop:doctor
```

Run the desktop development app:

```zsh
npm run desktop:dev
```

Build unsigned desktop artifacts:

```zsh
npm run desktop:build
```

Generate the DMG checksum file:

```zsh
npm run desktop:checksum
```

Smoke-check the built desktop artifacts and bundled resources:

```zsh
npm run desktop:smoke
```

The current target is a local unsigned `.app`; a `.dmg` is produced when the local Tauri/macOS build environment supports it. Apple Developer signing, notarization, and auto-update are not included yet. If Rust is missing, `desktop:build` prints a Chinese diagnostic and points to `https://rustup.rs/`.

The desktop app checks `127.0.0.1:37371` on startup. If an external helper is already online, the app connects to it and does not stop it on exit. If the app starts a managed helper, it attempts to stop only that managed helper when the app exits. Since 0.9.0, packaged builds include `helper/`, `scripts/`, `config.example.env`, and `examples/` as app resources, so the desktop app can start its bundled helper first. Since 0.10.0, managed helper stdout/stderr are written to:

```text
~/Library/Logs/CodexBackup/desktop-helper.out.log
~/Library/Logs/CodexBackup/desktop-helper.err.log
```

Development or custom runs can still point the helper launcher at the repo root with:

```zsh
CODEX_BACKUP_TOOLKIT_ROOT=/path/to/Codex-Backup-toolkit npm run desktop:dev
```

Since 0.11.0, the overview screen shows a desktop readiness check with version, helper status, toolkit source, and unsigned-build safety guidance. The `Settings` screen shows a first-launch checklist, helper status, start/stop controls, desktop diagnostics, bundled toolkit source, config path, history path, log paths, and version information, with open-path actions for the config directory, log directory, and toolkit directory.

Since 0.12.0, the overview screen parses `codexbackup --doctor` output into a structured target check with target, passed checks, warnings, and failures. The `Logs` screen shows the latest real backup result with archive, sha256, and manifest paths plus copy/open actions and a restore-plan entry point. Restore still only generates `codexrestore --plan`; it does not execute real restore.

Since 0.13.0, the `Schedule` screen includes a read-only automation status panel. Through the helper it can display the launchd label, loaded state, plist path, install path, scheduled script path, log paths, and schedule information. This surface only reads state; it does not install, uninstall, load, unload, or modify existing scheduled backup jobs.

Since 0.14.0, the overview and target screens include local-authoritative consistency checks. Local data always wins: the feature never writes backup data back to the Mac and never overwrites existing archives. A read-only check compares the current local fingerprint with the latest backup fingerprint. A local-authoritative run creates a new timestamped backup only when the latest backup is missing or different, then applies the configured retention count and retention days. This release supports consistency checks for `local` and `smb` targets first.

Since 0.15.0, the GUI includes a `Health` screen. It combines helper status, config checks, backup history, read-only automation status, and consistency-check settings into a backup health score with check items and suggested next actions. The screen is read-only apart from navigation; it does not run real restore, install, uninstall, or scheduled-task mutation commands.

Since 0.16.0, the GUI includes a `Guide` screen for the first-run validation path. It connects desktop runtime checks, target configuration, doctor checks, helper health, backup proof, and the restore safety boundary into one workflow. It only calls existing safe actions or navigates to existing screens; it does not bypass real-backup confirmation, run real restore, install, uninstall, or mutate scheduled jobs.

Since 0.17.0, the GUI includes an `Install` screen. It shows the current Release URL, DMG asset name, sha256 asset name, post-download checksum command, unsigned-build limitation, and first-open path. This screen only copies text and navigates to existing screens; it does not download or install files, run real restore, install, uninstall, or mutate scheduled jobs.

Since 0.18.0, the `Install` screen also explains how to read successful and failed checksum output, how to handle macOS unsigned-app blocking, and which post-install smoke checks to run. Those smoke checks still use existing safe screens and manual confirmation only; they do not add auto-update, signing, notarization, real restore, or scheduled-job mutation capabilities.

## Browser Mode And Local Helper

The repository also includes the browser-based GUI development mode for validating the interface, target configuration flow, and command previews:

```zsh
cd gui
npm ci
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173
```

The current GUI focuses on configuration, persisted config, Keychain secret actions, safety checks, confirmed backup execution, latest backup result display, restore planning, helper connection state, read-only automation status, and helper health/history surfaces. Mock mode still previews commands only. When the local HTTP helper is running and `HTTP Helper` mode is selected, the GUI can execute real `codexbackup` backup commands after an explicit confirmation step, and can execute `codexrestore --plan` restore-plan commands through structured helper actions. Real restore, install, uninstall, and status commands are still blocked.

The interface currently supports target forms, configuration checks, age encryption guidance, `config.env` previews, command copying, confirmed real backup execution, automatic helper history refresh after successful backups, latest/archive restore plans, mock/helper output, run history, helper online/offline status, disabled helper actions when the helper is offline, and clearer loading/error states for helper actions.

The GUI includes two local bridge-related modes:

- `Local Bridge`: uses a mock helper to show protocol responses and allowlist behavior without executing shell commands.
- `HTTP Helper`: connects to a manually started local helper at `http://127.0.0.1:37371`.
- `Desktop`: uses Tauri bridge commands to start/connect/stop a managed helper and proxy helper API calls.

The local helper is not started by default and does not auto-run with the GUI. For development validation, start it in a separate terminal:

```zsh
node helper/server.mjs
```

The current helper allows `codexbackup --doctor`, real `codexbackup` backup commands, `codexrestore --plan` restore-plan commands, and isolated `codexinstallautomation validate` commands that use `dev.codexbackup.toolkit.test.*` labels. Real restore, install, uninstall, status, and appended shell commands are blocked. Encrypted backup commands must include `CODEX_BACKUP_AGE_RECIPIENT` or `CODEX_BACKUP_AGE_RECIPIENT_FILE`. See [helper-protocol.md](docs/helper-protocol.md) for the protocol.

The helper also exposes opt-in product-state endpoints for the GUI:

- `GET /config` and `PUT /config` persist sanitized config at `~/Library/Application Support/CodexBackupToolkit/config.json`; the GUI can now load and save this config directly.
- `POST /secret` and `DELETE /secret` write/delete password-like values through macOS Keychain; the GUI can now manage SMB/WebDAV secrets through these endpoints.
- `GET /history` returns recent backup history recorded by successful helper backup runs; the GUI can now display this history on the logs page.
- `GET /automation` returns read-only launchd automation status; it only checks paths and `launchctl print`, and never installs, uninstalls, loads, unloads, or modifies scheduled jobs.

After selecting `HTTP 助手` in the GUI, use `检查助手` to call `/health` first. This only confirms the helper is online; it does not run backup scripts or modify any scheduled job. If the helper is offline, config, Keychain, and real history buttons are disabled until a later health check succeeds. Real backup execution requires a visible confirmation summary before the `执行真实备份` button is enabled.

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
