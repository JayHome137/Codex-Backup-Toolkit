export type PostInstallRuntime = {
  appVersion: string;
  helperOnline: boolean;
  isDesktop: boolean;
  toolkitAvailable: boolean;
};

export type PostInstallItem = {
  detail: string;
  id: 'download' | 'checksum' | 'unsigned' | 'first-open' | 'runtime' | 'safety';
  label: string;
  status: 'ok' | 'warning';
};

export type PostInstallExperience = {
  assetName: string;
  checksumAssetName: string;
  checksumCommand: string;
  items: PostInstallItem[];
  releaseUrl: string;
  summary: string;
};

export function buildPostInstallExperience(runtime: PostInstallRuntime): PostInstallExperience {
  const assetName = `CodexBackup_${runtime.appVersion}_aarch64.dmg`;
  const checksumAssetName = `${assetName}.sha256`;
  const releaseUrl = `https://github.com/JayHome137/Codex-Backup-toolkit/releases/tag/v${runtime.appVersion}`;
  const runtimeReady = runtime.isDesktop && runtime.toolkitAvailable && runtime.helperOnline;

  return {
    assetName,
    checksumAssetName,
    checksumCommand: `shasum -a 256 -c ${checksumAssetName}`,
    items: [
      {
        detail: `从 v${runtime.appVersion} Release 下载 ${assetName} 和 ${checksumAssetName}。`,
        id: 'download',
        label: '下载桌面产物',
        status: 'ok',
      },
      {
        detail: `在同一目录运行：shasum -a 256 -c ${checksumAssetName}`,
        id: 'checksum',
        label: '校验 DMG',
        status: 'ok',
      },
      {
        detail: '当前 DMG 未做 Apple Developer 签名和公证，首次打开可能需要在 macOS 安全设置中允许。',
        id: 'unsigned',
        label: '未签名限制',
        status: 'warning',
      },
      {
        detail: '首次打开后建议进入引导页，依次完成桌面环境、目标端、doctor、helper 健康和备份证明。',
        id: 'first-open',
        label: '首次打开流程',
        status: 'ok',
      },
      {
        detail: runtimeReady ? '桌面环境、toolkit 和 helper 当前都在线。' : '如果当前不是桌面环境或 helper 离线，真实备份按钮会按离线规则禁用。',
        id: 'runtime',
        label: '运行时状态',
        status: runtimeReady ? 'ok' : 'warning',
      },
      {
        detail: '本页只提供版本、下载和校验说明，不执行真实恢复，不安装或卸载定时任务。',
        id: 'safety',
        label: '安全边界',
        status: 'ok',
      },
    ],
    releaseUrl,
    summary: runtimeReady ? '桌面 App 已具备下载后验证和首次运行闭环。' : '下载和校验说明已就绪，首次运行后请完成引导页检查。',
  };
}
