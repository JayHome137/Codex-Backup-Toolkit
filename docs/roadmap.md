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
- Day-based retention for WebDAV and rclone once provider timestamp semantics are documented.
- Optional encrypted manifests.
- Homebrew formula or install script.

## Phase B: More AI Developer Tools

Future profiles can live behind a profile layer while keeping the same archive, target, and automation logic.

Potential profiles:

- Claude Code
- Cursor
- Windsurf
- Other local AI developer-tool state

The default should remain conservative: each profile must document exactly what it backs up and why.

## Phase C: GUI

The GUI calls the CLI through the helper rather than reimplementing backup logic. The current GUI supports browser development mode and a Tauri macOS desktop shell, configuration checks, encryption guidance, persisted config, Keychain secret actions, command previews, helper health checks, helper online/offline state, disabled helper actions while offline, desktop helper start/stop/status/diagnostics, managed helper log paths, settings path open actions, confirmed real backup execution, automatic helper history refresh, latest backup result display, restore-plan generation, and helper backup history. Real restore and automation management should wait for stronger confirmation, audit, and rollback UX.

See `docs/gui-design.md` for the visual direction.
