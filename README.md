# Codex-Backup-toolkit

[English README](README_EN.md)

`codexbackup` 是一个面向 macOS 的 Codex Desktop 备份、恢复和自动化工具。它可以把 Codex 本机状态打包成归档，并发布到本地目录、SMB/NAS、WebDAV 或 rclone 远端。

## 主要能力

- 备份 `~/.codex`、Codex app/browser 状态、skills、plugins、memories、sessions，以及 `~/Documents/Codex`。
- 支持 `local`、`smb`、`webdav`、`rclone` 四类目标端。
- 支持 `codexrestore --latest` 从本地、SMB、WebDAV、rclone 拉取最新备份。
- 支持 `codexrestore --plan` 生成恢复预案，不改文件、不创建安全备份。
- 支持可选 age 加密、本地/SMB 保留策略，以及默认关闭的 WebDAV/rclone 远端保留策略。
- 支持 macOS `launchd` 定时备份，默认每天 03:00 检查，间隔 3 天执行一次真实备份。
- 提供浏览器版 GUI 和手动启动的本地 helper，用于配置检查、配置保存、Keychain 密钥管理、备份执行、恢复预案、备份历史和安全边界验证。

## 快速开始

环境检查：

```zsh
./scripts/codexbackup.sh --doctor --target local
```

查看目标端配置说明：

```zsh
./scripts/codexbackup.sh --config-guide --target webdav
```

创建本地备份：

```zsh
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

生成恢复预案：

```zsh
./scripts/codexrestore.sh --plan --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
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

## 配置

复制示例配置：

```zsh
cp config.example.env config.env
$EDITOR config.env
source ./config.env
```

支持目标端：

- `local`：写入本机目录。
- `smb`：通过 `mount_smbfs` 使用 SMB/NAS 共享。
- `webdav`：通过 `curl` 上传和下载 WebDAV 备份。
- `rclone`：通过已配置的 rclone remote 上传和下载。

更多说明见 [storage-targets.md](docs/storage-targets.md) 和 [examples](examples)。

## 自动备份

安装定时任务：

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

默认安装路径：`~/Library/Application Support/CodexBackupToolkit/`
日志路径：`~/Library/Logs/CodexBackup/`

## Web GUI 和本地 helper

启动 GUI：

```zsh
cd gui
npm ci
npm run dev
```

默认地址：`http://127.0.0.1:5173`

手动启动本地 helper：

```zsh
node helper/server.mjs
```

helper 默认只监听 `127.0.0.1:37371`。GUI 选择 `HTTP 助手` 后，可以执行环境检查、加载/保存配置、保存/删除 Keychain 密钥、读取真实备份历史、真实备份、恢复预案和隔离的计划校验。恢复预案会运行 `codexrestore --plan`，不会执行真实恢复。

helper 仍会阻止真实恢复、安装、卸载、status 和拼接额外 shell 命令。配置会保存到 `~/Library/Application Support/CodexBackupToolkit/config.json`，敏感字段会被过滤；密码类信息应通过 macOS Keychain 接口保存。备份历史会保存到 `~/Library/Application Support/CodexBackupToolkit/history.json`。协议细节见 [helper-protocol.md](docs/helper-protocol.md)。

## 加密与安全

启用 age 加密：

```zsh
CODEX_BACKUP_ENCRYPT=1 \
CODEX_BACKUP_AGE_RECIPIENT='age1...' \
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

Codex 备份可能包含认证文件、cookies、sessions、memory、插件状态和项目文件。上传到第三方云盘前建议启用加密，并阅读 [security.md](docs/security.md)。

## 保留策略

本地和 SMB 目标端支持按份数和天数清理：

```zsh
CODEX_BACKUP_RETENTION_COUNT=10
CODEX_BACKUP_RETENTION_DAYS=30
```

WebDAV 和 rclone 的远端保留策略默认关闭。只有显式设置下面的变量后，才会删除旧远端归档：

```zsh
CODEX_BACKUP_REMOTE_RETENTION=1
```

## 恢复安全

真实恢复前，`codexrestore` 会创建安全备份：

```text
~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz
```

恢复前建议先运行 `--plan`。完整流程见 [restore-guide.md](docs/restore-guide.md)。

## 开发验证

常用检查：

```zsh
./tests/test-open-source-framework.sh
./tests/test-restore-plan.sh
node --test helper/*.test.mjs
cd gui && npm test && npm run build
```

## 许可证

MIT
