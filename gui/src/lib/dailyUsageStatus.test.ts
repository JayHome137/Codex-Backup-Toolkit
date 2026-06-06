import { describe, expect, it } from 'vitest';
import type { BackupHealth } from './backupHealth';
import type { FirstUsePath } from './firstUsePath';
import { buildDailyUsageStatus } from './dailyUsageStatus';

const readyFirstUsePath: FirstUsePath = {
  level: 'ready',
  primaryAction: '保持当前备份节奏，并定期检查健康页。',
  safetyNote: '不会执行真实恢复，不会安装、卸载或修改定时任务。',
  steps: [],
  summary: '首次真实使用路径已闭环，可以进入日常备份节奏。',
};

const healthyBackup: BackupHealth = {
  items: [
    { detail: 'helper 在线。', id: 'helper', label: 'helper', status: 'ok' },
    { detail: '配置正常。', id: 'config', label: '配置', status: 'ok' },
    { detail: '最近备份成功。', id: 'history', label: '最近备份', status: 'ok' },
    { detail: '定时任务已加载。', id: 'automation', label: '自动化', status: 'ok' },
    { detail: '一致性检查默认关闭。', id: 'sync', label: '一致性', status: 'ok' },
  ],
  latestBackup: {
    action: 'backup',
    actionLabel: '普通备份',
    ageHours: 12,
    archivePath: '/tmp/CodexBackups/codex-backup-daily.tar.gz',
    exitCode: 0,
    finishedAt: '2026-06-07T00:00:00.000Z',
    status: 'success',
    target: 'local',
  },
  level: 'healthy',
  nextActions: ['保持当前备份节奏'],
  score: 100,
  summary: '最近备份成功。',
};

describe('buildDailyUsageStatus', () => {
  it('marks daily usage ready when first use is complete and health is good', () => {
    const status = buildDailyUsageStatus({
      firstUsePath: readyFirstUsePath,
      health: healthyBackup,
    });

    expect(status.level).toBe('ready');
    expect(status.summary).toContain('日常备份状态正常');
    expect(status.primaryAction).toBe('保持当前备份节奏，并定期刷新健康状态。');
    expect(status.cards.map((card) => card.id)).toEqual(['first-use', 'latest-backup', 'health', 'automation']);
    expect(status.cards.every((card) => card.status === 'ok')).toBe(true);
  });

  it('asks users to finish first-use path before treating the product as daily-ready', () => {
    const status = buildDailyUsageStatus({
      firstUsePath: { ...readyFirstUsePath, level: 'needs-action', summary: '首次真实使用路径还没有走完。' },
      health: healthyBackup,
    });

    expect(status.level).toBe('attention');
    expect(status.primaryAction).toBe('先完成首次真实使用路径。');
    expect(status.cards.find((card) => card.id === 'first-use')?.status).toBe('warning');
  });

  it('blocks daily usage when health reports risk or the latest backup failed', () => {
    const status = buildDailyUsageStatus({
      firstUsePath: readyFirstUsePath,
      health: {
        ...healthyBackup,
        latestBackup: { ...healthyBackup.latestBackup!, exitCode: 2, status: 'error' },
        level: 'risk',
        nextActions: ['修正目标端或加密配置阻断项'],
        score: 30,
        summary: '备份链路存在需要先处理的风险。',
      },
    });

    expect(status.level).toBe('blocked');
    expect(status.summary).toContain('日常备份存在阻断风险');
    expect(status.primaryAction).toBe('修正目标端或加密配置阻断项');
    expect(status.cards.find((card) => card.id === 'latest-backup')?.status).toBe('error');
  });

  it('warns when the latest backup is older than three days', () => {
    const status = buildDailyUsageStatus({
      firstUsePath: readyFirstUsePath,
      health: {
        ...healthyBackup,
        latestBackup: { ...healthyBackup.latestBackup!, ageHours: 96 },
      },
    });

    expect(status.level).toBe('attention');
    expect(status.primaryAction).toBe('刷新历史；如确认过期，再执行一次手动确认备份。');
    expect(status.cards.find((card) => card.id === 'latest-backup')?.detail).toContain('96 小时前');
    expect(status.safetyNote).toContain('不会执行真实恢复');
  });
});
