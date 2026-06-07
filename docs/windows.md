# Windows 预览

CodexBackup 从 `0.29.0` 起加入 Windows 预览代码路径。这个阶段的目标是补齐 PowerShell 入口、路径计划、恢复预案、凭据和任务计划的安全边界，以及 Tauri Windows 打包配置。

当前状态：Windows 原生环境验证仍待完成。因此公开说明应写成“Windows 预览”或“Windows 代码路径已补齐，待 Windows 环境验证”，不要写成 Windows 真实备份已经稳定可用。

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

## 后续验证

进入 Windows 环境后，需要补跑：

- PowerShell 语法检查和 Pester 或等价测试。
- 本地 zip 备份创建、sha256、manifest 和恢复预案检查。
- SMB、WebDAV、rclone 的只读 doctor 验证。
- Task Scheduler 和 Credential Manager 的 validate-only 行为确认。
- Tauri Windows `.msi` / `.exe` 构建和 smoke 检查。
