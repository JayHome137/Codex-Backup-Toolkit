import { describe, expect, it } from 'vitest';
import { buildBackupCommand, buildDoctorCommand, buildValidateCommand, defaultConfig } from './config';
import { checkHelperHealth, buildHelperRequest, createHttpHelperTransport, createMockHelperTransport, runHelperCommand } from './helperProtocol';

describe('helper protocol', () => {
  it('builds a versioned helper request for allowed doctor commands', () => {
    const request = buildHelperRequest(buildDoctorCommand(defaultConfig));

    expect(request).toMatchObject({
      schema: 'codex-backup-helper.v1',
      version: 1,
      kind: 'doctor',
    });
    expect(request.command).toContain('CODEX_BACKUP_TARGET=local');
    expect(request.command).toContain('./scripts/codexbackup.sh --doctor --target local');
    expect(request.requestId).toMatch(/^cbt_/);
    expect(request.createdAt).toMatch(/T/);
  });

  it('builds a versioned helper request for isolated validate commands', () => {
    const request = buildHelperRequest(buildValidateCommand(defaultConfig));

    expect(request.kind).toBe('validate');
    expect(request.command).toContain('CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.local');
  });

  it('builds a versioned helper request for backup commands', () => {
    const request = buildHelperRequest(buildBackupCommand(defaultConfig));

    expect(request.kind).toBe('backup');
    expect(request.command).toContain('CODEX_BACKUP_TARGET=local');
    expect(request.command).toContain('./scripts/codexbackup.sh --target local');
  });

  it('throws a typed allowlist error when request creation receives a blocked command', () => {
    expect(() => buildHelperRequest('./scripts/codexrestore.sh --latest')).toThrow('ERR_COMMAND_NOT_ALLOWED');
  });

  it('returns success-shaped output and audit fields from the mock helper', async () => {
    const response = await runHelperCommand(buildDoctorCommand(defaultConfig), createMockHelperTransport());

    expect(response).toMatchObject({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      exitCode: 0,
      stderr: '',
      audit: {
        decision: 'allowed',
        commandKind: 'doctor',
        helper: 'mock-helper',
      },
    });
    expect(response.requestId).toMatch(/^cbt_/);
    expect(response.stdout).toContain('模拟助手已接受环境检查');
  });

  it('sends allowed requests to the HTTP helper /run endpoint', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const transport = createHttpHelperTransport('http://127.0.0.1:37371', async (input, init) => {
      calls.push({ input, init });
      const request = JSON.parse(String(init?.body));

      return new Response(
        JSON.stringify({
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
            helper: 'node-local-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const response = await runHelperCommand(buildDoctorCommand(defaultConfig), transport);

    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe('http://127.0.0.1:37371/run');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(response.stdout).toBe('doctor ok');
    expect(response.audit.helper).toBe('node-local-helper');
  });

  it('throws a typed unavailable error when the HTTP helper cannot be reached', async () => {
    const transport = createHttpHelperTransport('http://127.0.0.1:37371', async () => {
      throw new TypeError('fetch failed');
    });

    await expect(runHelperCommand(buildDoctorCommand(defaultConfig), transport)).rejects.toThrow('ERR_HELPER_UNAVAILABLE');
  });

  it('checks the HTTP helper health endpoint', async () => {
    const calls: Array<RequestInfo | URL> = [];
    const health = await checkHelperHealth('http://127.0.0.1:37371', async (input) => {
      calls.push(input);
      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          helper: 'node-local-helper',
          host: '127.0.0.1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    expect(String(calls[0])).toBe('http://127.0.0.1:37371/health');
    expect(health).toEqual({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      helper: 'node-local-helper',
      host: '127.0.0.1',
    });
  });

  it('throws a typed unavailable error when helper health cannot be reached', async () => {
    await expect(
      checkHelperHealth('http://127.0.0.1:37371', async () => {
        throw new TypeError('fetch failed');
      }),
    ).rejects.toThrow('ERR_HELPER_UNAVAILABLE');
  });
});
