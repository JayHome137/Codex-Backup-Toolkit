import { describe, expect, it } from 'vitest';
import { buildPostInstallExperience } from './postInstallExperience';

describe('post install experience', () => {
  it('builds release asset names and checksum command from the current app version', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.17.0',
      helperOnline: false,
      isDesktop: false,
      toolkitAvailable: false,
    });

    expect(experience.assetName).toBe('CodexBackup_0.17.0_aarch64.dmg');
    expect(experience.checksumAssetName).toBe('CodexBackup_0.17.0_aarch64.dmg.sha256');
    expect(experience.checksumCommand).toBe('shasum -a 256 -c CodexBackup_0.17.0_aarch64.dmg.sha256');
    expect(experience.releaseUrl).toBe('https://github.com/JayHome137/Codex-Backup-toolkit/releases/tag/v0.17.0');
  });

  it('keeps unsigned and runtime warnings explicit while preserving safety boundaries', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.17.0',
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

  it('marks runtime ready only when desktop, toolkit, and helper are all ready', () => {
    const experience = buildPostInstallExperience({
      appVersion: '0.17.0',
      helperOnline: true,
      isDesktop: true,
      toolkitAvailable: true,
    });

    expect(experience.summary).toContain('首次运行闭环');
    expect(experience.items.find((item) => item.id === 'runtime')).toMatchObject({ status: 'ok' });
  });
});
