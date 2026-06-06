import { describe, expect, it } from 'vitest';
import { buildBackupHealth, type BackupHealthInput } from './backupHealth';
import { defaultConfig } from './config';

const baseInput: BackupHealthInput = {
  automationStatus: {
    installDir: '/Users/test/Library/Application Support/CodexBackupToolkit',
    installDirExists: true,
    label: 'dev.codexbackup.toolkit',
    loaded: true,
    plistExists: true,
    plistPath: '/Users/test/Library/LaunchAgents/dev.codexbackup.toolkit.plist',
    schedule: '03:00 / 每 3 天',
    scheduledScriptExists: true,
    scheduledScriptPath: '/Users/test/Library/Application Support/CodexBackupToolkit/scripts/codexscheduledbackup.sh',
    stderrLogPath: '/Users/test/Library/Logs/CodexBackup/backup.err.log',
    stdoutLogPath: '/Users/test/Library/Logs/CodexBackup/backup.out.log',
  },
  config: defaultConfig,
  configErrorCount: 0,
  helperOnline: true,
  history: [{
    action: 'backup',
    archivePaths: ['/tmp/CodexBackups/codex-backup-mac.tar.gz'],
    exitCode: 0,
    finishedAt: '2026-06-06T00:00:01.000Z',
    startedAt: '2026-06-06T00:00:00.000Z',
    status: 'success',
    target: 'local',
  }],
  now: new Date('2026-06-06T12:00:00.000Z'),
};

describe('backup health summary', () => {
  it('reports healthy when helper, automation, config, and recent history are good', () => {
    const health = buildBackupHealth(baseInput);

    expect(health.level).toBe('healthy');
    expect(health.score).toBe(100);
    expect(health.summary).toContain('最近备份成功');
    expect(health.items.map((item) => item.id)).toEqual(['helper', 'config', 'history', 'automation', 'sync']);
    expect(health.items.every((item) => item.status === 'ok')).toBe(true);
  });

  it('warns when helper is offline, automation is missing, and no backup history exists', () => {
    const health = buildBackupHealth({
      ...baseInput,
      automationStatus: null,
      helperOnline: false,
      history: [],
    });

    expect(health.level).toBe('warning');
    expect(health.score).toBeLessThan(70);
    expect(health.items.find((item) => item.id === 'helper')?.status).toBe('warning');
    expect(health.items.find((item) => item.id === 'history')?.status).toBe('warning');
    expect(health.items.find((item) => item.id === 'automation')?.status).toBe('warning');
    expect(health.nextActions).toContain('检查 helper 连接');
    expect(health.nextActions).toContain('执行一次真实备份或刷新历史');
  });

  it('reports risk when config has blocking errors or latest backup failed', () => {
    const health = buildBackupHealth({
      ...baseInput,
      configErrorCount: 1,
      history: [{ ...baseInput.history[0], status: 'error', exitCode: 1 }],
    });

    expect(health.level).toBe('risk');
    expect(health.items.find((item) => item.id === 'config')?.status).toBe('error');
    expect(health.items.find((item) => item.id === 'history')?.status).toBe('error');
    expect(health.nextActions).toContain('修正目标端或加密配置阻断项');
  });

  it('shows sync as enabled when local authoritative checks are configured', () => {
    const health = buildBackupHealth({
      ...baseInput,
      config: { ...defaultConfig, syncEnabled: true, syncCheckIntervalHours: 12, syncMinBackupIntervalHours: 24 },
    });

    const sync = health.items.find((item) => item.id === 'sync');
    expect(sync?.status).toBe('ok');
    expect(sync?.detail).toContain('每 12 小时检查');
  });

  it('exposes the latest successful backup artifact for the health page', () => {
    const health = buildBackupHealth(baseInput);

    expect(health.latestBackup).toEqual({
      action: 'backup',
      actionLabel: '普通备份',
      ageHours: 12,
      archivePath: '/tmp/CodexBackups/codex-backup-mac.tar.gz',
      exitCode: 0,
      finishedAt: '2026-06-06T00:00:01.000Z',
      status: 'success',
      target: 'local',
    });
  });
});
