# Changelog

## 0.11.0 - 2026-06-06

- 概览页新增 `桌面就绪检查`，集中展示版本、helper 状态、toolkit 来源和安全边界。
- 设置页新增 `首次启动核对`，帮助首次打开桌面 App 时确认桌面运行环境、helper、toolkit、配置/历史路径和恢复预案边界。
- GUI 保持工具型布局，不新增真实恢复、安装、卸载或自动化管理入口。
- 更新测试覆盖首次启动体验和桌面就绪面板。
- GUI/Tauri 版本升至 `0.11.0`。

## 0.10.1 - 2026-06-06

- 新增正式 macOS App 图标资源，采用黑底玻璃质感备份图标方向。
- 生成并接入 Tauri 所需的多尺寸 PNG 和 `icon.icns`。
- 桌面 smoke 检查新增 App 图标资源断言，避免打包时遗漏图标。
- GUI/Tauri 版本升至 `0.10.1`。

## 0.10.0 - 2026-06-06

- Tauri 后端新增 `desktop_diagnostics` 命令，集中返回 helper 状态、toolkit 来源、配置路径、历史路径、日志路径和版本信息。
- 桌面 App 托管 helper 的标准输出和错误输出会写入 `~/Library/Logs/CodexBackup/desktop-helper.out.log` 和 `desktop-helper.err.log`。
- GUI 设置页新增 `刷新诊断`、打开 toolkit、打开配置/历史/日志路径入口，减少手动定位本机文件的成本。
- GUI 的 `桌面` helper 模式现在和 `HTTP 助手` 一样要求先确认真实备份摘要，非 Tauri 网页环境下不会启用桌面真实备份。
- 增加 Rust 和 GUI 测试覆盖桌面路径、诊断桥接、设置页路径和桌面真实备份确认边界。
- GUI/Tauri 版本升至 `0.10.0`。

## 0.9.2 - 2026-06-06

- 新增 `npm run desktop:checksum`，为当前版本 `.dmg` 生成 `.sha256` 文件并立即反向校验。
- `npm run desktop:smoke` 现在会检查 `.sha256` 是否存在且与当前 `.dmg` 匹配。
- 发布流程补充上传 `.dmg.sha256`，方便下载后校验桌面安装包完整性。
- 发布检查清单更新补丁版本流程和 tag 示例。
- GUI/Tauri 版本升至 `0.9.2`。

## 0.9.1 - 2026-06-06

- 设置页新增 `内置 toolkit` 状态，显示 toolkit 来源、根目录、helper 路径和脚本路径。
- Tauri 后端新增 `toolkit_status` 命令，用于检查桌面 App 当前使用的 toolkit 资源来源。
- 新增 `npm run desktop:smoke`，检查 `.app` Resources 中的运行时 toolkit 文件、确认未打入 helper 测试文件，并确认 `.dmg` 存在且非空。
- 修正设置页版本号显示，跟随当前发布版本。
- GUI 测试继续排除 `src-tauri/target/`，避免桌面构建缓存干扰前端测试。
- GUI/Tauri 版本升至 `0.9.1`。

## 0.9.0 - 2026-06-06

- 桌面 App 打包时新增内置 toolkit 资源：`helper/`、`scripts/`、`config.example.env` 和 `examples/`。
- Tauri helper 启动逻辑优先识别 App Resources 中的 `toolkit/`，开发环境仍支持 `CODEX_BACKUP_TOOLKIT_ROOT` 和仓库根目录。
- helper 根目录识别要求同时存在 `helper/server.mjs` 和 `scripts/codexbackup.sh`，避免只找到半套资源。
- 新增 Rust 单元测试覆盖 toolkit 资源定位逻辑。
- 发布检查脚本新增 Tauri 资源打包断言。
- GUI/Tauri 版本升至 `0.9.0`。

## 0.8.0 - 2026-06-06

- 新增 Tauri v2 桌面壳，复用现有 React/Vite GUI，目标产物为本机未签名 `.app`，环境支持时生成 `.dmg`。
- GUI 增加 `桌面` helper 模式，通过 Tauri bridge 代理 helper 请求，不再依赖浏览器跨域行为。
- 新增桌面桥接接口：`helper_status`、`helper_start`、`helper_stop`、`helper_request` 和 `open_path`。
- 桌面 App 只停止自己启动的托管 helper；发现外部 helper 在线时只连接，不强行接管。
- GUI 新增 `设置` 页，展示 helper 生命周期控制、配置路径、历史路径、日志路径和版本信息。
- GUI 日志页新增 `最新备份结果`，展示最近一次真实备份的目标端、状态、退出码、时间、归档路径、sha256 路径和 manifest 路径。
- 新增 `desktop:doctor`、`desktop:dev`、`desktop:build` 脚本；缺少 Rust 时输出中文诊断。
- 更新 README、README_EN、安全说明、路线图和发布清单，补齐桌面 App 构建与验证说明。
- GUI 版本升至 `0.8.0`。

## 0.7.0 - 2026-06-06

- GUI 在 `HTTP 助手` 模式下新增 `真实备份确认` 面板，显示目标端、加密状态、保留策略和 helper 状态摘要。
- 真实备份必须先点击 `确认真实备份`，才会启用 `执行真实备份`。
- 真实备份继续通过结构化 `backup` action 发送到 helper，不传递原始 shell 命令。
- 真实备份成功后，GUI 会自动调用 `/history` 刷新 helper 备份历史。
- 增加 GUI 测试，覆盖确认前禁用、确认后执行、结构化 backup action 和成功后刷新历史。
- GUI 版本升至 `0.7.0`。

## 0.6.0 - 2026-06-06

- GUI 顶部增加 helper 连接状态横幅，显示未确认、检查中、在线和离线状态。
- helper 离线时，配置加载/保存、Keychain 密钥操作和真实备份历史刷新按钮会自动禁用，避免误操作。
- helper 动作增加更清楚的加载中反馈，日志区会显示当前正在运行的 helper 动作。
- helper 不可用和 helper 执行失败的错误提示改为中文可操作说明，并指向 `node helper/server.mjs` 启动命令。
- 增加 GUI 测试，覆盖 helper 健康检查失败后的禁用状态，以及后续检查成功后的恢复状态。
- GUI 版本升至 `0.6.0`。

## 0.5.0 - 2026-06-06

- GUI 增加 helper 配置加载和保存，可以通过 `/config` 读取/写入持久化配置。
- GUI 增加 Keychain 密钥面板，支持为 SMB/WebDAV 目标端调用 `/secret` 保存或删除密钥。
- GUI 日志页增加 helper 真实备份历史读取，可通过 `/history` 展示目标端、状态、退出码、时间和归档路径。
- 新增 `gui/src/lib/helperApi.ts`，集中封装 `/config`、`/secret`、`/history` 调用和协议校验。
- 增加 GUI helper API 和界面交互测试。
- GUI 版本升至 `0.5.0`。

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
