import { describe, expect, it } from 'vitest';
import { buildBackupCommand, buildDoctorCommand, buildRestoreCommand, buildValidateCommand, defaultConfig } from './config';
import { classifyLocalCommand, createLocalBridgeRunner } from './localBridge';

describe('local bridge command allowlist', () => {
  it('allows doctor commands', () => {
    expect(classifyLocalCommand(buildDoctorCommand(defaultConfig))).toEqual({ allowed: true, kind: 'doctor' });
  });

  it('allows isolated launchd validate commands', () => {
    expect(classifyLocalCommand(buildValidateCommand(defaultConfig))).toEqual({ allowed: true, kind: 'validate' });
  });

  it('allows local backup commands', () => {
    expect(classifyLocalCommand(buildBackupCommand(defaultConfig))).toEqual({ allowed: true, kind: 'backup' });
  });

  it('blocks encrypted backup commands without an age recipient', () => {
    expect(classifyLocalCommand(buildBackupCommand({ ...defaultConfig, encrypt: true, ageRecipient: '', ageRecipientFile: '' }))).toEqual({
      allowed: false,
      reason: '加密备份必须配置 CODEX_BACKUP_AGE_RECIPIENT 或 CODEX_BACKUP_AGE_RECIPIENT_FILE。',
    });
  });

  it('blocks restore commands', () => {
    expect(classifyLocalCommand(buildRestoreCommand('/tmp/archive.tar.gz', false))).toEqual({
      allowed: false,
      reason: 'Web 桥接只允许环境检查、真实备份和隔离的计划校验。',
    });
  });

  it('blocks shell command chaining before a helper request is created', () => {
    expect(classifyLocalCommand(`${buildBackupCommand(defaultConfig)} && ./scripts/codexrestore.sh --latest`)).toEqual({
      allowed: false,
      reason: '命令不能包含 shell 拼接、替换或追加执行符号。',
    });
  });

  it('blocks non-isolated automation actions', () => {
    expect(classifyLocalCommand('./scripts/codexinstallautomation.sh install')).toEqual({
      allowed: false,
      reason: '只允许隔离的 codexinstallautomation validate 命令。',
    });
  });

  it('returns warning output when a blocked command is run', async () => {
    const runner = createLocalBridgeRunner();
    const result = await runner.run(buildRestoreCommand('/tmp/archive.tar.gz', false));

    expect(result.status).toBe('warning');
    expect(result.output).toContain('已被 Web 桥接允许列表阻止');
  });

  it('uses helper protocol responses for allowed commands', async () => {
    const runner = createLocalBridgeRunner({
      async send(request) {
        return {
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'doctor ok',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'unit-test-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        };
      },
    });

    const result = await runner.run(buildDoctorCommand(defaultConfig));

    expect(result.status).toBe('success');
    expect(result.output).toContain('doctor ok');
    expect(result.output).toContain('请求 ID: cbt_');
    expect(result.output).toContain('助手: unit-test-helper');
  });

  it('formats backup helper responses as executable output', async () => {
    const runner = createLocalBridgeRunner({
      async send(request) {
        return {
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'Backup written to:\n  /tmp/CodexBackups/codex-backup-mac.tar.gz',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'unit-test-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        };
      },
    });

    const result = await runner.run(buildBackupCommand(defaultConfig));

    expect(result.status).toBe('success');
    expect(result.output).toContain('Backup written to:');
    expect(result.output).toContain('命令类型: 备份执行');
  });

  it('returns an error when helper transport fails', async () => {
    const runner = createLocalBridgeRunner({
      async send() {
        throw new Error('helper offline');
      },
    });

    const result = await runner.run(buildDoctorCommand(defaultConfig));

    expect(result.status).toBe('error');
    expect(result.output).toContain('ERR_HELPER_UNAVAILABLE');
    expect(result.output).toContain('helper offline');
  });
});
