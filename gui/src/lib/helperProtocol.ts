import { classifyLocalCommand } from './localBridge';

export type HelperCommandKind = 'doctor' | 'validate';
export type HelperErrorCode = 'ERR_COMMAND_NOT_ALLOWED' | 'ERR_HELPER_UNAVAILABLE' | 'ERR_HELPER_FAILED';

export type HelperRequest = {
  schema: 'codex-backup-helper.v1';
  version: 1;
  requestId: string;
  createdAt: string;
  kind: HelperCommandKind;
  command: string;
};

export type HelperResponse = {
  schema: 'codex-backup-helper.v1';
  version: 1;
  requestId: string;
  status: 'ok' | 'error';
  exitCode: number;
  stdout: string;
  stderr: string;
  errorCode?: HelperErrorCode;
  audit: {
    commandKind: HelperCommandKind;
    decision: 'allowed' | 'blocked';
    helper: string;
    startedAt: string;
    finishedAt: string;
  };
};

export type HelperTransport = {
  send(request: HelperRequest): Promise<HelperResponse>;
};

const schema = 'codex-backup-helper.v1' as const;

function createRequestId(): string {
  return `cbt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildHelperRequest(command: string): HelperRequest {
  const classification = classifyLocalCommand(command);

  if (!classification.allowed) {
    throw new Error(`ERR_COMMAND_NOT_ALLOWED: ${classification.reason}`);
  }

  return {
    schema,
    version: 1,
    requestId: createRequestId(),
    createdAt: new Date().toISOString(),
    kind: classification.kind,
    command,
  };
}

export async function runHelperCommand(command: string, transport: HelperTransport): Promise<HelperResponse> {
  return transport.send(buildHelperRequest(command));
}

export function createMockHelperTransport(): HelperTransport {
  return {
    async send(request: HelperRequest): Promise<HelperResponse> {
      const now = new Date().toISOString();

      return {
        schema,
        version: 1,
        requestId: request.requestId,
        status: 'ok',
        exitCode: 0,
        stdout: `Mock helper accepted ${request.kind}.\n\nCommand:\n${request.command}`,
        stderr: '',
        audit: {
          commandKind: request.kind,
          decision: 'allowed',
          helper: 'mock-helper',
          startedAt: now,
          finishedAt: now,
        },
      };
    },
  };
}
