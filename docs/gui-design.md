# GUI Design Direction

The GUI should feel like a compact macOS utility, close to the CCSWITCH rhythm: fast to scan, dense enough for daily use, and focused on switching/configuring operational state without a marketing wrapper.

The DESIGN.md reference that best matches this direction is Raycast: dark command-palette chrome, near-black surfaces, fine hairline borders, compact controls, and clear status rows.

## Visual System

- Primary canvas: near-black.
- Panels: one-step-lighter dark surfaces with 1px hairline borders.
- Radius: 6px to 10px for controls and panels.
- Typography: Inter or system UI, small-to-medium sizes, no oversized hero type.
- Accent colors: green for healthy/success, yellow for attention, red for failure, blue for informational states.
- Primary action: compact high-contrast button.

## Layout

- Left sidebar: Overview, Targets, Schedule, Restore, Logs, Settings.
- Main panel: current target, configuration checks, helper mode, and backup action.
- Target setup: segmented control for local, SMB, WebDAV, rclone, plus age encryption guidance.
- Restore screen: latest/archive command preview first; real restore requires a later confirmation design.
- Logs screen: recent launchd output and stderr with copy/open actions.

## Interaction Rules

- The GUI shells out only through the local helper allowlist.
- CLI remains the source of truth for backup behavior.
- No hidden sync engine in the GUI.
- Real backup execution is allowed through the helper after allowlist checks.
- Restore, install, uninstall, and status actions stay blocked until a stronger confirmation and audit design exists.
- Dangerous restore actions will require confirmation and show the safety backup path.
- Passwords are stored through macOS Keychain, not in app preferences.

## Not In The First GUI

- Multi-profile backup editing.
- Cloud provider OAuth setup inside the app.
- Archive browsing inside compressed backups.
- Cross-platform UI.
