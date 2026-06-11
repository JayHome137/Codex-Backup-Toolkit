# Codex Backup

Codex Backup 是一个极简桌面端备份工具，用来把 Codex 本地状态和 `~/Documents/Codex` 备份到用户指定的本地目录。第一版只做本地路径、手动备份、自动周期备份和恢复预案，不接 WebDAV、SMB、rclone、NAS 自动挂载、账号凭据或复杂诊断。

当前结构分为两层：

- `codex-local-backup/`：可复用 skill 和备份核心脚本，负责打包、校验、恢复预案和确认恢复。
- `desktop/`：Tauri 桌面壳，负责界面、备份位置、周期设置、手动备份、自动到期检查和菜单栏常驻。

## 产品边界

v1 只做这些事：

- 选择本地备份目录。
- 设置备份周期：手动、每天、每 3 天、每 7 天、每 14 天、每 30 天或自定义天数。
- 软件运行时自动检查是否到期，到期后执行备份。
- 用户可以随时点击 `立即备份`。
- 关闭窗口时隐藏到菜单栏，备份检查继续运行。
- 通过菜单栏重新打开窗口或退出应用。
- 选择 `.tar.gz` 备份包并生成恢复预案。

v1 不做这些事：

- WebDAV / SMB / rclone / NAS 远端目标
- Keychain / 账号密码管理
- 系统级 `launchd` 安装或卸载
- Windows preview
- 复杂 doctor / 高级诊断
- 自动发布和 Release 管理

## 默认备份范围

存在时会备份：

```text
~/.codex
~/Documents/Codex
~/Library/Application Support/Codex
~/Library/Application Support/com.openai.chat
~/Library/Application Support/OpenAI
```

`~/Documents/Codex` 默认包含，因为它可能保存大量对话记录、项目内容和阶段上下文。

## 使用核心脚本

创建备份：

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py backup \
  --output-dir "$HOME/CodexBackups"
```

检查备份：

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py inspect \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz"
```

生成恢复预案：

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py restore-plan \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz"
```

确认恢复：

```zsh
python3 codex-local-backup/scripts/codex_local_backup.py restore \
  --archive "$HOME/CodexBackups/codex-local-backup-host-YYYYmmdd-HHMMSS.tar.gz" \
  --confirm
```

## 桌面端开发

安装依赖：

```zsh
cd desktop
npm install
```

浏览器开发模式：

```zsh
npm run dev
```

Tauri 桌面开发模式：

```zsh
npm run desktop:dev
```

构建前端：

```zsh
npm run build
```

检查 Rust/Tauri：

```zsh
cd desktop/src-tauri
cargo check
```

## 验证

核心脚本测试：

```zsh
python3 -m unittest tests/test_codex_local_backup.py
```

skill 结构校验：

```zsh
/tmp/codex-skill-validate-venv/bin/python /Users/jayboy137/.codex/skills/.system/skill-creator/scripts/quick_validate.py codex-local-backup
```

桌面端测试和构建：

```zsh
cd desktop
npm test
npm run build
cd src-tauri
cargo check
```
