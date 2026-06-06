import type { CommandStatus } from './commands';

export type DoctorCheckStatus = 'ok' | 'warning' | 'error';

export type DoctorCheck = {
  detail: string;
  label: string;
  status: DoctorCheckStatus;
};

export type DoctorReport = {
  checks: DoctorCheck[];
  status: CommandStatus;
  summary: string;
  target: string;
};

export function parseDoctorOutput(output: string): DoctorReport {
  const checks: DoctorCheck[] = [];
  let target = '未知';

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const targetMatch = line.match(/^(?:Target|目标端)[：:]\s*(.+)$/i);
    if (targetMatch) {
      target = targetMatch[1].trim();
      continue;
    }

    const checkMatch = line.match(/^(ok|warn|warning|fail|error)[：:]\s*(.+)$/i);
    if (!checkMatch) continue;

    const token = checkMatch[1].toLowerCase();
    checks.push({
      detail: checkMatch[2].trim(),
      label: statusLabel(token),
      status: token === 'ok' ? 'ok' : token === 'warn' || token === 'warning' ? 'warning' : 'error',
    });
  }

  const errorCount = checks.filter((check) => check.status === 'error').length;
  const warningCount = checks.filter((check) => check.status === 'warning').length;
  const status: CommandStatus = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success';

  return {
    checks,
    status,
    summary: checks.length === 0
      ? '还没有可解析的目标端检查结果。'
      : `${checks.length} 项检查，${errorCount} 个失败，${warningCount} 个警告。`,
    target,
  };
}

function statusLabel(token: string): string {
  if (token === 'ok') return '通过';
  if (token === 'warn' || token === 'warning') return '警告';
  return '失败';
}
