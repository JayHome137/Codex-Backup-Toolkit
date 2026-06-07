# 发布检查清单

公开发布前使用这份清单。以后 GitHub Release 的标题和说明正文统一只写中文，不写英文版 release notes。

版本号规则：小修小补使用补丁号，例如 `0.9.1`；新增明显产品模块再升到下一个次版本，例如 `0.10.0`；等软件达到稳定可用、安装和恢复链路都成熟后再进入 `1.0.0`。

## 打 Tag 前

- [ ] 运行 `./tests/test-open-source-framework.sh`。
- [ ] 运行 `./tests/test-config-guide.sh`。
- [ ] 运行 `./tests/test-restore-plan.sh`。
- [ ] 运行 `./tests/test-local-e2e.sh`。
- [ ] 运行 `./tests/test-encryption-e2e.sh`。
- [ ] 运行 `./tests/test-install-validate.sh`。
- [ ] 运行 `./tests/test-retention.sh`。
- [ ] 运行 `./tests/test-remote-latest-restore.sh`。
- [ ] 运行 `./tests/test-remote-retention.sh`。
- [ ] 运行 `./tests/test-sync-local-authoritative.sh`。
- [ ] 运行 `./tests/test-scheduled-sync-mode.sh`。
- [ ] 运行 `./tests/test-profile-plan.sh`。
- [ ] 运行 `node --test helper/*.test.mjs`。
- [ ] 运行 `cd gui && npm test`。
- [ ] 运行 `cd gui && npm run build`。
- [ ] 运行 `cd gui && npm run desktop:doctor`。
- [ ] 运行 `cd gui && npm run desktop:build`；如果本机缺少 Rust 或 Tauri 依赖，确认错误信息能清楚说明缺失环境。
- [ ] 运行 `cd gui && npm run desktop:checksum`。
- [ ] 运行 `cd gui && npm run desktop:smoke`；必须在 checksum 生成完成后再运行，避免并行检查时误报缺少 `.sha256`。
- [ ] 运行 `./tests/test-macos-release-smoke.sh`；必须在 `desktop:build`、`desktop:checksum` 和 `desktop:smoke` 后运行，避免检查旧产物。
- [ ] 安装到 `/Applications/CodexBackup.app` 后，运行 `./tests/test-macos-local-install-smoke.sh`；该脚本只检查已安装 App，不安装或修改系统任务。
- [ ] 确认 `.app` Resources 中包含 `toolkit/helper/server.mjs` 和 `toolkit/scripts/codexbackup.sh`。
- [ ] 确认 `.app` Resources 中包含 `icon.icns`，Windows 配置引用 `icon.ico`，且 `gui/src-tauri/icons/` 中多尺寸图标齐全。
- [ ] 运行 `./scripts/codexbackup.sh --doctor --target local`。
- [ ] 启动 `node helper/server.mjs`，打开 GUI，选择 `HTTP 助手`，确认 `检查助手` 显示在线；验证后停止 helper。
- [ ] 在 GUI 概览页确认 `HTTP 助手` 模式下可以看到 `真实备份确认`，且必须先点击 `确认真实备份` 才能点击 `执行真实备份`。
- [ ] 在 GUI 目标端页确认可以看到 `加载配置`、`保存配置`，SMB/WebDAV 下可以看到 Keychain 密钥面板。
- [ ] 在 GUI 日志页确认可以看到 `刷新历史` 和 `helper 备份历史`。
- [ ] 在 GUI 日志页确认真实备份历史刷新后可以看到 `最新备份结果`、归档路径、sha256 路径和 manifest 路径。
- [ ] 在 GUI 日志页确认可以看到 `首次备份验收`，并根据 helper 历史展示归档、sha256、manifest、退出码和恢复预案入口。
- [ ] 在 GUI 计划页确认可以刷新 `自动化状态`，能看到 label、加载状态、plist、安装路径、执行脚本、日志路径和计划信息。
- [ ] 确认 `自动化状态` 只读展示，不提供安装任务、卸载任务、加载任务或修改任务按钮。
- [ ] 在 GUI 概览页确认 `一致性统一` 显示本地为准、检查频率、最小备份间隔和保留策略说明。
- [ ] 确认 `只读检查` 不创建新备份，`本地为准生成备份` 只在 local/SMB 目标端可用。
- [ ] 在 GUI 健康页确认可以看到健康度评分、检查项、最近备份摘要、归档路径和建议动作。
- [ ] 在 GUI 健康页确认 `刷新健康状态` 只读取 helper 历史和自动化状态，不执行备份、恢复、安装、卸载或修改任务。
- [ ] 在 GUI 引导页确认可以看到桌面环境、目标端、环境检查、helper 健康、备份证明和恢复安全边界步骤。
- [ ] 在 GUI 引导页确认 `运行环境检查` 和 `刷新健康状态` 只调用已有安全动作，`查看真实备份确认` 不会绕过概览页确认按钮。
- [ ] 在 GUI 概览页或目标端页确认 `目标端处理建议` 会根据 doctor 输出展示目标端相关的下一步动作。
- [ ] 在 GUI 恢复页确认 `恢复预案说明` 展示会做什么、不会做什么、需要准备什么和风险提示，并且没有执行真实恢复按钮。
- [ ] 在 GUI 安装页确认 `发布可信度` 展示 Release 产物、sha256、人工 smoke 流程和未签名/未公证/无自动更新限制。
- [ ] 在 GUI 安装页确认 `安装落地验收` 展示下载校验、首次打开、桌面运行时、目标端检查、首次备份验收和恢复边界，并且只做跳转不执行真实恢复或修改定时任务。
- [ ] 在 GUI 概览页和引导页确认 `首次真实使用路径` 展示安装验收、目标端配置、doctor 检查、手动确认备份、首次备份验收和恢复边界，并且只做跳转或只读 doctor 检查。
- [ ] 在 GUI 概览页和健康页确认 `日常使用状态` 展示首次使用、最近备份、健康度和自动化状态，并且只做跳转或刷新健康信息，不执行真实恢复或修改定时任务。
- [ ] 在 GUI 诊断页确认 `macOS 诊断中心` 展示桌面成熟度、helper、toolkit、配置/历史/日志路径、首次备份证明和 macOS release smoke 状态。
- [ ] 确认 GUI 诊断页只提供刷新诊断、打开设置和打开日志，不提供安装任务、卸载任务、加载任务、卸载任务或执行真实恢复按钮。
- [ ] 确认未设置 `CODEX_BACKUP_SYNC_ENABLED=1` 时，定时脚本仍执行普通备份，不改变既有定时任务行为。
- [ ] 打开桌面 App，确认 helper 可以自动启动或在 `设置` 页一键启动。
- [ ] 确认 `设置` 页 `刷新诊断` 能显示 helper、toolkit、配置、历史、日志和版本信息。
- [ ] 确认 App 托管 helper 的输出写入 `desktop-helper.out.log` 和 `desktop-helper.err.log`。
- [ ] 退出桌面 App 后，确认由 App 启动的托管 helper 没有在 `37371` 残留。
- [ ] 手动启动外部 helper 后再打开桌面 App，确认显示外部 helper 在线，退出 App 不停止外部 helper。
- [ ] 确认 `设置` 页可以打开配置目录、日志目录和 toolkit 目录。
- [ ] 在 GUI 概览页确认 `桌面` helper 模式和 `HTTP 助手` 一样必须先点击 `确认真实备份` 才能点击 `执行真实备份`。
- [ ] 确认桌面 bridge 只代理允许的 helper API，不开放真实恢复、安装、卸载、status 或任意 shell。
- [ ] 确认本轮验证没有加载、修改或卸载已有真实定时备份任务。
- [ ] 确认 README 示例命令和当前脚本名称一致。
- [ ] 确认 `docs/cli-reference.md` 覆盖当前 CLI 命令、环境变量和安全边界。
- [ ] 确认 `codexbackup --profile-plan --platform win32` 仍标记为 `planned`，不把 Windows 真实备份写成当前已支持。
- [ ] 确认 macOS dry-run、fingerprint 和真实备份 staging 都由 profile/archive plan 驱动，归档内路径仍兼容旧恢复流程。
- [ ] 确认 Windows 预览说明没有写成 Windows 真实备份已稳定可用。
- [ ] 确认 Windows Credential Manager 和 Task Scheduler 入口只支持 validate-only，不会修改真实系统状态。
- [ ] 确认 GitHub Actions 的 `windows-native` job 已通过，且执行了 `tests/windows-native.ps1`。
- [ ] 确认 GitHub Actions 的 Windows runner 已执行 `npm run desktop:build:windows`、`npm run desktop:smoke:windows-installer` 和 `tests/windows-install-smoke.ps1`。
- [ ] 确认 Windows installer artifact `codexbackup-windows-installers` 已生成。
- [ ] 如需在本机复查已下载的 Windows artifact，运行 `cd gui && CODEXBACKUP_WINDOWS_INSTALLER_DIR=/path/to/artifact npm run desktop:smoke:windows-installer`。
- [ ] 确认 README 和 README_EN 描述的是同一套发布行为。
- [ ] 确认没有提交个人主机名、用户名、token、密码或备份归档。
- [ ] 确认 `CHANGELOG.md` 已填写发布日期。
- [ ] 确认 helper 或 GUI 只开放真实备份执行，仍阻止安装、卸载、恢复和 status。
- [ ] 确认加密备份命令没有 age 收件人或收件人文件时会被 helper 阻止。
- [ ] 确认 macOS 诊断页的建议修复路径只做页面跳转或只读刷新，不安装、卸载、加载或修改 `launchd`，不执行真实恢复。
- [ ] 确认概览页 `首次打开推荐` 只做页面跳转或运行只读 doctor，不安装、卸载、加载或修改 `launchd`，不执行真实恢复。

