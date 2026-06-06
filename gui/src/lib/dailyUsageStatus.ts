import type { BackupHealth } from './backupHealth';
import type { FirstUsePath } from './firstUsePath';

export type DailyUsageLevel = 'ready' | 'attention' | 'blocked';
export type DailyUsageCard = {
  detail: string;
  id: 'first-use' | 'latest-backup' | 'health' | 'automation';
  label: string;
  status: 'ok' | 'warning' | 'error';
};

export type DailyUsageStatus = {
  cards: DailyUsageCard[];
  level: DailyUsageLevel;
  primaryAction: string;
  safetyNote: string;
  summary: string;
};

export type DailyUsageStatusInput = {
  firstUsePath: FirstUsePath;
  health: BackupHealth;
};

export function buildDailyUsageStatus(input: DailyUsageStatusInput): DailyUsageStatus {
  const cards = [
    firstUseCard(input.firstUsePath),
    latestBackupCard(input.health),
    healthCard(input.health),
    automationCard(input.health),
  ];
  const level = cards.some((card) => card.status === 'error')
    ? 'blocked'
    : cards.some((card) => card.status === 'warning')
      ? 'attention'
      : 'ready';

  return {
    cards,
    level,
    primaryAction: primaryAction(level, input),
    safetyNote: '日常使用状态只读取现有健康、历史和路径结果；不会执行真实恢复，不会安装、卸载或修改定时任务，真实备份仍需要手动确认。',
    summary: summaryFor(level),
  };
}

function firstUseCard(path: FirstUsePath): DailyUsageCard {
  return {
    detail: path.summary,
    id: 'first-use',
    label: '首次使用',
    status: path.level === 'ready' ? 'ok' : path.level === 'blocked' ? 'error' : 'warning',
  };
}

function latestBackupCard(health: BackupHealth): DailyUsageCard {
  const latest = health.latestBackup;
  if (!latest) {
    return { detail: '还没有可用于日常判断的备份历史。', id: 'latest-backup', label: '最近备份', status: 'warning' };
  }
  if (latest.status !== 'success') {
    return { detail: `最近备份失败，退出码 ${latest.exitCode}。`, id: 'latest-backup', label: '最近备份', status: 'error' };
  }
  if (latest.ageHours !== null && latest.ageHours > 72) {
    return { detail: `最近备份成功，但已是约 ${latest.ageHours} 小时前。`, id: 'latest-backup', label: '最近备份', status: 'warning' };
  }
  return {
    detail: latest.ageHours === null ? '最近备份成功。' : `最近备份成功，约 ${latest.ageHours} 小时前完成。`,
    id: 'latest-backup',
    label: '最近备份',
    status: 'ok',
  };
}

function healthCard(health: BackupHealth): DailyUsageCard {
  return {
    detail: `${health.score}/100：${health.summary}`,
    id: 'health',
    label: '健康度',
    status: health.level === 'healthy' ? 'ok' : health.level === 'risk' ? 'error' : 'warning',
  };
}

function automationCard(health: BackupHealth): DailyUsageCard {
  const automation = health.items.find((item) => item.id === 'automation');
  return {
    detail: automation?.detail ?? '尚未读取自动化状态。',
    id: 'automation',
    label: '自动化',
    status: automation?.status === 'error' ? 'error' : automation?.status === 'ok' ? 'ok' : 'warning',
  };
}

function primaryAction(level: DailyUsageLevel, input: DailyUsageStatusInput): string {
  if (input.firstUsePath.level !== 'ready') return input.firstUsePath.level === 'blocked' ? input.firstUsePath.primaryAction : '先完成首次真实使用路径。';
  if (input.health.level === 'risk') return input.health.nextActions[0] ?? '先处理备份健康风险。';
  if (input.health.latestBackup?.status !== 'success') return '查看运行输出并重新执行一次手动确认备份。';
  if (input.health.latestBackup?.ageHours !== null && input.health.latestBackup?.ageHours !== undefined && input.health.latestBackup.ageHours > 72) {
    return '刷新历史；如确认过期，再执行一次手动确认备份。';
  }
  if (level === 'attention') return input.health.nextActions[0] ?? '刷新健康状态。';
  return '保持当前备份节奏，并定期刷新健康状态。';
}

function summaryFor(level: DailyUsageLevel): string {
  if (level === 'ready') return '日常备份状态正常，可以保持当前节奏。';
  if (level === 'blocked') return '日常备份存在阻断风险，需要先处理。';
  return '日常备份需要关注，有建议补齐的状态。';
}
