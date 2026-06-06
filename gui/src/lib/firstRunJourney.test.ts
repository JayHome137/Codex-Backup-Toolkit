import { describe, expect, it } from 'vitest';
import { buildFirstRunJourney, type FirstRunJourneyInput } from './firstRunJourney';
import { defaultConfig } from './config';

const baseInput: FirstRunJourneyInput = {
  config: defaultConfig,
  configErrorCount: 0,
  doctorReport: {
    checks: [{ label: '通过', detail: 'zsh 可用', status: 'ok' }],
    status: 'success',
    summary: '1 项检查，0 个失败，0 个警告。',
    target: 'local',
  },
  health: {
    items: [],
    latestBackup: {
      action: 'backup',
      actionLabel: '普通备份',
      ageHours: 1,
      archivePath: '/tmp/CodexBackups/codex-backup.tar.gz',
      exitCode: 0,
      finishedAt: '2026-06-06T00:00:00.000Z',
      status: 'success',
      target: 'local',
    },
    level: 'healthy',
    nextActions: ['保持当前备份节奏'],
    score: 100,
    summary: '最近备份成功。',
  },
  helperOnline: true,
  isDesktop: true,
  toolkitAvailable: true,
};

describe('first run journey', () => {
  it('marks every step ready when desktop, config, doctor, helper, health, and backup history are ready', () => {
    const journey = buildFirstRunJourney(baseInput);

    expect(journey.readyCount).toBe(journey.steps.length);
    expect(journey.level).toBe('ready');
    expect(journey.summary).toContain('首启验证链路已完整');
    expect(journey.steps.map((step) => step.id)).toEqual([
      'desktop',
      'target',
      'doctor',
      'helper-health',
      'backup-proof',
      'restore-boundary',
    ]);
  });

  it('keeps the journey actionable but not complete when helper and backup history are missing', () => {
    const journey = buildFirstRunJourney({
      ...baseInput,
      doctorReport: null,
      health: { ...baseInput.health, latestBackup: null, level: 'warning', score: 70, summary: '缺少历史。' },
      helperOnline: false,
      isDesktop: false,
      toolkitAvailable: false,
    });

    expect(journey.level).toBe('needs-action');
    expect(journey.readyCount).toBeLessThan(journey.steps.length);
    expect(journey.steps.find((step) => step.id === 'desktop')?.status).toBe('todo');
    expect(journey.steps.find((step) => step.id === 'doctor')?.actionLabel).toBe('运行环境检查');
    expect(journey.steps.find((step) => step.id === 'helper-health')?.actionLabel).toBe('刷新健康状态');
    expect(journey.steps.find((step) => step.id === 'backup-proof')?.detail).toContain('可选');
  });

  it('treats config errors and failed doctor checks as blockers', () => {
    const journey = buildFirstRunJourney({
      ...baseInput,
      configErrorCount: 2,
      doctorReport: { ...baseInput.doctorReport!, status: 'error', summary: '3 项检查，1 个失败，0 个警告。' },
    });

    expect(journey.level).toBe('blocked');
    expect(journey.steps.find((step) => step.id === 'target')?.status).toBe('blocked');
    expect(journey.steps.find((step) => step.id === 'doctor')?.status).toBe('blocked');
    expect(journey.summary).toContain('需要先处理阻断项');
  });
});
