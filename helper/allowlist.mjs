const schema = 'codex-backup-helper.v1';
const allowedTargets = new Set(['local', 'smb', 'webdav', 'rclone']);
import { buildCommandFromAction, classifyAction } from './actions.mjs';

export { schema };

export function classifyHelperCommand(request) {
  if (!request || typeof request !== 'object') {
    return { allowed: false, reason: 'Request body must be a JSON object.' };
  }

  if (request.schema !== schema || request.version !== 1) {
    return { allowed: false, reason: 'Unsupported helper protocol schema or version.' };
  }

  if (typeof request.requestId !== 'string' || request.requestId.trim() === '') {
    return { allowed: false, reason: 'requestId is required.' };
  }

  if (request.action !== undefined) {
    const classification = classifyAction(request.action);
    if (!classification.allowed) return classification;
    if (request.kind !== classification.kind) {
      return { allowed: false, reason: 'Request kind does not match structured action kind.' };
    }
    return { ...classification, command: buildCommandFromAction(request.action) };
  }

  if (request.kind !== 'doctor' && request.kind !== 'validate' && request.kind !== 'backup' && request.kind !== 'sync' && request.kind !== 'profilePlan') {
    return { allowed: false, reason: 'Only doctor, profile plan, backup, sync, and isolated validate requests are allowed.' };
  }

  if (typeof request.command !== 'string' || request.command.trim() === '') {
    return { allowed: false, reason: 'command is required.' };
  }

  if (request.kind === 'doctor') {
    return classifyDoctorCommand(request.command);
  }

  if (request.kind === 'backup') {
    return classifyBackupCommand(request.command);
  }

  if (request.kind === 'sync') {
    return classifySyncCommand(request.command);
  }

  if (request.kind === 'profilePlan') {
    return classifyProfilePlanCommand(request.command);
  }

  return classifyValidateCommand(request.command);
}

function classifyProfilePlanCommand(command) {
  const lines = parseSafeCommandLines(command);
  if (!lines.ok) return lines;

  const match = lines.finalLine.match(/^\.\/scripts\/codexbackup\.sh --profile-plan --platform (darwin|win32)$/);
  if (!match || Object.keys(lines.env).length > 0) {
    return { allowed: false, reason: 'Only read-only codexbackup profile plan commands for darwin or win32 are allowed.' };
  }

  return { allowed: true, kind: 'profilePlan' };
}

function classifyDoctorCommand(command) {
  const lines = parseSafeCommandLines(command);
  if (!lines.ok) return lines;

  const finalLine = lines.finalLine;
  const match = finalLine.match(/^\.\/scripts\/codexbackup\.sh --doctor --target ([a-z]+)$/);
  if (!match || !allowedTargets.has(match[1]) || (lines.env.CODEX_BACKUP_TARGET && lines.env.CODEX_BACKUP_TARGET !== match[1])) {
    return { allowed: false, reason: 'Only codexbackup doctor commands for known targets are allowed.' };
  }

  return { allowed: true, kind: 'doctor' };
}

function classifyBackupCommand(command) {
  const lines = parseSafeCommandLines(command);
  if (!lines.ok) return lines;

  const match = lines.finalLine.match(/^\.\/scripts\/codexbackup\.sh --target ([a-z]+)$/);
  if (!match || !allowedTargets.has(match[1]) || lines.env.CODEX_BACKUP_TARGET !== match[1]) {
    return { allowed: false, reason: 'Only codexbackup backup commands for known targets are allowed.' };
  }

  if (lines.env.CODEX_BACKUP_ENCRYPT === '1' && !lines.env.CODEX_BACKUP_AGE_RECIPIENT && !lines.env.CODEX_BACKUP_AGE_RECIPIENT_FILE) {
    return { allowed: false, reason: 'Encrypted backup commands require CODEX_BACKUP_AGE_RECIPIENT or CODEX_BACKUP_AGE_RECIPIENT_FILE.' };
  }

  return { allowed: true, kind: 'backup' };
}

function classifySyncCommand(command) {
  const lines = parseSafeCommandLines(command);
  if (!lines.ok) return lines;

  const match = lines.finalLine.match(/^\.\/scripts\/codexbackup\.sh --sync-(check|local-authoritative) --target ([a-z]+)$/);
  const target = match?.[2];
  if (!match || (target !== 'local' && target !== 'smb') || lines.env.CODEX_BACKUP_TARGET !== target) {
    return { allowed: false, reason: 'Only local authoritative sync commands for local and smb targets are allowed.' };
  }

  if (lines.env.CODEX_BACKUP_ENCRYPT === '1' && !lines.env.CODEX_BACKUP_AGE_RECIPIENT && !lines.env.CODEX_BACKUP_AGE_RECIPIENT_FILE) {
    return { allowed: false, reason: 'Encrypted sync commands require CODEX_BACKUP_AGE_RECIPIENT or CODEX_BACKUP_AGE_RECIPIENT_FILE.' };
  }

  return { allowed: true, kind: 'sync' };
}

function classifyValidateCommand(command) {
  if (/[;`]|\$\(/.test(command)) {
    return { allowed: false, reason: 'Validate commands cannot include shell command separators or substitutions.' };
  }

  const hasValidateAction = command.includes('./scripts/codexinstallautomation.sh validate');
  const labelMatch = command.match(/CODEX_BACKUP_LAUNCHD_LABEL=dev\.codexbackup\.toolkit\.test\.([a-z]+)/);

  if (!hasValidateAction || !labelMatch || !allowedTargets.has(labelMatch[1])) {
    return { allowed: false, reason: 'Only isolated codexinstallautomation validate commands are allowed.' };
  }

  if (/\.\/scripts\/codexinstallautomation\.sh\s+(install|uninstall|status)/.test(command)) {
    return { allowed: false, reason: 'Install, uninstall, and status are not allowed through the helper.' };
  }

  const nonEmptyLines = command
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const finalLine = nonEmptyLines.at(-1) ?? '';
  if (finalLine !== './scripts/codexinstallautomation.sh validate') {
    return { allowed: false, reason: 'Validate commands must end with the isolated validate action.' };
  }

  const envLines = nonEmptyLines.slice(0, -1).map((line) => line.replace(/\\$/, '').trim());
  const envPattern = /^[A-Z0-9_]+=("[^"]*"|[^\s]+)$/;
  if (!envLines.every((line) => envPattern.test(line))) {
    return { allowed: false, reason: 'Validate commands may only contain simple environment assignments.' };
  }

  return { allowed: true, kind: 'validate' };
}

function parseSafeCommandLines(command) {
  if (/[;`]|\$\(|&&|\|\|/.test(command)) {
    return { allowed: false, reason: 'Commands cannot include shell command separators or substitutions.' };
  }

  const nonEmptyLines = command
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const finalLine = nonEmptyLines.at(-1) ?? '';
  const envLines = nonEmptyLines.slice(0, -1).map((line) => line.replace(/\\$/, '').trim());
  const envPattern = /^[A-Z0-9_]+=("[^"]*"|[^\s]+)$/;

  if (!envLines.every((line) => envPattern.test(line))) {
    return { allowed: false, reason: 'Commands may only contain simple environment assignments.' };
  }

  return {
    ok: true,
    finalLine,
    env: Object.fromEntries(envLines.map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const rawValue = line.slice(separator + 1);
      return [key, rawValue.replace(/^"(.*)"$/, '$1')];
    })),
  };
}
