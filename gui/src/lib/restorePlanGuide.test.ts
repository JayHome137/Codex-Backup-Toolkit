import { describe, expect, it } from 'vitest';
import { buildLatestRestorePlanAction, buildRestorePlanAction } from './actions';
import { defaultConfig } from './config';
import { buildRestorePlanGuide } from './restorePlanGuide';

describe('buildRestorePlanGuide', () => {
  it('explains latest restore planning for the selected remote target', () => {
    const action = buildLatestRestorePlanAction({ ...defaultConfig, target: 'rclone', rcloneRemote: 'gdrive:CodexBackup' });
    const guide = buildRestorePlanGuide(action);

    expect(guide.title).toBe('最新备份恢复预案');
    expect(guide.willDo).toContain('从当前 rclone 目标端选择最新备份并生成预案。');
    expect(guide.needs).toContain('确认当前目标端配置仍指向要检查的备份位置。');
    expect(guide.willNotDo.join(' ')).toContain('不会解压归档');
    expect(guide.riskNotes.join(' ')).toContain('只读预案');
  });

  it('calls out age identity requirements for encrypted archive plans', () => {
    const action = buildRestorePlanAction('/tmp/CodexBackups/codex-backup.tar.gz.age', true);
    const guide = buildRestorePlanGuide(action);

    expect(guide.title).toBe('指定归档恢复预案');
    expect(guide.needs).toContain('准备 age identity 文件，仅用于生成可读的恢复预案。');
    expect(guide.riskNotes.join(' ')).toContain('没有 identity 时');
    expect(guide.willNotDo.join(' ')).not.toMatch(/执行真实恢复|覆盖文件/);
  });
});
