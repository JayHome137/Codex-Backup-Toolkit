import type { BackupAcceptance } from './backupAcceptance';

export type InstallReadinessStepId = 'download-checksum' | 'first-open' | 'runtime' | 'target-doctor' | 'first-backup' | 'restore-boundary';

export type InstallReadinessStep = {
  actionLabel: string;
  detail: string;
  id: InstallReadinessStepId;
  label: string;
  status: 'ok' | 'warning' | 'blocked';
};

export type InstallReadiness = {
  level: 'ready' | 'needs-action' | 'blocked';
  nextActions: string[];
  safetyNote: string;
  steps: InstallReadinessStep[];
  summary: string;
};

export type InstallReadinessInput = {
  appVersion: string;
  backupAcceptance: BackupAcceptance;
  doctorReady: boolean;
  helperOnline: boolean;
  isDesktop: boolean;
  toolkitAvailable: boolean;
};

export function buildInstallReadiness(input: InstallReadinessInput): InstallReadiness {
  const runtimeReady = input.isDesktop && input.helperOnline && input.toolkitAvailable;
  const steps: InstallReadinessStep[] = [
    {
      actionLabel: '复制校验命令',
      detail: `使用 CodexBackup_${input.appVersion}_aarch64.dmg.sha256 校验下载文件。`,
      id: 'download-checksum',
      label: '下载校验',
      status: 'ok',
    },
    {
      actionLabel: '查看打开步骤',
      detail: '首次打开未签名 App 时，按 macOS 隐私与安全提示允许打开。',
      id: 'first-open',
      label: '首次打开',
      status: 'ok',
    },
    {
      actionLabel: '打开设置',
      detail: runtimeReady ? '桌面环境、本机服务和内置资源已就绪。' : '需要在设置页确认本机服务和内置资源状态。',
      id: 'runtime',
      label: '桌面运行时',
      status: runtimeReady ? 'ok' : 'blocked',
    },
    {
      actionLabel: '运行目标端检查',
      detail: input.doctorReady ? '目标端 doctor 已有可用结果。' : '需要运行一次只读目标端 doctor 检查。',
      id: 'target-doctor',
      label: '目标端检查',
      status: input.doctorReady ? 'ok' : 'warning',
    },
    {
      actionLabel: '刷新历史',
      detail: input.backupAcceptance.summary,
      id: 'first-backup',
      label: '首次备份验收',
      status: input.backupAcceptance.level === 'accepted' ? 'ok' : input.backupAcceptance.level === 'blocked' ? 'blocked' : 'warning',
    },
    {
      actionLabel: '打开恢复预案',
      detail: '恢复页只生成 codexrestore --plan，用来确认恢复边界。',
      id: 'restore-boundary',
      label: '恢复边界',
      status: 'ok',
    },
  ];
  const blocked = steps.some((step) => step.status === 'blocked');
  const warning = steps.some((step) => step.status === 'warning');

  return {
    level: blocked ? 'blocked' : warning ? 'needs-action' : 'ready',
    nextActions: nextActions(steps),
    safetyNote: '安装落地验收不会执行真实恢复，不会安装、卸载或修改定时任务；真实备份仍只能走已有手动确认流程。',
    steps,
    summary: blocked || warning ? '安装落地验收还没有完成。' : '安装落地验收通过，可以进入日常备份使用。',
  };
}

function nextActions(steps: InstallReadinessStep[]): string[] {
  const actions: string[] = [];
  if (steps.find((step) => step.id === 'download-checksum')?.status !== 'ok' || steps.find((step) => step.id === 'first-open')?.status !== 'ok') {
    actions.push('先完成 DMG 校验和首次打开。');
  }
  if (steps.find((step) => step.id === 'runtime')?.status !== 'ok') {
    actions.push('先完成 DMG 校验和首次打开。');
    actions.push('打开设置页确认本机服务和内置资源。');
  }
  if (steps.find((step) => step.id === 'target-doctor')?.status !== 'ok') {
    actions.push('运行一次目标端 doctor 检查。');
  }
  if (steps.find((step) => step.id === 'first-backup')?.status !== 'ok') {
    actions.push('完成一次手动确认的真实备份并刷新历史。');
  }

  return actions.length > 0 ? unique(actions) : ['保持当前安装和备份验证记录。'];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
