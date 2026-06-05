import { describe, expect, it } from 'vitest';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildEnvFile,
  buildRestoreCommand,
  buildValidateCommand,
  defaultConfig,
  targetLabels,
} from './config';

describe('command builders', () => {
  it('lists all supported target labels', () => {
    expect(targetLabels).toEqual({
      local: '本地目录',
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

  it('builds a config.env preview without credential secrets', () => {
    const envFile = buildEnvFile({ ...defaultConfig, target: 'webdav', encrypt: true });

    expect(envFile).toContain('# Codex-Backup-toolkit config.env 预览');
    expect(envFile).toContain('CODEX_BACKUP_TARGET=webdav');
    expect(envFile).toContain('CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup"');
    expect(envFile).toContain('CODEX_BACKUP_ENCRYPT=1');
    expect(envFile).toContain('# CODEX_BACKUP_WEBDAV_PASSWORD=');
    expect(envFile).not.toContain('PASSWORD=backup-user');
  });
});
