# Changelog

## 0.34.0 - 2026-06-07

- macOS `诊断` 页新增 `建议修复路径`，把桌面运行、helper、toolkit、路径、计划状态、首次备份验收和 release smoke 的缺口转成可点击的下一步。
- `buildMacosReadiness` 新增结构化 `fixPlan`，每条建议都包含动作、说明、安全边界和目标页面，避免只给静态状态。
- 诊断建议继续保持安全边界：只跳转页面或刷新只读诊断，不安装、卸载、加载或修改 `launchd`，不执行真实恢复，不接管外部 helper。
- GUI 测试和 macOS readiness 测试覆盖修复路径展示、导航和安全边界。
- GUI/Tauri 版本升至 `0.34.0`。

## 0.33.0 - 2026-06-07

- macOS GUI 新增 `诊断` 入口，集中展示桌面运行时、helper、内置 toolkit、产品路径、首次备份证明和发布 smoke 状态。
- 新增 `buildMacosReadiness` 诊断模型和测试，用于判断 macOS 桌面端是否达到日常使用和发布验收基础。
- 新增 `tests/test-macos-release-smoke.sh`，只读检查 `.app`、`.dmg`、sha256、图标和打包内置 helper/scripts 资源。
- 发布验收继续保持安全边界：不安装、卸载、加载或卸载 launchd，不执行真实恢复，不触碰已有真实定时备份任务。
- README、路线图、安全说明和发布清单同步记录 macOS 产品化完善状态。
- GUI/Tauri 版本升至 `0.33.0`。

## 0.32.0 - 2026-06-07

- Windows CI 新增隔离安装布局 smoke：`tests/windows-install-smoke.ps1`。
- 安装布局 smoke 使用 MSI 行政安装模式把安装包提取到临时目录，检查 `CodexBackup.exe`、内置 helper、Windows PowerShell 脚本、示例配置和 validate-only 安全边界。
- 验证完成后会自动清理临时目录，不注册真实系统应用，不写 Task Scheduler，也不修改 Credential Manager。
- README、Windows 文档、路线图和发布清单同步标记 Windows 仍为预览，签名、真实系统安装后 smoke、远端目标原生验证和真实恢复仍待完成。
- GUI/Tauri 版本升至 `0.32.0`。

## 0.31.0 - 2026-06-07

- Windows CI 在 `windows-latest` runner 上新增 Tauri 安装包构建：`npm run desktop:build:windows`。
- 新增 `desktop:build:windows`、`desktop:smoke:windows-installer` 和 `gui/scripts/windows-installer-smoke.mjs`。
- Windows installer smoke 会检查 `.msi` 或 `.exe` 安装包存在、非空，并确认文件名包含当前版本号。
- GitHub Actions 会上传 Windows 安装包 artifact：`codexbackup-windows-installers`。
- Windows 安装包进入 CI 构建验证阶段；签名、公证/代码签名和真实恢复执行仍未启用。
- GUI/Tauri 版本升至 `0.31.0`。

## 0.30.0 - 2026-06-07

- GitHub Actions 新增 `windows-native` job，在 `windows-latest` runner 上执行 `tests/windows-native.ps1`。
- 新增 Windows 原生预览验证脚本，覆盖 `codexbackup.ps1 -ProfilePlan`、`-Doctor`、本地 zip 备份预览、sha256、manifest、zip 内容、`codexrestore.ps1 -Plan`、Credential Manager validate-only 和 Task Scheduler validate-only。
- Windows PowerShell 脚本新增 `CODEX_BACKUP_HOME` 支持，方便 CI 和本地验证在临时 home 中隔离运行，不碰真实用户目录。
- macOS 静态 Windows preview 检查同步要求 Windows CI job 和 `tests/windows-native.ps1` 存在。
- Windows 安装包构建仍待 Windows 环境补齐；本版先完成 Windows 原生脚本验证链路。
- GUI/Tauri 版本升至 `0.30.0`。

## 0.29.0 - 2026-06-07

