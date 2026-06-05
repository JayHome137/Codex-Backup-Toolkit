# 本地 Helper 协议

本文档描述 Web GUI 和手动启动的本地 helper 之间的协议。

Web GUI 默认不执行 shell 命令。`本地桥接` 模式使用 mock transport 展示协议形状；`HTTP 助手` 模式只会连接用户手动启动的本地 Node helper。

## 安全边界

helper 采用 allowlist-first 设计。当前允许的能力是：

- `doctor`: `./scripts/codexbackup.sh --doctor --target <target>`
- `backup`: `./scripts/codexbackup.sh --target <target>`
- `restorePlan`: `./scripts/codexrestore.sh --plan --latest` 或 `./scripts/codexrestore.sh --plan --archive <file>`
- `validate`: 带有 `CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.<target>` 的 `./scripts/codexinstallautomation.sh validate`

GUI 和 helper 都会阻止真实恢复、安装、卸载、status 和 allowlist 之外的命令。隔离 validate label 是刻意设计的：它让 GUI 验证计划任务配置时不会触碰用户已经安装的真实备份任务。

helper 会拒绝拼接 shell 命令和常见命令分隔符。命令字符串模式下，validate 请求必须以 `./scripts/codexinstallautomation.sh validate` 结尾，backup 请求必须以 `./scripts/codexbackup.sh --target <target>` 结尾，环境变量行只能是简单赋值。

0.4.0 起，GUI 优先发送结构化 `action`，helper 由 action 生成命令。这样浏览器不再需要把完整 shell 命令当成执行意图。加密备份 action 必须包含 `ageRecipient` 或 `ageRecipientFile`。

## HTTP 端点

Node helper 只监听 `127.0.0.1`。默认端口是 `37371`。

开发验证时手动启动：

```zsh
node helper/server.mjs
```

可选端口覆盖：

```zsh
CODEX_BACKUP_HELPER_PORT=37372 node helper/server.mjs
```

GUI 选择 `HTTP 助手` 时默认连接 `http://127.0.0.1:37371`。

GUI 的 `检查助手` 只调用 `GET /health`，不会调用 `/run`，也不会执行 shell 命令。0.6.0 起，GUI 会把 `/health` 结果显示为顶部 helper 状态；当 helper 离线时，配置、Keychain 和真实历史相关按钮会暂时禁用，直到后续健康检查恢复在线。0.7.0 起，GUI 的真实备份入口需要先确认目标端、加密状态、保留策略和 helper 状态摘要，确认后才会向 `/run` 发送结构化 `backup` action；成功后会自动读取 `/history`。

### `GET /health`

返回 helper 状态：

```json
{
  "schema": "codex-backup-helper.v1",
  "version": 1,
  "status": "ok",
  "helper": "node-local-helper",
  "host": "127.0.0.1"
}
```

### `POST /run`

接收 helper request JSON，并返回 helper response。服务端在执行前会重新检查 allowlist，即使 GUI 已经检查过。

### `GET /config`

读取持久化 GUI 配置。默认路径：

```text
~/Library/Application Support/CodexBackupToolkit/config.json
```

文件不存在时返回默认配置对象。

### `PUT /config`

写入持久化 GUI 配置。写入前会递归过滤名称包含 `password`、`secret`、`token`、`credential` 的字段。

### `POST /secret`

通过 macOS `security add-generic-password` 保存 secret。helper 不会把 secret 回传给 GUI。

### `DELETE /secret`

通过 macOS `security delete-generic-password` 删除 secret。

### `GET /history`

读取 helper 记录的备份历史。成功执行结构化 backup action 后，helper 会记录目标端、状态、时间、退出码和归档路径。默认路径：

```text
~/Library/Application Support/CodexBackupToolkit/history.json
```

不支持的路径和方法会返回 JSON 错误。浏览器 CORS 只对本地 HTTP origin 开放，例如 `127.0.0.1`、`localhost` 和 `::1`。

## 请求结构

```json
{
  "schema": "codex-backup-helper.v1",
  "version": 1,
  "requestId": "cbt_<generated>",
  "createdAt": "2026-06-04T00:00:00.000Z",
  "kind": "backup",
  "command": "CODEX_BACKUP_TARGET=local \\\nCODEX_BACKUP_LOCAL_DIR=\"$HOME/CodexBackups\" \\\n./scripts/codexbackup.sh --target local"
}
```

字段：

- `schema`: 固定协议名，当前是 `codex-backup-helper.v1`。
- `version`: 数字协议版本，当前是 `1`。
- `requestId`: GUI 生成的请求 ID，用于关联和审计。
- `createdAt`: GUI 生成的 ISO 时间。
- `kind`: `doctor`、`backup`、`restorePlan` 或 `validate`。
- `command`: 已通过 allowlist 的命令预览。
- `action`: 可选结构化动作。存在 `action` 时，helper 根据动作生成命令，并忽略浏览器侧命令字符串。

结构化备份 action 示例：

```json
{
  "type": "backup",
  "target": "local",
  "config": {
    "localDir": "/Users/me/CodexBackups",
    "retentionCount": 10,
    "retentionDays": 30,
    "remoteRetention": false,
    "encrypt": false
  }
}
```

结构化恢复预案 action 示例：

```json
{
  "type": "restorePlan",
  "source": "archive",
  "archivePath": "/tmp/codex-backup.tar.gz"
}
```

## 响应结构

```json
{
  "schema": "codex-backup-helper.v1",
  "version": 1,
  "requestId": "cbt_<generated>",
  "status": "ok",
  "exitCode": 0,
  "stdout": "Doctor passed.",
  "stderr": "",
  "audit": {
    "commandKind": "doctor",
    "decision": "allowed",
    "helper": "native-helper",
    "startedAt": "2026-06-04T00:00:01.000Z",
    "finishedAt": "2026-06-04T00:00:01.500Z"
  }
}
```

字段：

- `status`: `ok` 或 `error`。
- `exitCode`: 类进程退出码。mock helper 成功时为 `0`。
- `stdout`: 命令输出或 helper 消息。
- `stderr`: 可用时的命令错误输出。
- `errorCode`: 可选机器可读错误码。
- `audit`: 每个 helper response 都必须包含的审计摘要。

## 错误码

- `ERR_COMMAND_NOT_ALLOWED`: 命令在到达 helper 前未通过 GUI allowlist。
- `ERR_HELPER_UNAVAILABLE`: GUI 无法连接或使用 helper transport。
- `ERR_HELPER_FAILED`: helper 已响应，但命令或端点处理失败。

## 当前实现

当前实现位置：

- `gui/src/lib/localBridge.ts`: allowlist 分类和本地桥接 runner。
- `gui/src/lib/helperProtocol.ts`: `/run` 请求/响应类型、请求构造、mock transport 和 HTTP transport。
- `gui/src/lib/helperApi.ts`: `/config`、`/secret`、`/history` 的 GUI API client。
- `helper/server.mjs`: 手动启动的 loopback HTTP helper。
- `helper/allowlist.mjs`: helper 侧 allowlist。
- `helper/executor.mjs`: 仅在 helper 侧 allowlist 通过后使用的 shell executor。

运行 helper 测试：

```zsh
node --test helper/*.test.mjs
```

这个仓库不会自动启动 helper。mock transport 用于在不执行 shell 命令的情况下展示 request id、schema、命令类型、决策、helper identity 和退出码。
