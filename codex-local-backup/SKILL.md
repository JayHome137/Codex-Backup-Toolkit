---
name: codex-local-backup
description: Back up and restore Codex local state using only user-chosen local filesystem paths. Use when the user asks to back up Codex, save Codex data locally, preserve Codex conversations/workspaces, inspect a Codex backup archive, generate a restore plan, or restore Codex from a specified local archive. This skill intentionally avoids GUI, WebDAV, SMB, rclone, Keychain, launchd, cloud sync, and automatic scheduled jobs; it defaults to including ~/Documents/Codex because it may contain important conversation and project history.
---

# Codex Local Backup

Use this skill to create deterministic local backups of Codex state and restore from a user-specified archive. Keep the workflow boring and explicit: the user chooses the backup folder, the script writes an archive plus sidecars, and restore only happens after an inspection or restore plan and explicit confirmation.

## Safety Rules

- Use local filesystem paths only. Do not configure WebDAV, SMB, rclone, Keychain, launchd, cron, cloud storage, or desktop helpers.
- Do not run a real restore unless the user explicitly asks to execute restore after seeing the plan.
- Before every confirmed restore, create a safety backup of existing target paths.
- Default backup scope includes `~/Documents/Codex`; do not make it optional unless the user asks for a smaller backup.
- Prefer `restore-plan` before `restore`, even when the user sounds confident.
- Treat `.sha256` mismatch as a stop condition.

## Backup Scope

The bundled script backs up these paths under the chosen home directory when they exist:

```text
~/.codex
~/Documents/Codex
~/Library/Application Support/Codex
~/Library/Application Support/com.openai.chat
~/Library/Application Support/OpenAI
```

Missing paths are recorded in the manifest and do not fail the backup.

## Commands

Create a backup in a user-chosen folder:

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py backup \
  --output-dir "$HOME/CodexBackups"
```

Inspect a backup archive and verify its sidecar checksum when present:

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py inspect \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz"
```

Generate a non-destructive restore plan:

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py restore-plan \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz"
```

Execute restore only after explicit user confirmation:

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py restore \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz" \
  --confirm
```

The script emits JSON so another Codex instance can summarize exact archive, manifest, checksum, restored entries, and safety backup paths.

## Outputs

Each backup writes three files:

```text
codex-local-backup-<host>-<timestamp>.tar.gz
codex-local-backup-<host>-<timestamp>.tar.gz.sha256
codex-local-backup-<host>-<timestamp>.tar.gz.manifest.json
```

The archive preserves home-relative paths such as `.codex/...` and `Documents/Codex/...`.

## Restore Behavior

`restore-plan` reports target paths and whether each already exists. It does not write files.

`restore --confirm` creates a safety backup first. By default the safety backup is under:

```text
~/CodexRestoreSafety/codex-before-restore-YYYYmmdd-HHMMSS/
```

Then it replaces only paths included in the backup archive. It does not delete unrelated files outside those target paths.

## Reference

For the full contract and rationale, read `references/backup-contract.md`.
