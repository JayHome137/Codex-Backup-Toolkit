import { getBackupArtifacts } from './desktopBridge';
import type { BackupHistoryEntry } from './helperApi';

export type BackupAcceptanceLevel = 'pending' | 'accepted' | 'blocked';

export type BackupAcceptanceCheck = {
  detail: string;
  id: 'history' | 'success-status' | 'exit-code' | 'archive-path' | 'checksum-path' | 'manifest-path' | 'restore-plan';
  label: string;
  status: 'ok' | 'warning' | 'error';
};

export type BackupAcceptance = {
  archivePath: string | null;
  checks: BackupAcceptanceCheck[];
  level: BackupAcceptanceLevel;
  nextActions: string[];
  summary: string;
};

export function buildBackupAcceptance(history: BackupHistoryEntry[]): BackupAcceptance {
  const entry = history.find((item) => item.action === 'backup' || item.action === 'syncLocalAuthoritative') ?? null;
  if (!entry) {
    return {
      archivePath: null,
      checks: [{ detail: '还没有 helper 真实备份历史。', id: 'history', label: '历史记录', status: 'warning' }],
      level: 'pending',
      nextActions: ['先启动 helper，执行一次手动确认的真实备份，再刷新历史。'],
      summary: '首次真实备份还没有验收。',
    };
  }

  const artifacts = getBackupArtifacts(entry.archivePaths);
  const success = entry.status === 'success';
  const exitCodeOk = entry.exitCode === 0;
  const archiveOk = !!artifacts;
  const actionLabel = entry.action === 'syncLocalAuthoritative' ? '本地为准一致性备份' : '普通备份';
  const checks: BackupAcceptanceCheck[] = [
    { detail: `最近历史来自 ${actionLabel}，目标端 ${entry.target}。`, id: 'history', label: '历史记录', status: 'ok' },
    { detail: success ? 'helper 记录为成功。' : 'helper 记录不是成功状态。', id: 'success-status', label: '执行状态', status: success ? 'ok' : 'error' },
    { detail: `退出码 ${entry.exitCode}。`, id: 'exit-code', label: '退出码', status: exitCodeOk ? 'ok' : 'error' },
    { detail: artifacts?.archivePath ?? '历史记录没有可用归档路径。', id: 'archive-path', label: '归档路径', status: archiveOk ? 'ok' : 'error' },
    { detail: artifacts?.checksumPath ?? '缺少归档路径，无法推断 sha256 路径。', id: 'checksum-path', label: 'sha256 路径', status: archiveOk ? 'ok' : 'warning' },
    { detail: artifacts?.manifestPath ?? '缺少归档路径，无法推断 manifest 路径。', id: 'manifest-path', label: 'manifest 路径', status: archiveOk ? 'ok' : 'warning' },
    { detail: archiveOk ? '可以用该归档生成 codexrestore --plan 预案。' : '需要先获得归档路径才能生成指定归档预案。', id: 'restore-plan', label: '恢复预案', status: archiveOk ? 'ok' : 'warning' },
  ];
  const accepted = success && exitCodeOk && archiveOk;

  return {
    archivePath: artifacts?.archivePath ?? null,
    checks,
    level: accepted ? 'accepted' : 'blocked',
    nextActions: accepted
      ? ['在日志页确认归档、sha256 和 manifest 路径，并生成一次恢复预案。']
      : ['查看运行输出和 helper 历史，修正失败原因后重新执行一次手动确认备份。'],
    summary: accepted ? '首次真实备份验收通过。' : '最近一次真实备份还不能验收。',
  };
}
