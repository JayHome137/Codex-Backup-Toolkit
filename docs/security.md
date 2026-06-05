# Security Notes

Codex-Backup-toolkit copies local Codex state exactly enough to make restore useful. That means a backup may contain sensitive material.

Backups can include:

- Codex config and local credentials stored on disk.
- Plugin, skill, MCP, and connector state.
- Browser-backed session files that are present in Codex app data.
- Memories, transcripts, prompts, generated files, and workspace content.
- Project workspaces under `~/Documents/Codex`.

Treat every archive as private.

## Recommendations

- Store archives in a private folder or bucket.
- Restrict SMB, WebDAV, and cloud-drive permissions to trusted users only.
- Do not publish archives in GitHub issues, releases, public buckets, or shared folders.
- Consider encrypting archives before uploading them to third-party cloud storage.
- Rotate credentials if an archive was exposed.

## Password Handling

SMB and WebDAV passwords can be passed for one run through environment variables, typed interactively, or stored in macOS Keychain by `codexinstallautomation`.

Avoid committing `config.env` or shell history containing passwords. Use `config.example.env` and the files under `examples/` as templates only.

0.4.0 adds a helper-side Keychain interface for the GUI. The helper exposes `POST /secret` and `DELETE /secret`, implemented with the macOS `security` command. It stores or deletes secrets, but does not return secret values to the GUI.

Persistent GUI config is stored at:

```text
~/Library/Application Support/CodexBackupToolkit/config.json
```

Before writing config, the helper recursively removes fields whose names include `password`, `secret`, `token`, or `credential`. Keep passwords in Keychain rather than in config JSON.

## Archive Encryption

Set `CODEX_BACKUP_ENCRYPT=1` to encrypt archives with age before they are published to the target. Store the age identity file somewhere separate from the backup destination. If you lose the identity, encrypted backups cannot be restored.

The manifest remains a small plaintext operational file. It lists included and missing source paths but not file contents.

Use `./scripts/codexbackup.sh --config-guide --target <target>` to print target-specific setup and encryption guidance without creating files, touching the network, or modifying automation.

## GUI And Helper Boundary

The Web GUI can run a real backup only when the local HTTP helper is started manually and the user selects `HTTP 助手`. The helper re-checks an allowlist server-side before running anything.

Allowed helper actions are limited to environment checks, real backup execution, restore-plan generation, and isolated `codexinstallautomation validate` commands that use `dev.codexbackup.toolkit.test.*` labels. Real restore, install, uninstall, status, and appended shell commands remain blocked.

Restore-plan generation runs `codexrestore --plan`. It reports what would happen but does not prompt, extract archives, create safety backups, delete files, or copy files.

Successful helper backup runs are recorded in:

```text
~/Library/Application Support/CodexBackupToolkit/history.json
```

History entries include status, timestamps, target, exit code, and detected archive paths. They should not include passwords.

Encrypted backup commands are blocked unless they include `CODEX_BACKUP_AGE_RECIPIENT` or `CODEX_BACKUP_AGE_RECIPIENT_FILE`.

## Device-Bound State

macOS Keychain items and browser-encrypted data may not migrate cleanly to another Mac even when files are restored. After restore, Codex or browser-backed integrations may ask you to sign in again. That is expected.
