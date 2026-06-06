import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const version = process.env.npm_package_version ?? '0.15.0';
const appRoot = join('src-tauri', 'target', 'release', 'bundle', 'macos', 'CodexBackup.app');
const appIcon = join(appRoot, 'Contents', 'Resources', 'icon.icns');
const iconRoot = join('src-tauri', 'icons');
const resourceRoot = join(appRoot, 'Contents', 'Resources', 'toolkit');
const dmgPath = join('src-tauri', 'target', 'release', 'bundle', 'dmg', `CodexBackup_${version}_aarch64.dmg`);
const checksumPath = `${dmgPath}.sha256`;

const requiredFiles = [
  join(resourceRoot, 'helper', 'server.mjs'),
  join(resourceRoot, 'helper', 'actions.mjs'),
  join(resourceRoot, 'helper', 'allowlist.mjs'),
  join(resourceRoot, 'helper', 'automation-status.mjs'),
  join(resourceRoot, 'helper', 'config-store.mjs'),
  join(resourceRoot, 'helper', 'executor.mjs'),
  join(resourceRoot, 'helper', 'history-store.mjs'),
  join(resourceRoot, 'helper', 'keychain.mjs'),
  join(resourceRoot, 'scripts', 'codexbackup.sh'),
  join(resourceRoot, 'scripts', 'codexrestore.sh'),
  join(resourceRoot, 'config.example.env'),
  join(resourceRoot, 'examples', 'local.env'),
  appIcon,
  join(iconRoot, '32x32.png'),
  join(iconRoot, '128x128.png'),
  join(iconRoot, '128x128@2x.png'),
  join(iconRoot, '512x512.png'),
  join(iconRoot, '1024x1024.png'),
  join(iconRoot, 'icon.icns'),
  join(iconRoot, 'icon.png'),
  dmgPath,
  checksumPath,
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error('桌面产物 smoke 检查失败，缺少文件：');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const helperDir = join(resourceRoot, 'helper');
const packagedTests = readdirSync(helperDir).filter((name) => name.endsWith('.test.mjs'));
if (packagedTests.length > 0) {
  console.error('桌面产物不应包含 helper 测试文件：');
  for (const file of packagedTests) console.error(`- ${join(helperDir, file)}`);
  process.exit(1);
}

if (statSync(dmgPath).size === 0) {
  console.error(`桌面 DMG 文件为空：${dmgPath}`);
  process.exit(1);
}

if (statSync(appIcon).size === 0) {
  console.error(`桌面 App 图标文件为空：${appIcon}`);
  process.exit(1);
}

const expectedDigest = createHash('sha256').update(readFileSync(dmgPath)).digest('hex');
const [actualDigest, actualName] = readFileSync(checksumPath, 'utf8').trim().split(/\s+/);
if (actualDigest !== expectedDigest || actualName !== `CodexBackup_${version}_aarch64.dmg`) {
  console.error('桌面 DMG sha256 文件与当前产物不匹配。');
  process.exit(1);
}

console.log('桌面产物 smoke 检查通过。');
console.log(`App: ${appRoot}`);
console.log(`DMG: ${dmgPath}`);
console.log(`SHA256: ${checksumPath}`);
