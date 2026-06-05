import { useMemo, useState } from 'react';
import { Activity, Archive, CalendarCheck2, CheckCircle2, KeyRound, Play, RotateCcw, Save, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { CommandPreview } from './components/CommandPreview';
import { Sidebar, type SectionId } from './components/Sidebar';
import { StatusBadge } from './components/StatusBadge';
import { buildBackupAction, buildLatestRestorePlanAction, buildRestorePlanAction } from './lib/actions';
import type { HelperAction } from './lib/actions';
import { TargetForm } from './components/TargetForm';
import { createMockCommandRunner, type CommandResult } from './lib/commands';
import { createHelperApi, type BackupHistoryEntry } from './lib/helperApi';
import { checkHelperHealth, createHttpHelperTransport } from './lib/helperProtocol';
import { createLocalBridgeRunner } from './lib/localBridge';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildEnvFile,
  buildRestoreLatestCommand,
  buildRestoreCommand,
  buildValidateCommand,
  defaultConfig,
  getConfigChecks,
  targetLabels,
  type BackupConfig,
  type ConfigCheck,
} from './lib/config';

const runner = createMockCommandRunner();
const localBridgeRunner = createLocalBridgeRunner();

type RunnerMode = 'mock' | 'localBridge' | 'httpHelper';
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

type HelperActionState = 'config-load' | 'config-save' | 'secret-save' | 'secret-delete' | 'history-load' | null;

const helperActionLabels: Record<Exclude<HelperActionState, null>, string> = {
  'config-load': '加载配置',
  'config-save': '保存配置',
  'secret-save': '保存密钥',
  'secret-delete': '删除密钥',
  'history-load': '刷新历史',
};

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
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('mock');
  const [secretDraft, setSecretDraft] = useState<SecretDraft>(defaultSecretDraft(defaultConfig));
  const [helperStatus, setHelperStatus] = useState<HelperConnectionStatus>('unknown');
  const [helperAction, setHelperAction] = useState<HelperActionState>(null);
  const [helperMessage, setHelperMessage] = useState('尚未检查本地 helper。需要加载配置、保存密钥或读取真实历史时，请先确认 helper 已启动。');
  const httpHelperRunner = useMemo(() => createLocalBridgeRunner(createHttpHelperTransport()), []);
  const helperApi = useMemo(() => createHelperApi(), []);

  const commands = useMemo(
    () => ({
      doctor: buildDoctorCommand(config),
      backup: buildBackupCommand(config),
      envFile: buildEnvFile(config),
      validate: buildValidateCommand(config),
      restore: restoreSource === 'latest' ? buildRestoreLatestCommand(config) : buildRestoreCommand(archivePath, restoreEncrypted),
    }),
    [archivePath, config, restoreEncrypted, restoreSource],
  );
  const actions = useMemo(
    () => ({
      backup: buildBackupAction(config),
      restorePlan: restoreSource === 'archive' ? buildRestorePlanAction(archivePath, restoreEncrypted) : buildLatestRestorePlanAction(config),
    }),
    [archivePath, config, restoreEncrypted, restoreSource],
  );
  const configChecks = useMemo(() => getConfigChecks(config), [config]);
  const blockingChecks = configChecks.filter((check) => check.status === 'error');
  const helperBusy = helperStatus === 'checking' || helperAction !== null;
  const helperActionsDisabled = helperStatus === 'offline' || helperBusy;
  const helperActionLabel = helperAction ? helperActionLabels[helperAction] : null;
  const helperBannerMessage = helperActionLabel ? `${helperActionLabel}中...` : helperMessage;

  const setConfigAndSecretDefaults = (nextConfig: BackupConfig) => {
    setConfig(nextConfig);
    setSecretDraft((draft) => ({ ...defaultSecretDraft(nextConfig), secret: draft.secret }));
  };

  const runPreview = async (command: string, label: string, action?: HelperAction) => {
    setRunningCommand(command);
    const activeRunner = runnerMode === 'httpHelper' ? httpHelperRunner : runnerMode === 'localBridge' ? localBridgeRunner : runner;
    const result = await activeRunner.run(command, action);
    setLastResult(result);
    setHistory((entries) => [{ command, label, result }, ...entries].slice(0, 8));
    setRunningCommand(null);
  };

  const checkHelper = async () => {
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
                  <button className="button button--tertiary" onClick={() => runPreview(commands.backup, '备份命令', actions.backup)} type="button">
                    <Archive size={15} aria-hidden="true" />
                    {runnerMode === 'mock' ? '预览备份' : '执行备份'}
                  </button>
                </div>
              </section>
              <CommandPreview command={commands.backup} title="备份命令" onCopy={copyText} />
            </div>
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
          </section>
        )}

        {activeSection === 'schedule' && (
          <section className="view-stack">
            <section className="panel panel--compact">
              <div className="panel-header">
                <div className="panel-title">
                  <CalendarCheck2 size={16} aria-hidden="true" />
                  <span>launchd 校验</span>
                </div>
              </div>
              <p className="muted-copy">
                网页版预览版只预览 `codexinstallautomation validate`。它使用 `dev.codexbackup.toolkit.test.*` 隔离标识，
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
        <strong>{targetLabels[entry.target as keyof typeof targetLabels] ?? entry.target}</strong>
        <span>{entry.status === 'success' ? '成功' : '失败'} / 退出码 {entry.exitCode}</span>
      </div>
      <code>{entry.archivePaths.length > 0 ? entry.archivePaths.join('\n') : '没有检测到归档路径'}</code>
      <span className="history-meta">{entry.startedAt} - {entry.finishedAt}</span>
    </div>
  );
}

function sectionTitle(section: SectionId): string {
  return {
    overview: '概览',
    targets: '目标端',
    schedule: '计划校验',
    restore: '恢复预览',
    logs: '日志',
  }[section];
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
  }[mode];
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
