import type { CommandResult, CommandRunner } from './commands';
import { createMockHelperTransport, runHelperCommand, type HelperResponse, type HelperTransport } from './helperProtocol';

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

function formatHelperResponse(response: HelperResponse): string {
  return [
    response.stdout,
    '',
    'Audit:',
    `requestId: ${response.requestId}`,
    `schema: ${response.schema}`,
    `commandKind: ${response.audit.commandKind}`,
    `decision: ${response.audit.decision}`,
    `helper: ${response.audit.helper}`,
    `exitCode: ${response.exitCode}`,
  ].join('\n');
}

export function createLocalBridgeRunner(transport: HelperTransport = createMockHelperTransport()): CommandRunner {
  return {
    async run(command: string): Promise<CommandResult> {
      const classification = classifyLocalCommand(command);

      if (!classification.allowed) {
        return {
          status: 'warning',
          output: `Blocked by Web bridge allowlist.\n\n${classification.reason}\n\nCommand:\n${command}`,
        };
      }

      try {
        const response = await runHelperCommand(command, transport);

        return {
          status: response.status === 'ok' ? 'success' : 'error',
          output: formatHelperResponse(response),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return {
          status: 'error',
          output: `ERR_HELPER_UNAVAILABLE\n\n${message}\n\nCommand:\n${command}`,
        };
      }
    },
  };
}
