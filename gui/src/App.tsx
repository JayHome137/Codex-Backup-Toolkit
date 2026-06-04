import { useMemo, useState } from 'react';
import { Activity, Archive, CalendarCheck2, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { CommandPreview } from './components/CommandPreview';
import { Sidebar, type SectionId } from './components/Sidebar';
import { StatusBadge } from './components/StatusBadge';
import { TargetForm } from './components/TargetForm';
import { createMockCommandRunner, type CommandResult } from './lib/commands';
import { createLocalBridgeRunner } from './lib/localBridge';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildEnvFile,
  buildRestoreCommand,
  buildValidateCommand,
  defaultConfig,
  targetLabels,
  type BackupConfig,
} from './lib/config';

const runner = createMockCommandRunner();
const localBridgeRunner = createLocalBridgeRunner();

type RunnerMode = 'mock' | 'localBridge';

type HistoryEntry = {
  command: string;
  label: string;
  result: CommandResult;
};

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [archivePath, setArchivePath] = useState('/path/to/codex-backup-host-YYYYmmdd-HHMMSS.tar.gz');
  const [restoreEncrypted, setRestoreEncrypted] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('mock');

  const commands = useMemo(
    () => ({
      doctor: buildDoctorCommand(config),
      backup: buildBackupCommand(config),
      envFile: buildEnvFile(config),
      validate: buildValidateCommand(config),
      restore: buildRestoreCommand(archivePath, restoreEncrypted),
    }),
    [archivePath, config, restoreEncrypted],
  );

  const runPreview = async (command: string, label: string) => {
    setRunningCommand(command);
    const activeRunner = runnerMode === 'localBridge' ? localBridgeRunner : runner;
    const result = await activeRunner.run(command);
    setLastResult(result);
    setHistory((entries) => [{ command, label, result }, ...entries].slice(0, 8));
    setRunningCommand(null);
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
            <div className="mode-switch" role="group" aria-label="Runner mode">
              <button className={runnerMode === 'mock' ? 'segment segment--active' : 'segment'} onClick={() => setRunnerMode('mock')} type="button">
                Mock
              </button>
              <button
                className={runnerMode === 'localBridge' ? 'segment segment--active' : 'segment'}
                onClick={() => setRunnerMode('localBridge')}
                type="button"
              >
                Local Bridge
              </button>
            </div>
            <StatusBadge status={status} label={statusLabel(status)} />
          </div>
        </header>

        {activeSection === 'overview' && (
          <section className="view-stack">
            <div className="metric-grid">
              <MetricCard icon={Archive} label="Target" value={targetLabels[config.target]} tone="blue" />
              <MetricCard icon={ShieldCheck} label="Mode" value="Preview only" tone="green" />
              <MetricCard icon={CalendarCheck2} label="Schedule" value="03:00 / 3 days" tone="yellow" />
            </div>

            <div className="two-column">
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Activity size={16} aria-hidden="true" />
                    <span>Current run</span>
                  </div>
                </div>
                <div className="summary-list">
                  <SummaryRow label="Doctor" value="Mock adapter validates command shape" />
                  <SummaryRow label="Last backup" value="No real backup has been started by this GUI" />
                  <SummaryRow label="Runner" value={runnerMode === 'localBridge' ? 'Local bridge allowlist mode' : 'Mock preview mode'} />
                  <SummaryRow label="Automation" value="Validate command uses an isolated test label" />
                </div>
                <div className="action-row">
                  <button className="button button--primary" onClick={() => runPreview(commands.doctor, 'Doctor command')} type="button">
                    <Play size={15} aria-hidden="true" />
                    Run Doctor
                  </button>
                  <button className="button button--tertiary" onClick={() => runPreview(commands.backup, 'Backup command')} type="button">
                    <Archive size={15} aria-hidden="true" />
                    Preview Backup
                  </button>
                </div>
              </section>
              <CommandPreview command={commands.backup} title="Backup command" onCopy={copyText} />
            </div>
          </section>
        )}

        {activeSection === 'targets' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Archive size={16} aria-hidden="true" />
                  <span>Target configuration</span>
                </div>
              </div>
              <TargetForm config={config} onChange={setConfig} />
            </section>
            <CommandPreview command={commands.envFile} title="config.env preview" onCopy={copyText} />
            <CommandPreview command={commands.backup} title="Generated backup command" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'schedule' && (
          <section className="view-stack">
            <section className="panel panel--compact">
              <div className="panel-header">
                <div className="panel-title">
                  <CalendarCheck2 size={16} aria-hidden="true" />
                  <span>Launchd validation</span>
                </div>
              </div>
              <p className="muted-copy">
                The Web MVP only previews `codexinstallautomation validate`. It uses `dev.codexbackup.toolkit.test.*` labels and does
                not load or modify any backup job you have already installed.
              </p>
              <div className="action-row">
                <button className="button button--primary" onClick={() => runPreview(commands.validate, 'Validate command')} type="button">
                  <Play size={15} aria-hidden="true" />
                  Validate
                </button>
              </div>
            </section>
            <CommandPreview command={commands.validate} title="Validate command" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'restore' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>Restore preview</span>
                </div>
              </div>
              <div className="form-grid">
                <label className="field field--wide">
                  <span>Archive path</span>
                  <input value={archivePath} onChange={(event) => setArchivePath(event.target.value)} />
                </label>
                <label className="toggle-row field--wide">
                  <input checked={restoreEncrypted} onChange={(event) => setRestoreEncrypted(event.target.checked)} type="checkbox" />
                  <span>Encrypted archive</span>
                </label>
              </div>
              <p className="muted-copy">Restore remains preview-only in this browser build. Native execution will require an explicit bridge later.</p>
              <div className="action-row">
                <button className="button button--tertiary" onClick={() => runPreview(commands.restore, 'Restore command')} type="button">
                  <RotateCcw size={15} aria-hidden="true" />
                  Preview Restore
                </button>
              </div>
            </section>
            <CommandPreview command={commands.restore} title="Restore command" onCopy={copyText} />
          </section>
        )}

        {activeSection === 'logs' && (
          <section className="view-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>Mock output</span>
                </div>
              </div>
              <pre className="log-output">
                <code>{runningCommand ? 'Running preview command...' : lastResult?.output ?? 'No command has been previewed yet.'}</code>
              </pre>
            </section>
            <section className="panel panel--compact">
              <div className="summary-list">
                <SummaryRow label="stdout" value="~/Library/Logs/CodexBackup/backup.out.log" />
                <SummaryRow label="stderr" value="~/Library/Logs/CodexBackup/backup.err.log" />
                <SummaryRow label="installed toolkit" value="~/Library/Application Support/CodexBackupToolkit/" />
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Activity size={16} aria-hidden="true" />
                  <span>Run history</span>
                </div>
              </div>
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="muted-copy">No preview runs yet.</p>
                ) : (
                  history.map((entry) => (
                    <div className="history-item" key={`${entry.label}-${entry.command}-${entry.result.output}`}>
                      <div>
                        <strong>{entry.label}</strong>
                        <span>{entry.result.status}</span>
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
    overview: 'Overview',
    targets: 'Backup Targets',
    schedule: 'Schedule Validation',
    restore: 'Restore Preview',
    logs: 'Logs',
  }[section];
}

function statusLabel(status: CommandResult['status'] | 'idle'): string {
  return {
    idle: 'Ready',
    success: 'Preview passed',
    warning: 'Preview warning',
    error: 'Preview failed',
  }[status];
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
