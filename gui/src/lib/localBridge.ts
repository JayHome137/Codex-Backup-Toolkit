import type { CommandResult, CommandRunner } from './commands';

type AllowedLocalCommand = {
  allowed: true;
  kind: 'doctor' | 'validate';
};

type BlockedLocalCommand = {
  allowed: false;
  reason: string;
};

export type LocalCommandClassification = AllowedLocalCommand | BlockedLocalCommand;

const generalBlockReason = 'Only doctor and isolated validate are allowed in the Web bridge prototype.';

export function classifyLocalCommand(command: string): LocalCommandClassification {
  if (command.trim() === '' || command.includes('codexrestore.sh') || command.includes('codexbackup.sh --target')) {
    return { allowed: false, reason: generalBlockReason };
  }

  if (command.includes('codexinstallautomation.sh')) {
    const isValidate = command.includes('./scripts/codexinstallautomation.sh validate');
    const isIsolated = command.includes('CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.');
    if (isValidate && isIsolated) {
      return { allowed: true, kind: 'validate' };
    }
    return { allowed: false, reason: 'Only isolated codexinstallautomation validate commands are allowed.' };
  }

  if (command.startsWith('./scripts/codexbackup.sh --doctor --target ')) {
    return { allowed: true, kind: 'doctor' };
  }

  return { allowed: false, reason: generalBlockReason };
}

export function createLocalBridgeRunner(): CommandRunner {
  return {
    async run(command: string): Promise<CommandResult> {
      const classification = classifyLocalCommand(command);

      if (!classification.allowed) {
        return {
          status: 'warning',
          output: `Blocked by Web bridge allowlist.\n\n${classification.reason}\n\nCommand:\n${command}`,
        };
      }

      return {
        status: 'warning',
        output: `Native helper not connected yet.\n\nAllowed command kind: ${classification.kind}\n\nCommand:\n${command}`,
      };
    },
  };
}
