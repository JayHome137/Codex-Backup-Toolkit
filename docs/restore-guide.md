# Restore Guide

Use restore when moving Codex Desktop state to a new Mac or rolling back to an earlier local state.

## New Mac Restore

1. Install Codex Desktop on the new Mac.
2. Quit Codex Desktop.
3. Put the backup archive and matching `.sha256` file somewhere local, or configure the same local/SMB target used for backups.
4. Run one of the restore commands below.
5. Open Codex Desktop and sign in again if prompted.

Restore latest from a local backup folder:

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --latest
```

Restore latest from SMB:

```zsh
CODEX_BACKUP_TARGET=smb \
CODEX_BACKUP_SMB_HOST=nas.example.local \
CODEX_BACKUP_SMB_USER=backup-user \
CODEX_BACKUP_SMB_SHARE=CodexBackup \
./scripts/codexrestore.sh --latest
```

Restore a specific local archive:

```zsh
./scripts/codexrestore.sh --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

Print a restore plan before changing anything:

```zsh
./scripts/codexrestore.sh --plan --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

For latest restore, `--plan` works with every target as well:

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --plan --latest
```

Restore plans show the archive, target home, safety-backup location, checksum/decryption intent, and the paths that would be restored. They do not prompt, extract, create safety backups, delete files, or copy files.

Restore an encrypted archive:

```zsh
./scripts/codexrestore.sh \
  --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz.age \
  --age-identity /path/to/age-identity.txt
```

## Safety Backup

Before replacing files, `codexrestore` creates a local safety archive at:

```text
~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz
```

Keep that file until you have opened Codex Desktop and confirmed the restored state is good.

## WebDAV And rclone Restore

Restore latest from WebDAV:

```zsh
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER=backup-user \
./scripts/codexrestore.sh --latest
```

Preview the same WebDAV restore first:

```zsh
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER=backup-user \
./scripts/codexrestore.sh --plan --latest
```

Restore latest from rclone:

```zsh
CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup" \
./scripts/codexrestore.sh --latest
```

For WebDAV, `codexrestore` uses `curl PROPFIND` to list `CODEX_BACKUP_REMOTE_DIR`, then downloads the newest archive and matching `.sha256` file when available. For rclone, it uses `rclone lsf` and `rclone copyto` for the same flow. If the remote checksum is missing, restore continues with a warning, matching the local `--archive` behavior.
