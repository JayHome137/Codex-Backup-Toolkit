import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { classifyHelperCommand, schema } from './allowlist.mjs';
import { createAutomationStatusReader } from './automation-status.mjs';
import { createConfigStore } from './config-store.mjs';
import { createShellExecutor } from './executor.mjs';
import { buildBackupHistoryEntry, createHistoryStore } from './history-store.mjs';
import { createKeychain } from './keychain.mjs';

const helperName = 'node-local-helper';
const defaultHost = '127.0.0.1';
const defaultPort = 37371;

export async function createHelperServer({
  executor = createShellExecutor(),
  host = defaultHost,
  port = defaultPort,
  configStore = createConfigStore(),
  historyStore = createHistoryStore(),
  keychain = createKeychain({ executor }),
  automationStatus = createAutomationStatusReader(),
} = {}) {
  if (host !== defaultHost) {
    throw new Error('Helper host must be 127.0.0.1.');
  }

  const server = http.createServer((request, response) => {
    void handleRequest({ automationStatus, configStore, executor, historyStore, keychain, request, response, host });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Helper failed to bind a TCP address.');
  }

  return {
    address,
    origin: `http://${address.address}:${address.port}`,
    close: () => closeServer(server),
    server,
  };
}

async function handleRequest({ automationStatus, configStore, executor, historyStore, keychain, request, response, host }) {
  setCommonHeaders(response, request.headers.origin);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${host}`);

  if (url.pathname === '/health') {
    if (request.method !== 'GET') {
      writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
      return;
    }

    writeJson(response, 200, {
      schema,
      version: 1,
      status: 'ok',
      helper: helperName,
      host,
    });
    return;
  }

  if (url.pathname === '/config') {
    if (request.method === 'GET') {
      try {
        writeJson(response, 200, { schema, version: 1, status: 'ok', config: await configStore.read() });
      } catch (error) {
        writeError(response, 500, 'ERR_HELPER_FAILED', error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (request.method === 'PUT') {
      const body = await readJsonBody(request);
      if (!body.ok) {
        writeError(response, 400, 'ERR_HELPER_FAILED', body.error);
        return;
      }
      try {
        writeJson(response, 200, { schema, version: 1, status: 'ok', config: await configStore.write(body.value) });
      } catch (error) {
        writeError(response, 500, 'ERR_HELPER_FAILED', error instanceof Error ? error.message : String(error));
      }
      return;
    }

    writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
    return;
  }

  if (url.pathname === '/history') {
    if (request.method !== 'GET') {
      writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
      return;
    }
    try {
      writeJson(response, 200, { schema, version: 1, status: 'ok', history: await historyStore.read() });
    } catch (error) {
      writeError(response, 500, 'ERR_HELPER_FAILED', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (url.pathname === '/automation') {
    if (request.method !== 'GET') {
      writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
      return;
    }
    try {
      writeJson(response, 200, { schema, version: 1, status: 'ok', automation: await automationStatus.read() });
    } catch (error) {
      writeError(response, 500, 'ERR_HELPER_FAILED', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (url.pathname === '/secret') {
    if (request.method !== 'POST' && request.method !== 'DELETE') {
      writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
      return;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      writeError(response, 400, 'ERR_HELPER_FAILED', body.error);
      return;
    }

    try {
      const result = request.method === 'POST'
        ? await keychain.saveSecret(body.value)
        : await keychain.deleteSecret(body.value);
      writeJson(response, result.status === 'ok' ? 200 : 500, { schema, version: 1, ...result });
    } catch (error) {
      writeError(response, 400, 'ERR_HELPER_FAILED', error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (url.pathname === '/run') {
    if (request.method !== 'POST') {
      writeError(response, 405, 'ERR_HELPER_FAILED', 'Method not allowed.');
      return;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      writeError(response, 400, 'ERR_HELPER_FAILED', body.error);
      return;
    }

    const startedAt = new Date().toISOString();
    const classification = classifyHelperCommand(body.value);

    if (!classification.allowed) {
      writeJson(response, 403, buildResponse(body.value, {
        startedAt,
        exitCode: 126,
        stdout: '',
        stderr: classification.reason,
        status: 'error',
        errorCode: 'ERR_COMMAND_NOT_ALLOWED',
        decision: 'blocked',
      }));
      return;
    }

    try {
      const executableRequest = classification.command ? { ...body.value, kind: classification.kind, command: classification.command } : body.value;
      const result = await executor(executableRequest);
      const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
      const finishedAt = new Date().toISOString();
      if (executableRequest.kind === 'backup') {
        await historyStore.append(buildBackupHistoryEntry({ request: executableRequest, result: { ...result, exitCode }, startedAt, finishedAt }));
      }
      writeJson(response, 200, buildResponse(executableRequest, {
        startedAt,
        finishedAt,
        exitCode,
        stdout: String(result.stdout ?? ''),
        stderr: String(result.stderr ?? ''),
        status: exitCode === 0 ? 'ok' : 'error',
        errorCode: exitCode === 0 ? undefined : 'ERR_HELPER_FAILED',
        decision: 'allowed',
      }));
    } catch (error) {
      writeJson(response, 500, buildResponse(body.value, {
        startedAt,
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        status: 'error',
        errorCode: 'ERR_HELPER_FAILED',
        decision: 'allowed',
      }));
    }
    return;
  }

  writeError(response, 404, 'ERR_HELPER_FAILED', 'Not found.');
}

function buildResponse(request, options) {
  return {
    schema,
    version: 1,
    requestId: typeof request?.requestId === 'string' ? request.requestId : 'unknown',
    status: options.status,
    exitCode: options.exitCode,
    stdout: options.stdout,
    stderr: options.stderr,
    ...(options.errorCode ? { errorCode: options.errorCode } : {}),
    audit: {
      commandKind: ['doctor', 'validate', 'backup', 'restorePlan'].includes(request?.kind) ? request.kind : 'doctor',
      decision: options.decision,
      helper: helperName,
      startedAt: options.startedAt,
      finishedAt: options.finishedAt ?? new Date().toISOString(),
    },
  };
}

function writeError(response, statusCode, errorCode, message) {
  writeJson(response, statusCode, {
    schema,
    version: 1,
    status: 'error',
    errorCode,
    message,
  });
}

function setCommonHeaders(response, origin) {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');

  if (isAllowedOrigin(origin)) {
    response.setHeader('access-control-allow-origin', origin);
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]');
  } catch {
    return false;
  }
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode);
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 64_000) {
        request.destroy();
        resolve({ ok: false, error: 'Request body is too large.' });
      }
    });

    request.on('end', () => {
      try {
        resolve({ ok: true, value: JSON.parse(body || '{}') });
      } catch {
        resolve({ ok: false, error: 'Request body must be valid JSON.' });
      }
    });

    request.on('error', (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number.parseInt(process.env.CODEX_BACKUP_HELPER_PORT ?? `${defaultPort}`, 10);
  const helper = await createHelperServer({ port });
  console.log(`CodexBackupToolKit helper listening on ${helper.origin}`);
}