- 新增 Windows 预览脚本目录 `scripts/windows/`，包含 `codexbackup.ps1`、`codexrestore.ps1`、`codexcredential.ps1` 和 `codexscheduledbackup.ps1`。
- Windows `codexbackup.ps1` 支持 `-ProfilePlan`、`-Doctor`、`-DryRun` 和本地 zip 备份预览，并持续标记 `Status: preview`。
- Windows `codexrestore.ps1` 只生成恢复预案，真实恢复执行仍未启用。
- Windows Credential Manager 和 Task Scheduler 入口仅支持 `-ValidateOnly`，不会保存凭据或安装、修改、删除任务计划。
- 新增 `docs/windows.md`、Windows preview smoke 测试和 Tauri Windows `msi/nsis` 打包配置。
- 当前 macOS 构建仍是本机验证产物；Windows 原生运行和安装包构建仍需在 Windows 环境验证。
- GUI/Tauri 版本升至 `0.29.0`。

## 0.28.0 - 2026-06-07

- 新增 `buildProfileArchivePlan`，把 profile 路径计划映射为确定性的归档 staging 路径。
- `codexbackup` 的 dry-run、fingerprint 和真实备份 staging 拷贝改为从同一份 profile archive plan 读取路径，减少 macOS 和后续 Windows 路径维护重复。
- `codexbackup --profile-plan` 改为按脚本所在 toolkit 定位 helper 模块，从仓库外部目录调用也能正常输出路径计划。
- `codexbackup --doctor` 新增 Node 可用性检查，因为备份路径计划由 Node profile 模块生成。
- Windows 路径计划继续标记为 `planned`，本版本仍不启用 Windows 真实备份执行。
- GUI/Tauri 版本升至 `0.28.0`。

## 0.27.0 - 2026-06-07

- 新增 `helper/profile-paths.mjs`，提供 Codex profile 的跨平台路径计划能力。
- 新增只读 CLI：`codexbackup --profile-plan --platform darwin|win32`，可查看 macOS 当前路径计划和 Windows 规划路径。
- helper allowlist 新增只读 `profilePlan` action 和 raw 命令放行，仅允许 `darwin` 或 `win32`，不执行备份或恢复。
- Windows 路径计划会标记为 `planned`，用于后续验证和实现，不把 Windows 真实备份标记为已可用。
- 新增 profile path、helper action、helper server 和 CLI 测试。
- GUI/Tauri 版本升至 `0.27.0`。

## 0.26.1 - 2026-06-07

- 新增 `docs/cli-reference.md`，集中整理 `codexbackup`、`codexrestore`、`codexinstallautomation` 和定时入口的 CLI 用法。
- CLI 参考补齐命令选项、返回值、关键环境变量、归档产物、日志路径和推荐执行顺序。
- README、CLI 参考和路线图明确 Windows 支持已进入后续阶段，但当前版本仍按 macOS-first 标记和验证。
- README 和 README_EN 增加 CLI 参考入口，开源框架测试增加文档存在性和关键内容检查。
- GUI/Tauri 版本升至 `0.26.1`。

## 0.26.0 - 2026-06-07

- GUI 新增 `日常使用状态`，把首次真实使用路径、最近备份、健康度和自动化读取结果聚合成日常可用、需要关注或有阻断项。
- 概览页和健康页都会展示日常使用状态，方便用户在首次使用闭环后判断是否适合进入长期备份节奏。
- 新增 `dailyUsageStatus` 纯函数和测试，复用现有 `backupHealth` 与 `firstUsePath`，不重新扫描归档、不新增 helper API。
- 日常使用状态继续保持安全边界：只展示、跳转或刷新现有健康信息，不执行真实恢复，不安装、卸载或修改定时任务，真实备份仍需要手动确认。
- GUI/Tauri 版本升至 `0.26.0`。

## 0.25.0 - 2026-06-07

