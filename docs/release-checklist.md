# 发布检查清单

公开发布前使用这份清单。以后 GitHub Release 的标题和说明正文统一只写中文，不写英文版 release notes。

## 打 Tag 前

- [ ] 运行 `./tests/test-open-source-framework.sh`。
- [ ] 运行 `./tests/test-config-guide.sh`。
- [ ] 运行 `./tests/test-local-e2e.sh`。
- [ ] 运行 `./tests/test-encryption-e2e.sh`。
- [ ] 运行 `./tests/test-install-validate.sh`。
- [ ] 运行 `./tests/test-retention.sh`。
- [ ] 运行 `./tests/test-remote-latest-restore.sh`。
- [ ] 运行 `./tests/test-remote-retention.sh`。
- [ ] 运行 `node --test helper/server.test.mjs`。
- [ ] 运行 `cd gui && npm test`。
- [ ] 运行 `cd gui && npm run build`。
- [ ] 运行 `./scripts/codexbackup.sh --doctor --target local`。
- [ ] 启动 `node helper/server.mjs`，打开 GUI，选择 `HTTP 助手`，确认 `检查助手` 显示在线；验证后停止 helper。
- [ ] 确认 README 示例命令和当前脚本名称一致。
- [ ] 确认 README 和 README_EN 描述的是同一套发布行为。
- [ ] 确认没有提交个人主机名、用户名、token、密码或备份归档。
- [ ] 确认 `CHANGELOG.md` 已填写发布日期。
- [ ] 确认 helper 或 GUI 只开放真实备份执行，仍阻止安装、卸载、恢复和 status。
- [ ] 确认加密备份命令没有 age 收件人或收件人文件时会被 helper 阻止。

## 打 Tag

```zsh
git tag v0.3.0
git push origin main --tags
```

## 创建 GitHub Release

- [ ] 从 tag 创建 GitHub Release。
- [ ] Release 标题使用中文，例如：`Codex-Backup-toolkit v0.3.0` 可以保留项目名和版本号，但说明正文只写中文。
- [ ] 说明备份可能包含认证文件、cookies、sessions、memory 和本地项目文件。
- [ ] 说明上传到 WebDAV、rclone 云盘或第三方存储前建议启用加密。
- [ ] 说明 GUI 通过手动启动的 HTTP helper 可以执行真实备份，但仍不会执行恢复、安装或卸载。
- [ ] 说明 `codexbackup --config-guide` 是只读配置引导，不会创建备份或修改自动化。
- [ ] 说明 WebDAV 和 rclone 已支持 `codexrestore --latest` 拉取最新归档。
- [ ] 说明 WebDAV 和 rclone 远端保留策略默认关闭，只有设置 `CODEX_BACKUP_REMOTE_RETENTION=1` 才会删除旧远端归档。
