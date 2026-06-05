import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeychain } from './keychain.mjs';

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
  assert.match(calls[0].command, /-s "codexbackup-webdav"/);
  assert.match(calls[0].command, /-a "backup-user@example"/);
  assert.match(calls[0].command, /-w "super-secret"/);
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
