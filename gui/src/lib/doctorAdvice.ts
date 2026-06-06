import type { BackupConfig, BackupTarget } from './config';
import { targetLabels } from './config';
import type { DoctorReport } from './doctorReport';

export type DoctorAdviceLevel = 'waiting' | 'ready' | 'needs-action' | 'blocked';

export type DoctorAdviceCard = {
  detail: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
};

export type DoctorAdvice = {
  cards: DoctorAdviceCard[];
  level: DoctorAdviceLevel;
  nextActions: string[];
  safetyNote: string;
  summary: string;
};

export function buildDoctorAdvice(report: DoctorReport | null, config: BackupConfig): DoctorAdvice {
  if (!report) {
    return {
      cards: [{ detail: '运行目标端检查后，这里会把失败和警告整理成下一步动作。', label: '等待检查', status: 'warning' }],
      level: 'waiting',
      nextActions: ['先在目标端页或概览页运行一次只读目标端检查。'],
      safetyNote: safetyNote(),
      summary: '还没有目标端检查建议。',
    };
  }

  const issueCards = report.checks.flatMap((check) => check.status === 'ok' ? [] : adviceForDetail(check.detail, config.target));
  const cards = uniqueCards(issueCards.length > 0 ? issueCards : [{ detail: 'doctor 没有发现阻断项；可以进入首次真实备份验收。', label: '检查通过', status: 'ok' as const }]);
  const hasErrors = report.checks.some((check) => check.status === 'error');
  const hasWarnings = report.checks.some((check) => check.status === 'warning');

  return {
    cards,
    level: hasErrors ? 'blocked' : hasWarnings ? 'needs-action' : 'ready',
    nextActions: nextActionsFor(report, config.target),
    safetyNote: safetyNote(),
    summary: `${targetLabels[config.target]} 检查建议：${report.summary}`,
  };
}

function adviceForDetail(detail: string, target: BackupTarget): DoctorAdviceCard[] {
  const text = detail.toLowerCase();
  const cards: DoctorAdviceCard[] = [];

  if (target === 'webdav') {
    if (/401|403|auth|unauthori[sz]ed|credential|password|密码|凭据|认证/.test(text)) {
      cards.push({ detail: '优先确认 WebDAV 用户名、应用专用密码和服务端权限；密码建议继续走 Keychain。', label: 'WebDAV 凭据', status: 'error' });
    }
    if (/url|endpoint|connect|timeout|unreachable|地址|不可访问/.test(text)) {
      cards.push({ detail: '检查 WebDAV URL 是否包含正确路径，并用浏览器或 curl 做只读连通性确认。', label: 'WebDAV 地址', status: 'error' });
    }
    if (/quota|space|capacity|容量|空间/.test(text)) {
      cards.push({ detail: '确认云盘剩余容量和保留份数，必要时降低保留数量或开启远端保留策略。', label: '容量检查', status: 'warning' });
    }
  }

  if (target === 'smb') {
    if (/host|connect|timeout|unreachable|network|nas|主机|网络/.test(text)) {
      cards.push({ detail: '确认 NAS 主机名/IP、网络连接和 SMB 服务状态；先让 doctor 能连上主机。', label: 'NAS 连通性', status: 'error' });
    }
    if (/share|not found|共享|挂载/.test(text)) {
      cards.push({ detail: '核对 SMB share 名称是否和 NAS 上公开的共享名一致。', label: '共享名称', status: 'error' });
    }
    if (/auth|password|credential|permission|权限|密码|凭据/.test(text)) {
      cards.push({ detail: '确认 SMB 用户权限和密码；密码不要写入公开配置，继续通过 Keychain 或运行时环境变量提供。', label: 'SMB 凭据', status: 'error' });
    }
  }

  if (target === 'local') {
    if (/directory|dir|path|目录|路径/.test(text)) {
      cards.push({ detail: '确认本地备份目录存在且当前用户可写。', label: '本地目录', status: 'error' });
    }
    if (/space|capacity|容量|空间/.test(text)) {
      cards.push({ detail: '确认本地磁盘空间和保留份数，避免首次备份后立即占满磁盘。', label: '本地容量', status: 'warning' });
    }
  }

  if (target === 'rclone') {
    if (/remote|not found|config|找不到/.test(text)) {
      cards.push({ detail: '确认 rclone remote 名称和路径；先用 rclone lsd 做只读检查。', label: 'rclone remote', status: 'error' });
    }
    if (/auth|token|expired|credential|认证|过期/.test(text)) {
      cards.push({ detail: 'rclone 授权可能过期；重新完成 rclone config reconnect 后再运行 doctor。', label: 'rclone 授权', status: 'error' });
    }
    if (/quota|space|capacity|容量|空间/.test(text)) {
      cards.push({ detail: '确认远端容量和保留策略，必要时减少保留份数。', label: '远端容量', status: 'warning' });
    }
  }

  if (cards.length === 0) {
    cards.push({ detail: `检查项需要人工确认：${detail}`, label: '人工复核', status: /fail|error|失败/.test(text) ? 'error' : 'warning' });
  }

  return cards;
}

function nextActionsFor(report: DoctorReport, target: BackupTarget): string[] {
  if (report.status === 'success') return ['回到概览页，按真实备份确认流程执行第一次受控备份。'];
  if (target === 'webdav') return ['重新确认 WebDAV 地址、用户名和应用专用密码，再运行目标端检查。'];
  if (target === 'smb') return ['先确认 NAS 网络、共享名和账号权限，再运行目标端检查。'];
  if (target === 'rclone') return ['先确认 rclone remote 能只读列目录，再运行目标端检查。'];
  return ['修正本地目录或容量问题，再运行目标端检查。'];
}

function uniqueCards(cards: DoctorAdviceCard[]): DoctorAdviceCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.label}:${card.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safetyNote(): string {
  return '这里只解释 doctor 结果，不执行真实恢复，不安装、卸载、加载或修改定时任务。';
}
