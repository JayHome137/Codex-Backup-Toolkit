import { useEffect, useMemo, useState } from 'react';
import { Activity, Archive, CalendarCheck2, CheckCircle2, ClipboardCheck, FolderOpen, KeyRound, Play, RotateCcw, Save, ShieldCheck, TimerReset, Trash2, TriangleAlert, UnlockKeyhole } from 'lucide-react';
import { CommandPreview } from './components/CommandPreview';
import { Sidebar, type SectionId } from './components/Sidebar';
import { StatusBadge } from './components/StatusBadge';
import { buildBackupAction, buildLatestRestorePlanAction, buildRestorePlanAction, buildSyncLocalAuthoritativeAction } from './lib/actions';
import type { HelperAction } from './lib/actions';
import { TargetForm } from './components/TargetForm';
import { buildBackupHealth, type BackupHealth } from './lib/backupHealth';
import { createMockCommandRunner, type CommandResult } from './lib/commands';
import { createHelperApi, type AutomationStatus, type BackupHistoryEntry } from './lib/helperApi';
import { checkHelperHealth, createHttpHelperTransport } from './lib/helperProtocol';
import { createLocalBridgeRunner } from './lib/localBridge';
import { parseDoctorOutput, type DoctorReport } from './lib/doctorReport';
import { createDesktopBridge, createDesktopHelperApi, createDesktopHelperTransport, getBackupArtifacts, type DesktopDiagnostics, type DesktopHelperStatus, type DesktopPaths, type DesktopToolkitStatus } from './lib/desktopBridge';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildEnvFile,
  buildRestoreLatestCommand,
  buildRestoreCommand,
  buildSyncCheckCommand,
  buildSyncLocalAuthoritativeCommand,
  buildValidateCommand,
  defaultConfig,
  getConfigChecks,
  targetLabels,
  type BackupConfig,
  type ConfigCheck,
} from './lib/config';

const runner = createMockCommandRunner();
const localBridgeRunner = createLocalBridgeRunner();

type RunnerMode = 'mock' | 'localBridge' | 'httpHelper' | 'desktopHelper';
type RestoreSource = 'latest' | 'archive';

type HistoryEntry = {
  command: string;
  label: string;
  result: CommandResult;
};

type SecretDraft = {
  account: string;
  secret: string;
  service: string;
};

type HelperConnectionStatus = 'unknown' | 'checking' | 'online' | 'offline';

type HelperActionState = 'config-load' | 'config-save' | 'secret-save' | 'secret-delete' | 'history-load' | 'automation-load' | null;
type DesktopActionState = 'diagnostics' | 'status' | 'start' | 'stop' | null;

type RunPreviewOptions = {
  refreshHelperHistory?: boolean;
};

type FirstLaunchItem = {
  detail: string;
  id: string;
  label: string;
  status: 'ok' | 'warning';
};

const helperActionLabels: Record<Exclude<HelperActionState, null>, string> = {
  'config-load': '加载配置',
  'config-save': '保存配置',
  'secret-save': '保存密钥',
  'secret-delete': '删除密钥',
  'history-load': '刷新历史',
  'automation-load': '刷新自动化状态',
};

const fallbackDesktopPaths: DesktopPaths = {
  appSupportDir: '~/Library/Application Support/CodexBackupToolkit',
  automationStderrLogPath: '~/Library/Logs/CodexBackup/backup.err.log',
  automationStdoutLogPath: '~/Library/Logs/CodexBackup/backup.out.log',
  configPath: '~/Library/Application Support/CodexBackupToolkit/config.json',
  desktopHelperStderrLogPath: '~/Library/Logs/CodexBackup/desktop-helper.err.log',
  desktopHelperStdoutLogPath: '~/Library/Logs/CodexBackup/desktop-helper.out.log',
  historyPath: '~/Library/Application Support/CodexBackupToolkit/history.json',
  logDir: '~/Library/Logs/CodexBackup',
};

