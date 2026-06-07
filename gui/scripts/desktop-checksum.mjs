import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const version = process.env.npm_package_version ?? '0.27.0';
const dmgPath = join('src-tauri', 'target', 'release', 'bundle', 'dmg', `CodexBackup_${version}_aarch64.dmg`);
const checksumPath = `${dmgPath}.sha256`;

if (!existsSync(dmgPath)) {
  console.error(`找不到 DMG 文件：${dmgPath}`);
  console.error('请先运行 `npm run desktop:build` 生成当前版本的桌面产物。');
  process.exit(1);
}

const bytes = readFileSync(dmgPath);
if (bytes.length === 0 || statSync(dmgPath).size === 0) {
  console.error(`DMG 文件为空：${dmgPath}`);
  process.exit(1);
}

const digest = createHash('sha256').update(bytes).digest('hex');
const line = `${digest}  ${basename(dmgPath)}\n`;
writeFileSync(checksumPath, line);

const [recordedDigest, recordedName] = readFileSync(checksumPath, 'utf8').trim().split(/\s+/);
if (recordedDigest !== digest || recordedName !== basename(dmgPath)) {
  console.error('DMG sha256 校验失败。');
  process.exit(1);
}

console.log('DMG sha256 已生成并校验通过。');
console.log(checksumPath);
