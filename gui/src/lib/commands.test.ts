import { describe, expect, it } from 'vitest';
import { createMockCommandRunner } from './commands';

describe('mock command runner', () => {
  it('returns a successful doctor result', async () => {
    const runner = createMockCommandRunner();
    const result = await runner.run('./scripts/codexbackup.sh --doctor --target local');

    expect(result.status).toBe('success');
    expect(result.output).toContain('环境检查通过');
  });

  it('returns backup output for backup commands', async () => {
    const runner = createMockCommandRunner();
    const result = await runner.run('./scripts/codexbackup.sh --target local');

    expect(result.status).toBe('success');
    expect(result.output).toContain('备份写入位置：');
  });

  it('marks restore as preview-only', async () => {
    const runner = createMockCommandRunner();
    const result = await runner.run('./scripts/codexrestore.sh --archive /tmp/archive.tar.gz');

    expect(result.status).toBe('warning');
    expect(result.output).toContain('恢复在 GUI 中仅支持预览');
  });
});
