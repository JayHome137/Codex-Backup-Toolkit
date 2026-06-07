import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const guiRoot = dirname(scriptDir);
const repoRoot = dirname(guiRoot);

const requiredFiles = [
  join(guiRoot, 'src-tauri', 'tauri.windows.conf.json'),
  join(repoRoot, 'scripts', 'windows', 'codexbackup.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexrestore.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexcredential.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexscheduledbackup.ps1'),
  join(repoRoot, 'docs', 'windows.md'),
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error('Windows 桌面预览 smoke 检查失败，缺少文件：');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const config = readFileSync(join(guiRoot, 'src-tauri', 'tauri.windows.conf.json'), 'utf8');
if (!config.includes('"targets": ["msi", "nsis"]')) {
  console.error('Windows Tauri 配置未启用 msi/nsis targets。');
  process.exit(1);
}

const backupScript = readFileSync(join(repoRoot, 'scripts', 'windows', 'codexbackup.ps1'), 'utf8');
if (!backupScript.includes('Status: preview') || !backupScript.includes('Windows real backup is preview-only')) {
  console.error('Windows backup script must keep preview status visible.');
  process.exit(1);
}

console.log('Windows 桌面预览 smoke 检查通过。');
