# Windows 脚本预览

这个目录包含 Windows 支持的第一轮 PowerShell 入口。当前目标是让路径、命令形态、只读检查和打包配置先稳定下来。

- `codexbackup.ps1`：支持 `-ProfilePlan`、`-Doctor`、`-DryRun` 和本地 zip 备份预览。
- `codexrestore.ps1`：只支持 `-Plan`，不会执行真实恢复。
- `codexcredential.ps1`：只支持 `-ValidateOnly`，不会保存或删除 Credential Manager 凭据。
- `codexscheduledbackup.ps1`：只支持 `-ValidateOnly`，不会安装、修改或删除 Task Scheduler 任务。

Windows 原生环境验证仍待完成。当前公开版本仍不能宣称 Windows 真实备份已经稳定可用。
