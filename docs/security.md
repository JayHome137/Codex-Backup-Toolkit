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

## Archive Encryption

Set `CODEX_BACKUP_ENCRYPT=1` to encrypt archives with age before they are published to the target. Store the age identity file somewhere separate from the backup destination. If you lose the identity, encrypted backups cannot be restored.

The manifest remains a small plaintext operational file. It lists included and missing source paths but not file contents.

## Device-Bound State

macOS Keychain items and browser-encrypted data may not migrate cleanly to another Mac even when files are restored. After restore, Codex or browser-backed integrations may ask you to sign in again. That is expected.
