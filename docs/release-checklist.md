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
- [ ] 运行 `node --test helper/*.test.mjs`。
- [ ] 运行 `cd gui && npm test`。
- [ ] 运行 `cd gui && npm run build`。
- [ ] 运行 `cd gui && npm run desktop:doctor`。
- [ ] 运行 `cd gui && npm run desktop:build`；如果本机缺少 Rust 或 Tauri 依赖，确认错误信息能清楚说明缺失环境。
- [ ] 运行 `cd gui && npm run desktop:checksum`。
- [ ] 运行 `cd gui && npm run desktop:smoke`。
- [ ] 确认 `.app` Resources 中包含 `toolkit/helper/server.mjs` 和 `toolkit/scripts/codexbackup.sh`。
- [ ] 确认 `.app` Resources 中包含 `icon.icns`，且 `gui/src-tauri/icons/` 中多尺寸图标齐全。
- [ ] 运行 `./scripts/codexbackup.sh --doctor --target local`。
- [ ] 启动 `node helper/server.mjs`，打开 GUI，选择 `HTTP 助手`，确认 `检查助手` 显示在线；验证后停止 helper。
- [ ] 在 GUI 概览页确认 `HTTP 助手` 模式下可以看到 `真实备份确认`，且必须先点击 `确认真实备份` 才能点击 `执行真实备份`。
- [ ] 在 GUI 目标端页确认可以看到 `加载配置`、`保存配置`，SMB/WebDAV 下可以看到 Keychain 密钥面板。
- [ ] 在 GUI 日志页确认可以看到 `刷新历史` 和 `helper 备份历史`。
- [ ] 在 GUI 日志页确认真实备份历史刷新后可以看到 `最新备份结果`、归档路径、sha256 路径和 manifest 路径。
- [ ] 在 GUI 计划页确认可以刷新 `自动化状态`，能看到 label、加载状态、plist、安装路径、执行脚本、日志路径和计划信息。
- [ ] 确认 `自动化状态` 只读展示，不提供安装任务、卸载任务、加载任务或修改任务按钮。
- [ ] 在 GUI 概览页确认 `一致性统一` 显示本地为准、检查频率、最小备份间隔和保留策略说明。
- [ ] 确认 `只读检查` 不创建新备份，`本地为准生成备份` 只在 local/SMB 目标端可用。
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
- [ ] 确认 README 和 README_EN 描述的是同一套发布行为。
- [ ] 确认没有提交个人主机名、用户名、token、密码或备份归档。
- [ ] 确认 `CHANGELOG.md` 已填写发布日期。
- [ ] 确认 helper 或 GUI 只开放真实备份执行，仍阻止安装、卸载、恢复和 status。
- [ ] 确认加密备份命令没有 age 收件人或收件人文件时会被 helper 阻止。

## 打 Tag

```zsh
git tag v0.14.0
git push origin main --tags
```

## 创建 GitHub Release

- [ ] 从 tag 创建 GitHub Release。
- [ ] Release 标题使用中文，例如：`Codex-Backup-toolkit v0.14.0` 可以保留项目名和版本号，但说明正文只写中文。
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
- [ ] 说明 GUI 通过 HTTP helper 或桌面 helper 可以执行真实备份，但仍不会执行恢复、安装或卸载。
- [ ] 说明 `codexrestore --plan` 可以生成恢复预案，不会修改文件。
- [ ] 说明 helper 增加结构化 action、配置持久化、Keychain secret 接口和备份历史。
- [ ] 说明 GUI 已接入配置保存、Keychain 密钥操作和 helper 备份历史读取。
- [ ] 说明 GUI 增加 helper 在线/离线状态、离线禁用动作和更清楚的加载/错误反馈。
- [ ] 说明 GUI 真实备份需要先确认摘要，成功后会自动刷新 helper 备份历史。
- [ ] 说明 GUI 增加设置页和最新备份结果展示，可查看归档、sha256 和 manifest 路径。
- [ ] 说明 `codexbackup --config-guide` 是只读配置引导，不会创建备份或修改自动化。
- [ ] 说明 WebDAV 和 rclone 已支持 `codexrestore --latest` 拉取最新归档。
- [ ] 说明 WebDAV 和 rclone 远端保留策略默认关闭，只有设置 `CODEX_BACKUP_REMOTE_RETENTION=1` 才会删除旧远端归档。
