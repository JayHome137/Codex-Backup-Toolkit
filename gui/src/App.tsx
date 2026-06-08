import { useEffect, useMemo, useState } from 'react';
import { Activity, Archive, CalendarCheck2, CheckCircle2, ClipboardCheck, Compass, Download, FolderOpen, KeyRound, Play, RotateCcw, Save, ShieldCheck, TimerReset, Trash2, TriangleAlert, UnlockKeyhole } from 'lucide-react';
import { Sidebar, type SectionId } from './components/Sidebar';
import { StatusBadge } from './components/StatusBadge';
import { buildBackupAction, buildLatestRestorePlanAction, buildRestorePlanAction, buildSyncLocalAuthoritativeAction } from './lib/actions';
import type { HelperAction } from './lib/actions';
import { TargetForm } from './components/TargetForm';
import { buildBackupAcceptance, type BackupAcceptance, type BackupAcceptanceCheck } from './lib/backupAcceptance';
import { buildBackupHealth, type BackupHealth } from './lib/backupHealth';
import { buildDailyUsageStatus, type DailyUsageCard, type DailyUsageStatus } from './lib/dailyUsageStatus';
import { buildFirstLaunchGuidance, type FirstLaunchGuidance } from './lib/firstLaunchGuidance';
import { buildFirstRunJourney, type FirstRunJourney, type FirstRunJourneyStep } from './lib/firstRunJourney';
import { buildFirstUsePath, type FirstUsePath, type FirstUsePathStep } from './lib/firstUsePath';
import { buildInstallReadiness, type InstallReadiness, type InstallReadinessStep } from './lib/installReadiness';
import { buildMacosReadiness, type MacosReadiness, type MacosReadinessItem } from './lib/macosReadiness';
import { createMockCommandRunner, type CommandResult } from './lib/commands';
import { createHelperApi, type AutomationStatus, type BackupHistoryEntry } from './lib/helperApi';
import { checkHelperHealth, createHttpHelperTransport } from './lib/helperProtocol';
import { createLocalBridgeRunner } from './lib/localBridge';
import { buildDoctorAdvice, type DoctorAdvice, type DoctorAdviceCard } from './lib/doctorAdvice';
import { parseDoctorOutput, type DoctorReport } from './lib/doctorReport';
import { createDesktopBridge, createDesktopHelperApi, createDesktopHelperTransport, getBackupArtifacts, type DesktopDiagnostics, type DesktopHelperStatus, type DesktopPaths, type DesktopToolkitStatus, type LocalPathStatus } from './lib/desktopBridge';
import { buildPostInstallExperience, type PostInstallExperience, type PostInstallItem } from './lib/postInstallExperience';
import { buildRestorePlanGuide, type RestorePlanGuide } from './lib/restorePlanGuide';
import { buildTargetSetupGuide, type TargetSetupGuide, type TargetSetupStep } from './lib/targetSetupGuide';
import {
  buildBackupCommand,
  buildDoctorCommand,
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
type HealthActionState = 'refresh' | null;
type DesktopActionState = 'diagnostics' | 'status' | 'start' | 'stop' | null;

type LocalSettingsSnapshot = {
  appPaths: LocalPathStatus[];
  capturedAt: string;
  config: BackupConfig;
  dataPaths: LocalPathStatus[];
  history: BackupHistoryEntry[];
  paths: DesktopPaths;
  warnings: string[];
};

type RunPreviewOptions = {
  refreshHelperHistory?: boolean;
};

type VisibleHistoryEntry = HistoryEntry & {
  outputPreview: string;
};

type FirstLaunchItem = {
  detail: string;
  id: string;
  label: string;
  status: 'ok' | 'warning';
};

type LocalSnapshotSummary = {
  existing: LocalPathStatus[];
  missing: LocalPathStatus[];
  total: number;
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

const appVersion = '0.36.5';

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>('latest');
  const [archivePath, setArchivePath] = useState('/path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz');
  const [restoreEncrypted, setRestoreEncrypted] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [history, setHistory] = useState<VisibleHistoryEntry[]>([]);
  const [helperHistory, setHelperHistory] = useState<BackupHistoryEntry[]>([]);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('mock');
  const [secretDraft, setSecretDraft] = useState<SecretDraft>(defaultSecretDraft(defaultConfig));
  const [helperStatus, setHelperStatus] = useState<HelperConnectionStatus>('unknown');
  const [helperAction, setHelperAction] = useState<HelperActionState>(null);
  const [healthAction, setHealthAction] = useState<HealthActionState>(null);
  const [helperMessage, setHelperMessage] = useState('尚未检查本机服务。需要保存配置、读取记录或执行备份时，请先确认本机服务已连接。');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [desktopHelperStatus, setDesktopHelperStatus] = useState<DesktopHelperStatus>({ managed: false, online: false, source: 'unavailable' });
  const [desktopToolkitStatus, setDesktopToolkitStatus] = useState<DesktopToolkitStatus>({ available: false, source: 'unavailable' });
  const [desktopDiagnostics, setDesktopDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [desktopAction, setDesktopAction] = useState<DesktopActionState>(null);
  const [desktopMessage, setDesktopMessage] = useState('桌面状态尚未检查。');
  const [localSnapshot, setLocalSnapshot] = useState<LocalSettingsSnapshot | null>(null);
  const [localSnapshotBusy, setLocalSnapshotBusy] = useState(false);
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
  const healthBusy = healthAction !== null;
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
  const backupAcceptance = useMemo(() => buildBackupAcceptance(helperHistory), [helperHistory]);
  const desktopPaths = desktopDiagnostics?.paths ?? fallbackDesktopPaths;
  const displayedAppVersion = desktopDiagnostics?.version ?? appVersion;
  const doctorAdvice = useMemo(() => buildDoctorAdvice(doctorReport, config), [config, doctorReport]);
  const backupHealth = useMemo(() => buildBackupHealth({
    automationStatus,
    config,
    configErrorCount: blockingChecks.length,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    history: helperHistory,
    now: new Date(),
  }), [automationStatus, blockingChecks.length, config, desktopHelperStatus.online, helperHistory, helperStatus]);
  const firstRunJourney = useMemo(() => buildFirstRunJourney({
    config,
    configErrorCount: blockingChecks.length,
    doctorReport,
    health: backupHealth,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    isDesktop: desktopBridge.isDesktop,
    toolkitAvailable: desktopToolkitStatus.available,
  }), [backupHealth, blockingChecks.length, config, desktopBridge.isDesktop, desktopHelperStatus.online, desktopToolkitStatus.available, doctorReport, helperStatus]);
  const postInstallExperience = useMemo(() => buildPostInstallExperience({
    appVersion: displayedAppVersion,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    isDesktop: desktopBridge.isDesktop,
    toolkitAvailable: desktopToolkitStatus.available,
  }), [desktopBridge.isDesktop, desktopHelperStatus.online, desktopToolkitStatus.available, displayedAppVersion, helperStatus]);
  const installReadiness = useMemo(() => buildInstallReadiness({
    appVersion: displayedAppVersion,
    backupAcceptance,
    doctorReady: doctorReport !== null && doctorReport.status !== 'error',
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    isDesktop: desktopBridge.isDesktop,
    toolkitAvailable: desktopToolkitStatus.available,
  }), [backupAcceptance, desktopBridge.isDesktop, desktopHelperStatus.online, desktopToolkitStatus.available, displayedAppVersion, doctorReport, helperStatus]);
  const targetSetupGuide = useMemo(() => buildTargetSetupGuide(config, configChecks), [config, configChecks]);
  const restorePlanGuide = useMemo(() => buildRestorePlanGuide(actions.restorePlan), [actions.restorePlan]);
  const firstUsePath = useMemo(() => buildFirstUsePath({
    backupAcceptance,
    doctorAdvice,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    installReadiness,
    targetSetupGuide,
  }), [backupAcceptance, desktopHelperStatus.online, doctorAdvice, helperStatus, installReadiness, targetSetupGuide]);
  const dailyUsageStatus = useMemo(() => buildDailyUsageStatus({
    firstUsePath,
    health: backupHealth,
  }), [backupHealth, firstUsePath]);
  const firstLaunchGuidance = useMemo(() => buildFirstLaunchGuidance({
    automationLoaded: Boolean(automationStatus?.loaded),
    backupAcceptance,
    backupHealth,
    doctorAdvice,
    firstUsePath,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    isDesktop: desktopBridge.isDesktop,
    targetSetupGuide,
    toolkitAvailable: desktopToolkitStatus.available,
  }), [automationStatus?.loaded, backupAcceptance, backupHealth, desktopBridge.isDesktop, desktopHelperStatus.online, desktopToolkitStatus.available, doctorAdvice, firstUsePath, helperStatus, targetSetupGuide]);
  const macosReadiness = useMemo(() => buildMacosReadiness({
    automationLoaded: Boolean(automationStatus?.loaded),
    backupAccepted: backupAcceptance.level === 'accepted',
    configPath: desktopPaths.configPath,
    helperOnline: helperStatus === 'online' || desktopHelperStatus.online,
    historyPath: desktopPaths.historyPath,
    isDesktop: desktopBridge.isDesktop,
    logDir: desktopPaths.logDir,
    releaseSmokeAvailable: true,
    toolkitAvailable: desktopToolkitStatus.available,
    version: displayedAppVersion,
  }), [automationStatus?.loaded, backupAcceptance.level, desktopBridge.isDesktop, desktopHelperStatus.online, desktopPaths.configPath, desktopPaths.historyPath, desktopPaths.logDir, desktopToolkitStatus.available, displayedAppVersion, helperStatus]);

  useEffect(() => {
    if (!desktopBridge.isDesktop) {
      setDesktopMessage('当前不是 Tauri 桌面环境，网页版仍可使用 HTTP helper 模式。');
      return;
    }

    const initializeDesktop = async () => {
      setRunnerMode('desktopHelper');
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
    setHistory((entries) => [{ command, label, result, outputPreview: simplifyRunOutput(result.output) }, ...entries].slice(0, 8));
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
    setHelperMessage('正在连接 127.0.0.1:37371 的本机服务...');
    setRunningCommand('GET http://127.0.0.1:37371/health');
    try {
      const health = await checkHelperHealth();
      setHelperStatus('online');
      setHelperMessage(`本机服务已连接：${health.host}`);
      setLastResult({
        status: 'success',
        output: [
          '本机服务已连接。',
          '',
          `协议: ${health.schema}`,
          `服务: ${health.helper}`,
          `主机: ${health.host}`,
          `状态: ${health.status === 'ok' ? '正常' : health.status}`,
        ].join('\n'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHelperStatus('offline');
      setHelperMessage('本机服务未连接。请先启动本机服务，然后重新检查连接。');
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
      setHelperMessage('本机服务已连接，已成功加载保存的配置。');
      setLastResult({ status: 'success', output: '已从本机服务加载保存的配置。' });
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
      setHelperMessage('本机服务已连接，配置已保存。');
      setLastResult({ status: 'success', output: '配置已保存到本机。敏感字段不会写入 config.json。' });
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
      setHelperMessage('本机服务已连接，密钥已写入 Keychain。');
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
      setHelperMessage('本机服务已连接，Keychain 密钥已删除。');
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
      setHelperMessage(`本机服务已连接，已读取 ${entries.length} 条备份记录。`);
      setLastResult({ status: 'success', output: `已加载 ${entries.length} 条备份记录。` });
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
      setHelperMessage('本机服务已连接，已读取定时备份状态。');
      setLastResult({ status: 'success', output: `已刷新自动化状态：${status.label} / ${status.loaded ? '已加载' : '未加载'}` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHelperAction(null);
      setRunningCommand(null);
    }
  };

  const readLocalSettingsSnapshot = async () => {
    setLocalSnapshotBusy(true);
    const warnings: string[] = [];
    let snapshotPaths = desktopPaths;
    let snapshotDataPaths = fallbackLocalDataPaths();
    let snapshotAppPaths = fallbackLocalAppPaths(snapshotPaths);

    try {
      const localContent = await desktopBridge.localContentSnapshot();
      snapshotPaths = localContent.paths;
      snapshotDataPaths = localContent.dataPaths;
      snapshotAppPaths = localContent.appPaths;
    } catch (error) {
      warnings.push(`本机路径检测失败，已显示默认路径：${shortErrorMessage(error)}`);
    }

    if (desktopBridge.isDesktop) {
      try {
        const diagnostics = await desktopBridge.desktopDiagnostics();
        setDesktopDiagnostics(diagnostics);
        applyDesktopStatus(diagnostics.helper);
        setDesktopToolkitStatus(diagnostics.toolkit);
        snapshotPaths = diagnostics.paths;
      } catch (error) {
        warnings.push(`桌面状态刷新失败，本机路径检测结果仍可使用：${shortErrorMessage(error)}`);
      }
    }

    setLocalSnapshot({
      appPaths: snapshotAppPaths,
      capturedAt: new Date().toISOString(),
      config,
      dataPaths: snapshotDataPaths,
      history: helperHistory,
      paths: snapshotPaths,
      warnings,
    });
    setLastResult({
      status: warnings.length === 0 ? 'success' : 'warning',
      output: warnings.length === 0
        ? '已完成本机内容检测。这个操作只读取路径状态、配置摘要和历史摘要，不执行备份或恢复。'
        : ['已完成本机内容检测，但有部分附加信息未读取：', '', ...warnings].join('\n'),
    });
    setLocalSnapshotBusy(false);
  };

  const refreshBackupHealth = async () => {
    setHealthAction('refresh');
    setRunningCommand('GET /history + GET /automation');
    try {
      const [entries, status] = await Promise.all([
        helperApi.loadHistory(),
        helperApi.loadAutomationStatus(),
      ]);
      setHelperHistory(entries);
      setAutomationStatus(status);
      setHelperStatus('online');
      setHelperMessage(`已刷新健康状态：${entries.length} 条历史，自动化 ${status.loaded ? '已加载' : '未加载'}。`);
      setLastResult({ status: 'success', output: `已刷新健康状态：${entries.length} 条历史，自动化 ${status.loaded ? '已加载' : '未加载'}。` });
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult({ status: 'error', output: helperErrorOutput(error) });
    } finally {
      setHealthAction(null);
      setRunningCommand(null);
    }
  };

  const refreshHelperHistoryAfterBackup = async () => {
    try {
      const entries = await helperApi.loadHistory();
      setHelperHistory(entries);
      setHelperStatus('online');
      setHelperMessage(`备份完成，已自动刷新 ${entries.length} 条备份记录。`);
    } catch (error) {
      updateHelperFailureState(error);
      setLastResult((result) => result
        ? { ...result, output: `${result.output}\n\n备份已完成，但自动刷新备份记录失败：\n${helperErrorOutput(error)}` }
        : { status: 'warning', output: helperErrorOutput(error) });
    }
  };

  const updateHelperFailureState = (error: unknown) => {
    const output = helperErrorOutput(error);
    if (output.includes('ERR_HELPER_UNAVAILABLE')) {
      setHelperStatus('offline');
      setHelperMessage('本机服务未连接。请先启动本机服务，然后重新检查连接。');
      return;
    }

    setHelperStatus('online');
    setHelperMessage('本机服务已响应，但本次操作失败。请查看记录里的错误详情。');
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
            `本机服务: ${desktopHelperStatusLabel(diagnostics.helper)}`,
            `内置资源: ${diagnostics.toolkit.available ? '可用' : '不可用'}`,
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
    setHelperMessage(status.online ? desktopStatusMessage(status) : status.lastError ?? '本机服务未连接。');
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
            <StatusBadge status={status} label={statusLabel(status)} />
          </div>
        </header>

        {activeSection === 'overview' && (
          <section className="view-stack">
            <div className="metric-grid">
              <MetricCard icon={Archive} label="存储位置" value={targetLabels[config.target]} tone="blue" />
              <MetricCard icon={ShieldCheck} label="完整性" value={latestBackupEntry ? '有备份记录' : '等待首次备份'} tone="green" />
              <MetricCard icon={CalendarCheck2} label="定时备份" value="03:00 / 每 3 天" tone="yellow" />
            </div>

            <LocalSettingsSnapshotPanel
              busy={localSnapshotBusy}
              onCopy={copyText}
              onOpen={openBackupPath}
              onRead={readLocalSettingsSnapshot}
              snapshot={localSnapshot}
            />

            <StorageLocationPanel
              config={config}
              configErrorCount={blockingChecks.length}
              onOpenStorage={() => setActiveSection('targets')}
              onRunDoctor={() => runPreview(commands.doctor, '保存位置检查')}
              runningDoctor={runningCommand === commands.doctor}
            />

            <OverviewStatusPanel
              backupAcceptance={backupAcceptance}
              configErrorCount={blockingChecks.length}
              latestBackupEntry={latestBackupEntry}
              onOpenBackup={() => setActiveSection('backup')}
              onOpenRestore={() => setActiveSection('restore')}
              onOpenStorage={() => setActiveSection('targets')}
              onOpenRecords={() => setActiveSection('logs')}
              storageLabel={targetLabels[config.target]}
            />
          </section>
        )}

        {activeSection === 'backup' && (
          <section className="view-stack">
            <section className="panel readiness-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>备份本机数据</span>
                </div>
                <StatusBadge status={blockingChecks.length === 0 ? 'success' : 'error'} label={blockingChecks.length === 0 ? '可备份' : '配置未完成'} />
              </div>
              <div className="readiness-layout">
                <div className="summary-list">
                  <SummaryRow label="备份内容" value="Codex 配置、状态、插件、记录和工作区数据" />
                  <SummaryRow label="存储位置" value={targetLabels[config.target]} />
                  <SummaryRow label="加密" value={config.encrypt ? '已开启 age 加密' : '未开启'} />
                  <SummaryRow label="保留策略" value={`${config.retentionCount} 份 / ${config.retentionDays} 天`} />
                </div>
                <div className="readiness-copy">
                  <strong>先确认，再执行</strong>
                  <p>备份会生成时间戳归档、sha256 校验和 manifest。完成后可在记录页查看结果，并在恢复页生成恢复前检查。</p>
                  <div className="action-row">
                    <button className="button button--tertiary" disabled={blockingChecks.length > 0 || helperBusy} onClick={() => setBackupConfirmed(true)} type="button">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      确认备份内容
                    </button>
                    <button className="button button--primary" disabled={realBackupDisabled} onClick={runConfirmedBackup} type="button">
                      <Archive size={15} aria-hidden="true" />
                      立即备份
                    </button>
                    <button className="button button--tertiary" onClick={() => setActiveSection('targets')} type="button">修改存储位置</button>
                  </div>
                </div>
              </div>
              <ConfigCheckList checks={configChecks} compact />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <TimerReset size={16} aria-hidden="true" />
                  <span>本地为准同步</span>
                </div>
              </div>
              <div className="summary-list">
                <SummaryRow label="规则" value="本地数据永远优先" />
                <SummaryRow label="频率" value={`每 ${config.syncCheckIntervalHours} 小时检查 / 最短 ${config.syncMinBackupIntervalHours} 小时生成新备份`} />
                <SummaryRow label="归档" value="不覆盖旧备份，按时间戳生成并套用保留策略" />
                <SummaryRow label="存储位置" value={syncTargetSupported ? '当前存储位置支持一致性检查' : '当前先支持本地目录和 NAS'} />
              </div>
              <p className="muted-copy">这个功能用于定期发现本机和备份位置不一致的情况；发现不一致时生成新备份，不会从备份反向覆盖本机。</p>
              <div className="action-row">
                <button className="button button--tertiary" disabled={!syncTargetSupported || helperBusy} onClick={runSyncCheck} type="button">
                  <ShieldCheck size={15} aria-hidden="true" />
                  检查一致性
                </button>
                <button className="button button--primary" disabled={realRunnerMode ? realSyncDisabled : !syncTargetSupported || helperBusy} onClick={runLocalAuthoritativeSync} type="button">
                  <TimerReset size={15} aria-hidden="true" />
                  生成同步备份
                </button>
              </div>
            </section>
          </section>
        )}

        {activeSection === 'guide' && (
          <section className="view-stack">
            <FirstRunJourneyPanel
              firstUsePath={firstUsePath}
              journey={firstRunJourney}
              onOpenInstall={() => setActiveSection('install')}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenOverview={() => setActiveSection('overview')}
              onOpenRestore={() => setActiveSection('restore')}
              onOpenSettings={() => setActiveSection('settings')}
              onOpenTargets={() => setActiveSection('targets')}
              onRefreshHealth={refreshBackupHealth}
              onRunDoctor={() => runPreview(commands.doctor, '环境检查命令')}
              refreshing={healthBusy}
              runningDoctor={runningCommand === commands.doctor}
            />
            <TargetDoctorPanel report={doctorReport} />
            <DoctorAdvicePanel advice={doctorAdvice} />
          </section>
        )}

        {activeSection === 'install' && (
          <section className="view-stack">
            <PostInstallPanel
              experience={postInstallExperience}
              installReadiness={installReadiness}
              onCopy={copyText}
              onOpenGuide={() => setActiveSection('guide')}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenRestore={() => setActiveSection('restore')}
              onOpenSettings={() => setActiveSection('settings')}
              onOpenTargets={() => setActiveSection('targets')}
            />
            <DesktopReadinessPanel
              appVersion={displayedAppVersion}
              helperStatus={desktopHelperStatus}
              isDesktop={desktopBridge.isDesktop}
              onOpenSettings={() => setActiveSection('settings')}
              paths={desktopPaths}
              toolkitStatus={desktopToolkitStatus}
            />
          </section>
        )}

        {activeSection === 'health' && (
          <section className="view-stack">
            <DailyUsageStatusPanel
              onOpenHealth={refreshBackupHealth}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenTargets={() => setActiveSection('targets')}
              status={dailyUsageStatus}
            />
            <BackupHealthPanel
              health={backupHealth}
              onRefresh={refreshBackupHealth}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenSchedule={() => setActiveSection('schedule')}
              onOpenSettings={() => setActiveSection('settings')}
              onOpenTargets={() => setActiveSection('targets')}
              refreshing={healthBusy}
            />
          </section>
        )}

        {activeSection === 'diagnostics' && (
          <section className="view-stack">
            <MacosDiagnosticsPanel
              diagnostics={desktopDiagnostics}
              helperStatus={desktopHelperStatus}
              onOpenOverview={() => setActiveSection('overview')}
              onOpenLogs={() => setActiveSection('logs')}
              onOpenSchedule={() => setActiveSection('schedule')}
              onOpenSettings={() => setActiveSection('settings')}
              onRefreshDiagnostics={() => refreshDesktopDiagnostics()}
              paths={desktopPaths}
              readiness={macosReadiness}
              refreshing={desktopAction === 'diagnostics'}
              toolkitStatus={desktopToolkitStatus}
            />
          </section>
        )}

        {activeSection === 'targets' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>存储位置</span>
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
            <TargetSetupGuidePanel
              guide={targetSetupGuide}
              onRunDoctor={() => runPreview(commands.doctor, '保存位置检查')}
              runningDoctor={runningCommand === commands.doctor}
            />
            <TargetDoctorPanel report={doctorReport} />
            <DoctorAdvicePanel advice={doctorAdvice} />
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
              <p className="muted-copy">当前只生成恢复前检查清单，不执行真实恢复，也不会写入或覆盖本机文件。</p>
              <div className="action-row">
                <button className="button button--tertiary" onClick={() => runPreview(commands.restore, '恢复预案', actions.restorePlan)} type="button">
                  <RotateCcw size={15} aria-hidden="true" />
                  生成预案
                </button>
              </div>
            </section>
            <RestorePlanGuidePanel guide={restorePlanGuide} />
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
                <code>{runningCommand ? `${helperActionLabel ?? '任务'}正在运行...` : lastResult ? simplifyRunOutput(lastResult.output) : '还没有运行任何任务。'}</code>
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
            <BackupAcceptancePanel acceptance={backupAcceptance} onOpenRestore={() => setActiveSection('restore')} />
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
                      <code>{entry.outputPreview}</code>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>备份记录</span>
                </div>
              </div>
              <div className="history-list">
                {helperHistory.length === 0 ? (
                  <p className="muted-copy">还没有从本机加载备份记录。</p>
                ) : (
                  helperHistory.map((entry) => <HelperHistoryItem entry={entry} key={`${entry.startedAt}-${entry.target}-${entry.exitCode}`} />)
                )}
              </div>
            </section>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>应用设置</span>
                </div>
                <StatusBadge status="success" label={displayedAppVersion} />
              </div>
              <div className="summary-list">
                <SummaryRow label="版本" value={displayedAppVersion} />
                <SummaryRow label="保存位置" value={targetLocationSummary(config)} />
                <SummaryRow label="保留策略" value={`${config.retentionCount} 份 / ${config.retentionDays} 天`} />
                <PathRow label="备份记录" path={desktopPaths.historyPath} onOpen={openDesktopPath} />
                <PathRow label="应用数据" path={desktopPaths.appSupportDir} onOpen={openDesktopPath} />
              </div>
              <div className="action-row">
                <button className="button button--primary" onClick={() => setActiveSection('targets')} type="button">
                  <FolderOpen size={15} aria-hidden="true" />
                  修改保存位置
                </button>
                <button className="button button--tertiary" onClick={() => setActiveSection('logs')} type="button">查看备份记录</button>
              </div>
            </section>
            <details className="details-panel settings-advanced">
              <summary>高级诊断</summary>
              <p className="muted-copy">这些信息用于本机排查和开发验证，普通备份流程不需要调整。</p>
              <div className="action-row">
                <button className="button button--tertiary" onClick={() => setActiveSection('guide')} type="button">首启引导</button>
                <button className="button button--tertiary" onClick={() => setActiveSection('install')} type="button">安装验证</button>
                <button className="button button--tertiary" onClick={() => setActiveSection('health')} type="button">健康检查</button>
                <button className="button button--tertiary" onClick={() => setActiveSection('diagnostics')} type="button">macOS 诊断</button>
                <button className="button button--tertiary" onClick={() => setActiveSection('schedule')} type="button">定时备份状态</button>
              </div>
              <RuntimeModePanel
                mode={runnerMode}
                onSelect={(mode) => {
                  setRunnerMode(mode);
                  if (mode === 'desktopHelper') void refreshDesktopHelperStatus({ autoStart: true });
                }}
              />
              <FirstLaunchChecklist
                helperStatus={desktopHelperStatus}
                isDesktop={desktopBridge.isDesktop}
                paths={desktopPaths}
                toolkitStatus={desktopToolkitStatus}
              />
            </details>
            <details className="details-panel settings-advanced">
              <summary>本机运行诊断</summary>
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>本机服务</span>
                </div>
                <StatusBadge status={desktopHelperStatus.online ? 'success' : 'warning'} label={desktopHelperStatusLabel(desktopHelperStatus)} />
              </div>
              <div className="summary-list">
                <SummaryRow label="连接状态" value={helperStatusLabel(helperStatus)} />
                <SummaryRow label="状态" value={desktopHelperStatus.online ? '在线' : '离线'} />
                <SummaryRow label="来源" value={desktopSourceLabel(desktopHelperStatus.source)} />
                <SummaryRow label="端口" value={String(desktopHelperStatus.port ?? 37371)} />
                <SummaryRow label="托管" value={desktopHelperStatus.managed ? '由桌面 App 启动' : '未由桌面 App 托管'} />
              </div>
              <p className="muted-copy">{desktopMessage}</p>
              <div className="action-row">
                <button className="button button--tertiary" disabled={desktopAction !== null || helperBusy} onClick={checkHelper} type="button">
                  <Activity size={15} aria-hidden="true" />
                  {desktopAction === 'status' || helperStatus === 'checking' ? '刷新中' : '刷新状态'}
                </button>
                <button className="button button--primary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={startDesktopHelper} type="button">
                  <Play size={15} aria-hidden="true" />
                  {desktopAction === 'start' ? '启动中' : '启动服务'}
                </button>
                <button className="button button--tertiary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={stopDesktopHelper} type="button">
                  <Trash2 size={15} aria-hidden="true" />
                  {desktopAction === 'stop' ? '停止中' : '停止服务'}
                </button>
                <button className="button button--tertiary" disabled={!desktopBridge.isDesktop} onClick={refreshDesktopToolkitStatus} type="button">
                  <ShieldCheck size={15} aria-hidden="true" />
                  检查内置资源
                </button>
                <button className="button button--tertiary" disabled={desktopAction !== null || !desktopBridge.isDesktop} onClick={() => refreshDesktopDiagnostics()} type="button">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {desktopAction === 'diagnostics' ? '诊断中' : '刷新高级诊断'}
                </button>
              </div>
            </details>
            <details className="details-panel settings-advanced">
              <summary>内置资源和路径</summary>
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>高级诊断：内置资源</span>
                </div>
                <StatusBadge status={desktopToolkitStatus.available ? 'success' : 'warning'} label={desktopToolkitStatus.available ? '可用' : '不可用'} />
              </div>
              <div className="summary-list">
                <SummaryRow label="来源" value={toolkitSourceLabel(desktopToolkitStatus.source)} />
                <SummaryRow label="根目录" value={desktopToolkitStatus.rootPath ?? '未定位'} />
                <SummaryRow label="本机服务入口" value={desktopToolkitStatus.helperPath ?? '未定位'} />
                <SummaryRow label="脚本" value={desktopToolkitStatus.scriptsPath ?? '未定位'} />
              </div>
              {desktopToolkitStatus.lastError && <p className="muted-copy">{desktopToolkitStatus.lastError}</p>}
              <div className="action-row">
                <button className="button button--tertiary" disabled={!desktopBridge.isDesktop || !desktopToolkitStatus.rootPath} onClick={() => desktopToolkitStatus.rootPath && openDesktopPath(desktopToolkitStatus.rootPath)} type="button">
                  <FolderOpen size={15} aria-hidden="true" />
                  打开资源目录
                </button>
              </div>
              <hr className="settings-divider" />
              <div className="summary-list">
                <PathRow label="配置" path={desktopPaths.configPath} onOpen={openDesktopPath} />
                <PathRow label="历史" path={desktopPaths.historyPath} onOpen={openDesktopPath} />
                <PathRow label="配置目录" path={desktopPaths.appSupportDir} onOpen={openDesktopPath} />
                <PathRow label="自动化标准输出" path={desktopPaths.automationStdoutLogPath} onOpen={openDesktopPath} />
                <PathRow label="自动化错误输出" path={desktopPaths.automationStderrLogPath} onOpen={openDesktopPath} />
                <PathRow label="本机服务输出" path={desktopPaths.desktopHelperStdoutLogPath} onOpen={openDesktopPath} />
                <PathRow label="本机服务错误" path={desktopPaths.desktopHelperStderrLogPath} onOpen={openDesktopPath} />
                <PathRow label="日志目录" path={desktopPaths.logDir} onOpen={openDesktopPath} />
              </div>
            </details>
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
      '本机服务当前不可用。',
      '请先启动桌面 App 内置服务，或在开发环境运行 `node helper/server.mjs`，再回到 GUI 点击“重新检查”。',
      '',
      message,
    ].join('\n');
  }

  if (message.includes('ERR_HELPER_FAILED')) {
    return [
      'ERR_HELPER_FAILED',
      '',
      '本机服务已响应，但本次操作没有成功。',
      '请根据下方错误信息检查配置、权限或 Keychain 输入。',
      '',
      message,
    ].join('\n');
  }

  return message;
}

function simplifyRunOutput(output: string): string {
  const cleanedLines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0
        && trimmed !== 'undefined'
        && !trimmed.startsWith('命令：')
        && !trimmed.startsWith('协议:')
        && !trimmed.startsWith('命令类型:')
        && !trimmed.startsWith('审计信息')
        && !trimmed.startsWith('请求 ID:')
        && !trimmed.startsWith('决策:')
        && !trimmed.startsWith('服务:')
        && !trimmed.startsWith('退出码:')
        && !trimmed.startsWith('codexbackup ')
        && !trimmed.startsWith('codexrestore ')
        && !trimmed.startsWith('./scripts/')
        && !trimmed.startsWith('CODEX_BACKUP_')
        && !trimmed.startsWith('GET http://127.0.0.1')
        && !trimmed.startsWith('PUT http://127.0.0.1')
        && !trimmed.startsWith('POST http://127.0.0.1')
        && !trimmed.startsWith('DELETE http://127.0.0.1');
    });

  return cleanedLines.slice(0, 8).join('\n') || '任务已结束。';
}

function shortErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

function fallbackLocalDataPaths(): LocalPathStatus[] {
  return [
    { label: 'Codex 配置目录', path: '~/.codex', exists: false, kind: 'missing' },
    { label: 'Codex 应用数据', path: '~/Library/Application Support/Codex', exists: false, kind: 'missing' },
    { label: 'OpenAI 应用数据', path: '~/Library/Application Support/OpenAI', exists: false, kind: 'missing' },
    { label: 'OpenAI Codex 数据', path: '~/Library/Application Support/OpenAI/Codex', exists: false, kind: 'missing' },
    { label: 'Codex 桌面容器', path: '~/Library/Application Support/com.openai.codex', exists: false, kind: 'missing' },
    { label: 'Codex 工作区', path: '~/Documents/Codex', exists: false, kind: 'missing' },
  ];
}

function fallbackLocalAppPaths(paths: DesktopPaths): LocalPathStatus[] {
  return [
    { label: '配置文件', path: paths.configPath, exists: false, kind: 'missing' },
    { label: '历史文件', path: paths.historyPath, exists: false, kind: 'missing' },
    { label: '应用配置目录', path: paths.appSupportDir, exists: false, kind: 'missing' },
    { label: '日志目录', path: paths.logDir, exists: false, kind: 'missing' },
    { label: '自动化标准输出', path: paths.automationStdoutLogPath, exists: false, kind: 'missing' },
    { label: '自动化错误输出', path: paths.automationStderrLogPath, exists: false, kind: 'missing' },
  ];
}

function targetLocationSummary(config: BackupConfig): string {
  if (config.target === 'local') return config.localDir;
  if (config.target === 'smb') return `smb://${config.smbHost}/${config.smbShare}`;
  if (config.target === 'webdav') return config.webdavUrl;
  return config.rcloneRemote;
}

function RuntimeModePanel({
  mode,
  onSelect,
}: {
  mode: RunnerMode;
  onSelect: (mode: RunnerMode) => void;
}) {
  return (
    <div className="runtime-mode-panel">
      <div>
        <strong>开发运行模式</strong>
        <p className="muted-copy">普通使用不需要调整；这里只保留给本地验证、开发连接和桌面桥接排查。</p>
      </div>
      <div className="mode-switch" role="group" aria-label="开发运行模式">
        <button className={mode === 'mock' ? 'segment segment--active' : 'segment'} onClick={() => onSelect('mock')} type="button">
          预览
        </button>
        <button className={mode === 'localBridge' ? 'segment segment--active' : 'segment'} onClick={() => onSelect('localBridge')} type="button">
          本机
        </button>
        <button className={mode === 'httpHelper' ? 'segment segment--active' : 'segment'} onClick={() => onSelect('httpHelper')} type="button">
          开发连接
        </button>
        <button className={mode === 'desktopHelper' ? 'segment segment--active' : 'segment'} onClick={() => onSelect('desktopHelper')} type="button">
          桌面 App
        </button>
      </div>
    </div>
  );
}

function OverviewStatusPanel({
  backupAcceptance,
  configErrorCount,
  latestBackupEntry,
  onOpenBackup,
  onOpenRecords,
  onOpenRestore,
  onOpenStorage,
  storageLabel,
}: {
  backupAcceptance: BackupAcceptance;
  configErrorCount: number;
  latestBackupEntry: BackupHistoryEntry | null;
  onOpenBackup: () => void;
  onOpenRecords: () => void;
  onOpenRestore: () => void;
  onOpenStorage: () => void;
  storageLabel: string;
}) {
  const backupReady = configErrorCount === 0;
  const integrityLabel = backupAcceptance.level === 'accepted' ? '已验证' : latestBackupEntry ? '待复核' : '待备份';
  const nextAction = configErrorCount > 0
    ? '先完善存储位置'
    : latestBackupEntry
      ? '查看记录或准备恢复'
      : '执行第一次备份';

  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Archive size={16} aria-hidden="true" />
          <span>当前备份状态</span>
        </div>
        <StatusBadge status={backupReady ? 'success' : 'warning'} label={nextAction} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="存储位置" value={storageLabel} />
          <SummaryRow label="完整性" value={integrityLabel} />
          <SummaryRow label="最近备份" value={latestBackupEntry?.archivePaths[0] ?? '尚无记录'} />
          <SummaryRow label="下一步" value={nextAction} />
        </div>
        <div className="readiness-copy">
          <strong>{nextAction}</strong>
          <p>这里显示最近一次备份和下一步动作。归档、校验文件和清单等详细结果统一放在记录页。</p>
          <div className="action-row">
            <button className="button button--primary" onClick={configErrorCount > 0 ? onOpenStorage : onOpenBackup} type="button">
              <Archive size={15} aria-hidden="true" />
              {configErrorCount > 0 ? '设置存储位置' : '开始备份'}
            </button>
            <button className="button button--tertiary" onClick={onOpenStorage} type="button">存储位置</button>
            <button className="button button--tertiary" onClick={onOpenRecords} type="button">备份记录</button>
            <button className="button button--tertiary" onClick={onOpenRestore} type="button">恢复</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorageLocationPanel({
  config,
  configErrorCount,
  onOpenStorage,
  onRunDoctor,
  runningDoctor,
}: {
  config: BackupConfig;
  configErrorCount: number;
  onOpenStorage: () => void;
  onRunDoctor: () => Promise<void>;
  runningDoctor: boolean;
}) {
  const storageReady = configErrorCount === 0;
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Archive size={16} aria-hidden="true" />
          <span>备份保存位置</span>
        </div>
        <StatusBadge status={storageReady ? 'success' : 'error'} label={storageReady ? '已配置' : '需完善'} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="类型" value={targetLabels[config.target]} />
          <SummaryRow label="位置" value={targetLocationSummary(config)} />
          <SummaryRow label="保留" value={`${config.retentionCount} 份 / ${config.retentionDays} 天`} />
          <SummaryRow label="加密" value={config.encrypt ? '已开启' : '未开启'} />
        </div>
        <div className="readiness-copy">
          <strong>{storageReady ? '保存位置已填写' : '先完善保存位置'}</strong>
          <p>这里决定备份归档保存到哪里。可以是本地目录、NAS、WebDAV 或后续云盘方案。</p>
          <div className="action-row">
            <button className="button button--primary" onClick={onOpenStorage} type="button">
              <FolderOpen size={15} aria-hidden="true" />
              修改保存位置
            </button>
            <button className="button button--tertiary" disabled={!storageReady || runningDoctor} onClick={() => void onRunDoctor()} type="button">
              <ShieldCheck size={15} aria-hidden="true" />
              {runningDoctor ? '检查中' : '检查保存位置'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LocalSettingsSnapshotPanel({
  busy,
  onCopy,
  onOpen,
  onRead,
  snapshot,
}: {
  busy: boolean;
  onCopy: (text: string) => Promise<void>;
  onOpen: (path: string) => Promise<void>;
  onRead: () => Promise<void>;
  snapshot: LocalSettingsSnapshot | null;
}) {
  const latestEntry = snapshot?.history.find((entry) => entry.action === 'backup' || entry.action === 'syncLocalAuthoritative') ?? null;
  const latestArchive = latestEntry?.archivePaths[0] ?? '尚无备份记录';
  const snapshotSummary = snapshot ? summarizeLocalSnapshot(snapshot) : null;

  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <FolderOpen size={16} aria-hidden="true" />
          <span>本机内容检测</span>
        </div>
        <button className="button button--primary" disabled={busy} onClick={() => void onRead()} type="button">
          <FolderOpen size={15} aria-hidden="true" />
          {busy ? '检测中' : '一键检测本机内容'}
        </button>
      </div>
      {!snapshot ? (
        <p className="muted-copy">点击后只检测本机可备份内容和应用保存位置；不会执行备份、恢复，也不会修改定时任务。</p>
      ) : (
        <div className="snapshot-summary-layout">
          <div className="summary-list">
            <SummaryRow label="检测时间" value={formatDateTime(snapshot.capturedAt)} />
            <SummaryRow label="可备份内容" value={snapshotSummary ? `${snapshotSummary.existing.length} 项已发现` : '未检测'} />
            <SummaryRow label="未发现内容" value={snapshotSummary ? `${snapshotSummary.missing.length} 项` : '未检测'} />
            <SummaryRow label="备份保存位置" value={targetLocationSummary(snapshot.config)} />
            <SummaryRow label="保留策略" value={`${snapshot.config.retentionCount} 份 / ${snapshot.config.retentionDays} 天`} />
            <SummaryRow label="完整性" value="备份后生成 sha256 和 manifest" />
            <SummaryRow label="最近备份" value={latestArchive} />
          </div>
          <div className="snapshot-sections">
            {snapshotSummary && <SnapshotSummaryCards summary={snapshotSummary} />}
            <details className="details-panel">
              <summary>查看详细路径</summary>
              <SnapshotPathGroup title="本机数据位置" paths={snapshot.dataPaths} onCopy={onCopy} onOpen={onOpen} />
              <SnapshotPathGroup title="应用保存目录" paths={snapshot.appPaths} onCopy={onCopy} onOpen={onOpen} />
            </details>
            {snapshot.warnings.length > 0 && (
              <div className="check-list check-list--compact">
                {snapshot.warnings.map((warning) => (
                  <div className="check-item check-item--warning" key={warning}>
                    <TriangleAlert size={15} aria-hidden="true" />
                    <div>
                      <strong>读取提示</strong>
                      <span>{warning}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SnapshotPathGroup({
  onCopy,
  onOpen,
  paths,
  title,
}: {
  onCopy: (text: string) => Promise<void>;
  onOpen: (path: string) => Promise<void>;
  paths: LocalPathStatus[];
  title: string;
}) {
  return (
    <div className="snapshot-path-group">
      <strong>{title}</strong>
      <div className="artifact-list">
        {paths.map((item) => (
          <div className="artifact-row artifact-row--path-status" key={`${item.label}-${item.path}`}>
            <span>{item.label}</span>
            <code>{item.path}</code>
            <div className="artifact-actions">
              <span className={`path-status path-status--${item.exists ? 'ok' : 'missing'}`}>{pathStatusLabel(item)}</span>
              <button className="button button--tertiary" onClick={() => void onCopy(item.path)} type="button">复制</button>
              <button className="button button--tertiary" disabled={item.path.startsWith('~')} onClick={() => void onOpen(item.path)} type="button">
                <FolderOpen size={14} aria-hidden="true" />
                打开
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function summarizeLocalSnapshot(snapshot: LocalSettingsSnapshot): LocalSnapshotSummary {
  const items = snapshot.dataPaths;
  return {
    existing: items.filter((item) => item.exists),
    missing: items.filter((item) => !item.exists),
    total: items.length,
  };
}

function SnapshotSummaryCards({ summary }: { summary: LocalSnapshotSummary }) {
  const visibleExisting = summary.existing.slice(0, 4);
  const visibleMissing = summary.missing.slice(0, 4);

  return (
    <div className="snapshot-summary-cards">
      <div className="snapshot-summary-card snapshot-summary-card--ok">
        <strong>{summary.existing.length} 项已发现</strong>
        <span>{visibleExisting.length > 0 ? visibleExisting.map((item) => item.label).join('、') : '还没有发现可备份内容'}</span>
      </div>
      <div className="snapshot-summary-card snapshot-summary-card--missing">
        <strong>{summary.missing.length} 项未发现</strong>
        <span>{visibleMissing.length > 0 ? visibleMissing.map((item) => item.label).join('、') : '主要位置都已发现'}</span>
      </div>
    </div>
  );
}

function pathStatusLabel(item: LocalPathStatus): string {
  if (!item.exists) return '未发现';
  if (item.kind === 'directory') return '目录存在';
  if (item.kind === 'file') return '文件存在';
  return '已发现';
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
  onRefresh,
  onOpenLogs,
  onOpenSchedule,
  onOpenSettings,
  onOpenTargets,
  refreshing,
}: {
  health: BackupHealth;
  onRefresh: () => void;
  onOpenLogs: () => void;
  onOpenSchedule: () => void;
  onOpenSettings: () => void;
  onOpenTargets: () => void;
  refreshing: boolean;
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
            <SummaryRow label="最近归档" value={health.latestBackup?.archivePath ?? '尚无归档记录'} />
            <SummaryRow label="完成时间" value={health.latestBackup ? formatDateTime(health.latestBackup.finishedAt) : '尚无记录'} />
            <SummaryRow label="检查项" value={`${health.items.length} 项`} />
            <SummaryRow label="下一步" value={health.nextActions[0] ?? '保持当前备份节奏'} />
          </div>
          <div className="readiness-copy">
            <strong>只读健康视图</strong>
            <p>这里聚合本机服务、配置、历史、自动化和一致性检查状态，只做展示和跳转，不会执行真实恢复、安装、卸载或修改已有定时任务。</p>
            <div className="action-row">
              <button className="button button--primary" disabled={refreshing} onClick={onRefresh} type="button">
                <RotateCcw size={15} aria-hidden="true" />
                {refreshing ? '刷新中' : '刷新健康状态'}
              </button>
              <button className="button button--tertiary" onClick={onOpenTargets} type="button">打开目标端</button>
              <button className="button button--tertiary" onClick={onOpenLogs} type="button">打开日志</button>
              <button className="button button--tertiary" onClick={onOpenSchedule} type="button">打开计划</button>
              <button className="button button--tertiary" onClick={onOpenSettings} type="button">打开设置</button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--compact">
        <div className="panel-header">
          <div className="panel-title">
            <Archive size={16} aria-hidden="true" />
            <span>最近备份摘要</span>
          </div>
          <StatusBadge status={health.latestBackup?.status === 'success' ? 'success' : health.latestBackup ? 'error' : 'warning'} label={health.latestBackup ? health.latestBackup.actionLabel : '无历史'} />
        </div>
        <div className="summary-list">
          <SummaryRow label="目标端" value={health.latestBackup?.target ?? '尚无记录'} />
          <SummaryRow label="状态" value={health.latestBackup ? backupResultStatusLabel(health.latestBackup.status) : '尚无记录'} />
          <SummaryRow label="退出码" value={health.latestBackup ? String(health.latestBackup.exitCode) : '尚无记录'} />
          <SummaryRow label="时间差" value={health.latestBackup?.ageHours === null || health.latestBackup?.ageHours === undefined ? '无法计算' : `约 ${health.latestBackup.ageHours} 小时前`} />
          <SummaryRow label="归档路径" value={health.latestBackup?.archivePath ?? '尚无归档记录'} />
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

function DailyUsageStatusPanel({
  onOpenHealth,
  onOpenLogs,
  onOpenTargets,
  status,
}: {
  onOpenHealth: () => void | Promise<void>;
  onOpenLogs: () => void;
  onOpenTargets: () => void;
  status: DailyUsageStatus;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={16} aria-hidden="true" />
          <span>日常使用状态</span>
        </div>
        <StatusBadge status={dailyUsageStatusBadge(status.level)} label={dailyUsageStatusLevelLabel(status.level)} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="结论" value={status.summary} />
          <SummaryRow label="下一步" value={status.primaryAction} />
          <SummaryRow label="安全边界" value={status.safetyNote} />
        </div>
        <div className="readiness-copy">
          <strong>日常备份判断</strong>
          <p>这个状态汇总首次真实使用路径、最近备份、健康度和自动化读取结果，只提示当前是否适合进入日常节奏。</p>
          <div className="action-row">
            <button className="button button--primary" onClick={() => void onOpenHealth()} type="button">
              <RotateCcw size={15} aria-hidden="true" />
              日常刷新
            </button>
            <button className="button button--tertiary" onClick={onOpenLogs} type="button">日常记录</button>
            <button className="button button--tertiary" onClick={onOpenTargets} type="button">日常配置</button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {status.cards.map((card) => <DailyUsageCardItem card={card} key={card.id} />)}
      </div>
    </section>
  );
}

function DailyUsageCardItem({ card }: { card: DailyUsageCard }) {
  const Icon = card.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${card.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{card.label}</strong>
        <span>{card.detail}</span>
      </div>
    </div>
  );
}

function FirstLaunchGuidancePanel({
  guidance,
  onAction,
  runningDoctor,
}: {
  guidance: FirstLaunchGuidance;
  onAction: () => void;
  runningDoctor: boolean;
}) {
  const buttonDisabled = guidance.id === 'run-doctor' && runningDoctor;
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>首次打开推荐</span>
        </div>
        <StatusBadge status={firstLaunchGuidanceStatus(guidance.level)} label={firstLaunchGuidanceLevelLabel(guidance.level)} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="当前推荐动作" value={guidance.actionLabel} />
          <SummaryRow label="结论" value={guidance.summary} />
          <SummaryRow label="安全边界" value={guidance.safetyNote} />
        </div>
        <div className="readiness-copy">
          <strong>{guidance.summary}</strong>
          <p>{guidance.detail}</p>
          <button className="button button--primary" disabled={buttonDisabled} onClick={onAction} type="button">
            <Compass size={15} aria-hidden="true" />
            {buttonDisabled ? '检查中' : '执行推荐动作'}
          </button>
        </div>
      </div>
    </section>
  );
}

function firstLaunchGuidanceAction(
  guidance: FirstLaunchGuidance,
  actions: {
    onOpenHealth: () => void;
    onOpenOverview: () => void;
    onOpenSchedule: () => void;
    onOpenSettings: () => void;
    onOpenTargets: () => void;
    onRunDoctor: () => Promise<void>;
  },
): () => void {
  return {
    'daily-health': actions.onOpenHealth,
    'first-backup': actions.onOpenOverview,
    'fix-target': actions.onOpenTargets,
    'open-desktop': actions.onOpenSettings,
    'review-schedule': actions.onOpenSchedule,
    'run-doctor': () => void actions.onRunDoctor(),
    'start-helper': actions.onOpenSettings,
  }[guidance.id];
}

function firstLaunchGuidanceStatus(level: FirstLaunchGuidance['level']): CommandResult['status'] {
  if (level === 'ready') return 'success';
  if (level === 'blocked') return 'error';
  return 'warning';
}

function firstLaunchGuidanceLevelLabel(level: FirstLaunchGuidance['level']): string {
  return {
    attention: '建议处理',
    blocked: '优先处理',
    ready: '可日常使用',
  }[level];
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
          <SummaryRow label="本机服务" value={desktopHelperStatusLabel(helperStatus)} />
          <SummaryRow label="内置资源" value={toolkitStatus.available ? toolkitSourceLabel(toolkitStatus.source) : '未就绪'} />
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

function FirstRunJourneyPanel({
  firstUsePath,
  journey,
  onOpenInstall,
  onOpenLogs,
  onOpenOverview,
  onOpenRestore,
  onOpenSettings,
  onOpenTargets,
  onRefreshHealth,
  onRunDoctor,
  refreshing,
  runningDoctor,
}: {
  firstUsePath: FirstUsePath;
  journey: FirstRunJourney;
  onOpenInstall: () => void;
  onOpenLogs: () => void;
  onOpenOverview: () => void;
  onOpenRestore: () => void;
  onOpenSettings: () => void;
  onOpenTargets: () => void;
  onRefreshHealth: () => Promise<void>;
  onRunDoctor: () => Promise<void>;
  refreshing: boolean;
  runningDoctor: boolean;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>首启验证流程</span>
        </div>
        <StatusBadge status={journey.level === 'ready' ? 'success' : journey.level === 'blocked' ? 'error' : 'warning'} label={`${journey.readyCount}/${journey.steps.length} 已完成`} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="状态" value={firstRunJourneyLevelLabel(journey.level)} />
          <SummaryRow label="摘要" value={journey.summary} />
          <SummaryRow label="安全边界" value="不执行真实恢复，不安装或卸载定时任务" />
          <SummaryRow label="备份验证" value="真实备份仍需在概览页手动确认" />
        </div>
        <div className="readiness-copy">
          <strong>从打开 App 到完成验证</strong>
          <p>按顺序完成桌面环境、存储位置、只读检查、本机服务、备份证明和恢复边界确认。这里不会绕过真实备份确认，也不会修改已有自动化任务。</p>
          <div className="action-row">
            <button className="button button--primary" disabled={runningDoctor} onClick={onRunDoctor} type="button">
              <ShieldCheck size={15} aria-hidden="true" />
              {runningDoctor ? '检查中' : '运行环境检查'}
            </button>
            <button className="button button--tertiary" disabled={refreshing} onClick={() => void onRefreshHealth()} type="button">
              <RotateCcw size={15} aria-hidden="true" />
              {refreshing ? '刷新中' : '刷新健康状态'}
            </button>
            <button className="button button--tertiary" onClick={onOpenOverview} type="button">查看真实备份确认</button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {journey.steps.map((step) => (
          <FirstRunJourneyStepItem
            key={step.id}
            onAction={firstRunJourneyStepAction(step, {
              onOpenOverview,
              onOpenRestore,
              onOpenSettings,
              onOpenTargets,
              onRefreshHealth,
              onRunDoctor,
            })}
            step={step}
          />
        ))}
      </div>
      <FirstUsePathPanel
        path={firstUsePath}
        onOpenInstall={onOpenInstall}
        onOpenLogs={onOpenLogs}
        onOpenOverview={onOpenOverview}
        onOpenRestore={onOpenRestore}
        onOpenTargets={onOpenTargets}
        onRunDoctor={onRunDoctor}
        runningDoctor={runningDoctor}
      />
    </section>
  );
}

function FirstUsePathPanel({
  onOpenInstall,
  onOpenLogs,
  onOpenOverview,
  onOpenRestore,
  onOpenTargets,
  onRunDoctor,
  path,
  runningDoctor,
}: {
  onOpenInstall: () => void;
  onOpenLogs: () => void;
  onOpenOverview: () => void;
  onOpenRestore: () => void;
  onOpenTargets: () => void;
  onRunDoctor: () => Promise<void>;
  path: FirstUsePath;
  runningDoctor: boolean;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>首次真实使用路径</span>
        </div>
        <StatusBadge status={firstUsePathStatus(path.level)} label={firstUsePathLevelLabel(path.level)} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="结论" value={path.summary} />
          <SummaryRow label="下一步" value={path.primaryAction} />
          <SummaryRow label="安全边界" value={path.safetyNote} />
        </div>
        <div className="readiness-copy">
          <strong>从安装到第一次可验收备份</strong>
          <p>按顺序完成安装验收、目标端配置、doctor 检查、手动确认备份、结果验收和恢复边界确认。这里不会绕过真实备份确认。</p>
          <div className="action-row">
            <button className="button button--primary" disabled={runningDoctor} onClick={() => void onRunDoctor()} type="button">
              <ShieldCheck size={15} aria-hidden="true" />
              {runningDoctor ? '检查中' : '路径检查'}
            </button>
            <button className="button button--tertiary" onClick={onOpenTargets} type="button">路径目标</button>
            <button className="button button--tertiary" onClick={onOpenOverview} type="button">路径概览</button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {path.steps.map((step, index) => (
          <FirstUsePathStepItem
            key={step.id}
            index={index}
            onAction={firstUsePathStepAction(step, { onOpenInstall, onOpenLogs, onOpenOverview, onOpenRestore, onOpenTargets, onRunDoctor })}
            runningDoctor={runningDoctor}
            step={step}
          />
        ))}
      </div>
    </section>
  );
}

function PostInstallPanel({
  experience,
  installReadiness,
  onCopy,
  onOpenGuide,
  onOpenLogs,
  onOpenRestore,
  onOpenSettings,
  onOpenTargets,
}: {
  experience: PostInstallExperience;
  installReadiness: InstallReadiness;
  onCopy: (text: string) => Promise<void>;
  onOpenGuide: () => void;
  onOpenLogs: () => void;
  onOpenRestore: () => void;
  onOpenSettings: () => void;
  onOpenTargets: () => void;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Download size={16} aria-hidden="true" />
          <span>安装后验证</span>
        </div>
        <StatusBadge status="warning" label="未签名 DMG" />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="当前版本" value={experience.assetName.replace('CodexBackup_', '').replace('_aarch64.dmg', '')} />
          <SummaryRow label="Release" value={experience.releaseUrl} />
          <SummaryRow label="DMG" value={experience.assetName} />
          <SummaryRow label="校验文件" value={experience.checksumAssetName} />
          <SummaryRow label="校验命令" value={experience.checksumCommand} />
        </div>
        <div className="readiness-copy">
          <strong>下载后的第一轮确认</strong>
          <p>{experience.summary}</p>
          <div className="action-row">
            <button className="button button--primary" onClick={() => void onCopy(experience.checksumCommand)} type="button">
              <ClipboardCheck size={15} aria-hidden="true" />
              复制校验命令
            </button>
            <button className="button button--tertiary" onClick={() => void onCopy(experience.releaseUrl)} type="button">
              <Download size={15} aria-hidden="true" />
              复制 Release 地址
            </button>
            <button className="button button--tertiary" onClick={onOpenGuide} type="button">打开引导</button>
            <button className="button button--tertiary" onClick={onOpenSettings} type="button">打开设置</button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {experience.items.map((item) => <PostInstallItemCard item={item} key={item.id} />)}
      </div>
      <div className="two-column two-column--tight">
        <section className="sub-panel">
          <div className="panel-title">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>校验结果判断</span>
          </div>
          <div className="summary-list">
            <SummaryRow label="成功" value={experience.checksumSuccessText} />
            <SummaryRow label="失败" value={experience.checksumFailureText} />
          </div>
        </section>
        <section className="sub-panel">
          <div className="panel-title">
            <UnlockKeyhole size={16} aria-hidden="true" />
            <span>打不开时</span>
          </div>
          <StepList steps={experience.macosOpenSteps} />
        </section>
      </div>
      <section className="sub-panel">
        <div className="panel-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>安装后 smoke 检查</span>
        </div>
        <StepList steps={experience.smokeSteps} />
      </section>
      <section className="sub-panel">
        <div className="panel-title">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>发布可信度</span>
        </div>
        <div className="check-list check-list--grid">
          {experience.trustChecklist.map((item) => <PostInstallItemCard item={item} key={item.id} />)}
        </div>
      </section>
      <InstallReadinessPanel
        readiness={installReadiness}
        onOpenGuide={onOpenGuide}
        onOpenLogs={onOpenLogs}
        onOpenRestore={onOpenRestore}
        onOpenSettings={onOpenSettings}
        onOpenTargets={onOpenTargets}
      />
    </section>
  );
}

function InstallReadinessPanel({
  onOpenGuide,
  onOpenLogs,
  onOpenRestore,
  onOpenSettings,
  onOpenTargets,
  readiness,
}: {
  onOpenGuide: () => void;
  onOpenLogs: () => void;
  onOpenRestore: () => void;
  onOpenSettings: () => void;
  onOpenTargets: () => void;
  readiness: InstallReadiness;
}) {
  return (
    <section className="sub-panel">
      <div className="panel-title">
        <ClipboardCheck size={16} aria-hidden="true" />
        <span>安装落地验收</span>
      </div>
      <div className="summary-list">
        <SummaryRow label="结论" value={readiness.summary} />
        <SummaryRow label="安全边界" value={readiness.safetyNote} />
      </div>
      <div className="check-list check-list--grid">
        {readiness.steps.map((step) => (
          <InstallReadinessStepItem
            key={step.id}
            onAction={installReadinessAction(step, { onOpenGuide, onOpenLogs, onOpenRestore, onOpenSettings, onOpenTargets })}
            step={step}
          />
        ))}
      </div>
      <StepList steps={readiness.nextActions} />
    </section>
  );
}

function InstallReadinessStepItem({ onAction, step }: { onAction: () => void; step: InstallReadinessStep }) {
  const Icon = step.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${step.status === 'blocked' ? 'error' : step.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{step.label}</strong>
        <span>{step.detail}</span>
        <button className="inline-action" onClick={onAction} type="button">验收{step.actionLabel}</button>
      </div>
    </div>
  );
}

function installReadinessAction(
  step: InstallReadinessStep,
  actions: {
    onOpenGuide: () => void;
    onOpenLogs: () => void;
    onOpenRestore: () => void;
    onOpenSettings: () => void;
    onOpenTargets: () => void;
  },
): () => void {
  return {
    'download-checksum': actions.onOpenGuide,
    'first-open': actions.onOpenGuide,
    runtime: actions.onOpenSettings,
    'target-doctor': actions.onOpenTargets,
    'first-backup': actions.onOpenLogs,
    'restore-boundary': actions.onOpenRestore,
  }[step.id];
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="step-list">
      {steps.map((step) => <li key={step}>{step}</li>)}
    </ol>
  );
}

function PostInstallItemCard({ item }: { item: PostInstallItem }) {
  const Icon = item.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${item.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </div>
    </div>
  );
}

function TargetSetupGuidePanel({
  guide,
  onRunDoctor,
  runningDoctor,
}: {
  guide: TargetSetupGuide;
  onRunDoctor: () => Promise<void>;
  runningDoctor: boolean;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>保存位置检查</span>
        </div>
        <StatusBadge status={guide.level === 'blocked' ? 'error' : guide.level === 'ready' ? 'success' : 'warning'} label={targetSetupLevelLabel(guide.level)} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="保存类型" value={guide.title.replace('设置向导', '').replace('检查', '')} />
          <SummaryRow label="下一步" value={guide.nextAction} />
          <SummaryRow label="检查方式" value="只检查保存位置是否可用" />
          <SummaryRow label="安全边界" value="不会创建备份，也不会修改定时任务" />
        </div>
        <div className="readiness-copy">
          <strong>先确认能保存，再开始备份</strong>
          <p>检查会确认当前保存位置、权限和基础依赖是否可用。检查通过后再回到备份页执行真实备份。</p>
          <div className="action-row">
            <button className="button button--primary" disabled={runningDoctor || guide.level === 'blocked'} onClick={() => void onRunDoctor()} type="button">
              <ShieldCheck size={15} aria-hidden="true" />
              {runningDoctor ? '检查中' : '检查保存位置'}
            </button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {guide.steps.map((step) => <TargetSetupStepCard key={`${step.label}-${step.detail}`} step={step} />)}
      </div>
      <div className="two-column two-column--tight">
        <section className="sub-panel">
          <div className="panel-title">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>常见失败</span>
          </div>
          <div className="history-list">
            {guide.commonFailures.map((failure) => (
              <div className="history-item" key={failure.label}>
                <div>
                  <strong>{failure.label}</strong>
                  <span>{failure.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="sub-panel">
          <div className="panel-title">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>安全说明</span>
          </div>
          <StepList steps={guide.safetyNotes} />
        </section>
      </div>
    </section>
  );
}

function TargetSetupStepCard({ step }: { step: TargetSetupStep }) {
  const Icon = step.status === 'ready' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${step.status === 'blocked' ? 'error' : step.status === 'ready' ? 'ok' : 'warning'}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{step.label}</strong>
        <span>{step.detail}</span>
      </div>
    </div>
  );
}

function targetSetupLevelLabel(level: TargetSetupGuide['level']): string {
  return {
    blocked: '有阻断项',
    'needs-action': '待验证',
    ready: '可验证',
  }[level];
}

function DoctorAdvicePanel({ advice }: { advice: DoctorAdvice }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>目标端处理建议</span>
        </div>
        <StatusBadge status={adviceStatus(advice.level)} label={doctorAdviceLevelLabel(advice.level)} />
      </div>
      <div className="summary-list">
        <SummaryRow label="摘要" value={advice.summary} />
        <SummaryRow label="安全边界" value={advice.safetyNote} />
      </div>
      <div className="check-list check-list--grid">
        {advice.cards.map((card) => <DoctorAdviceCardItem card={card} key={`${card.label}-${card.detail}`} />)}
      </div>
      <div className="history-list">
        {advice.nextActions.map((action) => (
          <div className="history-item" key={action}>
            <div>
              <strong>下一步</strong>
              <span>{action}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DoctorAdviceCardItem({ card }: { card: DoctorAdviceCard }) {
  const Icon = card.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${card.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{card.label}</strong>
        <span>{card.detail}</span>
      </div>
    </div>
  );
}

function BackupAcceptancePanel({ acceptance, onOpenRestore }: { acceptance: BackupAcceptance; onOpenRestore: () => void }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>首次备份验收</span>
        </div>
        <StatusBadge status={backupAcceptanceStatus(acceptance.level)} label={backupAcceptanceLevelLabel(acceptance.level)} />
      </div>
      <div className="summary-list">
        <SummaryRow label="结论" value={acceptance.summary} />
        <SummaryRow label="归档" value={acceptance.archivePath ?? '尚未确认'} />
      </div>
      <div className="check-list check-list--grid">
        {acceptance.checks.map((check) => <BackupAcceptanceCheckItem check={check} key={check.id} />)}
      </div>
      <div className="action-row">
        <button className="button button--tertiary" onClick={onOpenRestore} type="button">
          <RotateCcw size={15} aria-hidden="true" />
          打开恢复预案
        </button>
      </div>
      <StepList steps={acceptance.nextActions} />
    </section>
  );
}

function BackupAcceptanceCheckItem({ check }: { check: BackupAcceptanceCheck }) {
  const Icon = check.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${check.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{check.label}</strong>
        <span>{check.detail}</span>
      </div>
    </div>
  );
}

function RestorePlanGuidePanel({ guide }: { guide: RestorePlanGuide }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{guide.title}</span>
        </div>
        <StatusBadge status="warning" label="只读预案" />
      </div>
      <div className="two-column two-column--tight">
        <section className="sub-panel">
          <div className="panel-title">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>会做什么</span>
          </div>
          <StepList steps={guide.willDo} />
        </section>
        <section className="sub-panel">
          <div className="panel-title">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>不会做什么</span>
          </div>
          <StepList steps={guide.willNotDo} />
        </section>
      </div>
      <div className="two-column two-column--tight">
        <section className="sub-panel">
          <div className="panel-title">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span>需要准备</span>
          </div>
          <StepList steps={guide.needs} />
        </section>
        <section className="sub-panel">
          <div className="panel-title">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>风险提示</span>
          </div>
          <StepList steps={guide.riskNotes} />
        </section>
      </div>
    </section>
  );
}

function adviceStatus(level: DoctorAdvice['level']): CommandResult['status'] {
  if (level === 'blocked') return 'error';
  if (level === 'ready') return 'success';
  return 'warning';
}

function doctorAdviceLevelLabel(level: DoctorAdvice['level']): string {
  return {
    blocked: '需要处理',
    'needs-action': '建议复核',
    ready: '可验收',
    waiting: '待检查',
  }[level];
}

function backupAcceptanceStatus(level: BackupAcceptance['level']): CommandResult['status'] {
  if (level === 'accepted') return 'success';
  if (level === 'blocked') return 'error';
  return 'warning';
}

function backupAcceptanceLevelLabel(level: BackupAcceptance['level']): string {
  return {
    accepted: '已通过',
    blocked: '待修正',
    pending: '待备份',
  }[level];
}

function FirstUsePathStepItem({ index, onAction, runningDoctor, step }: { index: number; onAction: () => void; runningDoctor: boolean; step: FirstUsePathStep }) {
  const Icon = step.status === 'ready' ? CheckCircle2 : TriangleAlert;
  const disabled = step.id === 'doctor' && runningDoctor;
  return (
    <div className={`check-item check-item--${step.status === 'blocked' ? 'error' : step.status === 'ready' ? 'ok' : 'warning'}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{step.label}</strong>
        <span>{step.detail}</span>
        <button className="inline-action" disabled={disabled} onClick={onAction} type="button">路径步骤 {index + 1}</button>
      </div>
    </div>
  );
}

function firstUsePathStepAction(
  step: FirstUsePathStep,
  actions: {
    onOpenInstall: () => void;
    onOpenLogs: () => void;
    onOpenOverview: () => void;
    onOpenRestore: () => void;
    onOpenTargets: () => void;
    onRunDoctor: () => Promise<void>;
  },
): () => void {
  return {
    acceptance: actions.onOpenLogs,
    backup: actions.onOpenOverview,
    doctor: () => void actions.onRunDoctor(),
    install: actions.onOpenInstall,
    'restore-boundary': actions.onOpenRestore,
    target: actions.onOpenTargets,
  }[step.id];
}

function firstUsePathStatus(level: FirstUsePath['level']): CommandResult['status'] {
  if (level === 'ready') return 'success';
  if (level === 'blocked') return 'error';
  return 'warning';
}

function firstUsePathLevelLabel(level: FirstUsePath['level']): string {
  return {
    blocked: '有阻断项',
    'needs-action': '待完成',
    ready: '已闭环',
  }[level];
}

function FirstRunJourneyStepItem({ onAction, step }: { onAction: () => void; step: FirstRunJourneyStep }) {
  const Icon = step.status === 'ready' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${step.status === 'blocked' ? 'error' : step.status === 'ready' ? 'ok' : 'warning'}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{step.label}</strong>
        <span>{step.detail}</span>
        <button className="inline-action" onClick={onAction} type="button">{step.actionLabel}</button>
      </div>
    </div>
  );
}

function firstRunJourneyStepAction(
  step: FirstRunJourneyStep,
  actions: {
    onOpenOverview: () => void;
    onOpenRestore: () => void;
    onOpenSettings: () => void;
    onOpenTargets: () => void;
    onRefreshHealth: () => Promise<void>;
    onRunDoctor: () => Promise<void>;
  },
): () => void {
  return {
    desktop: actions.onOpenSettings,
    target: actions.onOpenTargets,
    doctor: () => void actions.onRunDoctor(),
    'helper-health': () => void actions.onRefreshHealth(),
    'backup-proof': actions.onOpenOverview,
    'restore-boundary': actions.onOpenRestore,
  }[step.id];
}

function firstRunJourneyLevelLabel(level: FirstRunJourney['level']): string {
  return {
    blocked: '有阻断项',
    'needs-action': '待验证',
    ready: '已就绪',
  }[level];
}

function MacosDiagnosticsPanel({
  diagnostics,
  helperStatus,
  onOpenLogs,
  onOpenOverview,
  onOpenSchedule,
  onOpenSettings,
  onRefreshDiagnostics,
  paths,
  readiness,
  refreshing,
  toolkitStatus,
}: {
  diagnostics: DesktopDiagnostics | null;
  helperStatus: DesktopHelperStatus;
  onOpenLogs: () => void;
  onOpenOverview: () => void;
  onOpenSchedule: () => void;
  onOpenSettings: () => void;
  onRefreshDiagnostics: () => Promise<void>;
  paths: DesktopPaths;
  readiness: MacosReadiness;
  refreshing: boolean;
  toolkitStatus: DesktopToolkitStatus;
}) {
  return (
    <section className="panel readiness-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span>macOS 诊断中心</span>
        </div>
        <StatusBadge status={macosReadinessStatus(readiness.level)} label={`${readiness.score}/${readiness.items.length} 已就绪`} />
      </div>
      <div className="readiness-layout">
        <div className="summary-list">
          <SummaryRow label="macOS 桌面成熟度" value={macosReadinessLevelLabel(readiness.level)} />
          <SummaryRow label="结论" value={readiness.summary} />
          <SummaryRow label="本机服务" value={desktopHelperStatusLabel(helperStatus)} />
          <SummaryRow label="内置资源" value={toolkitStatus.available ? toolkitSourceLabel(toolkitStatus.source) : '未就绪'} />
          <SummaryRow label="最近诊断" value={diagnostics ? `版本 ${diagnostics.version}` : '尚未刷新桌面诊断'} />
          <SummaryRow label="安全边界" value={readiness.safetyNote} />
        </div>
        <div className="readiness-copy">
          <strong>面向发布前的本机状态汇总</strong>
          <p>诊断中心聚合桌面运行时、本机服务、内置资源、路径、首次备份证明和发布 smoke 状态。这里不触发恢复，也不修改自动化任务。</p>
          <div className="action-row">
            <button className="button button--primary" disabled={refreshing} onClick={() => void onRefreshDiagnostics()} type="button">
              <ShieldCheck size={15} aria-hidden="true" />
              {refreshing ? '诊断中' : '刷新桌面诊断'}
            </button>
            <button className="button button--tertiary" onClick={onOpenSettings} type="button">打开设置</button>
            <button className="button button--tertiary" onClick={onOpenLogs} type="button">打开日志</button>
          </div>
        </div>
      </div>
      <div className="check-list check-list--grid">
        {readiness.items.map((item) => <MacosReadinessItemCard item={item} key={item.id} />)}
      </div>
      <section className="sub-panel">
        <div className="panel-title">
          <Compass size={16} aria-hidden="true" />
          <span>建议修复路径</span>
        </div>
        <div className="check-list check-list--grid">
          {readiness.fixPlan.map((fix) => (
            <MacosReadinessFixCard
              fix={fix}
              key={fix.id}
              onAction={macosReadinessFixAction(fix, { onOpenOverview, onOpenSchedule, onOpenSettings, onRefreshDiagnostics })}
            />
          ))}
        </div>
      </section>
      <div className="two-column two-column--tight">
        <section className="sub-panel">
          <div className="panel-title">
            <FolderOpen size={16} aria-hidden="true" />
            <span>诊断路径</span>
          </div>
          <div className="summary-list">
            <SummaryRow label="配置" value={paths.configPath} />
            <SummaryRow label="历史" value={paths.historyPath} />
            <SummaryRow label="日志目录" value={paths.logDir} />
            <SummaryRow label="本机服务错误" value={paths.desktopHelperStderrLogPath} />
            <SummaryRow label="自动化错误" value={paths.automationStderrLogPath} />
          </div>
        </section>
        <section className="sub-panel">
          <div className="panel-title">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span>macOS release smoke</span>
          </div>
          <div className="summary-list">
            <SummaryRow label="本机命令" value="npm run desktop:build && npm run desktop:checksum && npm run desktop:smoke" />
            <SummaryRow label="安全边界" value="不安装、不卸载、不加载或卸载 launchd；不执行真实恢复。" />
          </div>
          <StepList steps={readiness.nextActions} />
        </section>
      </div>
    </section>
  );
}

function MacosReadinessItemCard({ item }: { item: MacosReadinessItem }) {
  const Icon = item.status === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div className={`check-item check-item--${item.status === 'blocked' ? 'error' : item.status}`}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </div>
    </div>
  );
}

function MacosReadinessFixCard({ fix, onAction }: { fix: MacosReadiness['fixPlan'][number]; onAction: () => void }) {
  return (
    <div className="check-item check-item--warning">
      <Compass size={15} aria-hidden="true" />
      <div>
        <strong>{fix.action}</strong>
        <span>{fix.detail}</span>
        <span>{fix.safeBoundary}</span>
        <button className="inline-action" onClick={onAction} type="button">前往处理</button>
      </div>
    </div>
  );
}

function macosReadinessFixAction(
  fix: MacosReadiness['fixPlan'][number],
  actions: {
    onOpenOverview: () => void;
    onOpenSchedule: () => void;
    onOpenSettings: () => void;
    onRefreshDiagnostics: () => Promise<void>;
  },
): () => void {
  return {
    'check-automation': actions.onOpenSchedule,
    'first-backup': actions.onOpenOverview,
    'keep-records': () => void actions.onRefreshDiagnostics(),
    'open-desktop': actions.onOpenSettings,
    'refresh-diagnostics': () => void actions.onRefreshDiagnostics(),
    'release-smoke': () => void actions.onRefreshDiagnostics(),
    'start-helper': actions.onOpenSettings,
  }[fix.id];
}

function macosReadinessStatus(level: MacosReadiness['level']): CommandResult['status'] {
  if (level === 'ready') return 'success';
  if (level === 'blocked') return 'error';
  return 'warning';
}

function macosReadinessLevelLabel(level: MacosReadiness['level']): string {
  return {
    blocked: '有阻断项',
    'needs-action': '待完善',
    ready: 'macOS 可验收',
  }[level];
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
      label: '本机服务状态',
      status: helperStatus.online ? 'ok' : 'warning',
      detail: helperStatus.online ? desktopStatusMessage(helperStatus) : '本机服务未连接时，配置保存、Keychain、历史读取和真实备份按钮会按离线规则禁用。',
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
    unknown: '本机服务未确认',
    checking: '本机服务检查中',
    online: '本机服务已连接',
    offline: '本机服务未连接',
  }[status];
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function backupResultStatusLabel(status: BackupHistoryEntry['status']): string {
  return status === 'success' ? '成功' : '失败';
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
        <p className="muted-copy">还没有可展示的真实备份结果。执行真实备份或刷新备份记录后会显示最近一次结果。</p>
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
    backup: '备份',
    guide: '首启引导',
    install: '安装验证',
    health: '备份健康',
    diagnostics: 'macOS 诊断',
    targets: '存储位置',
    schedule: '定时备份',
    restore: '恢复',
    logs: '记录',
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

function dailyUsageStatusBadge(level: DailyUsageStatus['level']): CommandResult['status'] {
  if (level === 'ready') return 'success';
  if (level === 'blocked') return 'error';
  return 'warning';
}

function dailyUsageStatusLevelLabel(level: DailyUsageStatus['level']): string {
  return {
    attention: '需要关注',
    blocked: '有阻断项',
    ready: '日常可用',
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
    mock: '预览模式',
    localBridge: '本机允许列表模式',
    httpHelper: '开发连接：127.0.0.1:37371',
    desktopHelper: '桌面 App 本机服务',
  }[mode];
}

function desktopStatusMessage(status: DesktopHelperStatus): string {
  if (status.online && status.source === 'managed') return '本机服务已连接。退出桌面 App 时会尝试清理这个服务。';
  if (status.online && status.source === 'external') return '外部本机服务已连接。桌面 App 只连接它，退出时不会停止它。';
  return status.lastError ?? '本机服务未连接。';
}

function desktopSourceLabel(source: DesktopHelperStatus['source']): string {
  return {
    managed: 'App 托管',
    external: '外部服务',
    unavailable: '不可用',
  }[source];
}

function desktopHelperStatusLabel(status: DesktopHelperStatus): string {
  if (!status.online) return '本机服务未连接';
  return status.source === 'managed' ? '本机服务已连接' : '外部服务已连接';
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
