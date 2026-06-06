# 安全说明

Codex-Backup-toolkit 会复制足够完整的本地 Codex 状态，目的是让恢复真正可用。这也意味着备份归档可能包含敏感内容。

备份可能包含：

- Codex 配置和保存在磁盘上的本地凭据。
- plugin、skill、MCP 和 connector 状态。
- Codex app 数据中存在的浏览器会话文件。
- memories、transcripts、prompts、生成文件和工作区内容。
- `~/Documents/Codex` 下的项目工作区。

请把每一个备份归档都当作私密文件处理。

## 建议

- 将归档保存在私有文件夹、私有 bucket 或受控网盘目录中。
- 只把 SMB、WebDAV 和云盘权限授予可信用户。
- 不要把归档上传到 GitHub issue、release、公开 bucket 或公开共享目录。
- 上传到第三方云盘前，建议先启用归档加密。
- 如果归档曾经暴露，请轮换相关凭据。

## 密码处理

SMB 和 WebDAV 密码可以通过环境变量传入单次运行、交互式输入，或由 `codexinstallautomation` 保存到 macOS Keychain。

避免提交包含密码的 `config.env`，也避免让 shell history 留下密码。`config.example.env` 和 `examples/` 下的文件只作为模板使用。

helper 为 GUI 提供 Keychain 接口：`POST /secret` 和 `DELETE /secret` 通过 macOS `security` 命令保存或删除 secret。helper 不会把 secret 值回传给 GUI。

持久化 GUI 配置保存在：

```text
~/Library/Application Support/CodexBackupToolkit/config.json
```

写入配置前，helper 会递归移除字段名包含 `password`、`secret`、`token` 或 `credential` 的内容。密码类信息应放在 Keychain，不应写进配置 JSON。

## 归档加密

设置 `CODEX_BACKUP_ENCRYPT=1` 后，归档会先用 age 加密，再发布到目标端。age identity 文件应保存在备份目标端之外；如果 identity 丢失，加密备份将无法恢复。

manifest 是一个小型明文运维文件。它列出已纳入和缺失的源路径，但不包含文件内容。

可以运行下面的只读命令查看目标端配置和加密建议；它不会创建文件、访问网络或修改自动化：

```zsh
./scripts/codexbackup.sh --config-guide --target <target>
```

## GUI 和 helper 边界

GUI 可以通过浏览器开发模式连接手动启动的 HTTP helper，也可以在 Tauri 桌面模式下由 App 管理 helper 生命周期。helper 会在服务端重新检查 allowlist。

Tauri 桌面 App 启动后会检查 `127.0.0.1:37371/health`。如果端口已有 helper 在线，App 标记为外部 helper，只连接、不接管，退出时不会停止它。如果 App 自己启动托管 helper，退出时只尝试停止这个托管进程，不杀已有外部进程。

0.9.0 起，桌面包会内置运行 helper 所需的 toolkit 资源，包括运行时 helper 模块、脚本、示例配置和目标端示例。App 会优先从自身 Resources 中定位 `toolkit/helper/server.mjs` 和 `toolkit/scripts/codexbackup.sh`，开发环境仍可通过 `CODEX_BACKUP_TOOLKIT_ROOT` 指向仓库根目录。打包资源不改变 helper allowlist，也不会让 GUI 获得真实恢复、安装、卸载或任意 shell 执行能力。

0.10.0 起，桌面 App 托管 helper 的标准输出和错误输出会写入 `~/Library/Logs/CodexBackup/desktop-helper.out.log` 和 `~/Library/Logs/CodexBackup/desktop-helper.err.log`。这些日志只来自由桌面 App 启动的 helper；已有 launchd 自动备份日志仍使用 `backup.out.log` 和 `backup.err.log`。

0.11.0 起，GUI 会在概览页显示桌面就绪检查，并在设置页显示首次启动核对。它们只展示 helper、toolkit、配置/历史路径、未签名状态和恢复预案边界，不会加载、修改或卸载已有真实定时备份任务，也不会扩大 helper allowlist。

0.12.0 起，GUI 会把 doctor 输出整理成目标端检查结果，并允许从备份历史归档生成恢复预案入口。这两个入口都只展示或填充 `codexrestore --plan`，不会执行真实恢复，也不会修改现有自动化。

0.13.0 起，GUI `计划` 页可以通过 helper 的 `GET /automation` 读取 launchd 自动化状态。这个端点只检查文件路径是否存在，并调用只读的 `launchctl print gui/<uid>/<label>` 判断是否已加载；它不会运行 `codexinstallautomation install`、`uninstall`、`status`、`validate`，也不会调用 `launchctl bootstrap`、`bootout`、`enable` 或 `kickstart`。

