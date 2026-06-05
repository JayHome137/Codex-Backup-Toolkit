import { describe, expect, it } from 'vitest';
import {
  buildBackupCommand,
  buildDoctorCommand,
  buildEnvFile,
  buildRestoreCommand,
  buildRestoreLatestCommand,
  buildValidateCommand,
  defaultConfig,
  getConfigChecks,
  targetLabels,
  type ConfigCheck,
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

  it('builds target-specific doctor command with the same environment as backup runs', () => {
    const command = buildDoctorCommand({ ...defaultConfig, target: 'webdav' });

    expect(command).toContain('CODEX_BACKUP_TARGET=webdav');
    expect(command).toContain('CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup"');
    expect(command).toContain('./scripts/codexbackup.sh --doctor --target webdav');
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

  it('builds latest restore command with target environment', () => {
    const command = buildRestoreLatestCommand({ ...defaultConfig, target: 'rclone' });

    expect(command).toContain('CODEX_BACKUP_TARGET=rclone');
    expect(command).toContain('CODEX_BACKUP_RCLONE_REMOTE="gdrive:CodexBackup"');
    expect(command).toContain('./scripts/codexrestore.sh --latest');
  });

  it('builds a config.env preview without credential secrets', () => {
    const envFile = buildEnvFile({
      ...defaultConfig,
      target: 'webdav',
      encrypt: true,
      ageRecipient: 'age1example',
    });

    expect(envFile).toContain('# Codex-Backup-toolkit config.env 预览');
    expect(envFile).toContain('CODEX_BACKUP_TARGET=webdav');
    expect(envFile).toContain('CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/remote.php/dav/files/user/CodexBackup"');
    expect(envFile).toContain('CODEX_BACKUP_ENCRYPT=1');
    expect(envFile).toContain('CODEX_BACKUP_ENCRYPTION=age');
    expect(envFile).toContain('CODEX_BACKUP_AGE_RECIPIENT=age1example');
    expect(envFile).toContain('CODEX_BACKUP_REMOTE_RETENTION=0');
    expect(envFile).toContain('# CODEX_BACKUP_WEBDAV_PASSWORD=');
    expect(envFile).not.toContain('PASSWORD=backup-user');
  });

  it('includes opt-in remote retention in command previews', () => {
    const command = buildBackupCommand({ ...defaultConfig, target: 'rclone', remoteRetention: true });

    expect(command).toContain('CODEX_BACKUP_REMOTE_RETENTION=1');
    expect(command).toContain('CODEX_BACKUP_RETENTION_COUNT=10');
  });

  it('reports blocking config checks for encrypted backups without age recipients', () => {
    const checks = getConfigChecks({ ...defaultConfig, target: 'webdav', encrypt: true, ageRecipient: '', ageRecipientFile: '' });

    expect(findCheck(checks, 'encryption').status).toBe('error');
    expect(findCheck(checks, 'encryption').detail).toContain('AGE_RECIPIENT');
    expect(findCheck(checks, 'target').status).toBe('ok');
  });

  it('warns when cloud targets are not encrypted', () => {
    const checks = getConfigChecks({ ...defaultConfig, target: 'rclone', encrypt: false });

    expect(findCheck(checks, 'encryption').status).toBe('warning');
    expect(findCheck(checks, 'encryption').detail).toContain('建议开启 age 加密');
  });

  it('flags remote retention that is enabled without a positive count', () => {
    const checks = getConfigChecks({ ...defaultConfig, target: 'webdav', remoteRetention: true, retentionCount: 0 });

    expect(findCheck(checks, 'retention').status).toBe('warning');
    expect(findCheck(checks, 'retention').detail).toContain('保留份数');
  });
});

function findCheck(checks: ConfigCheck[], id: ConfigCheck['id']): ConfigCheck {
  const check = checks.find((item) => item.id === id);
  if (!check) throw new Error(`Missing config check: ${id}`);
  return check;
}
