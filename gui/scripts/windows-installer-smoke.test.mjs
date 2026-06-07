import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, 'windows-installer-smoke.mjs');
const guiRoot = dirname(scriptDir);

function runSmoke(env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: guiRoot,
    env: { ...process.env, npm_package_version: '0.35.0', ...env },
    encoding: 'utf8',
  });
}

describe('windows installer smoke script', () => {
  it('accepts a CI artifact directory outside the local Tauri bundle path', () => {
    const root = mkdtempSync(join(tmpdir(), 'codexbackup-windows-artifact-test.'));
    try {
      const artifactDir = join(root, 'artifact', 'nsis');
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, 'CodexBackup_0.35.0_x64-setup.exe'), 'installer');

      const result = runSmoke({ CODEXBACKUP_WINDOWS_INSTALLER_DIR: join(root, 'artifact') });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Windows installer smoke 检查通过。');
      expect(result.stdout).toContain('CodexBackup_0.35.0_x64-setup.exe');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