0.14.0 起，一致性检查采用本地为准模型。它只对比本地状态和最新备份 fingerprint：本地数据永远优先，不会从备份回写本机，不会覆盖本机文件，也不会覆盖已有归档。发现缺失、缺少 fingerprint 或内容不一致时，会创建新的时间戳备份，并继续套用保留份数和保留天数。该机制默认关闭，只有设置 `CODEX_BACKUP_SYNC_ENABLED=1` 后定时脚本才会进入一致性模式；未启用时既有定时备份行为不变。

0.15.0 起，GUI `健康` 页只聚合已有只读状态、配置检查和 helper 历史，生成健康度评分和建议动作。它不新增 helper API，不执行真实恢复，不安装、卸载、加载或修改自动化任务。

0.16.0 起，GUI `引导` 页把桌面环境、目标端、doctor、helper 健康、备份证明和恢复边界串成首启验证流程。它只调用已有环境检查和只读健康刷新，或跳转到已有页面；不会新增 helper API，不会绕过真实备份确认，不会执行真实恢复，也不会安装、卸载、加载或修改自动化任务。

0.17.0 起，GUI `安装` 页只展示 Release 地址、DMG/sha256 文件名、校验命令、未签名限制和首次打开流程。它不新增 helper API，不下载或安装文件，不执行真实恢复，不安装、卸载、加载或修改自动化任务，也不包含 Apple 签名、公证或自动更新能力。

0.18.0 起，GUI `安装` 页会展示校验结果判断、macOS 未签名 App 打开步骤和安装后 smoke 检查清单。这些内容只用于指导用户确认下载完整性和运行状态，不会自动下载、自动安装、绕过系统安全设置、执行真实恢复或修改自动化任务。

0.19.0 起，GUI `目标端` 页会展示目标端设置向导、只读 doctor 验证命令和常见失败原因。向导不会保存密码明文，不新增 helper API，不执行真实备份，除非用户仍在概览页完成原有手动确认流程；也不会安装、卸载、加载或修改自动化任务。

0.23.0 起，GUI 会把 doctor 输出整理成目标端处理建议，把 helper 历史整理成首次备份验收，把恢复页整理成恢复预案说明，并在安装页展示发布可信度清单。这些能力只使用已有 doctor 输出、helper 历史、路径推断和版本信息，不重新扫描归档内容，不执行真实恢复，不下载或安装文件，不安装、卸载、加载或修改已有定时任务，也不加入签名、公证或自动更新。

桌面 bridge 只开放 `helper_status`、`helper_start`、`helper_stop`、`helper_request`、`toolkit_status`、`desktop_diagnostics` 和 `open_path`。`desktop_diagnostics` 只返回 helper 状态、toolkit 来源、配置路径、历史路径、日志路径和版本信息；`helper_request` 只允许 `/health`、`/config`、`/secret`、`/history`、`/automation` 和 `/run` 这组 helper API，不提供任意 shell 执行入口。

允许的 helper 动作仅限环境检查、真实备份执行、本地为准一致性检查、恢复预案生成，以及使用 `dev.codexbackup.toolkit.test.*` 隔离 label 的 `codexinstallautomation validate`。真实恢复、安装、卸载、status 和拼接额外 shell 命令仍会被阻止。

恢复预案通过 `codexrestore --plan` 生成。它只报告将要发生什么，不会提示确认、解压归档、创建安全备份、删除文件或复制文件。

GUI 顶部会显示 helper 未确认、检查中、在线或离线状态。helper 离线时，配置加载/保存、Keychain 密钥操作和真实历史刷新按钮会禁用；后续健康检查成功后，这些按钮会恢复可用。

真实备份入口需要先确认目标端、加密状态、保留策略和 helper 状态摘要，然后才会启用 `执行真实备份`。这个确认规则同时适用于 `HTTP 助手` 和 `桌面` helper 模式；非 Tauri 网页环境不会启用桌面真实备份。执行成功后，GUI 会自动刷新 helper 备份历史并显示最新备份结果。这个流程只发送结构化 `backup` action，不会开放真实恢复、安装、卸载或自动化修改。

成功的 helper 备份运行会记录在：

```text
~/Library/Application Support/CodexBackupToolkit/history.json
```

历史记录包含状态、时间戳、目标端、退出码和检测到的归档路径，不应包含密码。

加密备份命令如果没有包含 `CODEX_BACKUP_AGE_RECIPIENT` 或 `CODEX_BACKUP_AGE_RECIPIENT_FILE`，会被 helper 阻止。

## 设备绑定状态

macOS Keychain 项和浏览器加密数据可能无法仅靠文件复制迁移到另一台 Mac。恢复后，Codex 或浏览器相关集成可能要求重新登录，这是预期行为。
