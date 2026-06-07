# CLI 参考

本文件列出 Codex-Backup-toolkit 的 CLI 脚本、常用选项、关键环境变量和安全边界。CLI 仍是备份和恢复行为的来源，GUI/helper/Tauri 只调用或展示这些能力。

## 平台状态

| 平台 | 当前状态 | 说明 |
| --- | --- | --- |
| macOS | 已验证 | 当前 CLI、helper、launchd 自动化和 Tauri 桌面产物均以 macOS 为主。 |
| Windows | 已纳入路线，尚未标记可用 | 后续需要补齐 Windows 路径发现、PowerShell/原生命令入口、计划任务、凭据保存、压缩/校验和桌面打包验证。 |

除非文档明确说明某个版本已完成 Windows 支持，否则本文件中的脚本路径、日志路径、Keychain 和 `launchd` 描述都按 macOS 行为理解。

## 命令总览

| 脚本 | 用途 | 是否会改动数据 |
| --- | --- | --- |
| `scripts/codexbackup.sh` | 创建备份、环境检查、配置引导、一致性检查 | 普通备份会创建归档；`--doctor`、`--config-guide`、`--dry-run`、`--sync-check` 只读 |
| `scripts/codexrestore.sh` | 恢复最新备份或指定归档 | 真实恢复会改动本机文件；`--plan` 只读 |
| `scripts/codexinstallautomation.sh` | 安装、卸载、查看或隔离验证 macOS 定时任务 | `install/uninstall` 会修改 launchd；`validate` 只做隔离验证 |
| `scripts/codexscheduledbackup.sh` | launchd 调用的定时入口 | 按配置执行普通备份或一致性备份 |

## `codexbackup`

脚本：`./scripts/codexbackup.sh`

用法：

```zsh
./scripts/codexbackup.sh [--target local|smb|webdav|rclone] [--local-output DIR]
./scripts/codexbackup.sh --doctor [--target local|smb|webdav|rclone]
./scripts/codexbackup.sh --config-guide [--target local|smb|webdav|rclone]
./scripts/codexbackup.sh --sync-check [--target local|smb]
./scripts/codexbackup.sh --sync-local-authoritative [--target local|smb]
./scripts/codexbackup.sh --profile-plan --platform darwin|win32
./scripts/codexbackup.sh --dry-run
./scripts/codexbackup.sh --list-targets
```

选项：

- `--target TARGET`：覆盖 `CODEX_BACKUP_TARGET`。支持 `local`、`smb`、`webdav`、`rclone`。
- `--local-output DIR`：写入本机目录，同时把目标端切到 `local`。
- `--doctor`：检查依赖、spool 路径、本地源路径和目标端基础可用性，不创建备份。
- `--config-guide`：输出目标端配置、安全和加密建议，不创建文件、不访问网络、不修改自动化。
- `--sync-check`：只读对比本地状态与最新备份 fingerprint。当前支持 `local` 和 `smb`。
- `--sync-local-authoritative`：本地为准一致性备份。发现不一致时创建新时间戳归档，不从备份回写本机，不覆盖旧归档。
- `--profile-plan`：只读输出 Codex profile 路径计划，不创建备份。
- `--platform PLATFORM`：配合 `--profile-plan` 使用，支持 `darwin` 和 `win32`。
- `--dry-run`：展示将要纳入备份的路径和目标端，不创建归档。
- `--list-targets`：打印支持的目标端。
- `-h` / `--help`：显示帮助。

常用示例：

```zsh
./scripts/codexbackup.sh --doctor --target local
./scripts/codexbackup.sh --config-guide --target webdav
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
./scripts/codexbackup.sh --sync-check --target local
./scripts/codexbackup.sh --sync-local-authoritative --target local
./scripts/codexbackup.sh --profile-plan --platform win32
```

`--profile-plan --platform win32` 当前会显示 `Status: planned`，只用于后续 Windows 支持开发和验证。

返回值：

- `0`：命令成功。
- `1`：运行失败，例如依赖缺失、路径不可写、目标端不可用或备份失败。
- `2`：参数或配置缺失。

## `codexrestore`

脚本：`./scripts/codexrestore.sh`

用法：

```zsh
./scripts/codexrestore.sh --latest [--target local|smb|webdav|rclone]
./scripts/codexrestore.sh --archive /path/to/codex-backup-*.tar.gz[.age]
./scripts/codexrestore.sh --plan --latest [--target local|smb|webdav|rclone]
./scripts/codexrestore.sh --plan --archive /path/to/codex-backup-*.tar.gz[.age]
```

选项：

- `--latest`：从配置的目标端选择最新归档。
- `--archive FILE`：使用指定本地归档。
- `--target TARGET`：覆盖 `CODEX_BACKUP_TARGET`，仅用于 `--latest`。
- `--age-identity FILE`：指定 age identity，用于恢复 `.age` 加密归档。
- `--plan`：生成恢复预案，不执行真实恢复。
- `--yes`：跳过最终确认。谨慎使用。
- `-h` / `--help`：显示帮助。

安全边界：

- `--plan` 不提示确认、不解密、不解压、不创建安全备份、不复制或删除文件。
- 真实恢复会先创建安全备份：`~/CodexRestoreSafetyBackups/codex-before-restore-<timestamp>.tar.gz`。
- 恢复加密归档必须提供 `--age-identity` 或 `CODEX_BACKUP_AGE_IDENTITY`。

常用示例：

```zsh
./scripts/codexrestore.sh --plan --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz

CODEX_BACKUP_TARGET=local \
CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \
./scripts/codexrestore.sh --plan --latest

./scripts/codexrestore.sh \
  --archive /path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz.age \
  --age-identity /path/to/age-identity.txt
```

