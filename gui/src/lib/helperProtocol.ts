import { classifyLocalCommand } from './localBridge';
import type { HelperAction } from './actions';

export type HelperCommandKind = 'doctor' | 'validate' | 'backup' | 'restorePlan';
export type HelperErrorCode = 'ERR_COMMAND_NOT_ALLOWED' | 'ERR_HELPER_UNAVAILABLE' | 'ERR_HELPER_FAILED';

export type HelperRequest = {
  schema: 'codex-backup-helper.v1';
  version: 1;
  requestId: string;
  createdAt: string;
  kind: HelperCommandKind;
  command?: string;
  action?: HelperAction;
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

export type HelperHealth = {
  schema: 'codex-backup-helper.v1';
  version: 1;
  status: 'ok';
  helper: string;
  host: string;
};

export type HelperTransport = {
  send(request: HelperRequest): Promise<HelperResponse>;
};

const schema = 'codex-backup-helper.v1' as const;

function createRequestId(): string {
  return `cbt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildHelperRequest(commandOrAction: string | HelperAction): HelperRequest {
  if (typeof commandOrAction !== 'string') {
    return {
      schema,
      version: 1,
      requestId: createRequestId(),
      createdAt: new Date().toISOString(),
      kind: helperActionKind(commandOrAction),
      action: commandOrAction,
    };
  }

  const command = commandOrAction;
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

export async function runHelperAction(action: HelperAction, transport: HelperTransport): Promise<HelperResponse> {
  return transport.send(buildHelperRequest(action));
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
        stdout: `模拟助手已接受${helperKindLabel(request.kind)}。\n\n命令：\n${request.command}`,
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

function helperKindLabel(kind: HelperCommandKind): string {
  return {
    doctor: '环境检查',
    validate: '计划校验',
    backup: '备份执行',
    restorePlan: '恢复预案',
  }[kind];
}

function helperActionKind(action: HelperAction): HelperCommandKind {
  if (action.type === 'backup') return 'backup';
  return 'restorePlan';
}

export function createHttpHelperTransport(
  baseUrl = 'http://127.0.0.1:37371',
  fetcher: typeof fetch = fetch,
): HelperTransport {
  return {
    async send(request: HelperRequest): Promise<HelperResponse> {
      let response: Response;

      try {
        response = await fetcher(`${baseUrl.replace(/\/$/, '')}/run`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`ERR_HELPER_UNAVAILABLE: ${message}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`ERR_HELPER_UNAVAILABLE: 助手返回了无效 JSON：${message}`);
      }

      if (!isHelperResponse(body)) {
        throw new Error('ERR_HELPER_UNAVAILABLE: 助手响应不符合协议。');
      }

      return body;
    },
  };
}

export async function checkHelperHealth(
  baseUrl = 'http://127.0.0.1:37371',
  fetcher: typeof fetch = fetch,
): Promise<HelperHealth> {
  let response: Response;

  try {
    response = await fetcher(`${baseUrl.replace(/\/$/, '')}/health`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ERR_HELPER_UNAVAILABLE: ${message}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ERR_HELPER_UNAVAILABLE: 助手健康检查返回了无效 JSON：${message}`);
  }

  if (!response.ok || !isHelperHealth(body)) {
    throw new Error('ERR_HELPER_UNAVAILABLE: 助手健康检查响应不符合协议。');
  }

  return body;
}

function isHelperResponse(value: unknown): value is HelperResponse {
  if (!value || typeof value !== 'object') return false;

  const response = value as Partial<HelperResponse>;
  return (
    response.schema === schema &&
    response.version === 1 &&
    typeof response.requestId === 'string' &&
    (response.status === 'ok' || response.status === 'error') &&
    typeof response.exitCode === 'number' &&
    typeof response.stdout === 'string' &&
    typeof response.stderr === 'string' &&
    !!response.audit &&
    typeof response.audit === 'object' &&
    (response.audit.decision === 'allowed' || response.audit.decision === 'blocked') &&
    typeof response.audit.helper === 'string'
  );
}

function isHelperHealth(value: unknown): value is HelperHealth {
  if (!value || typeof value !== 'object') return false;

  const health = value as Partial<HelperHealth>;
  return (
    health.schema === schema &&
    health.version === 1 &&
    health.status === 'ok' &&
    typeof health.helper === 'string' &&
    typeof health.host === 'string'
  );
}
