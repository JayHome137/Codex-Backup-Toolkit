export type MacosReadinessLevel = 'ready' | 'needs-action' | 'blocked';

export type MacosReadinessItem = {
  detail: string;
  id: 'desktop-runtime' | 'helper-runtime' | 'toolkit-resources' | 'product-paths' | 'first-backup-proof' | 'release-smoke';
  label: string;
  status: 'ok' | 'warning' | 'blocked';
};

export type MacosReadinessFix = {
  action: string;
  detail: string;
  id: 'open-desktop' | 'start-helper' | 'refresh-diagnostics' | 'check-automation' | 'first-backup' | 'release-smoke' | 'keep-records';
  safeBoundary: string;
  target: 'settings' | 'diagnostics' | 'schedule' | 'overview' | 'release-checklist';
};

export type MacosReadinessInput = {
  automationLoaded: boolean;
  backupAccepted: boolean;
  configPath: string;
  helperOnline: boolean;
  historyPath: string;
  isDesktop: boolean;
  logDir: string;
  releaseSmokeAvailable: boolean;
  toolkitAvailable: boolean;
  version: string;
};

export type MacosReadiness = {
  fixPlan: MacosReadinessFix[];
  items: MacosReadinessItem[];
  level: MacosReadinessLevel;
  nextActions: string[];
  safetyNote: string;
  score: number;
  summary: string;
};

export function buildMacosReadiness(input: MacosReadinessInput): MacosReadiness {
  const items: MacosReadinessItem[] = [
    {
      detail: input.isDesktop ? `CodexBackup ${input.version} 正在桌面 App 中运行。` : '当前是浏览器开发模式，桌面 helper 托管和打开本机路径能力不可用。',
      id: 'desktop-runtime',
      label: '桌面运行环境',
      status: input.isDesktop ? 'ok' : 'blocked',
    },
    {
      detail: input.helperOnline ? 'helper 在线，可以读取配置、历史和执行受控备份。' : 'helper 离线，配置保存、历史读取和真实备份会按离线规则禁用。',
      id: 'helper-runtime',
      label: 'helper 运行状态',
      status: input.helperOnline ? 'ok' : 'blocked',
    },
    {
      detail: input.toolkitAvailable ? '内置 toolkit 资源已定位。' : '尚未定位内置 helper 和脚本资源。',
      id: 'toolkit-resources',
      label: '内置资源',
      status: input.toolkitAvailable ? 'ok' : 'blocked',
    },
    {
      detail: pathsReady(input) ? `配置、历史和日志路径已可展示：${input.logDir}` : '配置、历史或日志路径缺失，需要刷新桌面诊断。',
      id: 'product-paths',
      label: '产品路径',
      status: pathsReady(input) ? 'ok' : 'warning',
    },
    {
      detail: input.backupAccepted ? '已有一次可验收的真实备份历史。' : '还没有完成首次真实备份验收。',
      id: 'first-backup-proof',
      label: '首次备份证明',
      status: input.backupAccepted ? 'ok' : 'warning',
    },
    {
      detail: input.releaseSmokeAvailable ? 'macOS release smoke 脚本已纳入发布验收。' : '还缺少 macOS release smoke 验收脚本。',
      id: 'release-smoke',
      label: '发布验收脚本',
      status: input.releaseSmokeAvailable ? 'ok' : 'warning',
    },
  ];
  const score = items.filter((item) => item.status === 'ok').length;
  const level = items.some((item) => item.status === 'blocked') ? 'blocked' : score === items.length ? 'ready' : 'needs-action';

  return {
    fixPlan: fixPlan(input, items),
    items,
    level,
    nextActions: nextActions(input, items),
    safetyNote: 'macOS 诊断只读取状态和路径，不会安装、卸载或修改 launchd，不会执行真实恢复。',
    score,
    summary: summaryFor(level),
  };
}

function pathsReady(input: MacosReadinessInput): boolean {
  return Boolean(input.configPath && input.historyPath && input.logDir);
}

