import React from "react";
import ReactDOM from "react-dom/client";
import { Archive, CalendarClock, CheckCircle2, FolderOpen, HardDrive, Play, RotateCcw, Settings2, XCircle } from "lucide-react";
import "./styles.css";
import { buildSchedule, type ScheduleMode } from "./lib/schedule";
import { chooseArchive, chooseBackupDirectory, getAppState, runBackup, runRestorePlan, saveSettings, type DesktopAppState } from "./lib/tauri";

type BackupRun = {
  action: string;
  archive?: string;
  checksum?: string;
  manifest?: string;
  sha256?: string;
  included_paths?: string[];
  missing_paths?: string[];
};

type RestorePlan = {
  action: string;
  archive: string;
  would_restore: string[];
  targets: Array<{ archive_path: string; target_path: string; currently_exists: boolean }>;
};

const defaultState: AppState = {
  backupDir: "",
  scheduleMode: "preset",
  intervalDays: 3,
  lastSuccessAt: null,
  lastArchive: null,
  lastError: null
};

type AppState = DesktopAppState;

function formatDate(value: string | null): string {
  if (!value) return "尚未完成";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function scheduleLabel(mode: ScheduleMode, days: number): string {
  if (mode === "manual") return "手动备份";
  if (days === 1) return "每天";
  return `每 ${days} 天`;
}

function App() {
  const [state, setState] = React.useState<AppState>(defaultState);
  const [busy, setBusy] = React.useState(false);
  const [log, setLog] = React.useState("准备就绪");
  const [restoreArchive, setRestoreArchive] = React.useState("");
  const [restorePlan, setRestorePlan] = React.useState<RestorePlan | null>(null);

  const schedule = buildSchedule({
    mode: state.scheduleMode,
    days: state.intervalDays,
    lastSuccessAt: state.lastSuccessAt
  });

  async function refresh() {
    const next = await getAppState();
    setState(next);
  }

  React.useEffect(() => {
    refresh().catch((error) => setLog(String(error)));
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(async () => {
      const fresh = await getAppState();
      setState(fresh);
      const nextSchedule = buildSchedule({
        mode: fresh.scheduleMode,
        days: fresh.intervalDays,
        lastSuccessAt: fresh.lastSuccessAt
      });
      if (fresh.backupDir && nextSchedule.isDue && nextSchedule.mode !== "manual") {
        await handleBackup("auto");
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [state.backupDir, state.scheduleMode, state.intervalDays, state.lastSuccessAt]);

  async function updateSettings(partial: Partial<AppState>) {
    const next = { ...state, ...partial };
    setState(next);
    await saveSettings({
      backupDir: next.backupDir,
      scheduleMode: next.scheduleMode,
      intervalDays: next.intervalDays
    });
  }

  async function pickBackupDir() {
    const selected = await chooseBackupDirectory();
    if (selected) {
      await updateSettings({ backupDir: selected });
      setLog(`备份位置已更新：${selected}`);
    }
  }

  async function handleBackup(trigger: "manual" | "auto") {
    if (!state.backupDir) {
      setLog("请先选择备份位置。");
      return;
    }
    if (busy) return;
    setBusy(true);
    setLog(trigger === "auto" ? "到达周期，正在自动备份..." : "正在备份...");
    try {
      const result = (await runBackup(state.backupDir)) as BackupRun;
      await refresh();
      setLog(`备份完成：${result.archive}`);
    } catch (error) {
      setLog(`备份失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function pickArchive() {
    const selected = await chooseArchive();
    if (selected) {
      setRestoreArchive(selected);
      setRestorePlan(null);
      setLog(`已选择备份包：${selected}`);
    }
  }

  async function createPlan() {
    if (!restoreArchive) {
      setLog("请先选择备份包。");
      return;
    }
    setBusy(true);
    setLog("正在生成恢复预案...");
    try {
      const plan = (await runRestorePlan(restoreArchive)) as RestorePlan;
      setRestorePlan(plan);
      setLog("恢复预案已生成。");
    } catch (error) {
      setLog(`恢复预案失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const statusOk = !state.lastError;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <h1>Codex Backup</h1>
          <p>常驻桌面的 Codex 数据备份。选择本地目录，按周期自动备份，也可以随时手动备份。</p>
        </div>
        <div className={`status-pill ${statusOk ? "ok" : "bad"}`}>
          {statusOk ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {statusOk ? "运行正常" : "需要处理"}
        </div>
      </section>

      <section className="grid">
        <div className="panel primary-panel">
          <div className="panel-heading">
            <div>
              <h2>备份</h2>
              <p>默认包含 `~/.codex` 和 `~/Documents/Codex`。</p>
            </div>
            <HardDrive size={22} />
          </div>

          <label className="field">
            <span>备份位置</span>
            <button className="path-button" type="button" onClick={pickBackupDir}>
              <FolderOpen size={18} />
              <span>{state.backupDir || "选择本地备份文件夹"}</span>
            </button>
          </label>

          <div className="split-fields">
            <label className="field">
              <span>备份周期</span>
              <select
                value={state.scheduleMode === "manual" ? "manual" : String(state.intervalDays)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "manual") {
                    updateSettings({ scheduleMode: "manual" }).catch((error) => setLog(String(error)));
                  } else {
                    updateSettings({ scheduleMode: "preset", intervalDays: Number(value) }).catch((error) => setLog(String(error)));
                  }
                }}
              >
                <option value="manual">手动</option>
                <option value="1">每天</option>
                <option value="3">每 3 天</option>
                <option value="7">每 7 天</option>
                <option value="14">每 14 天</option>
                <option value="30">每 30 天</option>
              </select>
            </label>
            <label className="field">
              <span>自定义天数</span>
              <input
                min={1}
                type="number"
                value={state.intervalDays}
                onChange={(event) =>
                  updateSettings({ scheduleMode: "custom", intervalDays: Number(event.target.value) || 3 }).catch((error) =>
                    setLog(String(error))
                  )
                }
              />
            </label>
          </div>

          <button className="primary-action" type="button" disabled={busy} onClick={() => handleBackup("manual")}>
            <Play size={18} />
            {busy ? "正在处理" : "立即备份"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>状态</h2>
              <p>{scheduleLabel(state.scheduleMode, state.intervalDays)}</p>
            </div>
            <CalendarClock size={22} />
          </div>
          <div className="metric-list">
            <div>
              <span>上次备份</span>
              <strong>{formatDate(state.lastSuccessAt)}</strong>
            </div>
            <div>
              <span>下次备份</span>
              <strong>{schedule.nextDueAt ? formatDate(schedule.nextDueAt) : "仅手动"}</strong>
            </div>
            <div>
              <span>最近归档</span>
              <strong>{state.lastArchive ? state.lastArchive.split("/").pop() : "暂无"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel restore-panel">
        <div className="panel-heading">
          <div>
            <h2>恢复</h2>
            <p>先生成恢复预案，确认后再从 CLI 或后续确认流程执行真实恢复。</p>
          </div>
          <RotateCcw size={22} />
        </div>
        <div className="restore-row">
          <button className="path-button" type="button" onClick={pickArchive}>
            <Archive size={18} />
            <span>{restoreArchive || "选择 .tar.gz 备份包"}</span>
          </button>
          <button className="secondary-action" type="button" disabled={busy || !restoreArchive} onClick={createPlan}>
            生成恢复预案
          </button>
        </div>
        {restorePlan ? (
          <div className="plan-box">
            {restorePlan.targets.map((target) => (
              <div key={target.archive_path}>
                <span>{target.archive_path}</span>
                <strong>{target.currently_exists ? "将先安全备份再替换" : "将新建恢复"}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="log-bar">
        <Settings2 size={16} />
        <span>{log}</span>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
