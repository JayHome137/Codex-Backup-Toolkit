# Codex-Backup-toolkit

[English README](README_EN.md)

`codexbackup` 是一个面向 macOS 的 Codex Desktop 备份与恢复工具。它会把 Codex 本机状态打包成归档，并发布到本地目录、SMB/NAS、WebDAV 或 rclone 远端。

当前版本只聚焦 Codex Desktop：备份、恢复、定时自动化、Web GUI、配置检查和本地 helper。

## 功能概览

- 备份 Codex 配置、skills、plugins、memories、sessions、本地 app/browser 状态，以及 `~/Documents/Codex` 工作区。
- 支持 `local`、`smb`、`webdav`、`rclone` 四类目标端。
- `--latest` 恢复支持从本地目录、SMB/NAS、WebDAV 和 rclone 目标端拉取最新归档。
- 支持可选 age 加密、本地/SMB 保留策略，以及默认关闭的 WebDAV/rclone 远端保留策略。
- 支持 macOS `launchd` 定时备份，默认每天 03:00 检查，间隔 3 天才真正执行。
- 提供浏览器版 GUI，用于目标配置、配置检查、加密引导、命令预览、运行历史和 helper 健康检查。
- 本地 HTTP helper 已允许从 GUI 执行真实备份；恢复、安装、卸载仍被阻止。

## 快速开始

真实备份前先检查环境：

```zsh
./scripts/codexbackup.sh --doctor --target local
```

查看某个目标端需要怎么配置：

```zsh
./scripts/codexbackup.sh --config-guide --target webdav
```

创建本地备份：

```zsh
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

预览备份内容：

```zsh
./scripts/codexbackup.sh --dry-run
```

恢复最新本地备份：

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --latest
```

恢复最新 WebDAV 或 rclone 备份：

```zsh
CODEX_BACKUP_TARGET=webdav \
CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup" \
CODEX_BACKUP_WEBDAV_USER=backup-user \
./scripts/codexrestore.sh --latest

CODEX_BACKUP_TARGET=rclone \
CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup" \
./scripts/codexrestore.sh --latest
```

恢复指定归档：

```zsh
./scripts/codexrestore.sh --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

## 配置目标端

复制示例配置并编辑：

```zsh
cp config.example.env config.env
$EDITOR config.env
source ./config.env
```

支持的目标端：

- `local`：写入本机目录。
- `smb`：使用 `mount_smbfs` 挂载 SMB/NAS 共享。
- `webdav`：使用 `curl` 上传和下载 WebDAV 备份。
- `rclone`：使用 `rclone copy` 上传和下载任意已配置的 rclone remote。

更多配置见 [storage-targets.md](docs/storage-targets.md) 和 [examples](examples)。

## 自动备份

安装 `launchd` 定时任务：

```zsh
source ./config.env
./scripts/codexinstallautomation.sh install
```

查看、校验或移除任务：

```zsh
./scripts/codexinstallautomation.sh status
./scripts/codexinstallautomation.sh validate
./scripts/codexinstallautomation.sh uninstall
```

安装路径：

```text
~/Library/Application Support/CodexBackupToolkit/
```

日志路径：

```text
~/Library/Logs/CodexBackup/backup.out.log
~/Library/Logs/CodexBackup/backup.err.log
```

## Web GUI 原型

启动 GUI：

```zsh
cd gui
npm ci
npm run dev
```

默认地址：`http://127.0.0.1:5173`

GUI 目前以配置、安全验证和备份执行为主：它会生成命令、复制配置、展示配置检查、引导 age 加密，并可预览最新备份恢复或指定归档恢复命令。

本地 helper 需要手动启动，默认只监听 `127.0.0.1:37371`：

```zsh
node helper/server.mjs
```

选择 `HTTP 助手` 后，可以先点 `检查助手` 调用 `/health`。这个动作只确认 helper 在线，不运行备份脚本，也不会修改任何定时任务。

当前 helper 只允许：

- `./scripts/codexbackup.sh --doctor --target <target>`
- `./scripts/codexbackup.sh --target <target>` 真实备份命令
- 使用 `dev.codexbackup.toolkit.test.*` label 的隔离 `./scripts/codexinstallautomation.sh validate`

恢复、安装、卸载、status 和拼接额外 shell 命令都会被阻止。加密备份必须配置 `CODEX_BACKUP_AGE_RECIPIENT` 或 `CODEX_BACKUP_AGE_RECIPIENT_FILE` 才会放行。协议细节见 [helper-protocol.md](docs/helper-protocol.md)。

## 加密与保留

启用 age 加密：

```zsh
CODEX_BACKUP_ENCRYPT=1 \
CODEX_BACKUP_AGE_RECIPIENT='age1...' \
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

本地和 SMB 目标支持保留策略：

```zsh
CODEX_BACKUP_RETENTION_COUNT=10
CODEX_BACKUP_RETENTION_DAYS=30
```

WebDAV 和 rclone 的远端保留策略必须显式开启，开启后按 `CODEX_BACKUP_RETENTION_COUNT` 保留最新 N 个远端归档：

```zsh
CODEX_BACKUP_REMOTE_RETENTION=1
CODEX_BACKUP_RETENTION_COUNT=10
```

默认 `CODEX_BACKUP_REMOTE_RETENTION=0`，不会删除云端旧文件。

## 恢复与安全

`codexrestore` 覆盖文件前会先创建安全备份：

```text
~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz
```

Codex 备份可能包含认证文件、cookies、sessions、plugin 状态、memory 和项目文件。请把备份目标保持为私有；上传到第三方云盘前建议启用加密。

更多说明：

- [restore-guide.md](docs/restore-guide.md)
- [security.md](docs/security.md)
- [release-checklist.md](docs/release-checklist.md)

## 许可证

MIT
