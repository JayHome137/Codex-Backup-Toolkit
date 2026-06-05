import { describe, expect, it } from 'vitest';
import { buildBackupAction, buildLatestRestorePlanAction, buildRestorePlanAction } from './actions';
import { defaultConfig } from './config';

describe('structured helper actions', () => {
  it('builds backup actions from GUI config without credential secrets', () => {
    expect(buildBackupAction(defaultConfig)).toEqual({
      type: 'backup',
      target: 'local',
      config: {
        localDir: '$HOME/CodexBackups',
        retentionCount: 10,
        retentionDays: 30,
        remoteRetention: false,
        encrypt: false,
        ageRecipient: '',
        ageRecipientFile: '',
      },
    });
  });

  it('builds archive restore plan actions', () => {
    expect(buildRestorePlanAction('/tmp/codex-backup.tar.gz.age', true, '/tmp/identity.txt')).toEqual({
      type: 'restorePlan',
      source: 'archive',
      archivePath: '/tmp/codex-backup.tar.gz.age',
      encrypted: true,
      ageIdentity: '/tmp/identity.txt',
    });
  });

  it('builds latest restore plan actions with target config', () => {
    expect(buildLatestRestorePlanAction({ ...defaultConfig, target: 'rclone', rcloneRemote: 'gdrive:CodexBackup' })).toEqual({
      type: 'restorePlan',
      source: 'latest',
      target: 'rclone',
      config: {
        rcloneRemote: 'gdrive:CodexBackup',
      },
      encrypted: false,
    });
  });
});
