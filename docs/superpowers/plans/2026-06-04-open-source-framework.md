# Open Source Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local Codex backup scripts into a GitHub-ready open-source Codex-Backup-toolkit framework.

**Architecture:** Keep the project shell-first and macOS-first. Use `codexbackup`, `codexrestore`, and `codexinstallautomation` as the public command names while preserving old script names as wrappers. Publish the same archive format to local, SMB, WebDAV, or rclone targets.

**Tech Stack:** zsh, macOS launchd, rsync, tar, shasum, curl, optional rclone, macOS Keychain.

---

### Completed Tasks

- [x] Add open-source project metadata: `LICENSE`, `.gitignore`, `config.example.env`.
- [x] Replace README with GitHub-ready Codex-Backup-toolkit documentation.
- [x] Add public command scripts: `codexbackup.sh`, `codexrestore.sh`, `codexinstallautomation.sh`, `codexscheduledbackup.sh`.
- [x] Preserve legacy script names as wrappers.
- [x] Add storage target support for local, SMB, WebDAV, and rclone publishing.
- [x] Add docs for security, restore, storage targets, roadmap, and GUI direction.
- [x] Add example env files for local, SMB, WebDAV, and rclone.
- [x] Add framework validation script.
- [x] Verify local backup and restore with temporary HOME directories.

### Follow-Up Plan

- [ ] Add encrypted archive support with `age` or `gpg`.
- [ ] Add retention policy for local and SMB targets.
- [ ] Add remote latest restore for WebDAV and rclone.
- [ ] Add profile layer for future Claude Code, Cursor, and Windsurf support.
- [ ] Build GUI after the CLI is stable, using the CCSWITCH-like utility layout and Raycast-inspired DESIGN.md direction documented in `docs/gui-design.md`.
