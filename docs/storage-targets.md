# Storage Targets

`codexbackup` publishes the same archive format to every target. Pick the target that matches your storage setup, then keep the rest of the workflow unchanged.

Run a preflight check at any time:

```zsh
./scripts/codexbackup.sh --doctor --target local
```

## local

Use this for a first test, an external drive, or a folder synced by another app.

```zsh
CODEX_BACKUP_TARGET=local
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups"
./scripts/codexbackup.sh
```

Restore latest:

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --latest
```

## smb

Use this for a NAS share. The password can be provided with `CODEX_BACKUP_PASSWORD`, typed interactively, or stored by `codexinstallautomation` in macOS Keychain.

```zsh
CODEX_BACKUP_TARGET=smb
CODEX_BACKUP_SMB_HOST=nas.example.local
CODEX_BACKUP_SMB_USER=backup-user
CODEX_BACKUP_SMB_SHARE=CodexBackup
CODEX_BACKUP_REMOTE_DIR=codex-backups
./scripts/codexbackup.sh
```

Restore latest:

```zsh
CODEX_BACKUP_TARGET=smb ./scripts/codexrestore.sh --latest
```

## WebDAV

Use this for Nextcloud, ownCloud, Synology WebDAV, or another WebDAV-compatible server. The script uses macOS `curl`.

```zsh
CODEX_BACKUP_TARGET=webdav
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup"
CODEX_BACKUP_WEBDAV_USER=backup-user
./scripts/codexbackup.sh
```

Restore latest:

```zsh
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER=backup-user \
./scripts/codexrestore.sh --latest
```

The restore command lists the configured `CODEX_BACKUP_REMOTE_DIR`, downloads the newest `codex-backup-*.tar.gz` or `codex-backup-*.tar.gz.age` file plus the matching `.sha256` when available, and then restores from the temporary local copy.

## rclone

Use this for Google Drive, OneDrive, Dropbox, S3, WebDAV via rclone, and many other cloud targets.

Configure a remote first:

```zsh
rclone config
```

Then run:

```zsh
CODEX_BACKUP_TARGET=rclone
CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup"
./scripts/codexbackup.sh
```

Restore latest:

```zsh
CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup" \
./scripts/codexrestore.sh --latest
```

The restore command uses `rclone lsf` to choose the newest archive in `CODEX_BACKUP_REMOTE_DIR`, then `rclone copyto` to download the archive and matching `.sha256` when available.

## Encryption

Every target can receive encrypted archives when `CODEX_BACKUP_ENCRYPT=1` and age is installed. The target receives `.tar.gz.age`, `.tar.gz.age.sha256`, and the manifest.

## Retention

`CODEX_BACKUP_RETENTION_COUNT` and `CODEX_BACKUP_RETENTION_DAYS` currently apply to local and SMB targets. WebDAV and rclone retention are deferred so the first release does not risk deleting remote cloud files unexpectedly.
