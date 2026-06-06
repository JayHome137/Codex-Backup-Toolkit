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

function syncCommandRequest(command = [
  'CODEX_BACKUP_TARGET=local \\',
  'CODEX_BACKUP_LOCAL_DIR="/tmp/CodexBackups" \\',
  'CODEX_BACKUP_RETENTION_COUNT=5 \\',
  'CODEX_BACKUP_RETENTION_DAYS=14 \\',
  'CODEX_BACKUP_REMOTE_RETENTION=0 \\',
  'CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=12 \\',
  'CODEX_BACKUP_SYNC_MIN_BACKUP_INTERVAL_HOURS=24 \\',
  'CODEX_BACKUP_ENCRYPT=0 \\',
  './scripts/codexbackup.sh --sync-check --target local',
].join('\n')) {
  return {
    schema,
    version: 1,
    requestId: 'test-sync-command-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'sync',
    command,
  };
}

function backupActionRequest() {
  return {
    schema,
    version: 1,
    requestId: 'test-backup-action-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'backup',
    action: {
      type: 'backup',
      target: 'local',
      config: {
        localDir: '/tmp/CodexBackups',
        retentionCount: 10,
        retentionDays: 30,
        remoteRetention: false,
        encrypt: false,
      },
    },
  };
}

function restorePlanActionRequest() {
  return {
    schema,
    version: 1,
    requestId: 'test-restore-plan-action-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'restorePlan',
    action: {
      type: 'restorePlan',
      source: 'latest',
      target: 'local',
      config: {
        localDir: '/tmp/CodexBackups',
      },
    },
  };
}

function syncActionRequest(target = 'local') {
  return {
    schema,
    version: 1,
    requestId: 'test-sync-action-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    kind: 'sync',
    action: {
      type: 'syncLocalAuthoritative',
      target,
      config: {
        localDir: '/tmp/CodexBackups',
        smbHost: 'nas.example.local',
        smbUser: 'backup-user',
        smbShare: 'CodexBackup',
        retentionCount: 5,
        retentionDays: 14,
        remoteRetention: false,
        checkIntervalHours: 12,
        minBackupIntervalHours: 24,
        encrypt: false,
      },
    },
  };
}

async function withHelper(executor, callback, options = {}) {
  const helper = await createHelperServer({ executor, host: '127.0.0.1', port: 0, ...options });
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

test('config endpoint reads and writes sanitized persistent config', async () => {
  let stored = { version: 1, target: 'local' };
  const configStore = {
    read: async () => stored,
    write: async (config) => {
      stored = { ...config };
      delete stored.password;
      return stored;
    },
  };

  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    const initial = await requestJson(helper.origin, '/config');
    assert.equal(initial.response.status, 200);
    assert.deepEqual(initial.body.config, { version: 1, target: 'local' });

    const saved = await requestJson(helper.origin, '/config', {
      method: 'PUT',
      body: JSON.stringify({ target: 'webdav', webdavUser: 'backup-user', password: 'secret' }),
    });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.body.config, { target: 'webdav', webdavUser: 'backup-user' });
  }, { configStore });
});

test('secret endpoint saves and deletes Keychain secrets through injected keychain', async () => {
  const calls = [];
  const keychain = {
    saveSecret: async (input) => {
      calls.push(['save', input]);
      return { status: 'ok' };
    },
    deleteSecret: async (input) => {
      calls.push(['delete', input]);
      return { status: 'ok' };
    },
  };

  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    const saved = await requestJson(helper.origin, '/secret', {
      method: 'POST',
      body: JSON.stringify({ service: 'codexbackup-webdav', account: 'backup-user@example', secret: 'super-secret' }),
    });
    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.body, { schema, version: 1, status: 'ok' });

    const deleted = await requestJson(helper.origin, '/secret', {
      method: 'DELETE',
      body: JSON.stringify({ service: 'codexbackup-webdav', account: 'backup-user@example' }),
    });
    assert.equal(deleted.response.status, 200);
    assert.deepEqual(deleted.body, { schema, version: 1, status: 'ok' });
  }, { keychain });

  assert.deepEqual(calls, [
    ['save', { service: 'codexbackup-webdav', account: 'backup-user@example', secret: 'super-secret' }],
    ['delete', { service: 'codexbackup-webdav', account: 'backup-user@example' }],
  ]);
});

test('automation endpoint exposes read-only launchd status', async () => {
  const automationStatus = {
    read: async () => ({
      label: 'dev.codexbackup.toolkit',
      loaded: false,
      plistExists: true,
      installDirExists: true,
      scheduledScriptExists: false,
      plistPath: '/Users/test/Library/LaunchAgents/dev.codexbackup.toolkit.plist',
      installDir: '/Users/test/Library/Application Support/CodexBackupToolkit',
      scheduledScriptPath: '/Users/test/Library/Application Support/CodexBackupToolkit/scripts/codexscheduledbackup.sh',
      stdoutLogPath: '/Users/test/Library/Logs/CodexBackup/backup.out.log',
      stderrLogPath: '/Users/test/Library/Logs/CodexBackup/backup.err.log',
      schedule: '03:00 / 每 3 天',
      lastError: 'Job is not loaded',
    }),
  };

  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/automation');

    assert.equal(response.status, 200);
    assert.equal(body.schema, schema);
    assert.equal(body.version, 1);
    assert.equal(body.status, 'ok');
    assert.deepEqual(body.automation, await automationStatus.read());
  }, { automationStatus });
});

