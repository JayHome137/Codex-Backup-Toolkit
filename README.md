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
- 支持默认关闭的本地为准一致性检查：按可选频率对比本地状态和最新备份，不一致时生成新的时间戳备份，并套用保留策略。
- 提供 macOS 桌面 App 框架、浏览器开发模式和本地 helper，用于配置检查、helper 生命周期、配置保存、Keychain 密钥管理、受控真实备份执行、恢复预案、备份结果和安全边界验证。

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

## 桌面 App 和 GUI

0.8.0 起，GUI 已接入 Tauri v2 桌面壳。桌面 App 会复用 `gui/` 的 React/Vite 界面，并通过 Tauri bridge 管理或连接本地 helper。

安装前端依赖：

```zsh
cd gui
npm ci
```

浏览器开发模式：

```zsh
npm run dev
```

默认地址：`http://127.0.0.1:5173`

检查桌面构建环境：

```zsh
npm run desktop:doctor
```

启动桌面开发模式：

```zsh
npm run desktop:dev
```

构建未签名桌面产物：

```zsh
npm run desktop:build
```

生成 DMG 校验文件：

```zsh
npm run desktop:checksum
```

检查已构建桌面产物的内置资源：

```zsh
npm run desktop:smoke
```

当前目标是本机可运行的未签名 `.app`；如果 Tauri 和本机打包环境支持，也会生成 `.dmg`。当前不包含 Apple Developer 签名、公证和自动更新。缺少 Rust 工具链时，`desktop:build` 会输出中文提示，并指向 `https://rustup.rs/`。

桌面 App 启动后会检查 `127.0.0.1:37371`。如果发现外部 helper 已在线，只会连接它，退出 App 时不会停止外部进程；如果由 App 启动托管 helper，退出时会尝试清理该 helper。0.9.0 起，打包产物会内置 `helper/`、`scripts/`、`config.example.env` 和 `examples/`，桌面 App 可以优先从 App Resources 中启动 helper。0.10.0 起，App 托管 helper 的输出会写入：

```text
~/Library/Logs/CodexBackup/desktop-helper.out.log
~/Library/Logs/CodexBackup/desktop-helper.err.log
```

开发或调试时如需指定仓库根目录，可设置：

```zsh
CODEX_BACKUP_TOOLKIT_ROOT=/path/to/Codex-Backup-toolkit npm run desktop:dev
```

0.11.0 起，概览页会显示 `桌面就绪检查`，集中展示版本、helper 状态、toolkit 来源和未签名安全提示。`设置` 页会显示 `首次启动核对`、helper 状态、启动/停止按钮、桌面诊断、内置 toolkit 来源、配置路径、历史路径、日志路径和版本信息，并提供打开配置目录、日志目录和 toolkit 目录的入口。

0.12.0 起，概览页会把 `codexbackup --doctor` 输出整理成 `目标端检查` 结果，展示目标端、通过项、警告和失败项。`日志` 页会显示最近一次真实备份结果，包括归档、sha256 和 manifest 路径，并提供复制、打开路径和 `生成恢复预案` 入口。恢复页仍只生成 `codexrestore --plan`，不会执行真实恢复。

0.13.0 起，`计划` 页新增只读 `自动化状态` 面板，可通过 helper 读取 launchd 任务的 label、加载状态、plist 路径、安装路径、执行脚本、日志路径和计划信息。这个入口只做读取，不会安装、卸载、加载或修改已有定时备份任务。

0.14.0 起，概览页和目标端页新增 `一致性统一` 能力。它以本地数据为准，不会从备份回写本机，也不会覆盖已有归档；只读检查可查看当前本地状态和最新备份是否一致，`本地为准生成备份` 会在不一致时创建新的时间戳备份，并继续套用保留份数和保留天数。当前一致性检查先支持本地目录和 SMB/NAS 目标端。

