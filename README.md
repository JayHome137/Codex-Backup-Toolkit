# Codex-Backup-toolkit

[English README](README_EN.md)

`codexbackup` 是一个当前以 macOS 为主的 Codex Desktop 备份、恢复和自动化工具。它可以把 Codex 本机状态打包成归档，并发布到本地目录、SMB/NAS、WebDAV 或 rclone 远端。Windows 支持已纳入后续路线，当前版本不会把 Windows 标记为已可用。

## 主要能力

- 备份 `~/.codex`、Codex app/browser 状态、skills、plugins、memories、sessions，以及 `~/Documents/Codex`。
- 支持 `local`、`smb`、`webdav`、`rclone` 四类目标端。
- 支持 `codexrestore --latest` 从本地、SMB、WebDAV、rclone 拉取最新备份。
- 支持 `codexrestore --plan` 生成恢复预案，不改文件、不创建安全备份。
- 支持可选 age 加密、本地/SMB 保留策略，以及默认关闭的 WebDAV/rclone 远端保留策略。
- 支持 macOS `launchd` 定时备份，默认每天 03:00 检查，间隔 3 天执行一次真实备份。
- 支持默认关闭的本地为准一致性检查：按可选频率对比本地状态和最新备份，不一致时生成新的时间戳备份，并套用保留策略。
- 提供 macOS 桌面 App 框架、浏览器开发模式和本地 helper，用于配置检查、helper 生命周期、配置保存、Keychain 密钥管理、受控真实备份执行、恢复预案、备份结果和安全边界验证。
- Windows 支持已进入产品路线：后续会补齐 Windows 路径发现、PowerShell/原生命令入口、任务计划程序、凭据保存和桌面打包。

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

完整命令、选项和环境变量见 [CLI 参考](docs/cli-reference.md)。

跨平台状态见 [roadmap.md](docs/roadmap.md)。当前 CLI 和桌面产物仍按 macOS 验证；Windows 相关能力会在后续版本逐步加入。

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

当前 GUI 已覆盖桌面就绪检查、设置页 helper 管理、目标端设置向导、目标端 doctor 结果、目标端处理建议、健康页、日常使用状态、首启引导、安装验证、安装落地验收、首次真实使用路径、发布可信度清单、真实备份确认、首次备份验收、最新备份结果、helper 历史、只读自动化状态、本地为准一致性检查和恢复预案。

0.23.0 起，GUI 会把短期成熟产品所需的四个判断流程补齐：

- `目标端处理建议`：根据 doctor 输出给出本地、SMB/NAS、WebDAV、rclone 的下一步排查建议。
- `首次备份验收`：根据 helper 历史展示归档、sha256、manifest、退出码和恢复预案入口。
- `恢复预案说明`：明确 `codexrestore --plan` 会做什么、不会做什么、需要准备什么。
- `发布可信度`：在安装页展示 Release 产物、sha256、人工 smoke 流程、未签名/未公证/无自动更新等已知限制。

这些界面只展示、复制、跳转或调用现有安全动作。真实恢复、安装/卸载/加载定时任务、自动更新、Apple 签名和公证仍不在当前版本内。

0.24.0 起，安装页新增 `安装落地验收`，把下载校验、首次打开、桌面运行时、目标端检查、首次备份验收和恢复边界串成一个可跟随的验收清单。每个步骤都会跳转到对应页面，仍不会执行真实恢复，也不会安装、卸载或修改已有定时任务。

0.25.0 起，概览页和引导页新增 `首次真实使用路径`，把安装验收、目标端配置、doctor 检查、手动确认备份、首次备份验收和恢复边界串成第一次真正上手的路线。它只做状态展示、页面跳转和已有只读 doctor 检查，不执行真实恢复，也不会安装、卸载或修改已有定时任务。

0.26.0 起，概览页和健康页新增 `日常使用状态`，把首次真实使用路径、最近备份、健康度和自动化读取结果聚合成日常可用、需要关注或有阻断项。它只读取现有状态、跳转页面或刷新健康信息，不重新扫描归档，不新增 helper API，不执行真实恢复，也不会安装、卸载或修改已有定时任务。

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
