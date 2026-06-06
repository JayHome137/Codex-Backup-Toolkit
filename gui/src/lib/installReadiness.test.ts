import { describe, expect, it } from 'vitest';
import { buildBackupAcceptance } from './backupAcceptance';
import { buildInstallReadiness } from './installReadiness';
import type { BackupHistoryEntry } from './helperApi';

const successfulBackup: BackupHistoryEntry = {
  action: 'backup',
  archivePaths: ['/tmp/CodexBackups/codex-backup-ready.tar.gz'],
  exitCode: 0,
  finishedAt: '2026-06-07T01:00:01.000Z',
  startedAt: '2026-06-07T01:00:00.000Z',
  status: 'success',
  target: 'local',
};

describe('buildInstallReadiness', () => {
  it('marks the install path ready when desktop runtime and backup acceptance are ready', () => {
    const readiness = buildInstallReadiness({
      appVersion: '0.26.0',
      backupAcceptance: buildBackupAcceptance([successfulBackup]),
      doctorReady: true,
      helperOnline: true,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(readiness.level).toBe('ready');
    expect(readiness.summary).toContain('安装落地验收通过');
    expect(readiness.steps.map((step) => step.id)).toEqual([
      'download-checksum',
      'first-open',
      'runtime',
      'target-doctor',
      'first-backup',
      'restore-boundary',
    ]);
    expect(readiness.steps.every((step) => step.status === 'ok')).toBe(true);
  });

  it('shows actionable blockers before helper and first backup are ready', () => {
    const readiness = buildInstallReadiness({
      appVersion: '0.26.0',
      backupAcceptance: buildBackupAcceptance([]),
      doctorReady: false,
      helperOnline: false,
      isDesktop: false,
      toolkitAvailable: false,
    });

    expect(readiness.level).toBe('blocked');
    expect(readiness.summary).toContain('安装落地验收还没有完成');
    expect(readiness.steps.find((step) => step.id === 'runtime')?.status).toBe('blocked');
    expect(readiness.steps.find((step) => step.id === 'first-backup')?.detail).toContain('首次真实备份还没有验收');
    expect(readiness.nextActions).toEqual([
      '先完成 DMG 校验和首次打开。',
      '打开设置页确认桌面 helper 和内置 toolkit。',
      '运行一次目标端 doctor 检查。',
      '完成一次手动确认的真实备份并刷新历史。',
    ]);
  });

  it('keeps the flow read-only except for existing confirmed backup action', () => {
    const readiness = buildInstallReadiness({
      appVersion: '0.26.0',
      backupAcceptance: buildBackupAcceptance([]),
      doctorReady: true,
      helperOnline: true,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(readiness.safetyNote).toContain('不会执行真实恢复');
    expect(readiness.safetyNote).toContain('不会安装、卸载或修改定时任务');
    expect(readiness.steps.map((step) => step.detail).join(' ')).not.toMatch(/自动更新|公证|执行真实恢复/);
  });
});
