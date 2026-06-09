import { describe, expect, it } from 'vitest';
import { defaultConfig } from './config';
import { buildTargetSetupGuide } from './targetSetupGuide';

describe('target setup guide', () => {
  it('builds a local target guide with doctor and config steps', () => {
    const guide = buildTargetSetupGuide(defaultConfig, []);

    expect(guide.title).toBe('本地目录设置向导');
    expect(guide.steps.map((step) => step.label)).toEqual([
      '确认输出目录',
      '运行目标端检查',
      '执行手动备份确认',
    ]);
    expect(guide.validationCommand).toContain('./scripts/codexbackup.sh --doctor --target local');
    expect(guide.safetyNotes.join(' ')).toContain('不会安装、卸载或修改定时任务');
  });

  it('warns cloud targets to configure credentials and optional encryption before real backup', () => {
    const guide = buildTargetSetupGuide({ ...defaultConfig, target: 'webdav', encrypt: false }, []);

    expect(guide.title).toBe('WebDAV 设置向导');
    expect(guide.steps.map((step) => step.label)).toContain('保存或临时提供密码');
    expect(guide.steps.map((step) => step.label)).toContain('手动创建备份文件夹');
    expect(guide.steps.map((step) => step.detail).join(' ')).toContain('codex-backups');
    expect(guide.steps.map((step) => step.label)).toContain('评估加密');
    expect(guide.commonFailures).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '401 或 403' }),
      expect.objectContaining({ label: '备份文件夹不存在' }),
      expect.objectContaining({ label: '地址不可访问' }),
    ]));
  });

  it('surfaces blocking config checks as the next action', () => {
    const guide = buildTargetSetupGuide(
      { ...defaultConfig, target: 'rclone', rcloneRemote: '' },
      [{ id: 'target', label: '目标端', status: 'error', detail: '缺少 CODEX_BACKUP_RCLONE_REMOTE。' }],
    );

    expect(guide.level).toBe('blocked');
    expect(guide.nextAction).toContain('缺少 CODEX_BACKUP_RCLONE_REMOTE');
    expect(guide.steps[0]).toMatchObject({ status: 'blocked' });
  });

  it('keeps rclone guidance read-only and points users to rclone config', () => {
    const guide = buildTargetSetupGuide({ ...defaultConfig, target: 'rclone' }, []);

    expect(guide.title).toBe('rclone 设置向导');
    expect(guide.steps.map((step) => step.detail).join(' ')).toContain('rclone config');
    expect(guide.safetyNotes.join(' ')).not.toMatch(/执行真实恢复|安装定时任务|卸载定时任务/);
  });
});
