export type BackupTarget = 'local' | 'smb' | 'webdav' | 'rclone';

export type BackupConfig = {
  target: BackupTarget;
  localDir: string;
  smbHost: string;
  smbUser: string;
  smbShare: string;
  webdavUrl: string;
  webdavUser: string;
  rcloneRemote: string;
  encrypt: boolean;
  retentionCount: number;
  retentionDays: number;
};

export const targetLabels: Record<BackupTarget, string> = {
  local: '本地目录',
  smb: 'SMB / NAS',
  webdav: 'WebDAV',
  rclone: 'rclone',
};

export const defaultConfig: BackupConfig = {
  target: 'local',
  localDir: '$HOME/CodexBackups',
  smbHost: 'nas.example.local',
  smbUser: 'backup-user',
  smbShare: 'CodexBackup',
  webdavUrl: 'https://webdav.example.com/remote.php/dav/files/user/CodexBackup',
  webdavUser: 'backup-user',
  rcloneRemote: 'gdrive:CodexBackup',
  encrypt: false,
  retentionCount: 10,
  retentionDays: 30,
};

const quoteEnv = (value: string) => `"${value}"`;
const lineContinuation = ' ' + '\\' + '\n';
const joinEnvLines = (lines: string[]) => lines.join(lineContinuation);

const credentialPlaceholders: Partial<Record<BackupTarget, string[]>> = {
  smb: ['# CODEX_BACKUP_SMB_PASSWORD='],
  webdav: ['# CODEX_BACKUP_WEBDAV_PASSWORD='],
};

export function buildEnvLines(config: BackupConfig): string[] {
  const lines = [
    `CODEX_BACKUP_TARGET=${config.target}`,
    `CODEX_BACKUP_RETENTION_COUNT=${config.retentionCount}`,
    `CODEX_BACKUP_RETENTION_DAYS=${config.retentionDays}`,
    `CODEX_BACKUP_ENCRYPT=${config.encrypt ? 1 : 0}`,
  ];

  if (config.target === 'local') {
    lines.push(`CODEX_BACKUP_LOCAL_DIR=${quoteEnv(config.localDir)}`);
  }
  if (config.target === 'smb') {
    lines.push(`CODEX_BACKUP_SMB_HOST=${config.smbHost}`);
    lines.push(`CODEX_BACKUP_SMB_USER=${config.smbUser}`);
    lines.push(`CODEX_BACKUP_SMB_SHARE=${config.smbShare}`);
  }
  if (config.target === 'webdav') {
    lines.push(`CODEX_BACKUP_WEBDAV_URL=${quoteEnv(config.webdavUrl)}`);
    lines.push(`CODEX_BACKUP_WEBDAV_USER=${config.webdavUser}`);
  }
  if (config.target === 'rclone') {
    lines.push(`CODEX_BACKUP_RCLONE_REMOTE=${quoteEnv(config.rcloneRemote)}`);
  }

  return lines;
}

export function buildDoctorCommand(config: BackupConfig): string {
  return `./scripts/codexbackup.sh --doctor --target ${config.target}`;
}

export function buildBackupCommand(config: BackupConfig): string {
  return `${joinEnvLines(buildEnvLines(config))}${lineContinuation}./scripts/codexbackup.sh --target ${config.target}`;
}

export function buildEnvFile(config: BackupConfig): string {
  return [
    '# Codex-Backup-toolkit config.env 预览',
    '# 请在本地补充密钥后再 source 此文件。',
    ...buildEnvLines(config),
    ...(credentialPlaceholders[config.target] ?? []),
    '',
  ].join('\n');
}

export function buildValidateCommand(config: BackupConfig): string {
  return `CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.${config.target}${lineContinuation}${joinEnvLines(buildEnvLines(config))}${lineContinuation}./scripts/codexinstallautomation.sh validate`;
}

export function buildRestoreCommand(archivePath: string, encrypted: boolean): string {
  const identity = encrypted ? ' --age-identity /path/to/age-identity.txt' : '';
  return `./scripts/codexrestore.sh --archive ${archivePath}${identity}`;
}

export function buildRestoreLatestCommand(config: BackupConfig): string {
  return `${joinEnvLines(buildEnvLines(config))}${lineContinuation}./scripts/codexrestore.sh --latest`;
}
