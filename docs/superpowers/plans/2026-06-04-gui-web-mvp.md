# GUI Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite React browser prototype for Codex-Backup-toolkit's future GUI.

**Architecture:** Add a `gui/` workspace containing a TypeScript React app. The app uses typed config helpers to generate CLI command previews and a mock command runner that can later be replaced by a Tauri bridge.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, lucide-react, CSS tokens.

---

### Task 1: Project Scaffold

**Files:**
- Create: `gui/package.json`
- Create: `gui/tsconfig.json`
- Create: `gui/tsconfig.node.json`
- Create: `gui/vite.config.ts`
- Create: `gui/index.html`

- [x] Add a standalone Vite React project under `gui/`.
- [x] Add scripts for `dev`, `build`, `test`, and `preview`.

### Task 2: Command Model

**Files:**
- Create: `gui/src/lib/config.ts`
- Create: `gui/src/lib/commands.ts`
- Create: `gui/src/lib/config.test.ts`
- Create: `gui/src/lib/commands.test.ts`

- [x] Define backup target types and command builders.
- [x] Verify command output for local, SMB, WebDAV, rclone, doctor, validate, backup, and restore preview.
- [x] Add mock command runner behavior tests.

### Task 3: UI Components

**Files:**
- Create: `gui/src/components/Sidebar.tsx`
- Create: `gui/src/components/StatusBadge.tsx`
- Create: `gui/src/components/CommandPreview.tsx`
- Create: `gui/src/components/TargetForm.tsx`
- Create: `gui/src/App.tsx`
- Create: `gui/src/main.tsx`
- Create: `gui/src/styles.css`

- [x] Implement compact dark utility UI.
- [x] Add Overview, Targets, Schedule, Restore, and Logs sections.
- [x] Show command previews for user actions.

### Task 4: Verification And Docs

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `.github/workflows/ci.yml`

- [x] Document the Web GUI prototype.
- [x] Add GUI tests/build to CI.
- [x] Run local tests and build.
