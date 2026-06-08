import type { AutomationStatus, BackupHistoryEntry } from './helperApi';
import type { BackupConfig } from './config';

export type BackupHealthInput = {
  automationStatus: AutomationStatus | null;
  config: BackupConfig;
  configErrorCount: number;
  helperOnline: boolean;
  history: BackupHistoryEntry[];
  now: Date;
};

export type BackupHealthItem = {
  detail: string;
  id: 'helper' | 'config' | 'history' | 'automation' | 'sync';
  label: string;
  status: 'ok' | 'warning' | 'error';
};

export type BackupHealth = {
  items: BackupHealthItem[];
  latestBackup: BackupHealthLatestBackup | null;
  level: 'healthy' | 'warning' | 'risk';
  nextActions: string[];
  score: number;
  summary: string;
};

export type BackupHealthLatestBackup = {
  action: BackupHistoryEntry['action'];
  actionLabel: string;
  ageHours: number | null;
  archivePath: string | null;
  exitCode: number;
  finishedAt: string;
  status: BackupHistoryEntry['status'];
  target: string;
};

export function buildBackupHealth(input: BackupHealthInput): BackupHealth {
  const latestEntry = latestBackupEntry(input.history);
  const items: BackupHealthItem[] = [
    helperItem(input.helperOnline),
    configItem(input.configErrorCount),
    historyItem(latestEntry, input.now),
    automationItem(input.automationStatus),
    syncItem(input.config),
  ];
  const score = Math.max(0, 100 - items.reduce((total, item) => total + penalty(item.status), 0));
  const level = items.some((item) => item.status === 'error') ? 'risk' : score >= 80 ? 'healthy' : 'warning';
  const nextActions = buildNextActions(items);

  return {
    items,
    latestBackup: latestEntry ? buildLatestBackup(latestEntry, input.now) : null,
    level,
    nextActions,
    score,
    summary: buildSummary(items, level),
  };
}

function helperItem(helperOnline: boolean): BackupHealthItem {
  return helperOnline
    ? { id: 'helper', label: '本机服务', status: 'ok', detail: '本机服务已连接，可以读取配置、历史和执行受控操作。' }
    : { id: 'helper', label: '本机服务', status: 'warning', detail: '本机服务尚未连接，真实备份、历史刷新和 Keychain 操作会受限。' };
}

function configItem(configErrorCount: number): BackupHealthItem {
  if (configErrorCount > 0) {
    return { id: 'config', label: '配置', status: 'error', detail: `${configErrorCount} 个配置阻断项需要修正。` };
  }
  return { id: 'config', label: '配置', status: 'ok', detail: '目标端、加密和保留策略没有阻断项。' };
}

function historyItem(latest: BackupHistoryEntry | null, now: Date): BackupHealthItem {
  if (!latest) {
    return { id: 'history', label: '最近备份', status: 'warning', detail: '还没有备份记录。' };
  }
  if (latest.status !== 'success') {
    return { id: 'history', label: '最近备份', status: 'error', detail: `最近一次备份失败，退出码 ${latest.exitCode}。` };
  }

  const ageHours = backupAgeHours(latest.finishedAt, now);
  const suffix = latest.action === 'syncLocalAuthoritative' ? '一致性备份成功' : '最近备份成功';
  return {
    id: 'history',
    label: '最近备份',
    status: 'ok',
    detail: ageHours === null ? suffix : `${suffix}，约 ${ageHours} 小时前完成。`,
  };
}

function latestBackupEntry(history: BackupHistoryEntry[]): BackupHistoryEntry | null {
  return history.find((entry) => entry.action === 'backup' || entry.action === 'syncLocalAuthoritative') ?? null;
}

function buildLatestBackup(entry: BackupHistoryEntry, now: Date): BackupHealthLatestBackup {
  return {
    action: entry.action,
    actionLabel: entry.action === 'syncLocalAuthoritative' ? '本地为准一致性备份' : '普通备份',
    ageHours: backupAgeHours(entry.finishedAt, now),
    archivePath: entry.archivePaths[0] ?? null,
    exitCode: entry.exitCode,
    finishedAt: entry.finishedAt,
    status: entry.status,
    target: entry.target,
  };
}

function backupAgeHours(finishedAt: string, now: Date): number | null {
  const finished = Date.parse(finishedAt);
  return Number.isFinite(finished) ? Math.max(0, Math.round((now.getTime() - finished) / 36_000) / 100) : null;
}

function automationItem(status: AutomationStatus | null): BackupHealthItem {
  if (!status) {
    return { id: 'automation', label: '自动化', status: 'warning', detail: '尚未读取自动化状态。' };
  }
  if (!status.plistExists || !status.installDirExists || !status.scheduledScriptExists) {
    return { id: 'automation', label: '自动化', status: 'warning', detail: '自动化文件不完整，请按需重新校验或安装。' };
  }
  return {
    id: 'automation',
    label: '自动化',
    status: status.loaded ? 'ok' : 'warning',
    detail: status.loaded ? `定时任务已加载：${status.schedule}` : '定时任务文件存在，但当前未加载。',
  };
}

function syncItem(config: BackupConfig): BackupHealthItem {
  if (config.syncCheckIntervalHours <= 0 || config.syncMinBackupIntervalHours <= 0) {
    return { id: 'sync', label: '一致性', status: 'error', detail: '一致性检查频率配置无效。' };
  }
  if (config.target === 'webdav' || config.target === 'rclone') {
    return { id: 'sync', label: '一致性', status: 'warning', detail: '当前目标端暂不支持本地为准一致性检查。' };
  }
  if (!config.syncEnabled) {
    return { id: 'sync', label: '一致性', status: 'ok', detail: '一致性检查默认关闭；普通备份可继续使用。' };
  }
  return {
    id: 'sync',
    label: '一致性',
    status: 'ok',
    detail: `已启用，每 ${config.syncCheckIntervalHours} 小时检查，最短 ${config.syncMinBackupIntervalHours} 小时生成一次新备份。`,
  };
}

function penalty(status: BackupHealthItem['status']): number {
  if (status === 'error') return 35;
  if (status === 'warning') return 15;
  return 0;
}

function buildSummary(items: BackupHealthItem[], level: BackupHealth['level']): string {
  const history = items.find((item) => item.id === 'history');
  if (level === 'risk') return '备份链路存在需要先处理的风险。';
  if (level === 'warning') return '备份链路基本可用，但还有建议补齐的状态。';
  return history?.detail ?? '备份链路健康。';
}

function buildNextActions(items: BackupHealthItem[]): string[] {
  const actions: string[] = [];
  if (items.find((item) => item.id === 'helper')?.status !== 'ok') actions.push('检查 helper 连接');
  if (items.find((item) => item.id === 'config')?.status === 'error') actions.push('修正目标端或加密配置阻断项');
  if (items.find((item) => item.id === 'history')?.status !== 'ok') actions.push('执行一次真实备份或刷新历史');
  if (items.find((item) => item.id === 'automation')?.status !== 'ok') actions.push('刷新自动化状态或运行隔离计划校验');
  if (items.find((item) => item.id === 'sync')?.status === 'error') actions.push('修正一致性检查频率');
  return actions.length > 0 ? actions : ['保持当前备份节奏'];
}
