import { describe, expect, it } from 'vitest';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildRestoreCommand,
  buildValidateCommand,
  defaultConfig,
  targetLabels,
} from './config';

describe('command builders', () => {
  it('lists all supported target labels', () => {
    expect(targetLabels).toEqual({
      local: 'Local Folder',
      smb: 'SMB / NAS',
      webdav: 'WebDAV',
      rclone: 'rclone',
    });
  });

  it('builds a local backup command with output directory', () => {
    const command = buildBackupCommand(defaultConfig);

    expect(command).toContain('./scripts/codexbackup.sh --target local');
    expect(command).toContain('CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups"');
    expect(command).not.toContain('\n+');
  });

  it('builds target-specific doctor command', () => {
    expect(buildDoctorCommand({ ...defaultConfig, target: 'webdav' })).toBe(
      './scripts/codexbackup.sh --doctor --target webdav',
    );
  });

  it('builds isolated launchd validate command', () => {
    expect(buildValidateCommand(defaultConfig)).toContain('CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test');
    expect(buildValidateCommand(defaultConfig)).toContain('./scripts/codexinstallautomation.sh validate');
  });

  it('builds restore preview command for encrypted archive', () => {
    const command = buildRestoreCommand('/tmp/codex-backup.tar.gz.age', true);

    expect(command).toContain('./scripts/codexrestore.sh --archive /tmp/codex-backup.tar.gz.age');
    expect(command).toContain('--age-identity /path/to/age-identity.txt');
  });
});
