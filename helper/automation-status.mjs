import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const defaultLabel = 'dev.codexbackup.toolkit';

export function createAutomationStatusReader({
  env = process.env,
  launchctlPrint = defaultLaunchctlPrint,
  uid = typeof process.getuid === 'function' ? String(process.getuid()) : 'current',
} = {}) {
  return {
    async read() {
      const home = env.HOME || homedir();
      const label = env.CODEX_BACKUP_LAUNCHD_LABEL || defaultLabel;
      const installDir = env.CODEX_BACKUP_INSTALL_DIR || join(home, 'Library', 'Application Support', 'CodexBackupToolkit');
      const logDir = join(home, 'Library', 'Logs', 'CodexBackup');
      const plistPath = join(home, 'Library', 'LaunchAgents', `${label}.plist`);
      const scheduledScriptPath = join(installDir, 'scripts', 'codexscheduledbackup.sh');
      const hour = parseInteger(env.CODEX_BACKUP_HOUR, 3);
      const minute = parseInteger(env.CODEX_BACKUP_MINUTE, 0);
      const intervalDays = parseInteger(env.CODEX_BACKUP_INTERVAL_DAYS, 3);
      const serviceLabel = `gui/${uid}/${label}`;
      const launchctl = await launchctlPrint(serviceLabel);

      return {
        label,
        loaded: launchctl.exitCode === 0,
        plistExists: await pathExists(plistPath),
        installDirExists: await pathExists(installDir),
        scheduledScriptExists: await pathExists(scheduledScriptPath),
        plistPath,
        installDir,
        scheduledScriptPath,
        stdoutLogPath: join(logDir, 'backup.out.log'),
        stderrLogPath: join(logDir, 'backup.err.log'),
        schedule: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} / 每 ${intervalDays} 天`,
        ...(launchctl.exitCode === 0 ? {} : { lastError: firstNonEmpty(launchctl.stderr, launchctl.stdout, 'Job is not loaded') }),
      };
    },
  };
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstNonEmpty(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean);
}

function defaultLaunchctlPrint(label) {
  return new Promise((resolve) => {
    const child = spawn('launchctl', ['print', label], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      resolve({ exitCode: Number.isInteger(code) ? code : 1, stdout, stderr });
    });
  });
}
