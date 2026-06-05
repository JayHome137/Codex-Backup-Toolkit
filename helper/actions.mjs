const allowedTargets = new Set(['local', 'smb', 'webdav', 'rclone']);

export function classifyAction(action) {
  if (!action || typeof action !== 'object') {
    return { allowed: false, reason: 'Action must be a JSON object.' };
  }

  if (action.type === 'backup') {
    return classifyBackupAction(action);
  }

  if (action.type === 'restorePlan') {
    return classifyRestorePlanAction(action);
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

  if (action.type === 'restorePlan') {
    return buildRestorePlanCommand(action);
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

  if (action.target === 'local' && !stringValue(config.localDir)) {
    return { allowed: false, reason: 'Local backup actions require localDir.' };
  }
  if (action.target === 'smb' && (!stringValue(config.smbHost) || !stringValue(config.smbUser) || !stringValue(config.smbShare))) {
    return { allowed: false, reason: 'SMB backup actions require smbHost, smbUser, and smbShare.' };
  }
  if (action.target === 'webdav' && (!stringValue(config.webdavUrl) || !stringValue(config.webdavUser))) {
    return { allowed: false, reason: 'WebDAV backup actions require webdavUrl and webdavUser.' };
  }
  if (action.target === 'rclone' && !stringValue(config.rcloneRemote)) {
    return { allowed: false, reason: 'rclone backup actions require rcloneRemote.' };
  }

  return { allowed: true, kind: 'backup' };
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
    if (action.target === 'local' && !stringValue(config.localDir)) {
      return { allowed: false, reason: 'Local restore plan actions require localDir.' };
    }
    if (action.target === 'smb' && (!stringValue(config.smbHost) || !stringValue(config.smbUser) || !stringValue(config.smbShare))) {
      return { allowed: false, reason: 'SMB restore plan actions require smbHost, smbUser, and smbShare.' };
    }
    if (action.target === 'webdav' && (!stringValue(config.webdavUrl) || !stringValue(config.webdavUser))) {
      return { allowed: false, reason: 'WebDAV restore plan actions require webdavUrl and webdavUser.' };
    }
    if (action.target === 'rclone' && !stringValue(config.rcloneRemote)) {
      return { allowed: false, reason: 'rclone restore plan actions require rcloneRemote.' };
    }
  }
  return { allowed: true, kind: 'restorePlan' };
}

function buildBackupCommand(action) {
  const config = action.config ?? {};
  const lines = [
    `CODEX_BACKUP_TARGET=${action.target}`,
    `CODEX_BACKUP_RETENTION_COUNT=${numberValue(config.retentionCount)}`,
    `CODEX_BACKUP_RETENTION_DAYS=${numberValue(config.retentionDays)}`,
    `CODEX_BACKUP_REMOTE_RETENTION=${config.remoteRetention ? 1 : 0}`,
    `CODEX_BACKUP_ENCRYPT=${config.encrypt ? 1 : 0}`,
  ];

  if (config.encrypt) {
    lines.push('CODEX_BACKUP_ENCRYPTION=age');
    if (stringValue(config.ageRecipient)) lines.push(`CODEX_BACKUP_AGE_RECIPIENT=${config.ageRecipient.trim()}`);
    if (stringValue(config.ageRecipientFile)) lines.push(`CODEX_BACKUP_AGE_RECIPIENT_FILE=${quote(config.ageRecipientFile.trim())}`);
  }

  if (action.target === 'local') lines.push(`CODEX_BACKUP_LOCAL_DIR=${quote(config.localDir.trim())}`);
  if (action.target === 'smb') {
    lines.push(`CODEX_BACKUP_SMB_HOST=${config.smbHost.trim()}`);
    lines.push(`CODEX_BACKUP_SMB_USER=${config.smbUser.trim()}`);
    lines.push(`CODEX_BACKUP_SMB_SHARE=${config.smbShare.trim()}`);
  }
  if (action.target === 'webdav') {
    lines.push(`CODEX_BACKUP_WEBDAV_URL=${quote(config.webdavUrl.trim())}`);
    lines.push(`CODEX_BACKUP_WEBDAV_USER=${config.webdavUser.trim()}`);
  }
  if (action.target === 'rclone') lines.push(`CODEX_BACKUP_RCLONE_REMOTE=${quote(config.rcloneRemote.trim())}`);

  return `${lines.join(' \\\n')} \\\n./scripts/codexbackup.sh --target ${action.target}`;
}

function buildRestorePlanCommand(action) {
  const lines = [];
  const config = action.config ?? {};
  if (action.source === 'latest') {
    lines.push(`CODEX_BACKUP_TARGET=${action.target}`);
    if (action.target === 'local') lines.push(`CODEX_BACKUP_LOCAL_DIR=${quote(config.localDir.trim())}`);
    if (action.target === 'smb') {
      lines.push(`CODEX_BACKUP_SMB_HOST=${config.smbHost.trim()}`);
      lines.push(`CODEX_BACKUP_SMB_USER=${config.smbUser.trim()}`);
      lines.push(`CODEX_BACKUP_SMB_SHARE=${config.smbShare.trim()}`);
    }
    if (action.target === 'webdav') {
      lines.push(`CODEX_BACKUP_WEBDAV_URL=${quote(config.webdavUrl.trim())}`);
      lines.push(`CODEX_BACKUP_WEBDAV_USER=${config.webdavUser.trim()}`);
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
  return lines.length > 0 ? `${lines.join(' \\\n')} \\\n${command}` : command;
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function numberValue(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
