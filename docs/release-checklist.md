# Release Checklist

Use this checklist before tagging a public release.

## Before Tagging

- [ ] Run `./tests/test-open-source-framework.sh`.
- [ ] Run `./tests/test-local-e2e.sh`.
- [ ] Run `./tests/test-encryption-e2e.sh`.
- [ ] Run `./tests/test-install-validate.sh`.
- [ ] Run `./tests/test-retention.sh`.
- [ ] Run `node --test helper/server.test.mjs`.
- [ ] Run `cd gui && npm test`.
- [ ] Run `cd gui && npm run build`.
- [ ] Run `./scripts/codexbackup.sh --doctor --target local`.
- [ ] Start `node helper/server.mjs`, open the GUI, select `HTTP Helper`, and confirm `Check Helper` reports online; stop the helper afterwards.
- [ ] Confirm README examples match current script names.
- [ ] Confirm README and README_EN describe the same release behavior.
- [ ] Confirm no personal hostnames, users, tokens, passwords, or backup archives are committed.
- [ ] Confirm `CHANGELOG.md` has the release date.
- [ ] Confirm no helper or GUI flow can install, uninstall, restore, or run a real backup without a future explicit design and review.

## Tagging

```zsh
git tag v0.1.0
git push origin main --tags
```

## After Tagging

- [ ] Create a GitHub release from the tag.
- [ ] Include the safety note that backups may contain credentials and local session data.
- [ ] Mention that WebDAV and rclone restore currently use download-then-`--archive`.
