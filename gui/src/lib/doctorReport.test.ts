import { describe, expect, it } from 'vitest';
import { parseDoctorOutput } from './doctorReport';

describe('parseDoctorOutput', () => {
  it('parses target and status lines from doctor output', () => {
    const report = parseDoctorOutput([
      'codexbackup doctor',
      'Target: webdav',
      'ok: zsh available',
      'warn: ~/.codex missing',
      'fail: CODEX_BACKUP_WEBDAV_URL missing',
    ].join('\n'));

    expect(report.target).toBe('webdav');
    expect(report.status).toBe('error');
    expect(report.summary).toBe('3 项检查，1 个失败，1 个警告。');
    expect(report.checks).toEqual([
      { detail: 'zsh available', label: '通过', status: 'ok' },
      { detail: '~/.codex missing', label: '警告', status: 'warning' },
      { detail: 'CODEX_BACKUP_WEBDAV_URL missing', label: '失败', status: 'error' },
    ]);
  });

  it('supports Chinese target labels from the mock runner', () => {
    const report = parseDoctorOutput('目标端：local\nok: zsh 可用\nok: tar 可用');

    expect(report.target).toBe('local');
    expect(report.status).toBe('success');
    expect(report.summary).toBe('2 项检查，0 个失败，0 个警告。');
  });
});
