import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createShellExecutor } from './executor.mjs';
import { createKeychain } from './keychain.mjs';

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('saves secrets through the injected executor without returning the secret', async () => {
  const calls = [];
  const keychain = createKeychain({
    executor: async (request) => {
      calls.push(request);
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  });

  const result = await keychain.saveSecret({ service: 'codexbackup-webdav', account: 'backup-user@example', secret: 'super-secret' });

  assert.deepEqual(result, { status: 'ok' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /security add-generic-password/);
  assert.match(calls[0].command, /-s 'codexbackup-webdav'/);
  assert.match(calls[0].command, /-a 'backup-user@example'/);
  assert.match(calls[0].command, /-w 'super-secret'/);
});

test('shell-quotes Keychain values before real execution', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-backup-keychain-quote-'));
  const markerPath = join(tempDir, 'shell-substitution-created');
  try {
    const binDir = join(tempDir, 'bin');
    await mkdir(binDir);
    await writeFile(
      join(binDir, 'security'),
      '#!/bin/zsh\nprintf "%s\\n" "$@"\n',
      { mode: 0o755 },
    );

    const oldPath = process.env.PATH;
    process.env.PATH = `${binDir}:${oldPath}`;
    try {
      const keychain = createKeychain({ executor: createShellExecutor({ cwd: tempDir }) });
      const result = await keychain.saveSecret({
        service: 'codexbackup-webdav',
        account: `backup$(touch ${markerPath})@example`,
        secret: 'super-secret',
      });

      assert.deepEqual(result, { status: 'ok' });
      assert.equal(await pathExists(markerPath), false);
    } finally {
      process.env.PATH = oldPath;
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('reads secrets through the injected executor', async () => {
  const keychain = createKeychain({
    executor: async () => ({ exitCode: 0, stdout: 'stored-secret\n', stderr: '' }),
  });

  assert.deepEqual(await keychain.readSecret({ service: 'codexbackup-webdav', account: 'backup-user@example' }), {
    status: 'ok',
    secret: 'stored-secret',
  });
});

test('deletes secrets through the injected executor', async () => {
  const calls = [];
  const keychain = createKeychain({
    executor: async (request) => {
      calls.push(request);
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  });

  assert.deepEqual(await keychain.deleteSecret({ service: 'codexbackup-webdav', account: 'backup-user@example' }), { status: 'ok' });
  assert.match(calls[0].command, /security delete-generic-password/);
});
