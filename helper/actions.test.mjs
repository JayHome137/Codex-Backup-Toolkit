import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommandFromAction, classifyAction } from './actions.mjs';

test('builds a backup command from a structured local action', () => {
  const action = {
    type: 'backup',
    target: 'local',
    config: {
      localDir: '/tmp/CodexBackups',
      retentionCount: 10,
      retentionDays: 30,
      remoteRetention: false,
      encrypt: false,
    },
  };

  assert.deepEqual(classifyAction(action), { allowed: true, kind: 'backup' });
  assert.equal(buildCommandFromAction(action), [
    'CODEX_BACKUP_TARGET=local \\',
    'CODEX_BACKUP_RETENTION_COUNT=10 \\',
    'CODEX_BACKUP_RETENTION_DAYS=30 \\',
    'CODEX_BACKUP_REMOTE_RETENTION=0 \\',
    'CODEX_BACKUP_ENCRYPT=0 \\',
    'CODEX_BACKUP_LOCAL_DIR="/tmp/CodexBackups" \\',
    './scripts/codexbackup.sh --target local',
  ].join('\n'));
});

test('rejects encrypted backup actions without an age recipient', () => {
  const action = {
    type: 'backup',
    target: 'webdav',
    config: {
      webdavUrl: 'https://webdav.example.com/CodexBackup',
      webdavUser: 'backup-user',
      retentionCount: 10,
      retentionDays: 30,
      remoteRetention: false,
      encrypt: true,
      ageRecipient: '',
      ageRecipientFile: '',
    },
  };

  assert.deepEqual(classifyAction(action), {
    allowed: false,
    reason: 'Encrypted backup actions require ageRecipient or ageRecipientFile.',
  });
  assert.throws(() => buildCommandFromAction(action), /Encrypted backup actions require/);
});

test('builds a restore plan command without allowing restore execution', () => {
  const action = {
    type: 'restorePlan',
    source: 'archive',
    archivePath: '/tmp/codex-backup.tar.gz.age',
    encrypted: true,
    ageIdentity: '/tmp/age-identity.txt',
  };

  assert.deepEqual(classifyAction(action), { allowed: true, kind: 'restorePlan' });
  assert.equal(
    buildCommandFromAction(action),
    './scripts/codexrestore.sh --plan --archive "/tmp/codex-backup.tar.gz.age" --age-identity "/tmp/age-identity.txt"',
  );
});

test('builds a latest restore plan command with target config', () => {
  const action = {
    type: 'restorePlan',
    source: 'latest',
    target: 'webdav',
    config: {
      webdavUrl: 'https://webdav.example.com/CodexBackup',
      webdavUser: 'backup-user',
    },
  };

  assert.deepEqual(classifyAction(action), { allowed: true, kind: 'restorePlan' });
  assert.equal(buildCommandFromAction(action), [
    'CODEX_BACKUP_TARGET=webdav \\',
    'CODEX_BACKUP_WEBDAV_URL="https://webdav.example.com/CodexBackup" \\',
    'CODEX_BACKUP_WEBDAV_USER=backup-user \\',
    './scripts/codexrestore.sh --plan --latest',
  ].join('\n'));
});

test('rejects unsupported structured actions', () => {
  assert.deepEqual(classifyAction({ type: 'installAutomation' }), {
    allowed: false,
    reason: 'Unsupported helper action: installAutomation.',
  });
});
