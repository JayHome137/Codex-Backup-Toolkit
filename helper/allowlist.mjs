const schema = 'codex-backup-helper.v1';
const allowedTargets = new Set(['local', 'smb', 'webdav', 'rclone']);

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

  if (request.kind !== 'doctor' && request.kind !== 'validate') {
    return { allowed: false, reason: 'Only doctor and isolated validate requests are allowed.' };
  }

  if (typeof request.command !== 'string' || request.command.trim() === '') {
    return { allowed: false, reason: 'command is required.' };
  }

  if (request.kind === 'doctor') {
    return classifyDoctorCommand(request.command);
  }

  return classifyValidateCommand(request.command);
}

function classifyDoctorCommand(command) {
  const match = command.match(/^\.\/scripts\/codexbackup\.sh --doctor --target ([a-z]+)$/);
  if (!match || !allowedTargets.has(match[1])) {
    return { allowed: false, reason: 'Only codexbackup doctor commands for known targets are allowed.' };
  }

  return { allowed: true, kind: 'doctor' };
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
