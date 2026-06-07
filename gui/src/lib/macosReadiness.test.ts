import { describe, expect, it } from 'vitest';
import { buildMacosReadiness } from './macosReadiness';

describe('macOS readiness', () => {
  it('marks the macOS desktop path ready when runtime, paths, backup proof, and release checks are present', () => {
    const readiness = buildMacosReadiness({
      automationLoaded: true,
      backupAccepted: true,
      configPath: '/Users/test/Library/Application Support/CodexBackupToolkit/config.json',
      helperOnline: true,
      historyPath: '/Users/test/Library/Application Support/CodexBackupToolkit/history.json',
      isDesktop: true,
      logDir: '/Users/test/Library/Logs/CodexBackup',
      releaseSmokeAvailable: true,
      toolkitAvailable: true,
      version: '0.33.0',
    });

    expect(readiness.level).toBe('ready');
    expect(readiness.summary).toBe('macOS 桌面端已经具备日常使用和发布验收基础。');
    expect(readiness.score).toBe(6);
    expect(readiness.items.map((item) => item.id)).toEqual([
      'desktop-runtime',
      'helper-runtime',
      'toolkit-resources',
      'product-paths',
      'first-backup-proof',
      'release-smoke',
    ]);
    expect(readiness.nextActions).toEqual(['保持当前 macOS 验证记录，继续按发布清单验收。']);
    expect(readiness.safetyNote).toContain('不会安装、卸载或修改 launchd');
  });

  it('surfaces blockers and next actions without suggesting automation mutation or real restore', () => {
    const readiness = buildMacosReadiness({
      automationLoaded: false,
      backupAccepted: false,
      configPath: '',
      helperOnline: false,
      historyPath: '',
      isDesktop: false,
      logDir: '',
      releaseSmokeAvailable: false,
      toolkitAvailable: false,
      version: '0.33.0',
    });

    expect(readiness.level).toBe('blocked');
    expect(readiness.score).toBe(0);
    expect(readiness.nextActions).toContain('用桌面 App 打开，而不是只停留在浏览器开发模式。');
    expect(readiness.nextActions).toContain('刷新桌面诊断，确认 helper 和内置 toolkit。');
    expect(readiness.nextActions).toContain('执行一次手动确认的真实备份并刷新历史。');
    expect(readiness.nextActions.join('\n')).not.toMatch(/安装定时任务|卸载定时任务|执行真实恢复/);
  });
});
