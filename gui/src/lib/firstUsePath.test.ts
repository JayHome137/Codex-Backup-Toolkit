import { describe, expect, it } from 'vitest';
import { buildBackupAcceptance } from './backupAcceptance';
import { buildDoctorAdvice } from './doctorAdvice';
import { buildFirstUsePath } from './firstUsePath';
import { buildInstallReadiness } from './installReadiness';
import { buildTargetSetupGuide } from './targetSetupGuide';
import { defaultConfig, getConfigChecks } from './config';
import type { BackupHistoryEntry } from './helperApi';

const successfulBackup: BackupHistoryEntry = {
  action: 'backup',
  archivePaths: ['/tmp/CodexBackups/codex-backup-first-use.tar.gz'],
  exitCode: 0,
  finishedAt: '2026-06-07T02:00:01.000Z',
  startedAt: '2026-06-07T02:00:00.000Z',
  status: 'success',
  target: 'local',
};

const readyDoctorReport = {
  checks: [{ detail: 'local target can be created', label: '通过', status: 'ok' as const }],
  status: 'success' as const,
  summary: '1 项检查，0 个失败，0 个警告。',
  target: 'local',
};

describe('buildFirstUsePath', () => {
  it('marks the first real-use path complete when install, target, doctor, backup, and restore boundary are ready', () => {
    const acceptance = buildBackupAcceptance([successfulBackup]);
    const path = buildFirstUsePath({
      backupAcceptance: acceptance,
      doctorAdvice: buildDoctorAdvice(readyDoctorReport, defaultConfig),
      helperOnline: true,
      installReadiness: buildInstallReadiness({
        appVersion: '0.27.0',
        backupAcceptance: acceptance,
        doctorReady: true,
        helperOnline: true,
        isDesktop: true,
        toolkitAvailable: true,
      }),
      targetSetupGuide: buildTargetSetupGuide(defaultConfig, getConfigChecks(defaultConfig)),
    });

    expect(path.level).toBe('ready');
    expect(path.summary).toContain('首次真实使用路径已闭环');
    expect(path.steps.map((step) => step.id)).toEqual(['install', 'target', 'doctor', 'backup', 'acceptance', 'restore-boundary']);
    expect(path.steps.every((step) => step.status === 'ready')).toBe(true);
    expect(path.primaryAction).toBe('保持当前备份节奏，并定期检查健康页。');
  });

  it('keeps users on target and doctor steps before the first real backup', () => {
    const acceptance = buildBackupAcceptance([]);
    const path = buildFirstUsePath({
      backupAcceptance: acceptance,
      doctorAdvice: buildDoctorAdvice(null, defaultConfig),
      helperOnline: false,
      installReadiness: buildInstallReadiness({
        appVersion: '0.27.0',
        backupAcceptance: acceptance,
        doctorReady: false,
        helperOnline: false,
        isDesktop: true,
        toolkitAvailable: true,
      }),
      targetSetupGuide: buildTargetSetupGuide(defaultConfig, getConfigChecks(defaultConfig)),
    });

    expect(path.level).toBe('needs-action');
    expect(path.primaryAction).toBe('运行一次目标端 doctor 检查。');
    expect(path.steps.find((step) => step.id === 'doctor')?.status).toBe('todo');
    expect(path.steps.find((step) => step.id === 'backup')?.detail).toContain('需要 helper 在线');
    expect(path.steps.find((step) => step.id === 'acceptance')?.status).toBe('todo');
  });

  it('blocks real-use guidance when target config or doctor checks are blocked', () => {
    const blockedConfig = { ...defaultConfig, target: 'rclone' as const, rcloneRemote: '' };
    const configChecks = getConfigChecks(blockedConfig);
    const acceptance = buildBackupAcceptance([]);
    const path = buildFirstUsePath({
      backupAcceptance: acceptance,
      doctorAdvice: buildDoctorAdvice({
        checks: [{ detail: 'fail: remote not found', label: '失败', status: 'error' }],
        status: 'error',
        summary: '1 项检查，1 个失败，0 个警告。',
        target: 'rclone',
      }, blockedConfig),
      helperOnline: true,
      installReadiness: buildInstallReadiness({
        appVersion: '0.27.0',
        backupAcceptance: acceptance,
        doctorReady: false,
        helperOnline: true,
        isDesktop: true,
        toolkitAvailable: true,
      }),
      targetSetupGuide: buildTargetSetupGuide(blockedConfig, configChecks),
    });

    expect(path.level).toBe('blocked');
    expect(path.summary).toContain('首次真实使用路径有阻断项');
    expect(path.primaryAction).toContain('先处理目标端配置阻断项');
    expect(path.steps.find((step) => step.id === 'target')?.status).toBe('blocked');
    expect(path.steps.find((step) => step.id === 'doctor')?.status).toBe('blocked');
    expect(path.safetyNote).toContain('不会执行真实恢复');
    expect(path.safetyNote).toContain('不会安装、卸载或修改定时任务');
  });
});
