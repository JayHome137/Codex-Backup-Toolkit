import assert from 'node:assert/strict';
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

test('run rejects backup requests before the executor is called', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(doctorRequest('./scripts/codexbackup.sh --target local')),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.status, 'error');
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
    assert.equal(body.audit.decision, 'blocked');
    assert.equal(body.exitCode, 126);
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
