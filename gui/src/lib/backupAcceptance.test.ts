import { describe, expect, it } from 'vitest';
import { buildBackupAcceptance } from './backupAcceptance';
import type { BackupHistoryEntry } from './helperApi';

const successEntry: BackupHistoryEntry = {
  action: 'backup',
  archivePaths: ['/tmp/CodexBackups/codex-backup-mac-20260606-010203.tar.gz'],
  exitCode: 0,
  finishedAt: '2026-06-06T01:02:05.000Z',
  startedAt: '2026-06-06T01:02:03.000Z',
  status: 'success',
  target: 'local',
};

describe('buildBackupAcceptance', () => {
  it('marks the first real backup accepted when history has a successful archive entry', () => {
    const acceptance = buildBackupAcceptance([successEntry]);

    expect(acceptance.level).toBe('accepted');
    expect(acceptance.summary).toContain('首次真实备份验收通过');
    expect(acceptance.archivePath).toBe(successEntry.archivePaths[0]);
    expect(acceptance.checks.map((check) => check.id)).toEqual([
      'history',
      'success-status',
      'exit-code',
      'archive-path',
      'checksum-path',
      'manifest-path',
      'restore-plan',
    ]);
    expect(acceptance.checks.find((check) => check.id === 'checksum-path')?.detail).toContain('.sha256');
    expect(acceptance.nextActions).toContain('在日志页确认归档、sha256 和 manifest 路径，并生成一次恢复预案。');
  });

  it('accepts local-authoritative sync entries as backup proof when they created an archive', () => {
    const acceptance = buildBackupAcceptance([{ ...successEntry, action: 'syncLocalAuthoritative' }]);

    expect(acceptance.level).toBe('accepted');
    expect(acceptance.checks.find((check) => check.id === 'history')?.detail).toContain('本地为准一致性备份');
  });

  it('blocks acceptance when the latest backup failed', () => {
    const acceptance = buildBackupAcceptance([{ ...successEntry, archivePaths: [], exitCode: 2, status: 'error' }]);

    expect(acceptance.level).toBe('blocked');
    expect(acceptance.summary).toContain('最近一次真实备份还不能验收');
    expect(acceptance.checks.find((check) => check.id === 'success-status')?.status).toBe('error');
    expect(acceptance.checks.find((check) => check.id === 'archive-path')?.status).toBe('error');
  });

  it('stays pending when there is no helper history yet', () => {
    const acceptance = buildBackupAcceptance([]);

    expect(acceptance.level).toBe('pending');
    expect(acceptance.checks[0]).toMatchObject({ id: 'history', status: 'warning' });
    expect(acceptance.nextActions).toContain('先启动 helper，执行一次手动确认的真实备份，再刷新历史。');
  });
});
