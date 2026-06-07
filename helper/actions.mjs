const allowedTargets = new Set(['local', 'smb', 'webdav', 'rclone']);
const allowedProfilePlanPlatforms = new Set(['darwin', 'win32']);

export function classifyAction(action) {
  if (!action || typeof action !== 'object') {
    return { allowed: false, reason: 'Action must be a JSON object.' };
  }

  if (action.type === 'backup') {
    return classifyBackupAction(action);
  }

  if (action.type === 'syncLocalAuthoritative') {
    return classifySyncAction(action);
  }

  if (action.type === 'restorePlan') {
    return classifyRestorePlanAction(action);
  }

  if (action.type === 'profilePlan') {
    return classifyProfilePlanAction(action);
  }

  return { allowed: false, reason: `Unsupported helper action: ${String(action.type)}.` };
}

export function buildCommandFromAction(action) {
  const classification = classifyAction(action);
  if (!classification.allowed) {
    throw new Error(classification.reason);
  }

  if (action.type === 'backup') {
    return buildBackupCommand(action);
  }

  if (action.type === 'syncLocalAuthoritative') {
    return buildSyncCommand(action);
  }

  if (action.type === 'restorePlan') {
    return buildRestorePlanCommand(action);
  }

  if (action.type === 'profilePlan') {
    return buildProfilePlanCommand(action);
  }

  throw new Error(`Unsupported helper action: ${String(action.type)}.`);
}

function classifyBackupAction(action) {
  if (!allowedTargets.has(action.target)) {
    return { allowed: false, reason: `Unsupported backup target: ${String(action.target)}.` };
  }

  const config = action.config && typeof action.config === 'object' ? action.config : {};
  if (config.encrypt === true && !stringValue(config.ageRecipient) && !stringValue(config.ageRecipientFile)) {
    return { allowed: false, reason: 'Encrypted backup actions require ageRecipient or ageRecipientFile.' };
  }

  const targetCheck = validateTargetConfig('backup', action.target, config);
  if (!targetCheck.allowed) return targetCheck;

  return { allowed: true, kind: 'backup' };
}

function classifySyncAction(action) {
  if (action.target !== 'local' && action.target !== 'smb') {
    return { allowed: false, reason: `Local authoritative sync currently supports local and smb targets: ${String(action.target)}.` };
  }

  const config = action.config && typeof action.config === 'object' ? action.config : {};
  if (config.encrypt === true && !stringValue(config.ageRecipient) && !stringValue(config.ageRecipientFile)) {
    return { allowed: false, reason: 'Encrypted sync actions require ageRecipient or ageRecipientFile.' };
  }

  const targetCheck = validateTargetConfig('sync', action.target, config);
  if (!targetCheck.allowed) return targetCheck;

  return { allowed: true, kind: 'sync' };
}

function classifyRestorePlanAction(action) {
  if (action.source !== 'archive' && action.source !== 'latest') {
    return { allowed: false, reason: 'Restore plan actions require source archive or latest.' };
  }
  if (action.source === 'archive' && !stringValue(action.archivePath)) {
    return { allowed: false, reason: 'Archive restore plan actions require archivePath.' };
  }
  if (action.source === 'latest' && !allowedTargets.has(action.target)) {
    return { allowed: false, reason: `Unsupported restore plan target: ${String(action.target)}.` };
  }
  if (action.source === 'latest') {
    const config = action.config && typeof action.config === 'object' ? action.config : {};
    const targetCheck = validateTargetConfig('restore plan', action.target, config);
    if (!targetCheck.allowed) return targetCheck;
  }
  return { allowed: true, kind: 'restorePlan' };
}

function classifyProfilePlanAction(action) {
  const profile = action.profile ?? 'codex';
  const platform = action.platform ?? 'darwin';
  if (profile !== 'codex') {
    return { allowed: false, reason: `Unsupported profile plan profile: ${String(profile)}.` };
  }
  if (!allowedProfilePlanPlatforms.has(platform)) {
    return { allowed: false, reason: `Unsupported profile plan platform: ${String(platform)}.` };
  }
  return { allowed: true, kind: 'profilePlan' };
}

function buildBackupCommand(action) {
  const config = action.config ?? {};
  const lines = buildBackupEnvLines(action.target, config);
  return formatCommand(lines, `./scripts/codexbackup.sh --target ${action.target}`);
}

function buildSyncCommand(action) {
  const config = action.config ?? {};
  const lines = [
    `CODEX_BACKUP_TARGET=${action.target}`,
    `CODEX_BACKUP_RETENTION_COUNT=${numberValue(config.retentionCount)}`,
    `CODEX_BACKUP_RETENTION_DAYS=${numberValue(config.retentionDays)}`,
    `CODEX_BACKUP_REMOTE_RETENTION=${config.remoteRetention ? 1 : 0}`,
    `CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=${positiveNumberValue(config.checkIntervalHours, 24)}`,
    `CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=${positiveNumberValue(config.minBackupIntervalHours, 24)}`,
    `CODEX_BACKUP_ENCRYPT=${config.encrypt ? 1 : 0}`,
  ];

  appendEncryptionEnv(lines, config);
  appendTargetEnv(lines, action.target, config);

  return formatCommand(lines, `./scripts/codexbackup.sh --sync-local-authoritative --target ${action.target}`);
}

