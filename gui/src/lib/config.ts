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
  ageRecipient: string;
  ageRecipientFile: string;
  retentionCount: number;
  retentionDays: number;
  remoteRetention: boolean;
};

export type ConfigCheck = {
  id: 'target' | 'encryption' | 'retention' | 'credentials';
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
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
  ageRecipient: '',
  ageRecipientFile: '',
  retentionCount: 10,
  retentionDays: 30,
  remoteRetention: false,
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
    `CODEX_BACKUP_REMOTE_RETENTION=${config.remoteRetention ? 1 : 0}`,
    `CODEX_BACKUP_ENCRYPT=${config.encrypt ? 1 : 0}`,
  ];

  if (config.encrypt) {
    lines.push('CODEX_BACKUP_ENCRYPTION=age');
    if (config.ageRecipient.trim()) {
      lines.push(`CODEX_BACKUP_AGE_RECIPIENT=${config.ageRecipient.trim()}`);
    }
    if (config.ageRecipientFile.trim()) {
      lines.push(`CODEX_BACKUP_AGE_RECIPIENT_FILE=${quoteEnv(config.ageRecipientFile.trim())}`);
    }
  }

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
  return `${joinEnvLines(buildEnvLines(config))}${lineContinuation}./scripts/codexbackup.sh --doctor --target ${config.target}`;
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

export function getConfigChecks(config: BackupConfig): ConfigCheck[] {
  return [
    getTargetCheck(config),
    getCredentialCheck(config),
    getEncryptionCheck(config),
    getRetentionCheck(config),
  ];
}

function getTargetCheck(config: BackupConfig): ConfigCheck {
  if (config.target === 'local') {
    return config.localDir.trim()
      ? { id: 'target', label: '目标端', status: 'ok', detail: '本地输出目录已填写。' }
      : { id: 'target', label: '目标端', status: 'error', detail: '本地输出目录不能为空。' };
  }

  if (config.target === 'smb') {
    const missing = [
      ['CODEX_BACKUP_SMB_HOST', config.smbHost],
      ['CODEX_BACKUP_SMB_USER', config.smbUser],
      ['CODEX_BACKUP_SMB_SHARE', config.smbShare],
    ]
      .filter(([, value]) => !value.trim())
      .map(([name]) => name);
    return missing.length === 0
      ? { id: 'target', label: '目标端', status: 'ok', detail: 'SMB/NAS 目标端基础信息已填写。' }
      : { id: 'target', label: '目标端', status: 'error', detail: `缺少 ${missing.join(', ')}。` };
  }

  if (config.target === 'webdav') {
    const missing = [
      ['CODEX_BACKUP_WEBDAV_URL', config.webdavUrl],
      ['CODEX_BACKUP_WEBDAV_USER', config.webdavUser],
    ]
      .filter(([, value]) => !value.trim())
      .map(([name]) => name);
    return missing.length === 0
      ? { id: 'target', label: '目标端', status: 'ok', detail: 'WebDAV 地址和用户已填写。' }
      : { id: 'target', label: '目标端', status: 'error', detail: `缺少 ${missing.join(', ')}。` };
  }

  return config.rcloneRemote.trim()
    ? { id: 'target', label: '目标端', status: 'ok', detail: 'rclone remote 已填写。' }
    : { id: 'target', label: '目标端', status: 'error', detail: '缺少 CODEX_BACKUP_RCLONE_REMOTE。' };
}

function getCredentialCheck(config: BackupConfig): ConfigCheck {
  if (config.target === 'smb') {
    return {
      id: 'credentials',
      label: '密钥',
      status: 'warning',
      detail: 'SMB 密码不会写入预览配置；请使用 Keychain 或运行前临时导出 CODEX_BACKUP_PASSWORD。',
    };
  }

  if (config.target === 'webdav') {
    return {
      id: 'credentials',
      label: '密钥',
      status: 'warning',
      detail: 'WebDAV 密码不会写入预览配置；请使用 Keychain 或运行前临时导出 CODEX_BACKUP_WEBDAV_PASSWORD。',
    };
  }

  return {
    id: 'credentials',
    label: '密钥',
    status: 'ok',
    detail: config.target === 'rclone' ? 'rclone 凭据由 rclone config 管理。' : '当前目标端不需要在配置中保存密码。',
  };
}

function getEncryptionCheck(config: BackupConfig): ConfigCheck {
  if (config.encrypt) {
    return config.ageRecipient.trim() || config.ageRecipientFile.trim()
      ? { id: 'encryption', label: '加密', status: 'ok', detail: '已启用 age 加密，并配置了收件人或收件人文件。' }
      : {
          id: 'encryption',
          label: '加密',
          status: 'error',
          detail: '启用加密时必须配置 CODEX_BACKUP_AGE_RECIPIENT 或 CODEX_BACKUP_AGE_RECIPIENT_FILE。',
        };
  }

  if (config.target === 'webdav' || config.target === 'rclone') {
    return {
      id: 'encryption',
      label: '加密',
      status: 'warning',
      detail: '云端或第三方存储建议开启 age 加密后再上传。',
    };
  }

  return { id: 'encryption', label: '加密', status: 'ok', detail: '未启用加密；本地或可信 NAS 可按需开启。' };
}

function getRetentionCheck(config: BackupConfig): ConfigCheck {
  if ((config.target === 'webdav' || config.target === 'rclone') && config.remoteRetention && config.retentionCount <= 0) {
    return {
      id: 'retention',
      label: '保留策略',
      status: 'warning',
      detail: '远端保留策略已开启，但保留份数为 0，不会删除旧远端归档。',
    };
  }

  if (config.retentionCount < 0 || config.retentionDays < 0) {
    return { id: 'retention', label: '保留策略', status: 'error', detail: '保留份数和保留天数不能小于 0。' };
  }

  return {
    id: 'retention',
    label: '保留策略',
    status: 'ok',
    detail: config.remoteRetention ? '远端保留策略已显式开启。' : '远端保留策略默认关闭，不会删除云端旧备份。',
  };
}
