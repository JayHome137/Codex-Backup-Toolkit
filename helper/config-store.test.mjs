import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createConfigStore, sanitizeConfig } from './config-store.mjs';

test('sanitizes config before writing persistent app config', () => {
  const sanitized = sanitizeConfig({
    version: 1,
    target: 'webdav',
    webdavUser: 'backup-user',
    webdavPassword: 'secret',
    nested: { token: 'secret-token', keep: 'ok' },
  });

  assert.deepEqual(sanitized, {
    version: 1,
    target: 'webdav',
    webdavUser: 'backup-user',
    nested: { keep: 'ok' },
  });
});

test('persists and reads sanitized config json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codexbackup-config-store-'));
  try {
    const store = createConfigStore({ filePath: join(dir, 'config.json') });
    await store.write({ version: 1, target: 'local', localDir: '/tmp/backups', password: 'secret' });

    assert.deepEqual(await store.read(), { version: 1, target: 'local', localDir: '/tmp/backups' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('returns a default config object when config file is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codexbackup-config-store-'));
  try {
    const store = createConfigStore({ filePath: join(dir, 'missing-config.json') });

    assert.deepEqual(await store.read(), { version: 1, target: 'local' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
