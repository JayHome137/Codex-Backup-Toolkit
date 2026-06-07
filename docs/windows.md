# Windows 预览

CodexBackup 从 `0.29.0` 起加入 Windows 预览代码路径。这个阶段的目标是补齐 PowerShell 入口、路径计划、恢复预案、凭据和任务计划的安全边界，以及 Tauri Windows 打包配置。

当前状态：`0.30.0` 起，GitHub Actions 会在 `windows-latest` runner 上执行 `tests/windows-native.ps1`，验证 PowerShell 脚本的本地 zip 备份预览、sha256、manifest、恢复预案和 validate-only 安全边界。`0.31.0` 起，Windows runner 还会执行 `npm run desktop:build:windows` 并通过 `npm run desktop:smoke:windows-installer` 检查 `.msi` 或 `.exe` 安装包，随后上传 `codexbackup-windows-installers` artifact。`0.32.0` 起，Windows runner 还会执行 `tests/windows-install-smoke.ps1`，用 MSI 行政安装模式提取安装布局并检查内置资源，验证后自动清理临时目录。SMB/WebDAV/rclone 原生验证、签名、自动更新、真实系统安装后 smoke 和真实恢复执行仍待完成。因此公开说明仍应写成“Windows 预览”，不要写成 Windows 已完整成熟。

## 命令

查看 Windows profile 路径计划：

```powershell
pwsh -File .\scripts\windows\codexbackup.ps1 -ProfilePlan
```

运行只读环境检查：

```powershell
pwsh -File .\scripts\windows\codexbackup.ps1 -Doctor -Target local
```

预览将要检查的路径：

```powershell
pwsh -File .\scripts\windows\codexbackup.ps1 -DryRun
```

创建本地 zip 备份预览：

```powershell
pwsh -File .\scripts\windows\codexbackup.ps1 -Target local -LocalOutput "$HOME\CodexBackups"
```

生成恢复预案：

```powershell
pwsh -File .\scripts\windows\codexrestore.ps1 -Plan -Archive "$HOME\CodexBackups\codex-backup-host-YYYYmmdd-HHMMSS.zip"
```

凭据和任务计划当前只允许隔离验证：

```powershell
pwsh -File .\scripts\windows\codexcredential.ps1 -ValidateOnly
pwsh -File .\scripts\windows\codexscheduledbackup.ps1 -ValidateOnly
```

## 安全边界

- 真实恢复仍未启用，`codexrestore.ps1` 必须使用 `-Plan`。
- 不会安装、修改或删除任务计划程序任务。
- 不会保存、修改或删除 Windows Credential Manager 凭据。
- SMB、WebDAV 和 rclone 的 Windows 目标端真实验证仍待完成。
- macOS 现有 launchd 自动备份任务不会被 Windows 预览脚本读取、加载、卸载或修改。

## CI 验证

`tests/windows-native.ps1` 会在临时目录中设置 `CODEX_BACKUP_HOME`、`APPDATA`、`LOCALAPPDATA`、`CODEX_BACKUP_DOCUMENTS_DIR` 和 `CODEX_BACKUP_LOCAL_DIR`，避免读取或写入 runner 的真实用户资料目录。

验证范围：

- `codexbackup.ps1 -ProfilePlan`
- `codexbackup.ps1 -Doctor -Target local`
- `codexbackup.ps1 -Target local` 本地 zip 备份预览
- zip 内容、sha256 sidecar 和 manifest sidecar
- `codexrestore.ps1 -Plan`
- `codexcredential.ps1 -ValidateOnly`
- `codexscheduledbackup.ps1 -ValidateOnly`
- Tauri Windows `.msi` / `.exe` 构建
- Windows installer artifact smoke 检查
- Windows MSI 隔离安装布局 smoke 检查

## 后续验证

进入 Windows 环境后，需要补跑：

- SMB、WebDAV、rclone 的只读 doctor 验证。
- Task Scheduler 和 Credential Manager 的 validate-only 行为确认。
- Windows 安装包签名和真实系统安装后 smoke 检查。
