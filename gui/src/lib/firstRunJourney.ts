import type { BackupConfig } from './config';
import type { BackupHealth } from './backupHealth';
import type { DoctorReport } from './doctorReport';

export type FirstRunJourneyStepId = 'desktop' | 'target' | 'doctor' | 'helper-health' | 'backup-proof' | 'restore-boundary';
export type FirstRunJourneyStepStatus = 'ready' | 'todo' | 'blocked';

export type FirstRunJourneyInput = {
  config: BackupConfig;
  configErrorCount: number;
  doctorReport: DoctorReport | null;
  health: BackupHealth;
  helperOnline: boolean;
  isDesktop: boolean;
  toolkitAvailable: boolean;
};

export type FirstRunJourneyStep = {
  actionLabel: string;
  detail: string;
  id: FirstRunJourneyStepId;
  label: string;
  status: FirstRunJourneyStepStatus;
};

export type FirstRunJourney = {
  level: 'ready' | 'needs-action' | 'blocked';
  readyCount: number;
  steps: FirstRunJourneyStep[];
  summary: string;
};

export function buildFirstRunJourney(input: FirstRunJourneyInput): FirstRunJourney {
  const steps: FirstRunJourneyStep[] = [
    desktopStep(input),
    targetStep(input),
    doctorStep(input),
    helperHealthStep(input),
    backupProofStep(input),
    restoreBoundaryStep(),
  ];
  const readyCount = steps.filter((step) => step.status === 'ready').length;
  const level = steps.some((step) => step.status === 'blocked') ? 'blocked' : readyCount === steps.length ? 'ready' : 'needs-action';

  return {
    level,
    readyCount,
    steps,
    summary: summaryFor(level),
  };
}

function desktopStep(input: FirstRunJourneyInput): FirstRunJourneyStep {
  const ready = input.isDesktop && input.toolkitAvailable;
  return {
    actionLabel: '打开设置',
    detail: ready ? '桌面运行环境和内置 toolkit 已就绪。' : '建议在桌面 App 中刷新诊断，确认 helper、toolkit 和本机路径。',
    id: 'desktop',
    label: '桌面运行环境',
    status: ready ? 'ready' : 'todo',
  };
}

function targetStep(input: FirstRunJourneyInput): FirstRunJourneyStep {
  if (input.configErrorCount > 0) {
    return {
      actionLabel: '打开目标端',
      detail: `${input.configErrorCount} 个配置阻断项需要先修正。`,
      id: 'target',
      label: '目标端配置',
      status: 'blocked',
    };
  }

  return {
    actionLabel: '打开目标端',
    detail: `当前目标端为 ${input.config.target}，没有配置阻断项。`,
    id: 'target',
    label: '目标端配置',
    status: 'ready',
  };
}

function doctorStep(input: FirstRunJourneyInput): FirstRunJourneyStep {
  if (!input.doctorReport) {
    return {
      actionLabel: '运行环境检查',
      detail: '还没有运行 doctor 检查；建议先确认依赖、源目录和目标端可访问性。',
      id: 'doctor',
      label: '环境检查',
      status: 'todo',
    };
  }

  return {
    actionLabel: '运行环境检查',
    detail: input.doctorReport.summary,
    id: 'doctor',
    label: '环境检查',
    status: input.doctorReport.status === 'error' ? 'blocked' : 'ready',
  };
}

function helperHealthStep(input: FirstRunJourneyInput): FirstRunJourneyStep {
  const ready = input.helperOnline && input.health.level !== 'risk';
  return {
    actionLabel: '刷新健康状态',
    detail: ready ? `健康度 ${input.health.score}/100：${input.health.summary}` : '刷新健康状态会只读加载 helper 历史和自动化状态。',
    id: 'helper-health',
    label: 'helper 与健康状态',
    status: ready ? 'ready' : 'todo',
  };
}

function backupProofStep(input: FirstRunJourneyInput): FirstRunJourneyStep {
  const latest = input.health.latestBackup;
  return {
    actionLabel: '查看真实备份确认',
    detail: latest?.archivePath
      ? `已有最近备份归档：${latest.archivePath}`
      : '可选：完成前可在概览页手动确认并执行一次受控真实备份。',
    id: 'backup-proof',
    label: '验证备份结果',
    status: latest?.status === 'success' ? 'ready' : 'todo',
  };
}

function restoreBoundaryStep(): FirstRunJourneyStep {
  return {
    actionLabel: '查看恢复页',
    detail: '恢复页仍只生成恢复预案，不执行真实恢复，也不会创建或覆盖文件。',
    id: 'restore-boundary',
    label: '恢复安全边界',
    status: 'ready',
  };
}

function summaryFor(level: FirstRunJourney['level']): string {
  if (level === 'ready') return '首启验证链路已完整，可以保持当前备份节奏。';
  if (level === 'blocked') return '首启验证需要先处理阻断项，再继续执行检查或备份验证。';
  return '首启验证还缺少几项只读检查或可选备份证明。';
}
