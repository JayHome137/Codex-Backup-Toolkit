import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const defaultConfig = { version: 1, target: 'local' };
const sensitiveKeyPattern = /(password|secret|token|credential)/i;

export function createConfigStore({ filePath = defaultConfigPath() } = {}) {
  return {
    filePath,
    async read() {
      try {
        const raw = await readFile(filePath, 'utf8');
        return sanitizeConfig(JSON.parse(raw));
      } catch (error) {
        if (error && error.code === 'ENOENT') return { ...defaultConfig };
        throw error;
      }
    },
    async write(config) {
      const sanitized = sanitizeConfig(config);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
      return sanitized;
    },
  };
}

export function sanitizeConfig(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeConfig(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKeyPattern.test(key))
    .map(([key, entry]) => [key, sanitizeConfig(entry)]));
}

function defaultConfigPath() {
  return join(homedir(), 'Library/Application Support/CodexBackupToolkit/config.json');
}
