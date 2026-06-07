import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const guiRoot = dirname(scriptDir);
const repoRoot = dirname(guiRoot);
const version = process.env.npm_package_version ?? '0.30.0';
const bundleRoot = join(guiRoot, 'src-tauri', 'target', 'release', 'bundle');

const requiredSourceFiles = [
  join(repoRoot, 'scripts', 'windows', 'codexbackup.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexrestore.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexcredential.ps1'),
  join(repoRoot, 'scripts', 'windows', 'codexscheduledbackup.ps1'),
  join(guiRoot, 'src-tauri', 'tauri.windows.conf.json'),
];

const missingSources = requiredSourceFiles.filter((file) => !existsSync(file));
if (missingSources.length > 0) {
  console.error('Windows installer smoke 检查失败，缺少源文件：');
  for (const file of missingSources) console.error(`- ${file}`);
  process.exit(1);
}

const installers = findInstallers(bundleRoot).filter((file) => basename(file).includes(version));
const msi = installers.find((file) => file.endsWith('.msi'));
const exe = installers.find((file) => file.endsWith('.exe'));

if (!msi && !exe) {
  console.error(`找不到 Windows 安装包：${bundleRoot}`);
  console.error('请先在 Windows runner 上运行 `npm run desktop:build:windows`。');
  process.exit(1);
}

for (const installer of installers) {
  if (statSync(installer).size === 0) {
    console.error(`Windows 安装包文件为空：${installer}`);
    process.exit(1);
  }
}

console.log('Windows installer smoke 检查通过。');
for (const installer of installers) console.log(`Installer: ${installer}`);

function findInstallers(root) {
  if (!existsSync(root)) return [];
  const results = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...findInstallers(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.msi') || entry.name.endsWith('.exe'))) {
      results.push(fullPath);
    }
  }
  return results;
}