const appVersion = '0.15.0';

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>('latest');
  const [archivePath, setArchivePath] = useState('/path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz');
  const [restoreEncrypted, setRestoreEncrypted] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [helperHistory, setHelperHistory] = useState<BackupHistoryEntry[]>([]);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('mock');
  const [secretDraft, setSecretDraft] = useState<SecretDraft>(defaultSecretDraft(defaultConfig));
  const [helperStatus, setHelperStatus] = useState<HelperConnectionStatus>('unknown');
  const [helperAction, setHelperAction] = useState<HelperActionState>(null);
  const [helperMessage, setHelperMessage] = useState('尚未检查本地 helper。需要加载配置、保存密钥或读取真实历史时，请先确认 helper 已启动。');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [desktopHelperStatus, setDesktopHelperStatus] = useState<DesktopHelperStatus>({ managed: false, online: false, source: 'unavailable' });
  const [desktopToolkitStatus, setDesktopToolkitStatus] = useState<DesktopToolkitStatus>({ available: false, source: 'unavailable' });
  const [desktopDiagnostics, setDesktopDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [desktopAction, setDesktopAction] = useState<DesktopActionState>(null);
  const [desktopMessage, setDesktopMessage] = useState('桌面状态尚未检查。');
  const desktopBridge = useMemo(() => createDesktopBridge(), []);
  const httpHelperRunner = useMemo(() => createLocalBridgeRunner(createHttpHelperTransport()), []);
  const desktopHelperRunner = useMemo(() => createLocalBridgeRunner(createDesktopHelperTransport(desktopBridge)), [desktopBridge]);
  const webHelperApi = useMemo(() => createHelperApi(), []);
  const desktopHelperApi = useMemo(() => createDesktopHelperApi(desktopBridge), [desktopBridge]);
  const helperApi = runnerMode === 'desktopHelper' ? desktopHelperApi : webHelperApi;

  const commands = useMemo(
    () => ({
      doctor: buildDoctorCommand(config),
      backup: buildBackupCommand(config),
      envFile: buildEnvFile(config),
      syncCheck: buildSyncCheckCommand(config),
      syncLocalAuthoritative: buildSyncLocalAuthoritativeCommand(config),
      validate: buildValidateCommand(config),
      restore: restoreSource === 'latest' ? buildRestoreLatestCommand(config) : buildRestoreCommand(archivePath, restoreEncrypted),
    }),
    [archivePath, config, restoreEncrypted, restoreSource],
  );
  const actions = useMemo(
    () => ({
      backup: buildBackupAction(config),
      syncLocalAuthoritative: buildSyncLocalAuthoritativeAction(config),
      restorePlan: restoreSource === 'archive' ? buildRestorePlanAction(archivePath, restoreEncrypted) : buildLatestRestorePlanAction(config),
    }),
    [archivePath, config, restoreEncrypted, restoreSource],
  );
  const configChecks = useMemo(() => getConfigChecks(config), [config]);
  const blockingChecks = configChecks.filter((check) => check.status === 'error');
  const helperBusy = helperStatus === 'checking' || helperAction !== null;
  const realRunnerMode = runnerMode === 'httpHelper' || runnerMode === 'desktopHelper';
  const realBackupDisabled = realRunnerMode && (
    !backupConfirmed
    || blockingChecks.length > 0
    || helperBusy
    || helperStatus === 'offline'
    || (runnerMode === 'desktopHelper' && !desktopBridge.isDesktop)
  );
  const syncTargetSupported = config.target === 'local' || config.target === 'smb';
  const realSyncDisabled = realRunnerMode && (
    blockingChecks.length > 0
    || !syncTargetSupported
    || helperBusy
    || helperStatus === 'offline'
    || (runnerMode === 'desktopHelper' && !desktopBridge.isDesktop)
  );
  const helperActionsDisabled = helperStatus === 'offline' || helperBusy;
  const helperActionLabel = helperAction ? helperActionLabels[helperAction] : null;
  const helperBannerMessage = helperActionLabel ? `${helperActionLabel}中...` : helperMessage;
  const latestBackupEntry = helperHistory.find((entry) => entry.action === 'backup' || entry.action === 'syncLocalAuthoritative') ?? null;
  const desktopPaths = desktopDiagnostics?.paths ?? fallbackDesktopPaths;
  const displayedAppVersion = desktopDiagnostics?.version ?? appVersion;
  const backupHealth = useMemo(() => buildBackupHealth({
    automationStatus,
    config,
    configErrorCount: blockingChecks.length,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    history: helperHistory,
    now: new Date(),
  }), [automationStatus, blockingChecks.length, config, desktopHelperStatus.online, helperHistory, helperStatus]);

  useEffect(() => {
    if (!desktopBridge.isDesktop) {
      setDesktopMessage('当前不是 Tauri 桌面环境，网页版仍可使用 HTTP helper 模式。');
      return;
    }

    const initializeDesktop = async () => {
      await refreshDesktopHelperStatus({ autoStart: true });
      await refreshDesktopDiagnostics({ silent: true });
    };
    void initializeDesktop();
  }, [desktopBridge]);

  const setConfigAndSecretDefaults = (nextConfig: BackupConfig) => {
    setConfig(nextConfig);
    setSecretDraft((draft) => ({ ...defaultSecretDraft(nextConfig), secret: draft.secret }));
    setBackupConfirmed(false);
  };

  const runPreview = async (command: string, label: string, action?: HelperAction, options: RunPreviewOptions = {}) => {
    setRunningCommand(command);
    const activeRunner = runnerMode === 'desktopHelper' ? desktopHelperRunner : runnerMode === 'httpHelper' ? httpHelperRunner : runnerMode === 'localBridge' ? localBridgeRunner : runner;
    const result = await activeRunner.run(command, action);
    setLastResult(result);
    if (command.includes('--doctor')) {
      setDoctorReport(parseDoctorOutput(result.output));
    }
    setHistory((entries) => [{ command, label, result }, ...entries].slice(0, 8));
    if (options.refreshHelperHistory && result.status === 'success') {
      await refreshHelperHistoryAfterBackup();
    }
    setRunningCommand(null);
  };

  const runConfirmedBackup = async () => {
    await runPreview(commands.backup, '真实备份', actions.backup, { refreshHelperHistory: true });
    setBackupConfirmed(false);
  };

  const runSyncCheck = async () => {
    await runPreview(commands.syncCheck, '一致性只读检查');
  };

  const runLocalAuthoritativeSync = async () => {
    await runPreview(commands.syncLocalAuthoritative, '本地为准一致性备份', actions.syncLocalAuthoritative, { refreshHelperHistory: true });
  };

  const checkHelper = async () => {
    if (runnerMode === 'desktopHelper') {
      await refreshDesktopHelperStatus({ autoStart: true });
      return;
    }

    setHelperStatus('checking');
    setHelperMessage('正在连接 127.0.0.1:37371 的本地 helper...');
    setRunningCommand('GET http://127.0.0.1:37371/health');
    try {
      const health = await checkHelperHealth();
      setHelperStatus('online');
      setHelperMessage(`helper 在线：${health.helper} / ${health.host}`);
      setLastResult({
        status: 'success',
        output: [
          '助手在线。',
          '',
          `协议: ${health.schema}`,
          `助手: ${health.helper}`,
          `主机: ${health.host}`,
          `状态: ${health.status === 'ok' ? '正常' : health.status}`,
        ].join('\n'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHelperStatus('offline');
      setHelperMessage('helper 离线。请先在本机启动 helper，然后重新检查连接。');
      setLastResult({
        status: 'error',
        output: helperErrorOutput(message),
      });
    } finally {
      setRunningCommand(null);
    }
  };

  const loadPersistedConfig = async () => {
    setHelperAction('config-load');
    setRunningCommand('GET http://127.0.0.1:37371/config');
    try {
      const nextConfig = await helperApi.loadConfig();
      setConfigAndSecretDefaults({ ...defaultConfig, ...nextConfig });
      setHelperStatus('online');
      setHelperMessage('helper 在线，已成功加载持久化配置。');
      setLastResult({ status: 'success', output: '已从 helper 加载持久化配置。' });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const savePersistedConfig = async () => {
    setHelperAction('config-save');
    setRunningCommand('PUT http://127.0.0.1:37371/config');
    try {
      const savedConfig = await helperApi.saveConfig(config);
      setConfigAndSecretDefaults({ ...defaultConfig, ...savedConfig });
      setHelperStatus('online');
      setHelperMessage('helper 在线，配置已保存。');
      setLastResult({ status: 'success', output: '配置已保存到 helper。敏感字段不会写入 config.json。' });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const saveSecret = async () => {
    setHelperAction('secret-save');
    setRunningCommand('POST http://127.0.0.1:37371/secret');
    try {
      await helperApi.saveSecret(secretDraft);
      setSecretDraft((draft) => ({ ...draft, secret: '' }));
      setHelperStatus('online');
      setHelperMessage('helper 在线，密钥已写入 Keychain。');
      setLastResult({ status: 'success', output: `密钥已写入 macOS Keychain。\nservice: ${secretDraft.service}\naccount: ${secretDraft.account}` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const deleteSecret = async () => {
    setHelperAction('secret-delete');
    setRunningCommand('DELETE http://127.0.0.1:37371/secret');
    try {
      await helperApi.deleteSecret({ service: secretDraft.service, account: secretDraft.account });
      setHelperStatus('online');
      setHelperMessage('helper 在线，Keychain 密钥已删除。');
      setLastResult({ status: 'success', output: `Keychain 密钥已删除。\nservice: ${secretDraft.service}\naccount: ${secretDraft.account}` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const loadHelperHistory = async () => {
    setHelperAction('history-load');
    setRunningCommand('GET http://127.0.0.1:37371/history');
    try {
      const entries = await helperApi.loadHistory();
      setHelperHistory(entries);
      setHelperStatus('online');
      setHelperMessage(`helper 在线，已读取 ${entries.length} 条备份历史。`);
      setLastResult({ status: 'success', output: `已加载 ${entries.length} 条 helper 备份历史。` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const loadAutomationStatus = async () => {
    setHelperAction('automation-load');
    setRunningCommand('GET http://127.0.0.1:37371/automation');
    try {
      const status = await helperApi.loadAutomationStatus();
      setAutomationStatus(status);
      setHelperStatus('online');
      setHelperMessage('helper 在线，已读取只读自动化状态。');
      setLastResult({ status: 'success', output: `已刷新自动化状态：${status.label} / ${status.loaded ? '已加载' : '未加载'}` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const refreshHelperHistoryAfterBackup = async () => {
    try {
      const entries = await helperApi.loadHistory();
      setHelperHistory(entries);
      setHelperStatus('online');
      setHelperMessage(`真实备份完成，已自动刷新 ${entries.length} 条 helper 备份历史。`);
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult((result) => result
        ? { ...result, output: `${result.output}\n\n备份已完成，但自动刷新 helper 历史失败：\n${helperErrorOutput(error)}` }
        : { status: 'warning', output: helperErrorOutput(error) });
    }
  };

  const updateHelperFailureState = (error: unknown) => {
    const output = helperErrorOutput(error);
    if (output.includes('ERR_HELPER_UNAVAILABLE')) {
      setHelperStatus('offline');
      setHelperMessage('helper 离线。请先在本机启动 helper，然后重新检查连接。');
      return;
    }

    setHelperStatus('online');
    setHelperMessage('helper 已响应，但本次操作失败。请查看日志里的错误详情。');
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const refreshDesktopHelperStatus = async ({ autoStart = false }: { autoStart?: boolean } = {}) => {
    setDesktopAction('status');
    setHelperStatus('checking');
    try {
      let status = await desktopBridge.helperStatus();
      if (autoStart && desktopBridge.isDesktop && !status.online) {
        status = await desktopBridge.helperStart();
      }
      applyDesktopStatus(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = { lastError: message, managed: false, online: false, source: 'unavailable' as const };
      applyDesktopStatus(status);
    } finally {
      setDesktopAction(null);
    }
  };

  const refreshDesktopToolkitStatus = async () => {
    try {
      setDesktopToolkitStatus(await desktopBridge.toolkitStatus());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDesktopToolkitStatus({ available: false, lastError: message, source: 'unavailable' });
    }
  };

  const refreshDesktopDiagnostics = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setDesktopAction('diagnostics');
    try {
      const diagnostics = await desktopBridge.desktopDiagnostics();
      setDesktopDiagnostics(diagnostics);
      setDesktopToolkitStatus(diagnostics.toolkit);
      applyDesktopStatus(diagnostics.helper);
      if (!silent) {
        setLastResult({
          status: diagnostics.toolkit.available ? 'success' : 'warning',
          output: [
            '桌面诊断已刷新。',
            '',
            `版本: ${diagnostics.version}`,
            `helper: ${desktopHelperStatusLabel(diagnostics.helper)}`,
            `toolkit: ${diagnostics.toolkit.available ? '可用' : '不可用'}`,
            `配置: ${diagnostics.paths.configPath}`,
            `历史: ${diagnostics.paths.historyPath}`,
            `日志: ${diagnostics.paths.logDir}`,
          ].join('\n'),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!silent) setLastResult({ status: 'error', output: `桌面诊断失败：\n${message}` });
      setDesktopMessage(`桌面诊断失败：${message}`);
    } finally {
      if (!silent) setDesktopAction(null);
    }
  };

  const startDesktopHelper = async () => {
    setDesktopAction('start');
    try {
      applyDesktopStatus(await desktopBridge.helperStart());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      applyDesktopStatus({ lastError: message, managed: false, online: false, source: 'unavailable' });
    } finally {
      setDesktopAction(null);
    }
  };

  const stopDesktopHelper = async () => {
    setDesktopAction('stop');
    try {
      applyDesktopStatus(await desktopBridge.helperStop());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      applyDesktopStatus({ lastError: message, managed: false, online: false, source: 'unavailable' });
    } finally {
      setDesktopAction(null);
    }
  };

  const applyDesktopStatus = (status: DesktopHelperStatus) => {
    setDesktopHelperStatus(status);
    setHelperStatus(status.online ? 'online' : 'offline');
    setDesktopMessage(desktopStatusMessage(status));
    setHelperMessage(status.online ? desktopStatusMessage(status) : status.lastError ?? '桌面 helper 离线。');
  };

  const openBackupPath = async (path: string) => {
    try {
      await desktopBridge.openPath(path);
      setLastResult({ status: 'success', output: `已请求打开路径：\n${path}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastResult({ status: 'error', output: `打开路径失败：\n${path}\n\n${message}` });
    }
  };

  const openDesktopPath = async (path: string) => {
    await openBackupPath(path);
  };

  const useArchiveForRestorePlan = (path: string) => {
    setRestoreSource('archive');
    setArchivePath(path);
    setRestoreEncrypted(path.endsWith('.age'));
    setActiveSection('restore');
    setLastResult({ status: 'warning', output: `已从备份历史选择归档，只生成恢复预案，不执行真实恢复：\n${path}` });
  };

  const status = lastResult?.status ?? 'idle';

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Codex-Backup-toolkit</p>
            <h2>{sectionTitle(activeSection)}</h2>
          </div>
          <div className="topbar-actions">
            <div className="mode-switch" role="group" aria-label="运行模式">
              <button className={runnerMode === 'mock' ? 'segment segment--active' : 'segment'} onClick={() => setRunnerMode('mock')} type="button">
                模拟
              </button>
              <button
                className={runnerMode === 'localBridge' ? 'segment segment--active' : 'segment'}
                onClick={() => setRunnerMode('localBridge')}
                type="button"
              >
                本地桥接
              </button>
              <button
                className={runnerMode === 'httpHelper' ? 'segment segment--active' : 'segment'}
                onClick={() => setRunnerMode('httpHelper')}
                type="button"
              >
                HTTP 助手
              </button>
              <button
                className={runnerMode === 'desktopHelper' ? 'segment segment--active' : 'segment'}
                onClick={() => {
                  setRunnerMode('desktopHelper');
                  void refreshDesktopHelperStatus({ autoStart: true });
                }}
                type="button"
              >
                桌面
              </button>
            </div>
            <StatusBadge status={status} label={statusLabel(status)} />
          </div>
        </header>

        <HelperConnectionBanner
          disabled={helperBusy}
          message={helperBannerMessage}
          onCheck={checkHelper}
          status={helperStatus}
        />

        {activeSection === 'overview' && (
          <section className="view-stack">
            <div className="metric-grid">
              <MetricCard icon={Archive} label="目标端" value={targetLabels[config.target]} tone="blue" />
              <MetricCard icon={ShieldCheck} label="模式" value="仅预览" tone="green" />
              <MetricCard icon={CalendarCheck2} label="计划" value="03:00 / 每 3 天" tone="yellow" />
            </div>

            <DesktopReadinessPanel
              appVersion={displayedAppVersion}
              helperStatus={desktopHelperStatus}
              isDesktop={desktopBridge.isDesktop}
              onOpenSettings={() => setActiveSection('settings')}
              paths={desktopPaths}
              toolkitStatus={desktopToolkitStatus}
            />

            <TargetDoctorPanel report={doctorReport} />

            <div className="two-column">
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Activity size={16} aria-hidden="true" />
                    <span>当前运行</span>
                  </div>
                </div>
                <div className="summary-list">
                  <SummaryRow label="配置检查" value={blockingChecks.length === 0 ? '当前配置没有阻断项' : `${blockingChecks.length} 个阻断项`} />
                  <SummaryRow label="最近备份" value="此界面尚未启动任何真实备份" />
                  <SummaryRow label="运行器" value={runnerModeLabel(runnerMode)} />
                  <SummaryRow label="自动化" value="计划校验命令使用隔离测试标识" />
                </div>
                <ConfigCheckList checks={configChecks} compact />
                <div className="action-row">
                  <button className="button button--primary" onClick={() => runPreview(commands.doctor, '环境检查命令')} type="button">
                    <Play size={15} aria-hidden="true" />
                    运行检查
                  </button>
                  {runnerMode === 'httpHelper' && (
                    <button className="button button--tertiary" onClick={checkHelper} type="button">
                      <Activity size={15} aria-hidden="true" />
                      检查助手
                    </button>
                  )}
                  {!realRunnerMode && (
                    <button className="button button--tertiary" onClick={() => runPreview(commands.backup, '备份命令', actions.backup)} type="button">
                      <Archive size={15} aria-hidden="true" />
                      {runnerMode === 'mock' ? '预览备份' : '执行备份'}
                    </button>
                  )}
                </div>
              </section>
              {realRunnerMode && (
                <section className="panel real-backup-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <UnlockKeyhole size={16} aria-hidden="true" />
                      <span>真实备份确认</span>
                    </div>
                  </div>
                  <div className="summary-list">
                    <SummaryRow label="目标端" value={targetLabels[config.target]} />
                    <SummaryRow label="加密" value={config.encrypt ? '已开启 age 加密' : '未开启 age 加密'} />
                    <SummaryRow label="保留策略" value={`${config.retentionCount} 份 / ${config.retentionDays} 天${config.remoteRetention ? ' / 远端清理开启' : ''}`} />
                    <SummaryRow label="helper" value={helperStatusLabel(helperStatus)} />
                  </div>
                  <p className="muted-copy">确认后只会通过本地 helper 执行一次结构化 backup action。不会执行恢复、安装、卸载或修改已有定时任务。</p>
                  <div className="action-row">
                    <button className="button button--tertiary" disabled={blockingChecks.length > 0 || helperBusy} onClick={() => setBackupConfirmed(true)} type="button">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      确认真实备份
                    </button>
                    <button className="button button--primary" disabled={realBackupDisabled} onClick={runConfirmedBackup} type="button">
                      <Archive size={15} aria-hidden="true" />
                      执行真实备份
                    </button>
                  </div>
                </section>
              )}
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <TimerReset size={16} aria-hidden="true" />
                    <span>一致性统一</span>
                  </div>
                </div>
                <div className="summary-list">
                  <SummaryRow label="规则" value="本地数据永远优先" />
                  <SummaryRow label="频率" value={`每 ${config.syncCheckIntervalHours} 小时检查 / 最短 ${config.syncMinBackupIntervalHours} 小时生成新备份`} />
                  <SummaryRow label="归档" value="不覆盖旧备份，按时间戳生成并套用保留策略" />
                  <SummaryRow label="目标端" value={syncTargetSupported ? '当前目标端支持一致性检查' : '0.14.0 先支持本地目录和 SMB/NAS'} />
                </div>
                <p className="muted-copy">一致性统一不会从备份回写本机，也不会覆盖已有归档；发现备份和本地不一致时，只创建新的时间戳备份。</p>
                <div className="action-row">
                  <button className="button button--tertiary" disabled={!syncTargetSupported || helperBusy} onClick={runSyncCheck} type="button">
                    <ShieldCheck size={15} aria-hidden="true" />
                    只读检查
                  </button>
                  <button className="button button--primary" disabled={realRunnerMode ? realSyncDisabled : !syncTargetSupported || helperBusy} onClick={runLocalAuthoritativeSync} type="button">
                    <TimerReset size={15} aria-hidden="true" />
                    本地为准生成备份
                  </button>
                </div>
              </section>
              <CommandPreview command={commands.backup} title="备份命令" onCopy={copyText} />
            </div>
          </section>
        )}

        {activeSection === 'health' && (
          <section className="view-stack">
            <BackupHealthPanel
              health={backupHealth}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenSchedule={() => setActiveSection('schedule')}
              onOpenSettings={() => setActiveSection('settings')}
              onOpenTargets={() => setActiveSection('targets')}
            />
          </section>
        )}

        {activeSection === 'targets' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>目标端配置</span>
                </div>
              </div>
              <TargetForm config={config} onChange={setConfigAndSecretDefaults} />
              <div className="action-row">
                <button className="button button--tertiary" disabled={helperActionsDisabled} onClick={loadPersistedConfig} type="button">
                  <Activity size={15} aria-hidden="true" />
                  {helperAction === 'config-load' ? '加载中' : '加载配置'}
                </button>
                <button className="button button--primary" disabled={helperActionsDisabled} onClick={savePersistedConfig} type="button">
                  <Save size={15} aria-hidden="true" />
                  {helperAction === 'config-save' ? '保存中' : '保存配置'}
                </button>
              </div>
            </section>
            {(config.target === 'smb' || config.target === 'webdav') && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <KeyRound size={16} aria-hidden="true" />
                    <span>Keychain 密钥</span>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Service</span>
                    <input value={secretDraft.service} onChange={(event) => setSecretDraft({ ...secretDraft, service: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Account</span>
                    <input value={secretDraft.account} onChange={(event) => setSecretDraft({ ...secretDraft, account: event.target.value })} />
                  </label>
                  <label className="field field--wide">
                    <span>Secret</span>
                    <input
                      autoComplete="off"
                      type="password"
                      value={secretDraft.secret}
                      onChange={(event) => setSecretDraft({ ...secretDraft, secret: event.target.value })}
                    />
                  </label>
                </div>
                <div className="action-row">
                  <button className="button button--primary" disabled={helperActionsDisabled || secretDraft.secret.length === 0} onClick={saveSecret} type="button">
                    <KeyRound size={15} aria-hidden="true" />
                    {helperAction === 'secret-save' ? '保存中' : '保存密钥'}
                  </button>
                  <button className="button button--tertiary" disabled={helperActionsDisabled} onClick={deleteSecret} type="button">
                    <Trash2 size={15} aria-hidden="true" />
                    {helperAction === 'secret-delete' ? '删除中' : '删除密钥'}
                  </button>
                </div>
              </section>
            )}
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>配置检查</span>
                </div>
              </div>
              <ConfigCheckList checks={configChecks} />
            </section>
            <CommandPreview command={commands.envFile} title="config.env 预览" onCopy={copyText} />
            <CommandPreview command={commands.backup} title="生成的备份命令" onCopy={copyText} />
            <CommandPreview command={commands.syncLocalAuthoritative} title="一致性同步命令" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'schedule' && (
          <section className="view-stack">
            <AutomationStatusPanel
              disabled={helperActionsDisabled}
              onOpen={openDesktopPath}
              onRefresh={loadAutomationStatus}
              paths={desktopPaths}
              status={automationStatus}
              refreshing={helperAction === 'automation-load'}
            />
            <section className="panel panel--compact">
              <div className="panel-header">
                <div className="panel-title">
                  <CalendarCheck2 size={16} aria-hidden="true" />
                  <span>launchd 校验</span>
                </div>
              </div>
              <p className="muted-copy">
                GUI 只预览 `codexinstallautomation validate`。它使用 `dev.codexbackup.toolkit.test.*` 隔离标识，
                不会加载或修改你已经安装的备份任务。
              </p>
              <div className="action-row">
                <button className="button button--primary" onClick={() => runPreview(commands.validate, '计划校验命令')} type="button">
                  <Play size={15} aria-hidden="true" />
                  校验
                </button>
              </div>
            </section>
            <CommandPreview command={commands.validate} title="计划校验命令" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'restore' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>恢复预览</span>
                </div>
              </div>
              <div className="segmented-control" role="group" aria-label="恢复来源">
                <button
                  className={restoreSource === 'latest' ? 'segment segment--active' : 'segment'}
                  onClick={() => setRestoreSource('latest')}
                  type="button"
                >
                  最新备份
                </button>
                <button
                  className={restoreSource === 'archive' ? 'segment segment--active' : 'segment'}
                  onClick={() => setRestoreSource('archive')}
                  type="button"
                >
                  指定归档
                </button>
              </div>
              <div className="form-grid">
                {restoreSource === 'latest' ? (
                  <div className="field field--wide">
                    <span>最新备份目标端</span>
                    <strong>{targetLabels[config.target]}</strong>
                  </div>
                ) : (
                  <>
                    <label className="field field--wide">
                      <span>归档路径</span>
                      <input value={archivePath} onChange={(event) => setArchivePath(event.target.value)} />
                    </label>
                    <label className="toggle-row field--wide">
                      <input checked={restoreEncrypted} onChange={(event) => setRestoreEncrypted(event.target.checked)} type="checkbox" />
                      <span>加密归档</span>
                    </label>
                  </>
                )}
              </div>
              <p className="muted-copy">当前浏览器版只生成恢复预案，不执行真实恢复。最新备份会使用当前目标端配置生成 `codexrestore --plan --latest`。</p>
              <div className="action-row">
                <button className="button button--tertiary" onClick={() => runPreview(commands.restore, '恢复预案', actions.restorePlan)} type="button">
                  <RotateCcw size={15} aria-hidden="true" />
                  生成预案
                </button>
              </div>
            </section>
            <CommandPreview command={commands.restore} title="恢复预案命令" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'logs' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>运行输出</span>
                </div>
              </div>
              <pre className="log-output">
                <code>{runningCommand ? `${helperActionLabel ?? '命令'}正在运行...` : lastResult?.output ?? '还没有运行任何预览命令。'}</code>
              </pre>
            </section>
            <section className="panel panel--compact">
              <div className="summary-list">
                <SummaryRow label="标准输出" value="~/Library/Logs/CodexBackup/backup.out.log" />
                <SummaryRow label="错误输出" value="~/Library/Logs/CodexBackup/backup.err.log" />
                <SummaryRow label="安装路径" value="~/Library/Application Support/CodexBackupToolkit/" />
              </div>
            </section>
            <LatestBackupResult entry={latestBackupEntry} onCopy={copyText} onOpen={openBackupPath} onRestorePlan={useArchiveForRestorePlan} />
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>运行历史</span>
                </div>
                <button className="button button--tertiary" disabled={helperActionsDisabled} onClick={loadHelperHistory} type="button">
                  <Activity size={15} aria-hidden="true" />
                  {helperAction === 'history-load' ? '刷新中' : '刷新历史'}
                </button>
              </div>
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="muted-copy">还没有预览运行记录。</p>
                ) : (
                  history.map((entry) => (
                    <div className="history-item" key={`${entry.label}-${entry.command}-${entry.result.output}`}>
                      <div>
                        <strong>{entry.label}</strong>
                        <span>{resultStatusLabel(entry.result.status)}</span>
                      </div>
                      <code>{entry.command}</code>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>helper 备份历史</span>
                </div>
              </div>
              <div className="history-list">
                {helperHistory.length === 0 ? (
                  <p className="muted-copy">还没有从 helper 加载真实备份历史。</p>
                ) : (
                  helperHistory.map((entry) => <HelperHistoryItem entry={entry} key={`${entry.startedAt}-${entry.target}-${entry.exitCode}`} />)
                )}
              </div>
            </section>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="view-stack">
            <FirstLaunchChecklist
              helperStatus={desktopHelperStatus}
              isDesktop={desktopBridge.isDesktop}
              paths={desktopPaths}
              toolkitStatus={desktopToolkitStatus}
            />
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>桌面 helper</span>
                </div>
                <StatusBadge status={desktopHelperStatus.online ? 'success' : 'warning'} label={desktopHelperStatusLabel(desktopHelperStatus)} />
              </div>
              <div className="summary-list">
                <SummaryRow label="状态" value={desktopHelperStatus.online ? '在线' : '离线'} />
                <SummaryRow label="来源" value={desktopSourceLabel(desktopHelperStatus.source)} />
                <SummaryRow label="端口" value={String(desktopHelperStatus.port ?? 37371)} />
                <SummaryRow label="托管" value={desktopHelperStatus.managed ? '由桌面 App 启动' : '未由桌面 App 托管'} />
              </div>
              <p className="muted-copy">{desktopMessage}</p>
              <div className="action-row">
                <button className="button button--tertiary" disabled={desktopAction !== null} onClick={() => refreshDesktopHelperStatus()} type="button">
                  <Activity size={15} aria-hidden="true" />
                  {desktopAction === 'status' ? '刷新中' : '刷新状态'}
                </button>
                <button className="button button--primary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={startDesktopHelper} type="button">
                  <Play size={15} aria-hidden="true" />
                  {desktopAction === 'start' ? '启动中' : '启动 helper'}
                </button>
                <button className="button button--tertiary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={stopDesktopHelper} type="button">
                  <Trash2 size={15} aria-hidden="true" />
                  {desktopAction === 'stop' ? '停止中' : '停止 helper'}
                </button>
                <button className="button button--tertiary" disabled={!desktopBridge.isDesktop} onClick={refreshDesktopToolkitStatus} type="button">
                  <ShieldCheck size={15} aria-hidden="true" />
                  检查 toolkit
                </button>
                <button className="button button--tertiary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={() => refreshDesktopDiagnostics()} type="button">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {desktopAction === 'diagnostics' ? '诊断中' : '刷新诊断'}
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>内置 toolkit</span>
                </div>
                <StatusBadge status={desktopToolkitStatus.available ? 'success' : 'warning'} label={desktopToolkitStatus.available ? '可用' : '不可用'} />
              </div>
              <div className="summary-list">
                <SummaryRow label="来源" value={toolkitSourceLabel(desktopToolkitStatus.source)} />
                <SummaryRow label="根目录" value={desktopToolkitStatus.rootPath ?? '未定位'} />
                <SummaryRow label="helper" value={desktopToolkitStatus.helperPath ?? '未定位'} />
                <SummaryRow label="脚本" value={desktopToolkitStatus.scriptsPath ?? '未定位'} />
              </div>
              {desktopToolkitStatus.lastError && <p className="muted-copy">{desktopToolkitStatus.lastError}</p>}
              <div className="action-row">
                <button className="button button--tertiary" disabled={!desktopBridge.isDesktop || !desktopToolkitStatus.rootPath} onClick={() => desktopToolkitStatus.rootPath && openDesktopPath(desktopToolkitStatus.rootPath)} type="button">
                  <FolderOpen size={15} aria-hidden="true" />
                  打开 toolkit
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>产品路径</span>
                </div>
              </div>
              <div className="summary-list">
                <SummaryRow label="版本" value={displayedAppVersion} />
                <PathRow label="配置" path={desktopPaths.configPath} onOpen={openDesktopPath} />
                <PathRow label="历史" path={desktopPaths.historyPath} onOpen={openDesktopPath} />
                <PathRow label="配置目录" path={desktopPaths.appSupportDir} onOpen={openDesktopPath} />
                <PathRow label="自动化标准输出" path={desktopPaths.automationStdoutLogPath} onOpen={openDesktopPath} />
                <PathRow label="自动化错误输出" path={desktopPaths.automationStderrLogPath} onOpen={openDesktopPath} />
                <PathRow label="桌面 helper 输出" path={desktopPaths.desktopHelperStdoutLogPath} onOpen={openDesktopPath} />
                <PathRow label="桌面 helper 错误" path={desktopPaths.desktopHelperStderrLogPath} onOpen={openDesktopPath} />
                <PathRow label="日志目录" path={desktopPaths.logDir} onOpen={openDesktopPath} />
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}

function defaultSecretDraft(config: BackupConfig): SecretDraft {
  if (config.target === 'webdav') {
    return {
      service: 'codexbackup-webdav',
      account: `${config.webdavUser}@${config.webdavUrl}`,
      secret: '',
    };
  }

  return {
    service: 'codexbackup-smb',
    account: `${config.smbUser}@${config.smbHost}/${config.smbShare}`,
    secret: '',
  };
}

function helperErrorOutput(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('ERR_HELPER_UNAVAILABLE')) {
    return [
      'ERR_HELPER_UNAVAILABLE',
      '',
      '本地 helper 当前不可用。',
      '请先在仓库根目录运行 `node helper/server.mjs`，再回到 GUI 点击“重新检查”。',
      '',
      message,
    ].join('\n');
  }

  if (message.includes('ERR_HELPER_FAILED')) {
    return [
      'ERR_HELPER_FAILED',
      '',
      'helper 已响应，但本次操作没有成功。',
      '请根据下方错误信息检查配置、权限或 Keychain 输入。',
      '',
      message,
    ].join('\n');
  }

  return message;
}

function HelperConnectionBanner({
  disabled,
  message,
  onCheck,
  status,
}: {
  disabled: boolean;
  message: string;
  onCheck: () => void;
  status: HelperConnectionStatus;
}) {
  const Icon = status === 'online' ? CheckCircle2 : status === 'offline' ? TriangleAlert : Activity;

  return (
    <section className={`helper-banner helper-banner--${status}`}>
      <div className="helper-banner__status">
        <Icon size={16} aria-hidden="true" />
        <div>
          <strong>{helperStatusLabel(status)}</strong>
          <span>{message}</span>
        </div>
      </div>
      <button className="button button--tertiary" disabled={disabled} onClick={onCheck} type="button">
        <Activity size={15} aria-hidden="true" />
        {status === 'checking' ? '检查中' : '重新检查'}
      </button>
    </section>
  );
}

function BackupHealthPanel({
  health,
  onOpenLogs,
  onOpenSchedule,
  onOpenSettings,
  onOpenTargets,
}: {
  health: BackupHealth;
  onOpenLogs: () => void;
  onOpenSchedule: () => void;
  onOpenSettings: () => void;
  onOpenTargets: () => void;
}) {
  return (
    <>
      <section className="panel readiness-panel">
        <div className="panel-header">
          <div className="panel-title">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>备份健康度</span>
          </div>
          <StatusBadge status={health.level === 'healthy' ? 'success' : health.level === 'risk' ? 'error' : 'warning'} label={`${health.score}/100`} />
        </div>
        <div className="readiness-layout">
          <div className="summary-list">
            <SummaryRow label="状态" value={backupHealthLevelLabel(health.level)} />
            <SummaryRow label="摘要" value={health.summary} />
            <SummaryRow label="检查项" value={`${health.items.length} 项`} />
            <SummaryRow label="下一步" value={health.nextActions[0] ?? '保持当前备份节奏'} />
          </div>
          <div className="readiness-copy">
            <strong>只读健康视图</strong>
            <p>这里聚合 helper、配置、历史、自动化和一致性检查状态，只做展示和跳转，不会执行真实恢复、安装、卸载或修改已有定时任务。</p>
            <div className="action-row">
              <button className="button button--tertiary" onClick={onOpenTargets} type="button">打开目标端</button>
              <button className="button button--tertiary" onClick={onOpenLogs} type="button">打开日志</button>
              <button className="button button--tertiary" onClick={onOpenSchedule} type="button">打开计划</button>
              <button className="button button--tertiary" onClick={onOpenSettings} type="button">打开设置</button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span>健康检查项</span>
          </div>
        </div>
        <div className="check-list check-list--grid">
          {health.items.map((item) => {
            const Icon = item.status === 'ok' ? CheckCircle2 : TriangleAlert;
            return (
              <div className={`check-item check-item--${item.status}`} key={item.id}>
                <Icon size={15} aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel panel--compact">
        <div className="panel-header">
          <div className="panel-title">
            <Activity size={16} aria-hidden="true" />
            <span>建议动作</span>
          </div>
        </div>
        <div className="history-list">
          {health.nextActions.map((action) => (
            <div className="history-item" key={action}>
              <div>
                <strong>{action}</strong>
                <span>按需处理</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function DesktopReadinessPanel({
  appVersion,
  helperStatus,
  isDesktop,
  onOpenSettings,
  paths,
  toolkitStatus,
}: {
  appVersion: string;
  helperStatus: DesktopHelperStatus;
  isDesktop: boolean;
  onOpenSettings: () => void;
  paths: DesktopPaths;
  toolkitStatus: DesktopToolkitStatus;
}) {
  const readinessItems = buildFirstLaunchItems({ helperStatus, isDesktop, paths, toolkitStatus });
  const readyCount = readinessItems.filter((item) => item.status === 'ok').length;

  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>桌面就绪检查</span>
        </div>
        <StatusBadge status={readyCount >= 3 ? 'success' : 'warning'} label={`${readyCount}/${readinessItems.length} 已就绪`} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="版本" value={appVersion} />
          <SummaryRow label="helper" value={desktopHelperStatusLabel(helperStatus)} />
          <SummaryRow label="toolkit" value={toolkitStatus.available ? toolkitSourceLabel(toolkitStatus.source) : '未就绪'} />
          <SummaryRow label="安全边界" value="不会修改已有定时备份任务" />
        </div>
        <div className="readiness-copy">
          <strong>未签名桌面版本</strong>
          <p>当前 `.app/.dmg` 仍未签名、未公证。首次打开可能需要在 macOS 系统设置中允许打开；GUI 仍只执行受控备份和恢复预案，不会修改已有定时备份任务。</p>
          <button className="button button--tertiary" onClick={onOpenSettings} type="button">
            <Activity size={15} aria-hidden="true" />
            打开设置
          </button>
        </div>
      </div>
    </section>
  );
}

function FirstLaunchChecklist({
  helperStatus,
  isDesktop,
  paths,
  toolkitStatus,
}: {
  helperStatus: DesktopHelperStatus;
  isDesktop: boolean;
  paths: DesktopPaths;
  toolkitStatus: DesktopToolkitStatus;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>首次启动核对</span>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {buildFirstLaunchItems({ helperStatus, isDesktop, paths, toolkitStatus }).map((item) => {
          const Icon = item.status === 'ok' ? CheckCircle2 : TriangleAlert;
          return (
            <div className={`check-item check-item--${item.status}`} key={item.label}>
              <Icon size={15} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetDoctorPanel({ report }: { report: DoctorReport | null }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>目标端检查</span>
        </div>
        {report && <StatusBadge status={report.status} label={statusLabel(report.status)} />}
      </div>
      {!report ? (
        <p className="muted-copy">运行检查后会把 doctor 输出整理成目标端、依赖和路径状态。这里只展示检查结果，不会创建备份、恢复文件或修改定时任务。</p>
      ) : (
        <div className="doctor-result">
          <div className="summary-list">
            <SummaryRow label="目标端" value={report.target} />
            <SummaryRow label="摘要" value={report.summary} />
          </div>
          <div className="check-list check-list--grid">
            {report.checks.map((check, index) => {
              const Icon = check.status === 'ok' ? CheckCircle2 : TriangleAlert;
              return (
                <div className={`check-item check-item--${check.status}`} key={`${check.status}-${check.detail}-${index}`}>
                  <Icon size={15} aria-hidden="true" />
                  <div>
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function AutomationStatusPanel({
  disabled,
  onOpen,
  onRefresh,
  paths,
  refreshing,
  status,
}: {
  disabled: boolean;
  onOpen: (path: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  paths: DesktopPaths;
  refreshing: boolean;
  status: AutomationStatus | null;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarCheck2 size={16} aria-hidden="true" />
          <span>自动化状态</span>
        </div>
        <StatusBadge status={status?.loaded ? 'success' : 'warning'} label={status ? (status.loaded ? '已加载' : '未加载') : '未刷新'} />
      </div>
      <p className="muted-copy">只读检查，不会安装、卸载、加载或修改已有任务。状态来自 helper 的 `/automation`，只读取路径状态和 `launchctl print` 输出。</p>
      <div className="summary-list">
        <SummaryRow label="Label" value={status?.label ?? 'dev.codexbackup.toolkit'} />
        <SummaryRow label="加载状态" value={status ? (status.loaded ? '已加载' : '未加载') : '尚未刷新'} />
        <SummaryRow label="计划" value={status?.schedule ?? '03:00 / 每 3 天'} />
        <SummaryRow label="plist" value={status ? existsLabel(status.plistExists) : '尚未检查'} />
        <SummaryRow label="安装目录" value={status ? existsLabel(status.installDirExists) : '尚未检查'} />
        <SummaryRow label="执行脚本" value={status ? existsLabel(status.scheduledScriptExists) : '尚未检查'} />
        <PathRow label="plist 路径" path={status?.plistPath ?? '~/Library/LaunchAgents/dev.codexbackup.toolkit.plist'} onOpen={onOpen} />
        <PathRow label="安装路径" path={status?.installDir ?? paths.appSupportDir} onOpen={onOpen} />
        <PathRow label="执行脚本路径" path={status?.scheduledScriptPath ?? `${paths.appSupportDir}/scripts/codexscheduledbackup.sh`} onOpen={onOpen} />
        <PathRow label="标准输出" path={status?.stdoutLogPath ?? paths.automationStdoutLogPath} onOpen={onOpen} />
        <PathRow label="错误输出" path={status?.stderrLogPath ?? paths.automationStderrLogPath} onOpen={onOpen} />
      </div>
      {status?.lastError && <p className="muted-copy">{status.lastError}</p>}
      <div className="action-row">
        <button className="button button--tertiary" disabled={disabled} onClick={onRefresh} type="button">
          <Activity size={15} aria-hidden="true" />
          {refreshing ? '刷新中' : '刷新自动化状态'}
        </button>
      </div>
    </section>
  );
}

function buildFirstLaunchItems({
  helperStatus,
  isDesktop,
  paths,
  toolkitStatus,
}: {
  helperStatus: DesktopHelperStatus;
  isDesktop: boolean;
  paths: DesktopPaths;
  toolkitStatus: DesktopToolkitStatus;
}): FirstLaunchItem[] {
  return [
    {
      id: 'desktop-runtime',
      label: '桌面运行环境',
      status: isDesktop ? 'ok' : 'warning',
      detail: isDesktop ? '当前运行在 Tauri 桌面 App 中。' : '当前是浏览器开发模式；桌面专属启动、停止和打开路径能力会禁用。',
    },
    {
      id: 'helper-status',
      label: 'helper 状态',
      status: helperStatus.online ? 'ok' : 'warning',
      detail: helperStatus.online ? desktopStatusMessage(helperStatus) : 'helper 离线时，配置保存、Keychain、历史读取和真实备份按钮会按离线规则禁用。',
    },
    {
      id: 'toolkit-source',
      label: 'toolkit 来源',
      status: toolkitStatus.available ? 'ok' : 'warning',
      detail: toolkitStatus.available ? `当前来源：${toolkitSourceLabel(toolkitStatus.source)}。` : toolkitStatus.lastError ?? '尚未定位内置 toolkit；请刷新诊断或检查桌面构建资源。',
    },
    {
      id: 'config-history-paths',
      label: '配置和历史路径',
      status: paths.configPath && paths.historyPath ? 'ok' : 'warning',
      detail: `${paths.configPath} / ${paths.historyPath}`,
    },
    {
      id: 'restore-plan-only',
      label: '真实恢复仍为预案',
      status: 'ok',
      detail: '恢复页只生成 codexrestore --plan，不执行真实恢复，也不会创建或覆盖文件。',
    },
  ];
}

function existsLabel(exists: boolean): string {
  return exists ? '存在' : '未发现';
}

function helperStatusLabel(status: HelperConnectionStatus): string {
  return {
    unknown: 'helper 未确认',
    checking: 'helper 检查中',
    online: 'helper 在线',
    offline: 'helper 离线',
  }[status];
}

function HelperHistoryItem({ entry }: { entry: BackupHistoryEntry }) {
  return (
    <div className="history-item">
      <div>
        <strong>{entry.action === 'syncLocalAuthoritative' ? '一致性备份' : targetLabels[entry.target as keyof typeof targetLabels] ?? entry.target}</strong>
        <span>{entry.status === 'success' ? '成功' : '失败'} / 退出码 {entry.exitCode}</span>
      </div>
      <code>{entry.archivePaths.length > 0 ? entry.archivePaths.join('\n') : '没有检测到归档路径'}</code>
      <span className="history-meta">{entry.startedAt} - {entry.finishedAt}</span>
    </div>
  );
}

function LatestBackupResult({
  entry,
  onCopy,
  onOpen,
  onRestorePlan,
}: {
  entry: BackupHistoryEntry | null;
  onCopy: (text: string) => Promise<void>;
  onOpen: (path: string) => Promise<void>;
  onRestorePlan: (path: string) => void;
}) {
  const artifacts = entry ? getBackupArtifacts(entry.archivePaths) : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Archive size={16} aria-hidden="true" />
          <span>最新备份结果</span>
        </div>
      </div>
      {!entry ? (
        <p className="muted-copy">还没有可展示的真实备份结果。执行真实备份或刷新 helper 历史后会显示最近一次结果。</p>
      ) : (
        <div className="backup-result">
          <div className="summary-list">
            <SummaryRow label="目标端" value={targetLabels[entry.target as keyof typeof targetLabels] ?? entry.target} />
            <SummaryRow label="状态" value={entry.status === 'success' ? '成功' : '失败'} />
            <SummaryRow label="退出码" value={String(entry.exitCode)} />
            <SummaryRow label="开始" value={entry.startedAt} />
            <SummaryRow label="结束" value={entry.finishedAt} />
          </div>
          {artifacts ? (
            <div className="artifact-list">
              <ArtifactRow label="归档" path={artifacts.archivePath} onCopy={onCopy} onOpen={onOpen} onRestorePlan={onRestorePlan} />
              <ArtifactRow label="sha256" path={artifacts.checksumPath} onCopy={onCopy} onOpen={onOpen} />
              <ArtifactRow label="manifest" path={artifacts.manifestPath} onCopy={onCopy} onOpen={onOpen} />
            </div>
          ) : (
            <p className="muted-copy">本次历史记录没有归档路径。</p>
          )}
        </div>
      )}
    </section>
  );
}

function ArtifactRow({
  label,
  onCopy,
  onOpen,
  onRestorePlan,
  path,
}: {
  label: string;
  onCopy: (text: string) => Promise<void>;
  onOpen: (path: string) => Promise<void>;
  onRestorePlan?: (path: string) => void;
  path: string;
}) {
  return (
    <div className="artifact-row">
      <span>{label}</span>
      <code>{path}</code>
      <div className="artifact-actions">
        <button className="button button--tertiary" onClick={() => onCopy(path)} type="button">复制</button>
        {onRestorePlan && (
          <button className="button button--tertiary" onClick={() => onRestorePlan(path)} type="button">
            <RotateCcw size={14} aria-hidden="true" />
            生成恢复预案
          </button>
        )}
        <button className="button button--tertiary" onClick={() => onOpen(path)} type="button">
          <FolderOpen size={14} aria-hidden="true" />
          打开
        </button>
      </div>
    </div>
  );
}

function sectionTitle(section: SectionId): string {
  return {
    overview: '概览',
    health: '备份健康',
    targets: '目标端',
    schedule: '计划校验',
    restore: '恢复预览',
    logs: '日志',
    settings: '设置',
  }[section];
}

function backupHealthLevelLabel(level: BackupHealth['level']): string {
  return {
    healthy: '健康',
    warning: '需要关注',
    risk: '存在风险',
  }[level];
}

function statusLabel(status: CommandResult['status'] | 'idle'): string {
  return {
    idle: '就绪',
    success: '预览通过',
    warning: '预览警告',
    error: '预览失败',
  }[status];
}

function resultStatusLabel(status: CommandResult['status']): string {
  return {
    success: '成功',
    warning: '警告',
    error: '错误',
  }[status];
}

function runnerModeLabel(mode: RunnerMode): string {
  return {
    mock: '模拟预览模式',
    localBridge: '本地桥接允许列表模式',
    httpHelper: 'HTTP 助手：127.0.0.1:37371',
    desktopHelper: '桌面 helper：Tauri 托管或外部连接',
  }[mode];
}

function desktopStatusMessage(status: DesktopHelperStatus): string {
  if (status.online && status.source === 'managed') return '托管 helper 在线。退出桌面 App 时会尝试清理这个 helper。';
  if (status.online && status.source === 'external') return '外部 helper 在线。桌面 App 只连接它，退出时不会停止它。';
  return status.lastError ?? '桌面 helper 离线。';
}

function desktopSourceLabel(source: DesktopHelperStatus['source']): string {
  return {
    managed: 'App 托管',
    external: '外部 helper',
    unavailable: '不可用',
  }[source];
}

function desktopHelperStatusLabel(status: DesktopHelperStatus): string {
  if (!status.online) return 'helper 离线';
  return status.source === 'managed' ? '托管 helper 在线' : '外部 helper 在线';
}

function toolkitSourceLabel(source: DesktopToolkitStatus['source']): string {
  return {
    bundle: 'App 内置资源',
    environment: '环境变量指定',
    development: '开发目录',
    unavailable: '不可用',
  }[source];
}

type MetricCardProps = {
  icon: typeof Archive;
  label: string;
  tone: 'blue' | 'green' | 'yellow';
  value: string;
};

function MetricCard({ icon: Icon, label, tone, value }: MetricCardProps) {
  return (
    <section className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}>
        <Icon size={17} aria-hidden="true" />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PathRow({ label, onOpen, path }: { label: string; onOpen: (path: string) => Promise<void>; path: string }) {
  const canOpen = !path.startsWith('~');
  return (
    <div className="summary-row summary-row--action">
      <span>{label}</span>
      <strong>{path}</strong>
      <button className="icon-button" disabled={!canOpen} onClick={() => onOpen(path)} title={`打开${label}`} type="button">
        <FolderOpen size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function ConfigCheckList({ checks, compact = false }: { checks: ConfigCheck[]; compact?: boolean }) {
  return (
    <div className={compact ? 'check-list check-list--compact' : 'check-list'}>
      {checks.map((check) => {
        const Icon = check.status === 'ok' ? CheckCircle2 : TriangleAlert;
        return (
          <div className={`check-item check-item--${check.status}`} key={check.id}>
            <Icon size={15} aria-hidden="true" />
            <div>
              <strong>{check.label}</strong>
              <span>{check.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;