function nextActions(input: MacosReadinessInput, items: MacosReadinessItem[]): string[] {
  const actions: string[] = [];
  if (!input.isDesktop) actions.push('用桌面 App 打开，而不是只停留在浏览器开发模式。');
  if (!input.helperOnline || !input.toolkitAvailable || !pathsReady(input)) actions.push('刷新桌面诊断，确认 helper 和内置 toolkit。');
  if (!input.automationLoaded) actions.push('读取只读自动化状态，确认当前备份节奏。');
  if (!input.backupAccepted) actions.push('执行一次手动确认的真实备份并刷新历史。');
  if (!input.releaseSmokeAvailable) actions.push('运行 macOS release smoke，确认 .app/.dmg 和资源完整。');

  return actions.length > 0 && items.some((item) => item.status !== 'ok')
    ? actions
    : ['保持当前 macOS 验证记录，继续按发布清单验收。'];
}

function fixPlan(input: MacosReadinessInput, items: MacosReadinessItem[]): MacosReadinessFix[] {
  const fixes: MacosReadinessFix[] = [];
  if (!input.isDesktop) {
    fixes.push({
      action: '打开桌面 App 版本',
      detail: '浏览器开发模式可以预览界面，但不能托管 helper 或打开本机路径。',
      id: 'open-desktop',
      safeBoundary: '只切换运行入口，不会修改备份任务。',
      target: 'settings',
    });
  }
  if (!input.helperOnline) {
    fixes.push({
      action: '在设置页启动 helper',
      detail: 'helper 在线后，配置保存、历史读取、健康状态和受控真实备份才会可用。',
      id: 'start-helper',
      safeBoundary: '只启动桌面 App 托管的本地 helper，不接管外部进程。',
      target: 'settings',
    });
  }
  if (!input.toolkitAvailable || !pathsReady(input)) {
    fixes.push({
      action: '刷新桌面诊断',
      detail: '重新读取内置 toolkit、配置路径、历史路径和日志路径。',
      id: 'refresh-diagnostics',
      safeBoundary: '只读检查路径和资源，不安装或卸载 launchd。',
      target: 'diagnostics',
    });
  }
  if (!input.automationLoaded) {
    fixes.push({
      action: '读取计划状态',
      detail: '确认已有备份节奏、plist 路径和日志位置，仍不做安装或卸载。',
      id: 'check-automation',
      safeBoundary: '只读取自动化状态，不加载、不卸载、不重写定时任务。',
      target: 'schedule',
    });
  }
  if (!input.backupAccepted) {
    fixes.push({
      action: '完成首次真实备份验收',
      detail: '在概览页手动确认真实备份，成功后回到日志或诊断页刷新历史。',
      id: 'first-backup',
      safeBoundary: '真实备份需要手动确认，恢复仍只生成预案。',
      target: 'overview',
    });
  }
  if (!input.releaseSmokeAvailable) {
    fixes.push({
      action: '运行发布 smoke 检查',
      detail: '检查 .app/.dmg、sha256、图标和内置资源是否完整。',
      id: 'release-smoke',
      safeBoundary: '只读检查构建产物，不启动 App、不连接 helper。',
      target: 'release-checklist',
    });
  }

  return fixes.length > 0 && items.some((item) => item.status !== 'ok')
    ? fixes
    : [{
      action: '保持验证记录',
      detail: '继续按发布清单保留 CI、DMG checksum、桌面 smoke 和首次备份证据。',
      id: 'keep-records',
      safeBoundary: '不扩大权限边界。',
      target: 'release-checklist',
    }];
}

function summaryFor(level: MacosReadinessLevel): string {
  if (level === 'ready') return 'macOS 桌面端已经具备日常使用和发布验收基础。';
  if (level === 'blocked') return 'macOS 桌面端还有运行时阻断项，需要先修复。';
  return 'macOS 桌面端可继续完善，剩余项不阻断基础使用。';
}
