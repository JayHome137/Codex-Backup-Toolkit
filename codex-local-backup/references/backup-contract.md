# Codex 本地备份契约

这个 skill 的目标是把 Codex 备份恢复问题收敛成一个本地、手动、可校验、可恢复的流程。它不是桌面软件，不管理远端存储，也不接管定时任务。

## 核心原则

- 用户每次明确指定备份输出目录。
- 默认包含 `~/Documents/Codex`，因为这里可能保存对话记录、项目内容和阶段性上下文。
- 备份结果必须可校验，至少包含归档、sha256 和 manifest。
- 恢复必须先能生成非破坏性的恢复预案。
- 真正恢复必须显式确认，并且先保存目标机当前数据。

## 默认输入路径

以用户 home 为根：

```text
.codex
Documents/Codex
Library/Application Support/Codex
Library/Application Support/com.openai.chat
Library/Application Support/OpenAI
```

路径不存在时记录为 missing，不让备份失败。

## 输出文件

每次备份写入：

```text
codex-local-backup-<host>-<timestamp>.tar.gz
codex-local-backup-<host>-<timestamp>.tar.gz.sha256
codex-local-backup-<host>-<timestamp>.tar.gz.manifest.json
```

manifest 至少记录：

- schema version
- 本次模式 `local-manual`
- 创建时间
- 主机名
- home 路径
- 归档名
- 归档 sha256
- 归档大小
- 每个默认路径的存在状态和归档内路径
- 被跳过的特殊文件

## 归档结构

归档内使用 home-relative 路径：

```text
.codex/...
Documents/Codex/...
Library/Application Support/...
```

这样恢复到新机器时可以直接落回目标 home。

## 恢复流程

推荐顺序：

1. `inspect` 检查归档和 sha256。
2. `restore-plan` 查看会恢复哪些路径、哪些目标已存在。
3. 用户确认后才执行 `restore --confirm`。
4. restore 先把已有目标路径复制到 safety backup。
5. restore 删除并替换归档中包含的目标路径。
6. restore 不处理归档外的其它路径。

默认 safety backup：

```text
~/CodexRestoreSafety/codex-before-restore-YYYYmmdd-HHMMSS/
```

## 停止条件

遇到这些情况不要继续真实恢复：

- 归档不存在。
- sha256 sidecar 存在但校验不一致。
- 归档里包含绝对路径或 `..` 逃逸路径。
- 用户没有明确要求执行真实恢复。

## 旧项目保留逻辑

旧版 `Codexbackup-all` 的 GUI、WebDAV、SMB、rclone、Keychain、launchd 和发布链路都不进入这个 skill。后续若要参考旧逻辑，只参考这些原则：

- 备份和恢复都要可验证。
- 恢复比备份风险更高，默认先给预案。
- 真实恢复前要有可回滚安全备份。
- 不要把存储目标复杂度带回主路径。
