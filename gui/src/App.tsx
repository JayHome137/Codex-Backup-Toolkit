import { useMemo, useState } from 'react';
import { Activity, Archive, CalendarCheck2, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { CommandPreview } from './components/CommandPreview';
import { Sidebar, type SectionId } from './components/Sidebar';
import { StatusBadge } from './components/StatusBadge';
import { TargetForm } from './components/TargetForm';
import { createMockCommandRunner, type CommandResult } from './lib/commands';
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
  targetLabels,
  type BackupConfig,
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

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>('latest');
  const [archivePath, setArchivePath] = useState('/path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz');
  const [restoreEncrypted, setRestoreEncrypted] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('mock');
  const httpHelperRunner = useMemo(() => createLocalBridgeRunner(createHttpHelperTransport()), []);

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

  const runPreview = async (command: string, label: string) => {
    setRunningCommand(command);
    const activeRunner = runnerMode === 'httpHelper' ? httpHelperRunner : runnerMode === 'localBridge' ? localBridgeRunner : runner;
    const result = await activeRunner.run(command);
    setLastResult(result);
    setHistory((entries) => [{ command, label, result }, ...entries].slice(0, 8));
    setRunningCommand(null);
  };

  const checkHelper = async () => {
    setRunningCommand('GET http://127.0.0.1:37371/health');
    try {
      const health = await checkHelperHealth();
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
      setLastResult({
        status: 'error',
        output: `ERR_HELPER_UNAVAILABLE\n\n${message}`,
      });
    } finally {
      setRunningCommand(null);
    }
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
                  <SummaryRow label="环境检查" value="模拟适配器会校验命令形状" />
                  <SummaryRow label="最近备份" value="此界面尚未启动任何真实备份" />
                  <SummaryRow label="运行器" value={runnerModeLabel(runnerMode)} />
                  <SummaryRow label="自动化" value="计划校验命令使用隔离测试标识" />
                </div>
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
                  <button className="button button--tertiary" onClick={() => runPreview(commands.backup, '备份命令')} type="button">
                    <Archive size={15} aria-hidden="true" />
                    预览备份
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
              <TargetForm config={config} onChange={setConfig} />
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
              <p className="muted-copy">当前浏览器版只预览恢复命令。最新备份会使用当前目标端配置生成 `codexrestore --latest`。</p>
              <div className="action-row">
                <button className="button button--tertiary" onClick={() => runPreview(commands.restore, '恢复命令')} type="button">
                  <RotateCcw size={15} aria-hidden="true" />
                  预览恢复
                </button>
              </div>
            </section>
            <CommandPreview command={commands.restore} title="恢复命令" onCopy={copyText} />
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
                <code>{runningCommand ? '正在运行预览命令...' : lastResult?.output ?? '还没有运行任何预览命令。'}</code>
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
          </section>
        )}
      </main>
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

export default App;