- GUI 新增 `首次真实使用路径`，把安装验收、目标端配置、doctor 检查、手动确认备份、首次备份验收和恢复边界串成概览级路线。
- 概览页和引导页都会展示首次真实使用路径，用户可以从每个步骤跳转到对应页面或运行已有只读 doctor 检查。
- 新增 `firstUsePath` 纯函数和测试，用现有安装验收、目标端向导、doctor 建议和备份验收状态计算路径结论和下一步动作。
- 首次真实使用路径继续保持安全边界：不执行真实恢复，不安装、卸载或修改定时任务，真实备份仍需要手动确认。
- GUI/Tauri 版本升至 `0.25.0`。

## 0.24.0 - 2026-06-07

- 安装页新增 `安装落地验收`，把 DMG 校验、首次打开、桌面运行时、目标端检查、首次备份验收和恢复边界串成一个闭环。
- 安装落地验收每个步骤都提供明确跳转：设置、目标端、日志和恢复页，帮助用户从下载后的状态走到第一次真实备份验收。
- 新增 `installReadiness` 纯函数和测试，用现有 helper/doctor/备份验收状态计算安装闭环结论和下一步动作。
- 安装落地验收继续保持安全边界：不执行真实恢复，不安装、卸载或修改定时任务，真实备份仍走原有手动确认流程。
- GUI/Tauri 版本升至 `0.24.0`。

## 0.23.0 - 2026-06-07

- GUI 新增 `目标端处理建议`，把 doctor 输出进一步整理为本地、SMB/NAS、WebDAV、rclone 的排查建议和下一步动作。
- GUI 新增 `首次备份验收`，根据 helper 历史展示归档、sha256、manifest、退出码和恢复预案入口，帮助确认第一次真实备份是否可验收。
- 恢复页新增 `恢复预案说明`，明确 `codexrestore --plan` 会做什么、不会做什么、需要准备什么和风险边界。
- 安装页新增 `发布可信度` 清单，展示 Release 产物、sha256、人工 smoke 流程，以及未签名、未公证、无自动更新等已知限制。
- 新增 `doctorAdvice`、`backupAcceptance`、`restorePlanGuide` 纯函数和测试，继续保持 GUI 只展示或调用现有安全动作。
- GUI/Tauri 版本升至 `0.23.0`。

## 0.19.0 - 2026-06-06

- 目标端页新增设置向导，按当前目标端展示配置步骤、只读验证命令、下一步动作和安全边界。
- 设置向导新增 SMB/WebDAV/rclone 常见失败原因说明，帮助定位认证、地址、remote、共享名和容量问题。
- 目标端页新增 `运行目标端检查` 和 `复制验证命令` 入口，复用现有 `codexbackup --doctor`，不新增 helper API。
- 新增 `targetSetupGuide` 纯函数和测试，避免向导规则散落在界面组件中。
- GUI/Tauri 版本升至 `0.19.0`。

## 0.18.0 - 2026-06-06

- 安装页补齐下载后校验结果判断：明确 `OK` 表示校验一致，失败时应删除 DMG 和 sha256 后重新下载。
- 安装页新增 macOS 未签名 App 打不开时的处理步骤，包括右键打开和系统设置隐私与安全允许打开。
- 安装页新增安装后 smoke 检查清单，串联引导页、设置页、健康页、概览页手动备份确认和恢复预案边界。
- `postInstallExperience` 增加校验结果文案、macOS 打开步骤和 smoke 步骤，并补充单元测试。
- GUI/Tauri 版本升至 `0.18.0`。

## 0.17.0 - 2026-06-06

- GUI 新增 `安装` 页面，集中展示当前 Release 地址、DMG 文件名、sha256 文件名和下载后校验命令。
- 安装页新增未签名限制、首次打开流程、运行时状态和安全边界核对，帮助用户下载 DMG 后完成第一轮确认。
- 新增 `postInstallExperience` 纯函数和单元测试，用于从版本和运行时状态生成安装后验证信息。
- 安装页只提供复制和跳转，不执行真实恢复，不安装、卸载或修改已有定时备份任务，也不加入签名、公证或自动更新能力。
- GUI/Tauri 版本升至 `0.17.0`。

