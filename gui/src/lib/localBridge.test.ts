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

  it('blocks backup commands', () => {
    expect(classifyLocalCommand(buildBackupCommand(defaultConfig))).toEqual({
      allowed: false,
      reason: 'Only doctor and isolated validate are allowed in the Web bridge prototype.',
    });
  });

  it('blocks restore commands', () => {
    expect(classifyLocalCommand(buildRestoreCommand('/tmp/archive.tar.gz', false))).toEqual({
      allowed: false,
      reason: 'Only doctor and isolated validate are allowed in the Web bridge prototype.',
    });
  });

  it('blocks non-isolated automation actions', () => {
    expect(classifyLocalCommand('./scripts/codexinstallautomation.sh install')).toEqual({
      allowed: false,
      reason: 'Only isolated codexinstallautomation validate commands are allowed.',
    });
  });

  it('returns warning output when a blocked command is run', async () => {
    const runner = createLocalBridgeRunner();
    const result = await runner.run(buildBackupCommand(defaultConfig));

    expect(result.status).toBe('warning');
    expect(result.output).toContain('Blocked by Web bridge allowlist');
  });
});
