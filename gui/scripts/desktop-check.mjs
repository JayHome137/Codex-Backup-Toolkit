import { spawnSync } from 'node:child_process';

const required = process.argv.includes('--required');
const checks = [
  ['rustc', ['--version']],
  ['cargo', ['--version']],
];

const missing = checks.filter(([command, args]) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status === 0) {
    process.stdout.write(`${command}: ${result.stdout.trim()}\n`);
    return false;
  }
  return true;
});

if (missing.length > 0) {
  console.error('缺少 Rust 工具链，无法构建 Tauri 桌面 App。');
  console.error('请先安装 Rust：https://rustup.rs/');
  console.error(`缺失命令：${missing.map(([command]) => command).join(', ')}`);
  process.exit(required ? 1 : 0);
}

console.log('Tauri 桌面构建环境检查通过。');
