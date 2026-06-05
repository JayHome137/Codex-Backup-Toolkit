# Changelog

## 0.2.0 - 2026-06-05

- 增加 `codexrestore --latest --target webdav`，可从 WebDAV 目标端选择并下载最新备份归档。
- 增加 `codexrestore --latest --target rclone`，可通过 rclone remote 选择并下载最新备份归档。
- 远端 latest 恢复会优先下载匹配的 `.sha256` 校验文件；缺少校验文件时沿用现有警告行为。
- 增加默认关闭的 WebDAV/rclone 远端按数量保留策略，需设置 `CODEX_BACKUP_REMOTE_RETENTION=1` 才会删除远端旧归档。
- 增加不触网的 WebDAV/rclone 远端 latest 恢复测试，并接入 CI。

## 0.1.0 - 2026-06-04

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