## 打 Tag

```zsh
git tag v0.35.2
git push origin main --tags
```

## 创建 GitHub Release

- [ ] 从 tag 创建 GitHub Release。
- [ ] Release 标题使用中文，例如：`Codex-Backup-toolkit v0.35.2` 可以保留项目名和版本号，但说明正文只写中文。
- [ ] 上传 `.dmg` 和对应 `.dmg.sha256`。
- [ ] 说明备份可能包含认证文件、cookies、sessions、memory 和本地项目文件。
- [ ] 说明上传到 WebDAV、rclone 云盘或第三方存储前建议启用加密。
- [ ] 说明 0.9.0 桌面产物内置 helper/scripts toolkit 资源，本机可构建未签名 `.app`，环境支持时生成 `.dmg`。
- [ ] 说明桌面 App 已接入正式图标资源。
- [ ] 说明未包含 Apple 签名、公证和自动更新。
- [ ] 说明桌面 App 可以托管 helper，也可以连接外部 helper；退出时只停止自己启动的托管 helper。
- [ ] 说明桌面 App 增加诊断入口和托管 helper 日志，便于定位配置、历史、日志和 toolkit 路径。
- [ ] 说明桌面 App 增加首次启动核对和概览页桌面就绪检查，便于确认 helper、toolkit、路径和未签名状态。
- [ ] 说明 GUI 增加目标端检查结构化结果，并可从备份历史生成恢复预案。
- [ ] 说明 GUI 增加只读自动化状态页，可查看 launchd label、加载状态、plist、安装路径和日志路径，但不会安装、卸载、加载或修改已有任务。
- [ ] 说明新增本地为准一致性检查，默认关闭，频率可选，不会从备份回写本机，不会覆盖旧归档。
- [ ] 说明 GUI 新增只读健康页，可查看健康度评分、最近备份摘要、归档路径、检查项和建议动作。
- [ ] 说明 GUI 新增日常使用状态，可汇总首次使用、最近备份、健康度和自动化状态，且只读取现有状态、不修改任务。
- [ ] 说明 GUI 新增 macOS 诊断中心，可汇总桌面成熟度、helper、toolkit、路径、首次备份证明和 release smoke 状态，且只读取现有状态、不修改任务。
- [ ] 说明新增 `tests/test-macos-release-smoke.sh`，可只读检查 `.app/.dmg`、sha256、图标和打包内置资源。
- [ ] 说明新增 `tests/test-macos-local-install-smoke.sh`，可检查 `/Applications/CodexBackup.app`、内置资源、短暂启动和退出后的端口残留，且不修改系统任务。
- [ ] 说明 GUI 新增首启引导页，串联桌面环境、目标端、doctor、helper 健康、备份证明和恢复边界。
- [ ] 说明 GUI 新增安装后验证页，可查看 Release 地址、DMG/sha256 文件名、校验命令、未签名限制和首次打开流程。
- [ ] 说明安装页补充校验结果判断、macOS 未签名 App 打开步骤和安装后 smoke 检查清单。
- [ ] 说明目标端页新增设置向导，可查看配置步骤、只读 doctor 验证命令、常见失败和安全边界。
- [ ] 说明 GUI 通过 HTTP helper 或桌面 helper 可以执行真实备份，但仍不会执行恢复、安装或卸载。
- [ ] 说明 `codexrestore --plan` 可以生成恢复预案，不会修改文件。
- [ ] 说明 helper 增加结构化 action、配置持久化、Keychain secret 接口和备份历史。
- [ ] 说明 GUI 已接入配置保存、Keychain 密钥操作和 helper 备份历史读取。
- [ ] 说明 GUI 增加 helper 在线/离线状态、离线禁用动作和更清楚的加载/错误反馈。
- [ ] 说明 GUI 真实备份需要先确认摘要，成功后会自动刷新 helper 备份历史。
- [ ] 说明 GUI 增加设置页和最新备份结果展示，可查看归档、sha256 和 manifest 路径。
- [ ] 说明 `codexbackup --config-guide` 是只读配置引导，不会创建备份或修改自动化。
- [ ] 说明新增 CLI 参考文档，集中整理命令、环境变量和安全边界。
- [ ] 说明新增 `--profile-plan --platform win32` 只读路径计划，Windows 真实备份仍未启用。
- [ ] 说明 macOS 备份路径已改为 profile/archive plan 驱动，当前归档结构保持兼容。
- [ ] 说明 Windows 预览新增 PowerShell 入口、本地 zip 备份预览、恢复预案、Credential Manager/Task Scheduler validate-only 骨架和 Tauri Windows 打包配置。
- [ ] 说明 GitHub Actions 已加入 Windows runner 原生验证、Windows installer 构建、隔离安装布局 smoke 和 artifact 上传。
- [ ] 说明 Windows 仍是预览阶段，签名、真实系统安装后 smoke、SMB/WebDAV/rclone 原生验证和真实恢复执行仍待完成。
- [ ] 说明 WebDAV 和 rclone 已支持 `codexrestore --latest` 拉取最新归档。
- [ ] 说明 WebDAV 和 rclone 远端保留策略默认关闭，只有设置 `CODEX_BACKUP_REMOTE_RETENTION=1` 才会删除旧远端归档。
