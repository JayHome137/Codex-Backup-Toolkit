# Codex-Backup-toolkit

`codexbackup` is currently a macOS-first backup and restore toolkit for Codex Desktop. It archives the local state that makes Codex feel like your current machine, then publishes the archive to a local folder, SMB/NAS share, WebDAV endpoint, or rclone remote. Windows support is now part of the roadmap, but this version does not mark Windows as ready.

The current public scope is Codex Desktop backup, restore, automation, and a Tauri-based macOS desktop app. The desktop UI now focuses on the core product path: Overview, Backup, Storage Target, Restore, Logs, and Settings. Windows preview support includes PowerShell entrypoints, Windows path planning, local zip backup preview, restore plans, Credential Manager and Task Scheduler validate-only skeletons, and Tauri Windows packaging config. Native Windows preview validation, installer build checks, and isolated install-layout smoke checks now run in GitHub Actions, but Windows remains preview-only.

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

For a complete command, option, and environment variable reference, see [CLI reference](docs/cli-reference.md).

For cross-platform status, see [roadmap.md](docs/roadmap.md). The current macOS CLI and desktop artifacts are validated locally; Windows preview code paths now have GitHub Actions native preview validation and installer build checks, but Windows is still not marked ready.

Since 0.28.0, macOS real backup, dry-run, and fingerprint generation read paths from the same profile/archive plan. This keeps the current macOS archive layout unchanged while making later Windows path work safer. You can also inspect the Codex profile path plan before Windows backup execution is enabled:

```zsh
./scripts/codexbackup.sh --profile-plan --platform darwin
./scripts/codexbackup.sh --profile-plan --platform win32
```

The `win32` output is marked as `planned`; it is for implementation and validation work, not a claim that Windows real backup is enabled.

Since 0.29.0, Windows preview entrypoints are available:

```powershell
pwsh -File .\scripts\windows\codexbackup.ps1 -ProfilePlan
pwsh -File .\scripts\windows\codexbackup.ps1 -Doctor -Target local
pwsh -File .\scripts\windows\codexrestore.ps1 -Plan -Archive "$HOME\CodexBackups\codex-backup-host-YYYYmmdd-HHMMSS.zip"
pwsh -File .\scripts\windows\codexcredential.ps1 -ValidateOnly
pwsh -File .\scripts\windows\codexscheduledbackup.ps1 -ValidateOnly
```

See [Windows preview](docs/windows.md). These entrypoints do not install, modify, or delete Task Scheduler tasks, and real restore execution remains disabled.

Since 0.30.0, GitHub Actions runs `tests/windows-native.ps1` on a `windows-latest` runner. It natively validates the Windows profile plan, doctor, local zip backup preview, sha256, manifest, restore plan, and validate-only safety boundaries.

Since 0.31.0, the Windows runner also runs `npm run desktop:build:windows` and `npm run desktop:smoke:windows-installer` to build and smoke-check `.msi` or `.exe` installers. CI uploads the `codexbackup-windows-installers` artifact; signing, auto-update, and real restore execution are still disabled.

Since 0.32.0, the Windows runner also runs `tests/windows-install-smoke.ps1`. It uses MSI administrative install mode to extract the installer into a temporary directory, checks `CodexBackup.exe`, bundled helper files, Windows PowerShell scripts, example config, and validate-only safety boundaries, then removes the temporary directory. It does not register a real installed app, write Task Scheduler jobs, or modify Credential Manager.

Since 0.33.0, the macOS GUI includes a Diagnostics page. It summarizes desktop runtime readiness, helper state, bundled toolkit resources, config/history/log paths, first-backup proof, and release-smoke status. This page is read-only: it does not install, uninstall, load, or unload `launchd`, and it does not execute real restore.

Since 0.34.0, the Diagnostics page also shows an actionable fix path. These actions only navigate to Overview, Settings, Schedule, or refresh read-only diagnostics. They do not install, uninstall, load, or modify `launchd`, do not execute real restore, and do not take over an external helper process.

Since 0.35.0, the Overview page includes a First Launch Recommendation card. It prioritizes the next entry point across desktop runtime, helper, target blockers, read-only doctor checks, first real-backup acceptance, read-only schedule review, and health refresh. The recommendation only navigates inside the GUI or runs the existing read-only doctor command; it does not modify scheduled backup jobs or execute real restore.

