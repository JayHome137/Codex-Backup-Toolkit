import type { BackupAcceptance } from './backupAcceptance';
import type { DoctorAdvice } from './doctorAdvice';
import type { InstallReadiness } from './installReadiness';
import type { TargetSetupGuide } from './targetSetupGuide';

export type FirstUsePathStepId = 'install' | 'target' | 'doctor' | 'backup' | 'acceptance' | 'restore-boundary';
export type FirstUsePathStepStatus = 'ready' | 'todo' | 'blocked';

export type FirstUsePathStep = {
  actionLabel: string;
  detail: string;
  id: FirstUsePathStepId;
  label: string;
  status: FirstUsePathStepStatus;
};

export type FirstUsePath = {
  level: 'ready' | 'needs-action' | 'blocked';
  primaryAction: string;
  safetyNote: string;
  steps: FirstUsePathStep[];
  summary: string;
};

export type FirstUsePathInput = {
  backupAcceptance: BackupAcceptance;
  doctorAdvice: DoctorAdvice;
  helperOnline: boolean;
  installReadiness: InstallReadiness;
  targetSetupGuide: TargetSetupGuide;
};

export function buildFirstUsePath(input: FirstUsePathInput): FirstUsePath {
  const steps: FirstUsePathStep[] = [
    installStep(input.installReadiness),
    targetStep(input.targetSetupGuide),
    doctorStep(input.doctorAdvice),
    backupStep(input),
    acceptanceStep(input.backupAcceptance),
    restoreBoundaryStep(input.backupAcceptance),
  ];
  const level = steps.some((step) => step.status === 'blocked')
    ? 'blocked'
    : steps.every((step) => step.status === 'ready')
      ? 'ready'
      : 'needs-action';

  return {
    level,
    primaryAction: primaryAction(steps, input),
    safetyNote: '首次真实使用路径只做状态展示和页面跳转；不会执行真实恢复，不会安装、卸载或修改定时任务，真实备份仍需要手动确认。',
    steps,
    summary: summaryFor(level),
  };
}

function installStep(readiness: InstallReadiness): FirstUsePathStep {
  return {
    actionLabel: readiness.level === 'ready' ? '查看安装验收' : '完成安装验收',
    detail: readiness.level === 'ready' ? '安装落地验收已通过。' : readiness.summary,
    id: 'install',
    label: '安装落地验收',
    status: readiness.level === 'ready' ? 'ready' : 'todo',
  };
}

function targetStep(guide: TargetSetupGuide): FirstUsePathStep {
  return {
    actionLabel: '打开目标端',
    detail: guide.level === 'blocked' ? guide.nextAction : '目标端基础配置没有阻断项。',
    id: 'target',
    label: '选择并配置目标端',
    status: guide.level === 'blocked' ? 'blocked' : 'ready',
  };
}

function doctorStep(advice: DoctorAdvice): FirstUsePathStep {
  if (advice.level === 'blocked') {
    return {
      actionLabel: '打开目标端',
      detail: advice.summary,
      id: 'doctor',
      label: '运行目标端 doctor',
      status: 'blocked',
    };
  }
  if (advice.level === 'ready') {
    return {
      actionLabel: '查看检查建议',
      detail: advice.summary,
      id: 'doctor',
      label: '运行目标端 doctor',
      status: 'ready',
    };
  }
  return {
    actionLabel: '运行目标端检查',
    detail: '还需要运行一次只读目标端 doctor 检查。',
    id: 'doctor',
    label: '运行目标端 doctor',
    status: 'todo',
  };
}

function backupStep(input: FirstUsePathInput): FirstUsePathStep {
  if (input.backupAcceptance.level === 'accepted') {
    return {
      actionLabel: '查看备份结果',
      detail: '已有一次可验收的真实备份。',
      id: 'backup',
      label: '执行确认备份',
      status: 'ready',
    };
  }
  if (input.doctorAdvice.level === 'blocked' || input.targetSetupGuide.level === 'blocked') {
    return {
      actionLabel: '处理阻断项',
      detail: '需要先处理目标端或 doctor 阻断项，再执行真实备份。',
      id: 'backup',
      label: '执行确认备份',
      status: 'blocked',
    };
  }
  return {
    actionLabel: '打开概览',
    detail: input.helperOnline ? '回到概览页，手动确认后执行一次受控真实备份。' : '需要本机服务在线后，才能执行手动确认的真实备份。',
    id: 'backup',
    label: '执行确认备份',
    status: 'todo',
  };
}

function acceptanceStep(acceptance: BackupAcceptance): FirstUsePathStep {
  if (acceptance.level === 'accepted') {
    return {
      actionLabel: '查看日志',
      detail: acceptance.summary,
      id: 'acceptance',
      label: '看懂验收结果',
      status: 'ready',
    };
  }
  return {
    actionLabel: '查看日志',
    detail: acceptance.summary,
    id: 'acceptance',
    label: '看懂验收结果',
    status: acceptance.level === 'blocked' ? 'blocked' : 'todo',
  };
}

function restoreBoundaryStep(acceptance: BackupAcceptance): FirstUsePathStep {
  return {
    actionLabel: '打开恢复预案',
    detail: acceptance.archivePath ? '可以用已验收归档生成恢复预案。' : '恢复页仍只生成 codexrestore --plan，用来确认恢复边界。',
    id: 'restore-boundary',
    label: '确认恢复边界',
    status: 'ready',
  };
}

function primaryAction(steps: FirstUsePathStep[], input: FirstUsePathInput): string {
  if (steps.every((step) => step.status === 'ready')) return '保持当前备份节奏，并定期检查健康页。';
  if (input.targetSetupGuide.level === 'blocked') return `先处理目标端配置阻断项：${input.targetSetupGuide.nextAction}`;
  if (input.doctorAdvice.level === 'blocked') return '先处理目标端 doctor 检查失败项。';
  if (input.doctorAdvice.level !== 'ready') return '运行一次目标端 doctor 检查。';
  if (!input.helperOnline) return '启动 helper 后，在概览页手动确认真实备份。';
  if (input.backupAcceptance.level !== 'accepted') return '在概览页手动确认并执行第一次真实备份。';
  return steps.find((step) => step.status !== 'ready')?.detail ?? '保持当前备份节奏，并定期检查健康页。';
}

function summaryFor(level: FirstUsePath['level']): string {
  if (level === 'ready') return '首次真实使用路径已闭环，可以进入日常备份节奏。';
  if (level === 'blocked') return '首次真实使用路径有阻断项，需要先处理目标端或检查失败。';
  return '首次真实使用路径还没有走完，请按下一步继续验证。';
}
