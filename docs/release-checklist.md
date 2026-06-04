# 发布检查清单

公开发布前使用这份清单。以后 GitHub Release 的标题和说明正文统一只写中文，不写英文版 release notes。

## 打 Tag 前

- [ ] 运行 `./tests/test-open-source-framework.sh`。
- [ ] 运行 `./tests/test-local-e2e.sh`。
- [ ] 运行 `./tests/test-encryption-e2e.sh`。
- [ ] 运行 `./tests/test-install-validate.sh`。
- [ ] 运行 `./tests/test-retention.sh`。
- [ ] 运行 `node --test helper/server.test.mjs`。
- [ ] 运行 `cd gui && npm test`。
- [ ] 运行 `cd gui && npm run build`。
- [ ] 运行 `./scripts/codexbackup.sh --doctor --target local`。
- [ ] 启动 `node helper/server.mjs`，打开 GUI，选择 `HTTP Helper`，确认 `Check Helper` 显示在线；验证后停止 helper。
- [ ] 确认 README 示例命令和当前脚本名称一致。
- [ ] 确认 README 和 README_EN 描述的是同一套发布行为。
- [ ] 确认没有提交个人主机名、用户名、token、密码或备份归档。
- [ ] 确认 `CHANGELOG.md` 已填写发布日期。
- [ ] 确认 helper 或 GUI 没有在未经新设计和审查的情况下开放安装、卸载、恢复或真实备份。

## 打 Tag

```zsh
git tag v0.1.0
git push origin main --tags
```

## 创建 GitHub Release

- [ ] 从 tag 创建 GitHub Release。
- [ ] Release 标题使用中文，例如：`Codex-Backup-toolkit v0.1.0` 可以保留项目名和版本号，但说明正文只写中文。
- [ ] 说明备份可能包含认证文件、cookies、sessions、memory 和本地项目文件。
- [ ] 说明上传到 WebDAV、rclone 云盘或第三方存储前建议启用加密。
- [ ] 说明 GUI 当前仍是保守预览版，不会直接运行真实备份、恢复、安装或卸载。
- [ ] 说明 WebDAV 和 rclone 恢复目前采用“先下载归档，再用 `codexrestore --archive` 恢复”的方式。
