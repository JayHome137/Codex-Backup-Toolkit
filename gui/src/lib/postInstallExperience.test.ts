import { describe, expect, it } from 'vitest';
import { buildPostInstallExperience } from './postInstallExperience';

describe('post install experience', () => {
  it('builds release asset names and checksum command from the current app version', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.18.0',
      helperOnline: false,
      isDesktop: false,
      toolkitAvailable: false,
    });

    expect(experience.assetName).toBe('CodexBackup_0.18.0_aarch64.dmg');
    expect(experience.checksumAssetName).toBe('CodexBackup_0.18.0_aarch64.dmg.sha256');
    expect(experience.checksumCommand).toBe('shasum -a 256 -c CodexBackup_0.18.0_aarch64.dmg.sha256');
    expect(experience.releaseUrl).toBe('https://github.com/JayHome137/Codex-Backup-toolkit/releases/tag/v0.18.0');
    expect(experience.checksumSuccessText).toContain('OK');
    expect(experience.checksumFailureText).toContain('重新下载');
  });

  it('keeps unsigned and runtime warnings explicit while preserving safety boundaries', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.18.0',
      helperOnline: false,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(experience.summary).toContain('下载和校验说明已就绪');
    expect(experience.items.find((item) => item.id === 'unsigned')).toMatchObject({ status: 'warning' });
    expect(experience.items.find((item) => item.id === 'runtime')).toMatchObject({ status: 'warning' });
    expect(experience.items.find((item) => item.id === 'safety')?.detail).toContain('不执行真实恢复');
    expect(experience.items.find((item) => item.id === 'safety')?.detail).toContain('不安装或卸载定时任务');
  });

  it('explains macOS first-open recovery and post-install smoke checks without adding automation mutation', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.18.0',
      helperOnline: false,
      isDesktop: false,
      toolkitAvailable: false,
    });

    expect(experience.macosOpenSteps).toEqual([
      '把 CodexBackup.app 拖到 Applications 后，优先用右键或 Control 点击选择打开。',
      '如果系统拦截未签名 App，进入系统设置 > 隐私与安全，允许打开 CodexBackup。',
      '允许后重新打开 App，再进入引导页完成只读检查和手动备份确认。',
    ]);
    expect(experience.smokeSteps).toContain('打开引导页并运行环境检查。');
    expect(experience.smokeSteps).toContain('打开设置页确认 helper、toolkit、配置路径、历史路径和日志路径。');
    expect(experience.smokeSteps.join(' ')).not.toMatch(/安装定时任务|卸载定时任务|执行真实恢复/);
  });

  it('marks runtime ready only when desktop, toolkit, and helper are all ready', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.18.0',
      helperOnline: true,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(experience.summary).toContain('首次运行闭环');
    expect(experience.items.find((item) => item.id === 'runtime')).toMatchObject({ status: 'ok' });
  });

  it('builds a release trust checklist without claiming signing or auto-update support', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.25.0',
      helperOnline: true,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(experience.trustChecklist.map((item) => item.id)).toEqual([
      'release-assets',
      'checksum-published',
      'manual-smoke',
      'known-limits',
    ]);
    expect(experience.trustChecklist.find((item) => item.id === 'known-limits')?.detail).toContain('未加入 Apple 签名、公证和自动更新');
    expect(experience.trustChecklist.map((item) => item.detail).join(' ')).not.toMatch(/执行真实恢复|安装定时任务|卸载定时任务/);
  });
});
