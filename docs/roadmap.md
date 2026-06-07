# Roadmap

## Phase A: Codex Desktop Backup

Status: current scope.

- Codex-only backup profile.
- Manual backup and restore.
- macOS launchd automation.
- Storage targets: local, SMB/NAS, WebDAV, and rclone.
- Preflight diagnostics with `codexbackup --doctor`.
- Optional age archive encryption.
- Retention settings for local and SMB targets.
- Restore safety archive.
- Public docs, examples, and security guidance.

## Phase A.1: Release Hardening

- Remote latest restore for WebDAV and rclone. Status: added for 0.2.0.
- Opt-in count-based retention for WebDAV and rclone. Status: added for 0.2.0.
- GUI configuration checks and age encryption guidance. Status: added for 0.3.0.
- Opt-in HTTP helper real backup execution with restore/install/uninstall still blocked. Status: added for 0.3.0.
- Read-only `codexbackup --config-guide` target setup guide. Status: added for 0.3.0.
- Structured helper actions for backup and restore planning. Status: added for 0.4.0.
- Persistent sanitized GUI config store. Status: added for 0.4.0.
- Helper-side Keychain save/delete interface for secrets. Status: added for 0.4.0.
- Backup history store exposed through `GET /history`. Status: added for 0.4.0.
- Restore dry-run through `codexrestore --plan`. Status: added for 0.4.0.
- GUI load/save for persisted helper config. Status: added for 0.5.0.
- GUI Keychain secret save/delete for SMB and WebDAV. Status: added for 0.5.0.
- GUI display of helper backup history. Status: added for 0.5.0.
- GUI helper connection banner, offline disabled actions, and clearer helper loading/error states. Status: added for 0.6.0.
- GUI confirmed real backup execution with automatic helper history refresh. Status: added for 0.7.0.
- Tauri macOS desktop shell, desktop helper lifecycle bridge, settings page, and latest backup result display. Status: added for 0.8.0.
- Bundled helper/scripts resources for packaged desktop builds. Status: added for 0.9.0.
- Desktop diagnostics, managed helper log files, settings path open actions, and desktop real-backup confirmation hardening. Status: added for 0.10.0.
- Desktop first-launch readiness panel and settings checklist. Status: added for 0.11.0.
- Structured doctor result display and history-to-restore-plan entry point. Status: added for 0.12.0.
- Read-only launchd automation status in helper and GUI. Status: added for 0.13.0.
- Local-authoritative consistency checks with configurable check frequency and backup cooldown. Status: added for 0.14.0.
- Backup health dashboard that summarizes helper, config, history, automation, and sync status. Status: added for 0.15.0.
- First-run validation guide that links desktop readiness, target config, doctor, helper health, backup proof, and restore boundary. Status: added for 0.16.0.
- Post-install verification page with Release URL, DMG asset names, checksum command, unsigned-build guidance, and first-open checklist. Status: added for 0.17.0.
- Post-install checksum result guidance, macOS unsigned-app recovery steps, and smoke checklist. Status: added for 0.18.0.
- Target setup guide with target-specific steps, read-only doctor command, common failure hints, and safety boundaries. Status: added for 0.19.0.
- Target doctor advice with target-specific next actions. Status: added for 0.23.0.
- First real-backup acceptance checklist based on helper history, archive, sha256, manifest, exit code, and restore-plan readiness. Status: added for 0.23.0.
- Restore-plan guidance that explains what `codexrestore --plan` will do, will not do, needs, and risks. Status: added for 0.23.0.
- Release trust checklist for DMG, sha256, manual smoke checks, and unsigned-build limitations. Status: added for 0.23.0.
- Install-readiness acceptance checklist connecting DMG checksum, first open, runtime, doctor, first backup acceptance, and restore boundary. Status: added for 0.24.0.
- First real-use path connecting install readiness, target setup, doctor, manually confirmed backup, first backup acceptance, and restore boundary. Status: added for 0.25.0.
- Daily usage status combining first-use completion, latest backup, health score, and read-only automation state. Status: added for 0.26.0.
- Complete CLI reference for commands, options, environment variables, outputs, and safety boundaries. Status: added for 0.26.1.
- Cross-platform Codex profile path plan with macOS supported paths and planned Windows paths. Status: added for 0.27.0.
- Day-based retention for WebDAV and rclone once provider timestamp semantics are documented.
- Optional encrypted manifests.
- Homebrew formula or install script.

## Phase A.2: Windows Support

Status: planned. Current releases remain macOS-first until these items are implemented and verified on Windows.

- Windows Codex Desktop profile discovery for `%USERPROFILE%`, `%APPDATA%`, `%LOCALAPPDATA%`, and user documents paths. Status: path plan added for 0.27.0; real backup execution still pending.
- PowerShell or native Windows CLI entrypoints equivalent to `codexbackup`, `codexrestore`, and validation commands.
- Windows archive creation, checksum verification, retention, latest restore, and restore-plan behavior.
- Windows credential storage replacement for macOS Keychain, such as Windows Credential Manager.
- Windows scheduled backup support through Task Scheduler, with validate-only checks that do not mutate existing tasks.
- Windows local, SMB path, WebDAV, and rclone target verification.
- Windows desktop packaging and smoke checks for the Tauri app.
- Documentation that clearly separates macOS and Windows commands, paths, logs, and safety boundaries.

## Phase B: More AI Developer Tools

Future profiles can live behind a profile layer while keeping the same archive, target, and automation logic.

Potential profiles:

- Claude Code
- Cursor
- Windsurf
- Other local AI developer-tool state

The default should remain conservative: each profile must document exactly what it backs up and why.

## Phase C: GUI

The GUI calls the CLI through the helper rather than reimplementing backup logic. The current GUI supports browser development mode and a Tauri macOS desktop shell, first-run validation guide, install-readiness acceptance, first real-use path, daily usage status, configuration checks, encryption guidance, persisted config, Keychain secret actions, command previews, helper health checks, helper online/offline state, disabled helper actions while offline, desktop helper start/stop/status/diagnostics, managed helper log paths, settings path open actions, confirmed real backup execution, local-authoritative consistency checks, backup health scoring, target doctor advice, first real-backup acceptance, automatic helper history refresh, latest backup result display, restore-plan guidance, read-only launchd automation status, release trust checklist, and helper backup history. Real restore and automation management should wait for stronger confirmation, audit, and rollback UX.

See `docs/gui-design.md` for the visual direction.
