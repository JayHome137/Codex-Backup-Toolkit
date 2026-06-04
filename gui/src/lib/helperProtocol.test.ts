import { describe, expect, it } from 'vitest';
import { buildBackupCommand, buildDoctorCommand, buildValidateCommand, defaultConfig } from './config';
import { buildHelperRequest, createMockHelperTransport, runHelperCommand } from './helperProtocol';

describe('helper protocol', () => {
  it('builds a versioned helper request for allowed doctor commands', () => {
    const request = buildHelperRequest(buildDoctorCommand(defaultConfig));

    expect(request).toMatchObject({
      schema: 'codex-backup-helper.v1',
      version: 1,
      kind: 'doctor',
      command: './scripts/codexbackup.sh --doctor --target local',
    });
    expect(request.requestId).toMatch(/^cbt_/);
    expect(request.createdAt).toMatch(/T/);
  });

  it('builds a versioned helper request for isolated validate commands', () => {
    const request = buildHelperRequest(buildValidateCommand(defaultConfig));

    expect(request.kind).toBe('validate');
    expect(request.command).toContain('CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.local');
  });

  it('throws a typed allowlist error when request creation receives a blocked command', () => {
    expect(() => buildHelperRequest(buildBackupCommand(defaultConfig))).toThrow('ERR_COMMAND_NOT_ALLOWED');
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
    expect(response.stdout).toContain('Mock helper accepted doctor');
  });
});
