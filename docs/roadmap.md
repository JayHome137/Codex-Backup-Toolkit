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

The GUI should call the CLI rather than reimplementing backup logic. The first GUI can focus on target setup, backup status, recent archives, run-now, restore, and logs.

See `docs/gui-design.md` for the visual direction.
