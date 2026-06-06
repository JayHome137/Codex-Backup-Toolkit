import type { BackupConfig, BackupTarget } from './config';

export type BackupAction = {
  type: 'backup';
  target: BackupTarget;
  config: {
    localDir?: string;
    smbHost?: string;
    smbUser?: string;
    smbShare?: string;
    webdavUrl?: string;
    webdavUser?: string;
    rcloneRemote?: string;
    retentionCount: number;
    retentionDays: number;
    remoteRetention: boolean;
    encrypt: boolean;
    ageRecipient: string;
    ageRecipientFile: string;
  };
};

export type RestorePlanAction = {
  type: 'restorePlan';
  source: 'archive' | 'latest';
  target?: BackupTarget;
  config?: Partial<BackupAction['config']>;
  archivePath?: string;
  encrypted?: boolean;
  ageIdentity?: string;
};

export type SyncLocalAuthoritativeAction = {
  type: 'syncLocalAuthoritative';
  target: BackupTarget;
  config: BackupAction['config'] & {
    checkIntervalHours: number;
    minBackupIntervalHours: number;
  };
};

export type HelperAction = BackupAction | RestorePlanAction | SyncLocalAuthoritativeAction;

export function buildBackupAction(config: BackupConfig): BackupAction {
  return {
    type: 'backup',
    target: config.target,
    config: {
      ...targetConfig(config),
      retentionCount: config.retentionCount,
      retentionDays: config.retentionDays,
      remoteRetention: config.remoteRetention,
      encrypt: config.encrypt,
      ageRecipient: config.ageRecipient,
      ageRecipientFile: config.ageRecipientFile,
    },
  };
}

export function buildSyncLocalAuthoritativeAction(config: BackupConfig): SyncLocalAuthoritativeAction {
  return {
    type: 'syncLocalAuthoritative',
    target: config.target,
    config: {
      ...targetConfig(config),
      retentionCount: config.retentionCount,
      retentionDays: config.retentionDays,
      remoteRetention: config.remoteRetention,
      checkIntervalHours: config.syncCheckIntervalHours,
      minBackupIntervalHours: config.syncMinBackupIntervalHours,
      encrypt: config.encrypt,
      ageRecipient: config.ageRecipient,
      ageRecipientFile: config.ageRecipientFile,
    },
  };
}

export function buildRestorePlanAction(archivePath: string, encrypted: boolean, ageIdentity = '/path/to/age-identity.txt'): RestorePlanAction {
  return {
    type: 'restorePlan',
    source: 'archive',
    archivePath,
    encrypted,
    ...(encrypted && ageIdentity ? { ageIdentity } : {}),
  };
}

export function buildLatestRestorePlanAction(config: BackupConfig): RestorePlanAction {
  return {
    type: 'restorePlan',
    source: 'latest',
    target: config.target,
    config: targetConfig(config),
    encrypted: config.encrypt,
    ...(config.encrypt && config.ageRecipientFile ? { ageIdentity: config.ageRecipientFile } : {}),
  };
}

function targetConfig(config: BackupConfig): Partial<BackupAction['config']> {
  if (config.target === 'local') return { localDir: config.localDir };
  if (config.target === 'smb') return { smbHost: config.smbHost, smbUser: config.smbUser, smbShare: config.smbShare };
  if (config.target === 'webdav') return { webdavUrl: config.webdavUrl, webdavUser: config.webdavUser };
  return { rcloneRemote: config.rcloneRemote };
}
