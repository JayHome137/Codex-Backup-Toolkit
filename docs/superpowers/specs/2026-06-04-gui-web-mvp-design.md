# GUI Web MVP Design

## Goal

Build a browser-based GUI prototype for Codex-Backup-toolkit before adding a Tauri shell. The prototype should make the backup workflow visible, validate the information architecture, and preserve a clean path to later native CLI execution.

## Scope

The first GUI is a Web MVP under `gui/`. It does not execute local scripts from the browser. Instead, it models the CLI through a mock adapter and always shows the exact shell command that a future Tauri bridge would run.

## Product Surface

- Overview: target summary, doctor status, last backup status, next scheduled check, primary backup action, and command preview.
- Targets: segmented target selector for local, SMB, WebDAV, and rclone; target-specific config fields; no plaintext password persistence.
- Schedule: launchd validation summary and `codexinstallautomation validate` command preview.
- Restore: archive path input, encrypted archive indicator, safety backup reminder, and restore command preview.
- Logs: recent mock command output and log file locations.

## Design System

The visual direction follows `docs/gui-design.md`: compact macOS utility layout with Raycast-inspired dark command-palette styling. The UI uses a near-black canvas, 1px hairline borders, 6-10px radius, compact controls, Inter/system typography, and restrained semantic colors.

## Architecture

- React owns UI state and routing between sidebar sections.
- `src/lib/config.ts` defines target config types and command-building helpers.
- `src/lib/commands.ts` provides a mock command runner with the same interface a future Tauri bridge can implement.
- Components stay presentational where possible.

## Non-Goals

- No real local script execution from the browser.
- No Tauri build in this phase.
- No credential storage.
- No destructive restore execution.
- No archive browsing inside tar files.

## Verification

- Unit tests cover command generation and mock command behavior.
- Build check confirms the Web MVP compiles.
- Browser preview confirms layout is usable at desktop size.
