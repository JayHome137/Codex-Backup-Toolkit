import { describe, expect, it } from 'vitest';
import type { BackupAcceptance } from './backupAcceptance';
import type { BackupHealth } from './backupHealth';
import type { DoctorAdvice } from './doctorAdvice';
import type { FirstUsePath } from './firstUsePath';
import type { TargetSetupGuide } from './targetSetupGuide';
import { buildFirstLaunchGuidance } from './firstLaunchGuidance';

const readyFirstUsePath: FirstUsePath = {
  level: 'ready',
  primaryAction: '保持当前备份节奏，并定期检查健康页。',
  safetyNote: '不会执行真实恢复，不会安装、卸载或修改定时任务。',
  steps: [],
  summary: '首次真实使用路径已闭环，可以进入日常备份节奏。',
};

const acceptedBackup: BackupAcceptance = {
  archivePath: '/tmp/CodexBackups/codex-backup.tar.gz',
  checks: [],
  level: 'accepted',
  nextActions: ['保持当前备份节奏'],
  summary: '首次真实备份已验收。',
};

const healthyBackup: BackupHealth = {
  items: [
    { detail: 'helper 在线。', id: 'helper', label: 'helper', status: 'ok' },
    { detail: '配置正常。', id: 'config', label: '配置', status: 'ok' },
    { detail: '最近备份成功。', id: 'history', label: '最近备份', status: 'ok' },
    { detail: '定时任务已加载。', id: 'automation', label: '自动化', status: 'ok' },
    { detail: '一致性关闭。', id: 'sync', label: '一致性', status: 'ok' },
  ],
  latestBackup: {
    action: 'backup',
    actionLabel: '普通备份',
    ageHours: 8,
    archivePath: '/tmp/CodexBackups/codex-backup.tar.gz',
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

const readyDoctorAdvice: DoctorAdvice = {
  cards: [],
  level: 'ready',
  nextActions: ['可以执行手动确认备份。'],
  safetyNote: '只读检查。',
  summary: '目标端检查通过。',
};

const readyTargetGuide: TargetSetupGuide = {
  commonFailures: [],
  level: 'ready',
  nextAction: '可以运行 doctor。',
  safetyNotes: ['不执行备份。'],
  steps: [],
  title: '本地设置向导',
  validationCommand: 'codexbackup --doctor',
};

const baseInput = {
  automationLoaded: true,
  backupAcceptance: acceptedBackup,
  backupHealth: healthyBackup,
  doctorAdvice: readyDoctorAdvice,
  firstUsePath: readyFirstUsePath,
  helperOnline: true,
  isDesktop: true,
  targetSetupGuide: readyTargetGuide,
  toolkitAvailable: true,
};

describe('buildFirstLaunchGuidance', () => {
  it('prioritizes opening the desktop app before deeper checks', () => {
    const guidance = buildFirstLaunchGuidance({ ...baseInput, isDesktop: false });

    expect(guidance.id).toBe('open-desktop');
    expect(guidance.section).toBe('settings');
    expect(guidance.actionLabel).toBe('打开设置');
    expect(guidance.safetyNote).toContain('不会修改已有定时备份任务');
  });

  it('prioritizes helper startup before backup or history actions', () => {
    const guidance = buildFirstLaunchGuidance({ ...baseInput, helperOnline: false });

    expect(guidance.id).toBe('start-helper');
    expect(guidance.section).toBe('settings');
    expect(guidance.summary).toContain('helper 离线');
  });

  it('sends blocked target configuration to the targets page', () => {
    const guidance = buildFirstLaunchGuidance({
      ...baseInput,
      targetSetupGuide: { ...readyTargetGuide, level: 'blocked', nextAction: '先补齐 rclone remote。' },
    });

    expect(guidance.id).toBe('fix-target');
    expect(guidance.section).toBe('targets');
    expect(guidance.actionLabel).toBe('打开目标端');
  });

  it('asks for read-only doctor before first backup when doctor has not run', () => {
    const guidance = buildFirstLaunchGuidance({
      ...baseInput,
      doctorAdvice: { ...readyDoctorAdvice, level: 'waiting', nextActions: ['运行一次只读 doctor。'], summary: '还没有运行目标端检查。' },
      firstUsePath: { ...readyFirstUsePath, level: 'needs-action', primaryAction: '运行一次目标端 doctor 检查。', summary: '首次真实使用路径还没有走完。' },
    });

    expect(guidance.id).toBe('run-doctor');
    expect(guidance.section).toBe('overview');
    expect(guidance.actionLabel).toBe('运行环境检查');
  });

  it('guides users to manually confirm the first real backup when acceptance is pending', () => {
    const guidance = buildFirstLaunchGuidance({
      ...baseInput,
      backupAcceptance: { ...acceptedBackup, archivePath: null, level: 'pending', summary: '还没有可验收的真实备份。' },
      firstUsePath: { ...readyFirstUsePath, level: 'needs-action', primaryAction: '回到概览页手动确认备份。', summary: '还缺少首次备份验收。' },
    });

    expect(guidance.id).toBe('first-backup');
    expect(guidance.section).toBe('overview');
    expect(guidance.detail).toContain('手动确认');
  });

  it('uses the schedule page for read-only automation review after first backup is accepted', () => {
    const guidance = buildFirstLaunchGuidance({ ...baseInput, automationLoaded: false });

    expect(guidance.id).toBe('review-schedule');
    expect(guidance.section).toBe('schedule');
    expect(guidance.safetyNote).toContain('不加载、不卸载、不重写定时任务');
  });

  it('falls back to health refresh when the product is ready for daily use', () => {
    const guidance = buildFirstLaunchGuidance(baseInput);

    expect(guidance.id).toBe('daily-health');
    expect(guidance.section).toBe('health');
    expect(guidance.level).toBe('ready');
    expect(guidance.summary).toContain('可以保持当前备份节奏');
  });
});