0.15.0 起，GUI 新增 `健康` 页，聚合 helper、配置检查、备份历史、只读自动化状态和一致性检查，给出备份健康度评分、检查项和建议动作。这个页面只做展示和跳转，不执行真实恢复、安装、卸载或修改已有定时备份任务。

0.16.0 起，GUI 新增 `引导` 页，把桌面运行环境、目标端配置、环境检查、helper 健康、备份证明和恢复安全边界串成首启验证流程。引导页只调用已有安全动作或跳转到对应页面，不会绕过真实备份确认，不会执行真实恢复，也不会安装、卸载或修改已有定时任务。

0.17.0 起，GUI 新增 `安装` 页，集中展示当前 Release 地址、DMG 文件名、sha256 文件名、下载后校验命令、未签名限制和首次打开流程。这个页面只提供复制和跳转，不会下载或安装文件，不会执行真实恢复，也不会安装、卸载或修改已有定时任务。

0.18.0 起，`安装` 页会进一步说明校验成功和失败时分别代表什么、macOS 拦截未签名 App 时如何处理，以及安装后应按什么顺序完成 smoke 检查。smoke 检查仍只使用已有安全页面和手动确认流程，不会新增自动更新、签名、公证、真实恢复或自动化任务修改能力。

0.19.0 起，`目标端` 页新增设置向导，会按本地目录、SMB/NAS、WebDAV 或 rclone 展示配置步骤、只读 doctor 验证命令、下一步动作、常见失败原因和安全边界。向导复用现有 `codexbackup --doctor`，不会保存密码明文，不会新增 helper API，也不会安装、卸载或修改已有定时任务。

0.10.1 起，桌面 App 已接入正式图标资源。当前图标采用黑底玻璃质感备份图标方向，包含多尺寸 PNG 和 `icon.icns`，用于 `.app`、Dock、Finder 和 DMG 展示。

## 浏览器模式和本地 helper

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

helper 默认只监听 `127.0.0.1:37371`。GUI 顶部会显示 helper 未确认、检查中、在线或离线状态；helper 离线时，加载/保存配置、Keychain 密钥和真实历史按钮会暂时禁用，避免误操作。GUI 选择 `HTTP 助手` 或 `桌面` helper 后，可以执行环境检查、加载/保存配置、保存/删除 Keychain 密钥、读取真实备份历史、读取只读自动化状态、受控真实备份、恢复预案和隔离的计划校验。真实备份需要先确认摘要，再点击 `执行真实备份`，成功后会自动刷新 helper 备份历史并更新最新备份结果。恢复预案会运行 `codexrestore --plan`，不会执行真实恢复。

helper 仍会阻止真实恢复、安装、卸载、status 和拼接额外 shell 命令。自动化状态读取使用 `GET /automation`，只读取路径存在性和 `launchctl print` 状态，不会调用安装、卸载、加载或卸载命令。配置会保存到 `~/Library/Application Support/CodexBackupToolkit/config.json`，敏感字段会被过滤；密码类信息应通过 macOS Keychain 接口保存。备份历史会保存到 `~/Library/Application Support/CodexBackupToolkit/history.json`。协议细节见 [helper-protocol.md](docs/helper-protocol.md)。

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

## 本地为准一致性检查

一致性检查默认关闭，不会改变既有定时备份行为。启用后，定时脚本会先运行本地为准检查；如果最新备份缺失或与本地状态不同，就创建一个新的时间戳备份，然后按保留策略清理旧归档。本机数据永远优先，不会把备份内容同步回本机，也不会覆盖旧备份。

```zsh
CODEX_BACKUP_SYNC_ENABLED=1
CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=24
CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=24
```

只读检查：

```zsh
./scripts/codexbackup.sh --sync-check --target local
```

本地为准生成备份：

```zsh
./scripts/codexbackup.sh --sync-local-authoritative --target local
```

0.14.0 先支持 `local` 和 `smb` 目标端的一致性检查。WebDAV 和 rclone 仍可继续使用普通备份、最新恢复和远端保留策略。

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
