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

const generalBlockReason = 'Web 桥接原型只允许环境检查和隔离的计划校验。';

const commandKindLabels: Record<AllowedLocalCommand['kind'], string> = {
  doctor: '环境检查',
  validate: '计划校验',
};

const decisionLabels: Record<HelperResponse['audit']['decision'], string> = {
  allowed: '已允许',
  blocked: '已阻止',
};

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
    return { allowed: false, reason: '只允许隔离的 codexinstallautomation validate 命令。' };
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
    '审计信息：',
    `请求 ID: ${response.requestId}`,
    `协议: ${response.schema}`,
    `命令类型: ${commandKindLabels[response.audit.commandKind]}`,
    `决策: ${decisionLabels[response.audit.decision]}`,
    `助手: ${response.audit.helper}`,
    `退出码: ${response.exitCode}`,
  ].join('\n');
}

export function createLocalBridgeRunner(transport: HelperTransport = createMockHelperTransport()): CommandRunner {
  return {
    async run(command: string): Promise<CommandResult> {
      const classification = classifyLocalCommand(command);

      if (!classification.allowed) {
        return {
          status: 'warning',
          output: `已被 Web 桥接允许列表阻止。\n\n${classification.reason}\n\n命令：\n${command}`,
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
          output: `ERR_HELPER_UNAVAILABLE\n\n${message}\n\n命令：\n${command}`,
        };
      }
    },
  };
}
