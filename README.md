# Codex-Backup-toolkit

[English README](README_EN.md)

`codexbackup` 是一个面向 macOS 的 Codex Desktop 备份与恢复工具。它会把让 Codex 在本机“像现在这样工作”的本地状态打包成归档文件，然后发布到本地目录、SMB/NAS、WebDAV 或 rclone 远端。

第一版刻意只聚焦 Codex Desktop。项目结构会为后续 Claude Code、Cursor、Windsurf 等 AI 开发工具 profile 留空间，但当前承诺很窄：把 Codex 的备份、恢复和自动化做好。

## 备份内容

- `~/.codex`
- `~/Library/Application Support/Codex`
- `~/Library/Application Support/OpenAI`
- `~/Library/Application Support/OpenAI/Codex`
- `~/Library/Application Support/com.openai.codex`
- `~/Documents/Codex`

归档中会包含 Codex 配置、skills、plugins、memories、sessions、本地 app/browser 状态、磁盘上存在的认证文件，以及 `~/Documents/Codex` 下的 Codex 工作区。

`.codex/tmp`、`.codex/.tmp`、socket、Git fsmonitor IPC 文件等临时运行文件会被排除。它们可能在 Codex 运行时消失，也不适合用于恢复。

重要限制：有些登录/session 数据可能被 macOS Keychain 或设备绑定的浏览器加密保护。恢复文件到新 Mac 后，Codex 或某些浏览器集成仍可能要求重新登录。

## 快速开始

创建本地备份：

```zsh
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

真实备份前检查环境：

```zsh
./scripts/codexbackup.sh --doctor --target local
```

预览将要备份的内容：

```zsh
./scripts/codexbackup.sh --dry-run
```

从本地目录恢复最新备份：

```zsh
CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --latest
```

恢复指定归档：

```zsh
./scripts/codexrestore.sh --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz
```

## 配置备份目标

复制示例配置并编辑：

```zsh
cp config.example.env config.env
$EDITOR config.env
source ./config.env
```

支持的 `CODEX_BACKUP_TARGET`：

- `local`：写入本机目录。
- `smb`：使用 `mount_smbfs` 挂载 SMB/NAS 共享。
- `webdav`：使用 `curl` 上传到 WebDAV 服务。
- `rclone`：使用 `rclone copy` 上传到任意已配置的 rclone remote。

更多目标端配置见 [storage-targets.md](docs/storage-targets.md) 和 [examples](examples) 下的示例文件。

列出支持的目标端：

```zsh
./scripts/codexbackup.sh --list-targets
```

## 可选加密

设置 `CODEX_BACKUP_ENCRYPT=1` 后，工具会用 [age](https://age-encryption.org/) 加密备份归档：

```zsh
CODEX_BACKUP_ENCRYPT=1 \
CODEX_BACKUP_AGE_RECIPIENT='age1...' \
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
```

加密备份会生成：

```text
codex-backup-<host>-<timestamp>.tar.gz.age
codex-backup-<host>-<timestamp>.tar.gz.age.sha256
```

使用对应的 age identity 恢复：

```zsh
./scripts/codexrestore.sh \
  --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz.age \
  --age-identity /path/to/age-identity.txt
```

## 保留策略

`local` 和 `smb` 目标支持在备份成功后做简单清理：

```zsh
CODEX_BACKUP_RETENTION_COUNT=10
CODEX_BACKUP_RETENTION_DAYS=30
```

`CODEX_BACKUP_RETENTION_COUNT` 会保留最新 N 份备份归档。`CODEX_BACKUP_RETENTION_DAYS` 会删除早于 N 天的备份文件。两者默认都是 `0`，也就是不自动清理。

## 自动备份

安装 macOS `launchd` 定时任务：

```zsh
source ./config.env
./scripts/codexinstallautomation.sh install
```

默认情况下，任务每天本地时间 `03:00` 检查一次；只有距离上次成功备份至少过去 `3` 天时，才会真正运行备份。

安装时修改检查时间和间隔：

```zsh
CODEX_BACKUP_HOUR=2 \
CODEX_BACKUP_MINUTE=15 \
CODEX_BACKUP_INTERVAL_DAYS=3 \
./scripts/codexinstallautomation.sh install
```

查看或移除任务：

```zsh
./scripts/codexinstallautomation.sh status
./scripts/codexinstallautomation.sh uninstall
```

安装器会把工具复制到：

```text
~/Library/Application Support/CodexBackupToolkit/
```

日志路径：

```text
~/Library/Logs/CodexBackup/backup.out.log
~/Library/Logs/CodexBackup/backup.err.log
```

发布前或本地验证时，可以只生成并校验 plist，不加载 launchd 任务：

```zsh
./scripts/codexinstallautomation.sh validate
```

## Web GUI 原型

仓库包含一个浏览器版 GUI 原型，用来先验证界面、目标端配置流程和命令预览：

```zsh
cd gui
npm ci
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

当前 GUI 是预览版：它会显示未来要执行的 `codexbackup`、`codexrestore` 和自动化校验命令，但浏览器内不会直接执行真实备份、恢复或安装 launchd 任务。自动化校验预览使用 `dev.codexbackup.toolkit.test.*` 这类隔离 label，不会改动用户已经安装的备份定时任务。

## 输出文件

每次备份会生成：

- `codex-backup-<host>-<timestamp>.tar.gz`
- `codex-backup-<host>-<timestamp>.tar.gz.sha256`
- `codex-backup-<host>-<timestamp>.manifest.txt`

如果启用加密，归档文件会变成 `.tar.gz.age`。

备份会先把完成的文件写入本地 spool 目录，再发布到配置好的目标端。如果远端暂时不可用，本地 spool 中的副本仍可用于手动重试。

## 恢复安全

覆盖任何文件前，`codexrestore` 会先创建当前目标文件的本地安全备份：

```text
~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz
```

在新 Mac 上恢复前，建议先阅读 [restore-guide.md](docs/restore-guide.md)。

## 安全说明

Codex 备份可能包含敏感内容：本地认证文件、cookies、sessions、plugin 状态、memory 和项目文件。请把备份目标保持为私有；如果要上传到第三方云盘，建议启用加密。

发布到 WebDAV 或 rclone 云盘前，请阅读 [security.md](docs/security.md)。

## 许可证

MIT
