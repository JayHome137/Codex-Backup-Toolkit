import type { BackupAcceptance } from './backupAcceptance';
import type { BackupHealth } from './backupHealth';
import type { DoctorAdvice } from './doctorAdvice';
import type { FirstUsePath } from './firstUsePath';
import type { TargetSetupGuide } from './targetSetupGuide';

export type FirstLaunchGuidanceId =
  | 'open-desktop'
  | 'start-helper'
  | 'fix-target'
  | 'run-doctor'
  | 'first-backup'
  | 'review-schedule'
  | 'daily-health';

export type FirstLaunchGuidanceSection = 'overview' | 'settings' | 'targets' | 'schedule' | 'health';

export type FirstLaunchGuidance = {
  actionLabel: string;
  detail: string;
  id: FirstLaunchGuidanceId;
  level: 'ready' | 'attention' | 'blocked';
  safetyNote: string;
  section: FirstLaunchGuidanceSection;
  summary: string;
};

export type FirstLaunchGuidanceInput = {
  automationLoaded: boolean;
  backupAcceptance: BackupAcceptance;
  backupHealth: BackupHealth;
  doctorAdvice: DoctorAdvice;
  firstUsePath: FirstUsePath;
  helperOnline: boolean;
  isDesktop: boolean;
  targetSetupGuide: TargetSetupGuide;
  toolkitAvailable: boolean;
};

export function buildFirstLaunchGuidance(input: FirstLaunchGuidanceInput): FirstLaunchGuidance {
  if (!input.isDesktop) {
    return guidance({
      actionLabel: '打开设置',
      detail: '当前仍是浏览器或开发预览环境；桌面 helper 托管、本机路径打开和发布验收需要在桌面 App 中确认。',
      id: 'open-desktop',
      level: 'blocked',
      section: 'settings',
      summary: '请先使用桌面 App 打开 CodexBackup。',
    });
  }

  if (!input.helperOnline || !input.toolkitAvailable) {
    return guidance({
      actionLabel: '打开设置',
      detail: input.toolkitAvailable
        ? 'helper 离线会限制配置保存、历史读取、健康检查和真实备份按钮。'
        : '内置 toolkit 尚未就绪，需要先在设置页检查 helper 和打包资源。',
      id: 'start-helper',
      level: 'blocked',
      section: 'settings',
      summary: 'helper 离线或内置资源未就绪，请先处理桌面运行状态。',
    });
  }

  if (input.targetSetupGuide.level === 'blocked') {
    return guidance({
      actionLabel: '打开目标端',
      detail: input.targetSetupGuide.nextAction,
      id: 'fix-target',
      level: 'blocked',
      section: 'targets',
      summary: '目标端配置还有阻断项。',
    });
  }

  if (input.doctorAdvice.level !== 'ready') {
    return guidance({
      actionLabel: '运行环境检查',
      detail: input.doctorAdvice.level === 'blocked'
        ? input.doctorAdvice.summary
        : '运行一次只读目标端 doctor，确认依赖、路径和目标端可访问性。',
      id: 'run-doctor',
      level: input.doctorAdvice.level === 'blocked' ? 'blocked' : 'attention',
      section: 'overview',
      summary: input.doctorAdvice.level === 'blocked' ? '目标端 doctor 存在失败项。' : '还需要完成只读目标端检查。',
    });
  }

  if (input.backupAcceptance.level !== 'accepted' || input.firstUsePath.level !== 'ready') {
    return guidance({
      actionLabel: '查看真实备份确认',
      detail: '回到概览页，手动确认真实备份摘要，执行成功后刷新历史并验收归档、sha256 和 manifest。',
      id: 'first-backup',
      level: input.backupAcceptance.level === 'blocked' ? 'blocked' : 'attention',
      section: 'overview',
      summary: input.backupAcceptance.summary,
    });
  }

  if (!input.automationLoaded) {
    return guidance({
      actionLabel: '打开计划状态',
      detail: '读取现有计划状态、plist 路径和日志位置，确认日常备份节奏。',
      id: 'review-schedule',
      level: 'attention',
      safetyNote: '只读取自动化状态，不加载、不卸载、不重写定时任务，不执行真实恢复。',
      section: 'schedule',
      summary: '首次备份已验收，建议补齐只读计划状态。',
    });
  }

  return guidance({
    actionLabel: '打开健康页',
    detail: input.backupHealth.nextActions[0] ?? '刷新健康状态，确认最近备份、自动化和一致性状态仍正常。',
    id: 'daily-health',
    level: input.backupHealth.level === 'healthy' ? 'ready' : input.backupHealth.level === 'risk' ? 'blocked' : 'attention',
    section: 'health',
    summary: input.backupHealth.level === 'healthy' ? '首次打开链路已闭环，可以保持当前备份节奏。' : input.backupHealth.summary,
  });
}

function guidance(input: Omit<FirstLaunchGuidance, 'safetyNote'> & { safetyNote?: string }): FirstLaunchGuidance {
  return {
    safetyNote: input.safetyNote ?? '只做状态展示、页面跳转或只读刷新；不会修改已有定时备份任务，不会执行真实恢复。',
    ...input,
  };
}
