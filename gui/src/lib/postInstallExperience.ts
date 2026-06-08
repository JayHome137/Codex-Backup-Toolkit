export type PostInstallRuntime = {
  appVersion: string;
  helperOnline: boolean;
  isDesktop: boolean;
  toolkitAvailable: boolean;
};

export type PostInstallItem = {
  detail: string;
  id: 'download' | 'checksum' | 'unsigned' | 'first-open' | 'runtime' | 'safety' | 'release-assets' | 'checksum-published' | 'manual-smoke' | 'known-limits';
  label: string;
  status: 'ok' | 'warning';
};

export type PostInstallExperience = {
  assetName: string;
  checksumAssetName: string;
  checksumCommand: string;
  checksumFailureText: string;
  checksumSuccessText: string;
  items: PostInstallItem[];
  trustChecklist: PostInstallItem[];
  macosOpenSteps: string[];
  releaseUrl: string;
  smokeSteps: string[];
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
    checksumFailureText: '如果校验输出不是 OK，请删除 DMG 和 sha256 文件后从 GitHub Release 重新下载。',
    checksumSuccessText: `${assetName}: OK 表示下载文件和发布校验一致。`,
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
        detail: '首次打开后建议进入引导页，依次完成桌面环境、目标端、doctor、本机服务和备份证明。',
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
    macosOpenSteps: [
      '把 CodexBackup.app 拖到 Applications 后，优先用右键或 Control 点击选择打开。',
      '如果系统拦截未签名 App，进入系统设置 > 隐私与安全，允许打开 CodexBackup。',
      '允许后重新打开 App，再进入引导页完成只读检查和手动备份确认。',
    ],
    releaseUrl,
    smokeSteps: [
      '打开引导页并运行环境检查。',
      '打开设置页确认 helper、toolkit、配置路径、历史路径和日志路径。',
      '打开健康页刷新健康状态，确认 helper 历史和只读自动化状态能读取。',
      '需要真实验证时，回到概览页手动确认后执行一次受控真实备份。',
      '恢复页仍只生成恢复预案，不修改文件。',
    ],
    trustChecklist: [
      {
        detail: `Release 应同时包含 ${assetName} 和 ${checksumAssetName}，下载后先校验再打开。`,
        id: 'release-assets',
        label: 'Release 产物完整',
        status: 'ok',
      },
      {
        detail: `校验文件使用 ${runtime.appVersion} 版本 DMG 生成，用户本机用 shasum 回读确认。`,
        id: 'checksum-published',
        label: '校验可回读',
        status: 'ok',
      },
      {
        detail: '首次验收仍依赖引导、设置、健康、目标端检查、手动真实备份和恢复预案这组 smoke 流程。',
        id: 'manual-smoke',
        label: '人工验收路径',
        status: 'ok',
      },
      {
        detail: '当前版本仍未加入 Apple 签名、公证和自动更新；这些是后续 1.0 前的可信度增强项。',
        id: 'known-limits',
        label: '已知限制明确',
        status: 'warning',
      },
    ],
    summary: runtimeReady ? '桌面 App 已具备下载后验证和首次运行闭环。' : '下载和校验说明已就绪，首次运行后请完成引导页检查。',
  };
}