test('automation endpoint rejects mutating methods', async () => {
  await withHelper(async () => ({ exitCode: 0, stdout: '', stderr: '' }), async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/automation', { method: 'POST', body: '{}' });

    assert.equal(response.status, 405);
    assert.equal(body.status, 'error');
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

test('run accepts raw local authoritative sync check requests and calls the injected executor', async () => {
  const calls = [];
  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'Sync status: consistent', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(syncCommandRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'sync');
    assert.equal(body.audit.commandKind, 'sync');
    assert.equal(body.stdout, 'Sync status: consistent');
  });
});

test('run builds commands from structured backup actions before calling the executor', async () => {
  const calls = [];
  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'backup action ok', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(backupActionRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'backup');
    assert.match(calls[0].command, /CODEX_BACKUP_TARGET=local/);
    assert.match(calls[0].command, /\.\/scripts\/codexbackup\.sh --target local/);
    assert.equal(body.status, 'ok');
    assert.equal(body.stdout, 'backup action ok');
    assert.equal(body.audit.commandKind, 'backup');
  });
});

test('run records backup history and exposes it through history endpoint', async () => {
  const entries = [];
  const historyStore = {
    append: async (entry) => entries.push(entry),
    read: async () => ({ version: 1, entries }),
  };

  await withHelper(async () => ({
    exitCode: 0,
    stdout: 'Backup written to:\n  /tmp/CodexBackups/codex-backup-mac.tar.gz\n',
    stderr: '',
  }), async (helper) => {
    await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(backupActionRequest()),
    });

    const history = await requestJson(helper.origin, '/history');
    assert.equal(history.response.status, 200);
    assert.equal(history.body.history.entries.length, 1);
    assert.deepEqual(history.body.history.entries[0].archivePaths, ['/tmp/CodexBackups/codex-backup-mac.tar.gz']);
    assert.equal(history.body.history.entries[0].status, 'success');
  }, { historyStore });
});

test('run builds commands from structured restore plan actions without recording backup history', async () => {
  const calls = [];
  const entries = [];
  const historyStore = {
    append: async (entry) => entries.push(entry),
    read: async () => ({ version: 1, entries }),
  };

  await withHelper(async (request) => {
    calls.push(request);
    return { exitCode: 0, stdout: 'Codex restore plan\nNo files were changed.\n', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(restorePlanActionRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'restorePlan');
    assert.match(calls[0].command, /\.\/scripts\/codexrestore\.sh --plan --latest/);
    assert.equal(body.status, 'ok');
    assert.equal(body.audit.commandKind, 'restorePlan');
    assert.equal(entries.length, 0);
  }, { historyStore });
});

test('run builds commands from structured sync actions and records history only when a backup is created', async () => {
  const calls = [];
  const entries = [];
  const historyStore = {
    append: async (entry) => entries.push(entry),
    read: async () => ({ version: 1, entries }),
  };

  await withHelper(async (request) => {
    calls.push(request);
    return {
      exitCode: 0,
      stdout: 'Sync status: drift\nSync action: backup-created\nBackup written to:\n  /tmp/CodexBackups/codex-backup-sync.tar.gz\n',
      stderr: '',
    };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(syncActionRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'sync');
    assert.match(calls[0].command, /CODEX_BACKUP_SYNC_CHECK_INTERVAL_HOURS=12/);
    assert.match(calls[0].command, /\.\/scripts\/codexbackup\.sh --sync-local-authoritative --target local/);
    assert.equal(body.status, 'ok');
    assert.equal(body.audit.commandKind, 'sync');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, 'syncLocalAuthoritative');
    assert.deepEqual(entries[0].archivePaths, ['/tmp/CodexBackups/codex-backup-sync.tar.gz']);
  }, { historyStore });
});

test('run does not record sync history when no backup is created', async () => {
  const entries = [];
  const historyStore = {
    append: async (entry) => entries.push(entry),
    read: async () => ({ version: 1, entries }),
  };

  await withHelper(async () => ({
    exitCode: 0,
    stdout: 'Sync status: consistent\nSync action: already-consistent\n',
    stderr: '',
  }), async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(syncActionRequest()),
    });

    assert.equal(response.status, 200);
    assert.equal(body.audit.commandKind, 'sync');
    assert.equal(entries.length, 0);
  }, { historyStore });
});

test('run rejects structured sync actions for unsupported targets', async () => {
  let callCount = 0;
  await withHelper(async () => {
    callCount += 1;
    return { exitCode: 0, stdout: 'unexpected', stderr: '' };
  }, async (helper) => {
    const { response, body } = await requestJson(helper.origin, '/run', {
      method: 'POST',
      body: JSON.stringify(syncActionRequest('webdav')),
    });

    assert.equal(response.status, 403);
    assert.equal(callCount, 0);
    assert.equal(body.errorCode, 'ERR_COMMAND_NOT_ALLOWED');
    assert.match(body.stderr, /currently supports local and smb targets/);
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
