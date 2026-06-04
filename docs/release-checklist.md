# Release Checklist

Use this checklist before tagging a public release.

## Before Tagging

- [ ] Run `./tests/test-open-source-framework.sh`.
- [ ] Run `./tests/test-local-e2e.sh`.
- [ ] Run `./tests/test-encryption-e2e.sh`.
- [ ] Run `./tests/test-install-validate.sh`.
- [ ] Run `./scripts/codexbackup.sh --doctor --target local`.
- [ ] Confirm README examples match current script names.
- [ ] Confirm no personal hostnames, users, tokens, passwords, or backup archives are committed.
- [ ] Confirm `CHANGELOG.md` has the release date.

## Tagging

```zsh
git tag v0.1.0
git push origin main --tags
```

## After Tagging

- [ ] Create a GitHub release from the tag.
- [ ] Include the safety note that backups may contain credentials and local session data.
- [ ] Mention that WebDAV and rclone restore currently use download-then-`--archive`.