function buildBackupEnvLines(target, config) {
  const lines = [
    `CODEX_BACKUP_TARGET=${target}`,
    `CODEX_BACKUP_RETENTION_COUNT=${numberValue(config.retentionCount)}`,
    `CODEX_BACKUP_RETENTION_DAYS=${numberValue(config.retentionDays)}`,
    `CODEX_BACKUP_REMOTE_RETENTION=${config.remoteRetention ? 1 : 0}`,
    `CODEX_BACKUP_ENCRYPT=${config.encrypt ? 1 : 0}`,
  ];

  appendEncryptionEnv(lines, config);
  appendTargetEnv(lines, target, config);
  return lines;
}

function appendEncryptionEnv(lines, config) {
  if (!config.encrypt) return;

  lines.push('CODEX_BACKUP_ENCRYPTION=age');
  if (stringValue(config.ageRecipient)) lines.push(`CODEX_BACKUP_AGE_RECIPIENT=${quote(config.ageRecipient.trim())}`);
  if (stringValue(config.ageRecipientFile)) lines.push(`CODEX_BACKUP_AGE_RECIPIENT_FILE=${quote(config.ageRecipientFile.trim())}`);
}

function appendTargetEnv(lines, target, config) {
  if (target === 'local') lines.push(`CODEX_BACKUP_LOCAL_DIR=${quote(config.localDir.trim())}`);
  if (target === 'smb') {
    lines.push(`CODEX_BACKUP_SMB_HOST=${quote(config.smbHost.trim())}`);
    lines.push(`CODEX_BACKUP_SMB_USER=${quote(config.smbUser.trim())}`);
    lines.push(`CODEX_BACKUP_SMB_SHARE=${quote(config.smbShare.trim())}`);
  }
  if (target === 'webdav') {
    lines.push(`CODEX_BACKUP_WEBDAV_URL=${quote(config.webdavUrl.trim())}`);
    lines.push(`CODEX_BACKUP_WEBDAV_USER=${quote(config.webdavUser.trim())}`);
  }
  if (target === 'rclone') lines.push(`CODEX_BACKUP_RCLONE_REMOTE=${quote(config.rcloneRemote.trim())}`);
}

function buildRestorePlanCommand(action) {
  const lines = [];
  const config = action.config ?? {};
  if (action.source === 'latest') {
    lines.push(`CODEX_BACKUP_TARGET=${action.target}`);
    if (action.target === 'local') lines.push(`CODEX_BACKUP_LOCAL_DIR=${quote(config.localDir.trim())}`);
    if (action.target === 'smb') {
      lines.push(`CODEX_BACKUP_SMB_HOST=${quote(config.smbHost.trim())}`);
      lines.push(`CODEX_BACKUP_SMB_USER=${quote(config.smbUser.trim())}`);
      lines.push(`CODEX_BACKUP_SMB_SHARE=${quote(config.smbShare.trim())}`);
    }
    if (action.target === 'webdav') {
      lines.push(`CODEX_BACKUP_WEBDAV_URL=${quote(config.webdavUrl.trim())}`);
      lines.push(`CODEX_BACKUP_WEBDAV_USER=${quote(config.webdavUser.trim())}`);
    }
    if (action.target === 'rclone') lines.push(`CODEX_BACKUP_RCLONE_REMOTE=${quote(config.rcloneRemote.trim())}`);
  }

  const args = ['./scripts/codexrestore.sh', '--plan'];
  if (action.source === 'latest') {
    args.push('--latest');
  } else {
    args.push('--archive', quote(action.archivePath));
  }
  if (stringValue(action.ageIdentity)) {
    args.push('--age-identity', quote(action.ageIdentity));
  }
  const command = args.join(' ');
  return lines.length > 0 ? formatCommand(lines, command) : command;
}

function buildProfilePlanCommand(action) {
  const platform = action.platform ?? 'darwin';
  return `./scripts/codexbackup.sh --profile-plan --platform ${platform}`;
}

function formatCommand(lines, command) {
  return `${lines.map((line) => `${line} \\`).join('\n')}\n${command}`;
}

function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function validateTargetConfig(actionLabel, target, config) {
  if (target === 'local' && !stringValue(config.localDir)) {
    return { allowed: false, reason: `Local ${actionLabel} actions require localDir.` };
  }
  if (target === 'smb' && (!stringValue(config.smbHost) || !stringValue(config.smbUser) || !stringValue(config.smbShare))) {
    return { allowed: false, reason: `SMB ${actionLabel} actions require smbHost, smbUser, and smbShare.` };
  }
  if (target === 'webdav' && (!stringValue(config.webdavUrl) || !stringValue(config.webdavUser))) {
    return { allowed: false, reason: `WebDAV ${actionLabel} actions require webdavUrl and webdavUser.` };
  }
  if (target === 'rclone' && !stringValue(config.rcloneRemote)) {
    return { allowed: false, reason: `rclone ${actionLabel} actions require rcloneRemote.` };
  }
  return { allowed: true };
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function numberValue(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function positiveNumberValue(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
