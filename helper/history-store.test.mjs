import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHistoryStore, extractArchivePaths } from './history-store.mjs';

test('extracts backup archive paths from backup stdout', () => {
  assert.deepEqual(extractArchivePaths('Backup written to:\n  /tmp/CodexBackups/codex-backup-mac.tar.gz\n  /tmp/CodexBackups/codex-backup-mac.tar.gz.sha256'), [
    '/tmp/CodexBackups/codex-backup-mac.tar.gz',
  ]);
});

test('appends and reads backup history entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codexbackup-history-'));
  try {
    const store = createHistoryStore({ filePath: join(dir, 'history.json') });
    await store.append({ action: 'backup', target: 'local', status: 'success', archivePaths: ['/tmp/a.tar.gz'] });

    const history = await store.read();
    assert.equal(history.version, 1);
    assert.equal(history.entries.length, 1);
    assert.deepEqual(history.entries[0], {
      action: 'backup',
      target: 'local',
      status: 'success',
      archivePaths: ['/tmp/a.tar.gz'],
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
