# Changelog

## 0.4.0 - 2026-06-06

- 增加结构化 helper action：GUI 可以发送 `backup` 和 `restorePlan` 动作，由 helper 服务端生成受控命令。
- 增加 `codexrestore --plan`，可生成恢复预案并明确输出不会修改文件。
- GUI 的恢复页改为生成恢复预案，HTTP helper 可运行 `codexrestore --plan`，但仍阻止真实恢复。
- 增加持久化配置存储，默认写入 `~/Library/Application Support/CodexBackupToolkit/config.json`，写入前过滤敏感字段。
- 增加 helper 侧 Keychain secret 保存和删除接口，用于后续 GUI 管理密码类信息。
- 增加备份历史存储和 `GET /history`，记录 helper 备份执行状态、时间、目标端、退出码和归档路径。
- CI 增加恢复预案测试，并改为运行 helper 全量测试。
- GUI 版本升至 `0.4.0`。

## 0.3.0 - 2026-06-05

- 增加 `codexbackup --config-guide`，可按目标端输出配置、安全和 age 加密引导，不创建文件、不访问网络、不修改自动化。
- GUI 增加配置检查面板，覆盖目标端必填项、密钥处理、加密状态和远端保留策略提示。
- GUI 增加 age 收件人和收件人文件配置字段，`config.env` 预览会输出对应环境变量但不输出密码。
- HTTP helper 允许执行真实 `codexbackup` 备份命令，并在浏览器侧和服务端侧双重 allowlist 校验。
- HTTP helper 继续阻止恢复、安装、卸载、status 和拼接额外 shell 命令。
- 加密备份命令必须配置 `CODEX_BACKUP_AGE_RECIPIENT` 或 `CODEX_BACKUP_AGE_RECIPIENT_FILE` 才会被 helper 放行。
- GUI 版本升至 `0.3.0`。

## 0.2.0 - 2026-06-05

- 增加 `codexrestore --latest --target webdav`，可从 WebDAV 目标端选择并下载最新备份归档。
- 增加 `codexrestore --latest --target rclone`，可通过 rclone remote 选择并下载最新备份归档。
- 远端 latest 恢复会优先下载匹配的 `.sha256` 校验文件；缺少校验文件时沿用现有警告行为。
- 增加默认关闭的 WebDAV/rclone 远端按数量保留策略，需设置 `CODEX_BACKUP_REMOTE_RETENTION=1` 才会删除远端旧归档。
- 增加不触网的 WebDAV/rclone 远端 latest 恢复测试，并接入 CI。

## 0.1.0 - 2026-06-04

- 将 Codex-Backup-toolkit 整理为可发布的 GitHub 开源项目。
- 增加公开的 `codexbackup`、`codexrestore`、`codexinstallautomation` 和 `codexscheduledbackup` 命令脚本。
- 支持 local、SMB/NAS、WebDAV 和 rclone 备份目标端。
- 增加可选 age 归档加密。
- 增加 local 和 SMB 目标端保留策略。
- 增加 `codexbackup --doctor`、`--dry-run` 和 `--list-targets`。
- 增加隔离的 launchd plist 校验能力，用于发布检查。
- 增加 GitHub Actions CI 和发布文档。
- 增加 Web GUI MVP，包含目标端表单、命令预览、mock 输出、运行历史和 WebDAV/rclone 配置路径。
- 增加默认关闭的本地 HTTP helper 草案，包含 `/health`、`/run`、loopback-only 绑定、helper 侧 allowlist 校验和隔离测试。
- 增加 GUI `HTTP Helper` 模式，可做不执行命令的健康检查，并支持受限的 doctor/隔离 validate 执行路径。
