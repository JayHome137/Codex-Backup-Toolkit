import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const defaultHistory = { version: 1, entries: [] };

export function createHistoryStore({ filePath = defaultHistoryPath(), limit = 100 } = {}) {
  return {
    filePath,
    async read() {
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return { version: 1, entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
      } catch (error) {
        if (error && error.code === 'ENOENT') return { ...defaultHistory, entries: [] };
        throw error;
      }
    },
    async append(entry) {
      const history = await this.read();
      const entries = [entry, ...history.entries].slice(0, limit);
      const next = { version: 1, entries };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      return entry;
    },
  };
}

export function extractArchivePaths(stdout) {
  return String(stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^.+codex-backup-.+\.tar\.gz(\.age)?$/.test(line));
}

export function buildBackupHistoryEntry({ request, result, startedAt, finishedAt }) {
  const target = request?.action?.target ?? parseTargetFromCommand(request?.command);
  return {
    action: request?.kind === 'sync' ? 'syncLocalAuthoritative' : 'backup',
    target,
    status: Number(result?.exitCode) === 0 ? 'success' : 'error',
    startedAt,
    finishedAt,
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : 1,
    archivePaths: extractArchivePaths(result?.stdout),
  };
}

function parseTargetFromCommand(command) {
  const match = String(command ?? '').match(/CODEX_BACKUP_TARGET=([a-z]+)|--target ([a-z]+)/);
  return match?.[1] ?? match?.[2] ?? 'unknown';
}

function defaultHistoryPath() {
  return join(homedir(), 'Library/Application Support/CodexBackupToolkit/history.json');
}
