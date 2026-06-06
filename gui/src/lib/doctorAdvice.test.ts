import { describe, expect, it } from 'vitest';
import { parseDoctorOutput } from './doctorReport';
import { buildDoctorAdvice } from './doctorAdvice';
import { defaultConfig } from './config';

describe('buildDoctorAdvice', () => {
  it('turns WebDAV auth and quota failures into target-specific read-only advice', () => {
    const report = parseDoctorOutput([
      'Target: webdav',
      'ok: zsh available',
      'fail: WebDAV 401 unauthorized',
      'warn: remote quota may be low',
    ].join('\n'));

    const advice = buildDoctorAdvice(report, { ...defaultConfig, target: 'webdav' });

    expect(advice.summary).toContain('WebDAV');
    expect(advice.cards.map((card) => card.label)).toContain('WebDAV 凭据');
    expect(advice.cards.map((card) => card.label)).toContain('容量检查');
    expect(advice.nextActions).toContain('重新确认 WebDAV 地址、用户名和应用专用密码，再运行目标端检查。');
    expect(advice.cards.map((card) => card.detail).join(' ')).not.toMatch(/安装|卸载|真实恢复/);
  });

  it('explains SMB connectivity and share failures without taking over automation', () => {
    const report = parseDoctorOutput([
      'Target: smb',
      'fail: smb host unreachable nas.local',
      'fail: share CodexBackup not found',
    ].join('\n'));

    const advice = buildDoctorAdvice(report, { ...defaultConfig, target: 'smb' });

    expect(advice.level).toBe('blocked');
    expect(advice.cards.map((card) => card.label)).toEqual(expect.arrayContaining(['NAS 连通性', '共享名称']));
    expect(advice.safetyNote).toContain('只解释 doctor 结果');
    expect(advice.nextActions.join(' ')).not.toMatch(/launchctl|执行真实恢复|卸载/);
  });

  it('keeps successful local doctor output focused on first backup verification', () => {
    const report = parseDoctorOutput('Target: local\nok: zsh available\nok: target directory writable');

    const advice = buildDoctorAdvice(report, { ...defaultConfig, target: 'local' });

    expect(advice.level).toBe('ready');
    expect(advice.cards).toHaveLength(1);
    expect(advice.cards[0]).toMatchObject({ label: '检查通过', status: 'ok' });
    expect(advice.nextActions).toContain('回到概览页，按真实备份确认流程执行第一次受控备份。');
  });

  it('returns a waiting state before doctor has run', () => {
    const advice = buildDoctorAdvice(null, defaultConfig);

    expect(advice.level).toBe('waiting');
    expect(advice.cards[0].detail).toContain('运行目标端检查');
  });
});
