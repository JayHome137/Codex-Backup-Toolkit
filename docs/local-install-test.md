# macOS 本地安装测试清单

这份清单用于验证已经安装到 `/Applications` 的 CodexBackup App。它不负责安装 App，不加载、卸载或修改 `launchd`，不修改已有真实定时备份任务，也不执行真实恢复。

## 前置条件

- 已从 GitHub Release 下载并校验 `CodexBackup_<version>_aarch64.dmg`。
- 已把 `CodexBackup.app` 拖入 `/Applications`。
- 如果 macOS 拦截未签名 App，先用 Finder 右键打开；必要时再执行：

```zsh
xattr -dr com.apple.quarantine /Applications/CodexBackup.app
```

## 自动 smoke

运行：

```zsh
./tests/test-macos-local-install-smoke.sh
```

脚本会检查：

- `/Applications/CodexBackup.app` 存在。
- `Contents/MacOS/CodexBackup` 可执行。
- App Resources 内置 `toolkit/helper/server.mjs`。
- App Resources 内置 `toolkit/scripts/codexbackup.sh` 和 `toolkit/scripts/codexrestore.sh`。
- App 可以短暂启动并正常停止。
- 退出后 `37371` 和 `5173` 没有监听残留。

如果要测试临时位置的 App，可以指定：

```zsh
CODEXBACKUP_APP_ROOT=/path/to/CodexBackup.app ./tests/test-macos-local-install-smoke.sh
```

## 人工检查

1. 打开 `/Applications/CodexBackup.app`。
2. 确认概览页显示 `首次打开推荐`。
3. 进入设置页，确认 helper 状态、配置路径、历史路径、日志路径和版本号可见。
4. 刷新诊断，确认诊断只读展示，不出现安装、卸载、加载或卸载定时任务按钮。
5. 运行只读 doctor，确认结果可以展示。
6. 如果要做真实备份，只使用临时隔离目标目录，不使用已有真实备份目标。
7. 退出 App 后执行：

```zsh
lsof -nP -iTCP:37371 -sTCP:LISTEN || true
lsof -nP -iTCP:5173 -sTCP:LISTEN || true
```

预期没有监听残留。

## 不在本清单内

- 不测试真实恢复。
- 不安装、卸载、加载或卸载真实 `launchd` 任务。
- 不修改已有真实定时备份配置。
- 不验证 Apple 签名、公证或自动更新。
- 不验证 Windows 安装包。