Since 0.35.1, macOS local install testing has a dedicated checklist and smoke script. After installing the app to `/Applications/CodexBackup.app`, run:

```zsh
./tests/test-macos-local-install-smoke.sh
```

The script only checks the installed app executable, bundled helper/scripts resources, short launch behavior, and port cleanup after exit. It does not install, uninstall, load, or modify `launchd`, does not modify existing real scheduled backup jobs, and does not execute real restore. See [macOS local install test checklist](docs/local-install-test.md).

Before a macOS release, run the read-only release smoke check:

```zsh
./tests/test-macos-release-smoke.sh
```

It checks the current `.app/.dmg`, sha256, icon, and bundled helper/scripts/config/examples resources without starting the app, loading system jobs, or changing existing scheduled backups.

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

The GUI includes a Tauri v2 desktop shell that reuses the React/Vite app under `gui/`. Since 0.36.0, the desktop UI has been simplified around the user-facing backup flow. The main navigation only shows `Overview`, `Backup`, `Storage Target`, `Restore`, `Logs`, and `Settings`; guide, install verification, health checks, diagnostics, and schedule status are available from the advanced entries in Settings.

The current desktop flow is:

- Choose a local folder, NAS/SMB share, WebDAV endpoint, or rclone remote in `Storage Target`, then run the target check.
- Package local Codex data from `Backup`; confirmed real backup and local-authoritative consistency backup are both available through controlled actions.
- Review command output, backup history, archive paths, sha256 files, and manifests in `Logs`.
- Generate restore plans in `Restore`; real restore still requires explicit CLI execution outside the GUI.
- Manage the local service, config path, log path, version information, and advanced diagnostics in `Settings`.

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

The desktop app checks the local service at `127.0.0.1:37371` on startup. If an external service is already online, the app connects to it and does not stop it on exit. If the app starts a managed service, it attempts to stop only that managed process when the app exits. Packaged builds include `helper/`, `scripts/`, `config.example.env`, and `examples/` as app resources. Managed service stdout/stderr are written to:

```text
~/Library/Logs/CodexBackup/desktop-helper.out.log
~/Library/Logs/CodexBackup/desktop-helper.err.log
```

Development or custom runs can still point the service launcher at the repo root with:

```zsh
CODEX_BACKUP_TOOLKIT_ROOT=/path/to/Codex-Backup-toolkit npm run desktop:dev
```

The GUI safety boundary is unchanged: it can run target checks, save sanitized config, manage Keychain secrets, execute confirmed backups, show backup results, run local-authoritative consistency checks, and generate restore plans. It does not execute real restore, install, uninstall, load, or modify existing scheduled backup jobs, and it does not expose arbitrary shell execution.

## Browser Mode And Local Service

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

Mock mode previews commands only. For development validation, start the local service in a separate terminal:

```zsh
node helper/server.mjs
```

The local service defaults to `127.0.0.1:37371`. It accepts only controlled actions: `codexbackup --doctor`, confirmed `codexbackup` backup commands, `codexrestore --plan` restore-plan commands, and isolated `codexinstallautomation validate` commands that use `dev.codexbackup.toolkit.test.*` labels. Real restore, install, uninstall, status, and appended shell commands are blocked. Encrypted backup commands must include `CODEX_BACKUP_AGE_RECIPIENT` or `CODEX_BACKUP_AGE_RECIPIENT_FILE`. See [helper-protocol.md](docs/helper-protocol.md) for the protocol.

The local service also exposes opt-in product-state endpoints for the GUI:

- `GET /config` and `PUT /config` persist sanitized config at `~/Library/Application Support/CodexBackupToolkit/config.json`; the GUI can load and save this config directly.
- `POST /secret` and `DELETE /secret` write/delete password-like values through macOS Keychain; the GUI can manage SMB/WebDAV secrets through these endpoints.
- `GET /history` returns recent backup history recorded by successful backup runs; the GUI displays this history on the logs page.
- `GET /automation` returns read-only launchd automation status; it only checks paths and `launchctl print`, and never installs, uninstalls, loads, unloads, or modifies scheduled jobs.

Calling `/health` only confirms that the local service is online; it does not run backup scripts or modify any scheduled job. If the service is offline, config, Keychain, and real history buttons are disabled until a later health check succeeds. Real backup execution requires a visible confirmation summary before the backup button is enabled.

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