## 0.16.0 - 2026-06-06

- GUI 新增 `引导` 页面，把桌面环境、目标端配置、doctor 检查、helper 健康、备份证明和恢复安全边界串成首启验证流程。
- 引导页可以触发已有的环境检查和只读健康刷新，也可以跳转到目标端、设置、概览真实备份确认和恢复页。
- 引导页不会绕过真实备份确认，不执行真实恢复，不安装、卸载、加载或修改已有定时任务。
- 新增 `firstRunJourney` 纯函数和单元测试，用于计算首启验证步骤、阻断项和完成度。
- GUI/Tauri 版本升至 `0.16.0`。

## 0.15.0 - 2026-06-06

- GUI 新增 `健康` 页面，聚合 helper、配置、备份历史、自动化状态和一致性检查，形成备份健康度评分。
- 健康页新增只读检查项、最近备份摘要、归档路径展示和建议动作，帮助用户判断下一步应该检查 helper、修正配置、刷新历史或查看计划状态。
- 健康页新增 `刷新健康状态`，只读取 helper 历史和自动化状态，不执行备份、恢复、安装、卸载或修改任务。
- 新增 `backupHealth` 纯函数和单元测试，把健康度计算从界面中拆出，便于后续继续扩展。
- 继续保持安全边界：健康页只展示和跳转，不执行真实恢复、安装、卸载或修改已有定时任务。
- GUI/Tauri 版本升至 `0.15.0`。

## 0.14.0 - 2026-06-06

- 新增本地为准一致性检查：支持 `--sync-check` 只读对比，以及 `--sync-local-authoritative` 在不一致时生成新的时间戳备份。
- 新增可配置频率：`CODEX_BACKUP_SYNC_ENABLED`、`CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS`、`CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS`，默认关闭，不改变既有定时备份行为。
- 定时脚本在显式启用同步后会调用本地为准检查；未启用时仍执行原来的普通备份。
- 备份归档新增 fingerprint sidecar，用于对比本地状态和最新备份；保留策略会一起清理 fingerprint 文件。
- helper 新增结构化 `syncLocalAuthoritative` action 和 raw sync allowlist；只有同步确实创建备份时才写入备份历史。
- GUI 新增 `一致性统一` 面板、同步频率设置、只读检查和本地为准备份入口，最新备份结果可展示同步触发的新归档。
- 新增 CLI、定时脚本、helper 和 GUI 测试覆盖本地为准一致性检查。
- GUI/Tauri 版本升至 `0.14.0`。

## 0.13.0 - 2026-06-06

- helper 新增只读 `GET /automation` 端点，展示 macOS launchd 备份任务的 label、加载状态、plist、安装目录、执行脚本、日志路径和计划信息。
- GUI `计划` 页新增 `自动化状态` 面板，可刷新真实自动化状态，但不提供安装、卸载、加载或修改任务入口。
- Tauri 桌面 bridge 允许代理只读 `/automation` 请求，继续拒绝自动化相关的修改方法。
- 桌面打包资源新增 `helper/automation-status.mjs`，避免 packaged helper 缺少只读状态模块。
- 新增 helper、GUI API、desktop bridge、Tauri allowlist 和计划页 UI 测试。
- GUI/Tauri 版本升至 `0.13.0`。

## 0.12.0 - 2026-06-06

- 概览页新增 `目标端检查`，把 `codexbackup --doctor` 输出解析成结构化检查项和摘要。
- 最新备份结果新增 `生成恢复预案` 入口，可从历史归档一键切到恢复页并填入归档路径。
- 从备份历史生成恢复预案时仍只使用 `codexrestore --plan`，不会执行真实恢复。
- 新增 doctor 输出解析单元测试和 GUI 历史恢复预案测试。
- GUI/Tauri 版本升至 `0.12.0`。

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
