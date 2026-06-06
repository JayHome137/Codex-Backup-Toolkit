import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAutomationStatusReader } from './automation-status.mjs';

test('reads launchd automation status without modifying files or loading jobs', async () => {
  const tempHome = await mkdtemp(join(tmpdir(), 'codexbackup-automation-status-'));
  const calls = [];
  try {
    await writeFile(join(tempHome, 'existing-marker'), 'keep');
    const reader = createAutomationStatusReader({
      env: {
        HOME: tempHome,
        CODEX_BACKUP_LAUNCHD_LABEL: 'dev.codexbackup.toolkit.readonly',
        CODEX_BACKUP_INSTALL_DIR: join(tempHome, 'AppSupport', 'CodexBackupToolkit'),
        CODEX_BACKUP_HOUR: '4',
        CODEX_BACKUP_MINUTE: '15',
        CODEX_BACKUP_INTERVAL_DAYS: '5',
      },
      uid: 'current',
      launchctlPrint: async (label) => {
        calls.push(label);
        return { exitCode: 1, stdout: '', stderr: 'Could not find service' };
      },
    });

    const status = await reader.read();

    assert.equal(status.label, 'dev.codexbackup.toolkit.readonly');
    assert.equal(status.loaded, false);
    assert.equal(status.plistExists, false);
    assert.equal(status.installDirExists, false);
    assert.equal(status.scheduledScriptExists, false);
    assert.equal(status.schedule, '04:15 / 每 5 天');
    assert.equal(status.lastError, 'Could not find service');
    assert.equal(status.plistPath, join(tempHome, 'Library', 'LaunchAgents', 'dev.codexbackup.toolkit.readonly.plist'));
    assert.equal(status.installDir, join(tempHome, 'AppSupport', 'CodexBackupToolkit'));
    assert.equal(status.scheduledScriptPath, join(tempHome, 'AppSupport', 'CodexBackupToolkit', 'scripts', 'codexscheduledbackup.sh'));
    assert.equal(status.stdoutLogPath, join(tempHome, 'Library', 'Logs', 'CodexBackup', 'backup.out.log'));
    assert.equal(status.stderrLogPath, join(tempHome, 'Library', 'Logs', 'CodexBackup', 'backup.err.log'));
    assert.deepEqual(calls, ['gui/current/dev.codexbackup.toolkit.readonly']);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('reports existing automation files while keeping the check read-only', async () => {
  const tempHome = await mkdtemp(join(tmpdir(), 'codexbackup-automation-status-existing-'));
  try {
    const installDir = join(tempHome, 'Library', 'Application Support', 'CodexBackupToolkit');
    await mkdir(join(tempHome, 'Library', 'LaunchAgents'), { recursive: true });
    await mkdir(join(installDir, 'scripts'), { recursive: true });
    await writeFile(join(tempHome, 'Library', 'LaunchAgents', 'dev.codexbackup.toolkit.plist'), '<plist/>');
    await writeFile(join(installDir, 'scripts', 'codexscheduledbackup.sh'), '#!/usr/bin/env zsh\n');

    const reader = createAutomationStatusReader({
      env: { HOME: tempHome },
      launchctlPrint: async () => ({ exitCode: 0, stdout: 'service = dev.codexbackup.toolkit', stderr: '' }),
    });

    const status = await reader.read();

    assert.equal(status.loaded, true);
    assert.equal(status.plistExists, true);
    assert.equal(status.installDirExists, true);
    assert.equal(status.scheduledScriptExists, true);
    assert.equal(status.lastError, undefined);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});
