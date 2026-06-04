# Changelog

## 0.1.0 - Unreleased

- Prepare Codex-Backup-toolkit as a GitHub-ready open-source project.
- Add public `codexbackup`, `codexrestore`, `codexinstallautomation`, and `codexscheduledbackup` command scripts.
- Support local, SMB/NAS, WebDAV, and rclone backup targets.
- Add optional age encryption for backup archives.
- Add retention settings for local and SMB targets.
- Add `codexbackup --doctor`, `--dry-run`, and `--list-targets`.
- Add isolated launchd plist validation for release checks.
- Add GitHub Actions CI and release documentation.
- Add Web GUI MVP with target forms, command previews, mock output, run history, and WebDAV/rclone configuration paths.
- Add opt-in local HTTP helper draft with `/health` and `/run`, loopback-only binding, helper-side allowlist checks, and isolated test coverage.
- Add GUI `HTTP Helper` mode with a non-executing health check and restricted doctor/isolated-validate execution path.