返回值：

- `0`：恢复成功或预案生成成功。
- `1`：运行失败，例如归档不存在、校验失败、依赖缺失或目标端不可达。
- `2`：参数或配置缺失。

## `codexinstallautomation`

脚本：`./scripts/codexinstallautomation.sh`

用法：

```zsh
./scripts/codexinstallautomation.sh install
./scripts/codexinstallautomation.sh status
./scripts/codexinstallautomation.sh validate
./scripts/codexinstallautomation.sh uninstall
```

动作：

- `install`：安装 macOS `launchd` 定时任务。会复制 toolkit 到 `~/Library/Application Support/CodexBackupToolkit/`。
- `status`：读取当前定时任务状态。
- `validate`：写入并 lint 一个隔离 plist，随后删除，不加载 launchd 任务。适合发布验证。
- `uninstall`：卸载已安装的定时任务。
- `-h` / `--help`：显示帮助。

路径：

- 安装目录：`~/Library/Application Support/CodexBackupToolkit/`
- 标准输出日志：`~/Library/Logs/CodexBackup/backup.out.log`
- 错误输出日志：`~/Library/Logs/CodexBackup/backup.err.log`

重要提醒：GUI 当前不会安装、卸载、加载或修改真实定时任务。发布验证中使用的是 `validate` 隔离模式。

## 关键环境变量

通用：

- `CODEX_BACKUP_PROFILE`：当前只支持 `codex`。
- `CODEX_BACKUP_TARGET`：目标端，支持 `local`、`smb`、`webdav`、`rclone`。
- `CODEX_BACKUP_REMOTE_DIR`：远端目录名，默认 `codex-backups`。
- `CODEX_BACKUP_SPOOL_DIR`：临时目录，默认在 `~/Library/Application Support/CodexBackupToolkit/spool`。
- `CODEX_BACKUP_INTERVAL_DAYS`：定时任务最小备份间隔天数，默认 `3`。

本地目标端：

- `CODEX_BACKUP_LOCAL_DIR`：本机备份目录。

SMB/NAS 目标端：

- `CODEX_BACKUP_SMB_HOST`：服务器地址。
- `CODEX_BACKUP_SMB_USER`：用户名。
- `CODEX_BACKUP_SMB_SHARE`：共享名。
- `CODEX_BACKUP_SMB_MOUNT`：挂载路径。
- `CODEX_BACKUP_KEYCHAIN_SERVICE`：Keychain service。
- `CODEX_BACKUP_KEYCHAIN_ACCOUNT`：Keychain account。
- `CODEX_BACKUP_PASSWORD`：单次运行密码覆盖。

WebDAV 目标端：

- `CODEX_BACKUP_WEBDAV_URL`：WebDAV 地址。
- `CODEX_BACKUP_WEBDAV_USER`：用户名。
- `CODEX_BACKUP_WEBDAV_KEYCHAIN_SERVICE`：Keychain service。
- `CODEX_BACKUP_WEBDAV_KEYCHAIN_ACCOUNT`：Keychain account。
- `CODEX_BACKUP_WEBDAV_PASSWORD`：单次运行密码覆盖。

rclone 目标端：

- `CODEX_BACKUP_RCLONE_REMOTE`：rclone remote，例如 `gdrive:CodexBackup`。

加密：

- `CODEX_BACKUP_ENCRYPT`：设为 `1` 启用 age 加密。
- `CODEX_BACKUP_ENCRYPTION`：当前为 `age`。
- `CODEX_BACKUP_AGE_RECIPIENT`：age 收件人公钥。
- `CODEX_BACKUP_AGE_RECIPIENT_FILE`：age 收件人文件。
- `CODEX_BACKUP_AGE_IDENTITY`：恢复加密归档时使用的 identity 文件。

保留策略：

- `CODEX_BACKUP_RETENTION_COUNT`：保留最新 N 份备份，默认 `0` 表示关闭。
- `CODEX_BACKUP_RETENTION_DAYS`：删除超过 N 天的备份，默认 `0` 表示关闭。
- `CODEX_BACKUP_REMOTE_RETENTION`：WebDAV/rclone 远端保留策略开关，默认 `0`。设为 `1` 后才会删除远端旧归档。

本地为准一致性检查：

- `CODEX_BACKUP_SYNC_ENABLED`：定时任务是否启用一致性检查，默认 `0`。
- `CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS`：只读检查频率，默认 `24`。
- `CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS`：最小生成新备份间隔，默认 `24`。

## 归档产物

普通备份会生成：

```text
codex-backup-<host>-<timestamp>.tar.gz
codex-backup-<host>-<timestamp>.tar.gz.sha256
codex-backup-<host>-<timestamp>.tar.gz.manifest
```

启用 age 加密后会生成：

```text
codex-backup-<host>-<timestamp>.tar.gz.age
codex-backup-<host>-<timestamp>.tar.gz.age.sha256
codex-backup-<host>-<timestamp>.tar.gz.manifest
```

本地为准一致性检查还会维护 fingerprint sidecar，用于判断本机状态和最新备份是否一致。

## 推荐执行顺序

首次配置建议按这个顺序走：

```zsh
cp config.example.env config.env
$EDITOR config.env
source ./config.env
./scripts/codexbackup.sh --doctor --target local
./scripts/codexbackup.sh --config-guide --target local
./scripts/codexbackup.sh --target local --local-output "$HOME/CodexBackups"
./scripts/codexrestore.sh --plan --latest --target local
```

真实恢复前，先跑 `codexrestore --plan`，确认归档和目标路径无误后再执行真实恢复。
