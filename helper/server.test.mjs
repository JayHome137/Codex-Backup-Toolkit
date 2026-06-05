import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createShellExecutor } from './executor.mjs';
import { createHelperServer } from './server.mjs';

const schema = 'codex-backup-helper.v1';

function doctorRequest(command = './scripts/codexbackup.sh --doctor --target local') {
  return {
    schema,
    version: 1,
    requestId: 'test-doctor-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'doctor',
    command,
  };
}

function validateRequest() {
  return {
    schema,
    version: 1,
    requestId: 'test-validate-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'validate',
    command: [
      'CODEX_BACKUP_LAUNCHD_LABEL=dev.codexbackup.toolkit.test.local \\',
      'CODEX_BACKUP_TARGET=local \\',
      'CODEX_BACKUP_LOCAL_DIR="$HOME/CodexBackups" \\',
      './scripts/codexinstallautomation.sh validate',
    ].join('\n'),
  };
}

function backupRequest(command = [
  'CODEX_BACKUP_TARGET=local \\',
  'CODEX_BACKUP_LOCAL_DIR="/tmp/CodexBackups" \\',
  'CODEX_BACKUP_RETENTION_COUNT=10 \\',
  'CODEX_BACKUP_RETENTION_DAYS=30 \\',
  'CODEX_BACKUP_REMOTE_RETENTION=0 \\',
  'CODEX_BACKUP_ENCRYPT=0 \\',
  './scripts/codexbackup.sh --target local',
].join('\n')) {
  return {
    schema,
    version: 1,
    requestId: 'test-backup-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'backup',
    command,
  };
}

async function withHelper(executor, callback) {
  const helper = await createHelperServer({ executor, host: '127.0.0.1', port: 0 });
  try {
    return await callback(helper);
  } finally {
    await helper.close();
  }
}

async function requestJson(origin, path, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return { response, body: await response.json() };
}

function readFirstStdoutLine(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for helper CLI output. ${output}`)), 5_000);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const newlineIndex = output.indexOf('\n');
      if (newlineIndex !== -1) {
        clearTimeout(timer);
        resolve(output.slice(0, newlineIndex).trim());
      }
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Helper CLI exited before printing its origin: ${code}. ${output}`));
    });
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
  });
}

test('health reports helper status and binds to loopback only', async () => {
  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    assert.equal(helper.address.address, '127.0.0.1');

    const { response, body } = await requestJson(helper.origin, '/health');

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      schema,
      version: 1,
      status: 'ok',
      helper: 'node-local-helper',
      host: '127.0.0.1',
    });
  });
});

test('server module starts as a CLI even when the repository path contains spaces', async () => {
  const child = spawn(process.execPath, ['helper/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, CODEX_BACKUP_HELPER_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const line = await readFirstStdoutLine(child);
    assert.match(line, /^CodexBackupToolKit helper listening on http:\/\/127\.0\.0\.1:\d+$/);

    const origin = line.replace('CodexBackupToolKit helper listening on ', '');
    const response = await fetch(`${origin}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.helper, 'node-local-helper');
  } finally {
    child.kill('SIGTERM');
    await waitForExit(child);
  }
});

test('run accepts doctor requests and calls the injected executor', async () => {
  const calls = [];
  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'doctor ok', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(doctorRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'doctor');
    assert.equal(calls[0].command, './scripts/codexbackup.sh --doctor --target local');
    assert.equal(body.schema, schema);
    assert.equal(body.requestId, 'test-doctor-1');
    assert.equal(body.status, 'ok');
    assert.equal(body.exitCode, 0);
    assert.equal(body.stdout, 'doctor ok');
    assert.equal(body.audit.decision, 'allowed');
    assert.equal(body.audit.commandKind, 'doctor');
    assert.equal(body.audit.helper, 'node-local-helper');
  });
});

test('run can execute an allowed doctor command through the real shell executor in an isolated workspace', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-backup-helper-'));
  try {
    const scriptsDir = join(tempDir, 'scripts');
    await mkdir(scriptsDir);
    await writeFile(
      join(scriptsDir, 'codexbackup.sh'),
      '#!/bin/zsh\nprintf "fake doctor %s %s %s\\n" "$1" "$2" "$3"\n',
      { mode: 0o755 },
    );

    await withHelper(createShellExecutor({ cwd: tempDir }), async (helper) => {
      const { response, body } = await requestJson(helper.origin, '/run', {
        method: 'POST',
        body: JSON.stringify(doctorRequest()),
      });

      assert.equal(response.status, 200);
      assert.equal(body.status, 'ok');
      assert.equal(body.stdout, 'fake doctor --doctor --target local\n');
      assert.equal(body.stderr, '');
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('run accepts isolated validate requests and calls the injected executor', async () => {
  const calls = [];
  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'validate ok', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(validateRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'validate');
    assert.equal(body.status, 'ok');
    assert.equal(body.stdout, 'validate ok');
  });
});

test('run accepts backup requests and calls the injected executor', async () => {
  const calls = [];
  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'backup ok', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(backupRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'backup');
    assert.equal(body.status, 'ok');
    assert.equal(body.stdout, 'backup ok');
    assert.equal(body.audit.commandKind, 'backup');
  });
});

test('run rejects encrypted backup requests without an age recipient before executor is called', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const unsafe = backupRequest([
      'CODEX_BACKUP_TARGET=local \\',
      'CODEX_BACKUP_LOCAL_DIR="/tmp/CodexBackups" \\',
      'CODEX_BACKUP_ENCRYPT=1 \\',
      './scripts/codexbackup.sh --target local',
    ].join('\n'));

    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(unsafe),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
  });
});

test('run rejects backup requests that append extra shell commands', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const unsafe = backupRequest(`${backupRequest().command} && ./scripts/codexrestore.sh --latest`);

    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(unsafe),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
  });
});

test('run rejects backup requests that inject shell operators into environment lines', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const unsafe = backupRequest([
      'CODEX_BACKUP_TARGET=local \\',
      'CODEX_BACKUP_LOCAL_DIR=/tmp/CodexBackups&&./scripts/codexrestore.sh --latest \\',
      './scripts/codexbackup.sh --target local',
    ].join('\n'));

    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(unsafe),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
  });
});

test('run rejects non-isolated validate requests before the executor is called', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const unsafe = validateRequest();
    unsafe.command = './scripts/codexinstallautomation.sh validate';

    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(unsafe),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
  });
});

test('run rejects validate requests that append extra shell commands', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const unsafe = validateRequest();
    unsafe.command = `${unsafe.command}; ./scripts/codexbackup.sh --target local`;

    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(unsafe),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
  });
});

test('unsupported methods and paths return safe JSON errors', async () => {
  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    const runGet = await requestJson(helper.origin, '/run');
    assert.equal(runGet.response.status, 405);
    assert.equal(runGet.body.status, 'error');

    const missing = await requestJson(helper.origin, '/missing');
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.status, 'error');
  });
});
