# Contributing

Thanks for helping improve Codex-Backup-toolkit.

## Development Setup

This project is shell-first and macOS-first. There is no package install step for the core toolkit.

Run the checks before opening a pull request:

```zsh
./tests/test-open-source-framework.sh
./tests/test-local-e2e.sh
./tests/test-encryption-e2e.sh
./tests/test-install-validate.sh
```

`test-encryption-e2e.sh` skips itself when `age` and `age-keygen` are not installed.

## Scope

The current release scope is Codex Desktop backup and restore. New AI-tool profiles should document exactly which paths are backed up and why.

## Safety Rules

- Do not commit real backup archives.
- Do not commit private config files or credentials.
- Do not add personal NAS, WebDAV, cloud, or Keychain values to defaults.
- Keep launchd tests isolated from real user jobs.
