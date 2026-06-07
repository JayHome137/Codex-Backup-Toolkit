import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfilePathPlan, profilePathPlanToText } from './profile-paths.mjs';

test('builds the current macOS Codex profile path plan', () => {
  const plan = buildProfilePathPlan({ homeDir: '/Users/alice', platform: 'darwin', profile: 'codex' });

  assert.equal(plan.profile, 'codex');
  assert.equal(plan.platform, 'darwin');
  assert.equal(plan.status, 'supported');
  assert.deepEqual(plan.sources.map((source) => source.archivePath), [
    'home/.codex',
    'Library/Application Support/Codex',
    'Library/Application Support/OpenAI',
    'Library/Application Support/OpenAI/Codex',
    'Library/Application Support/com.openai.codex',
    'Documents/Codex',
  ]);
  assert.equal(plan.notes[0], 'macOS profile matches the current 0.26.x backup behavior.');
});

test('builds a planned Windows Codex profile path plan without marking it release-ready', () => {
  const plan = buildProfilePathPlan({
    appDataDir: 'C:/Users/Alice/AppData/Roaming',
    documentsDir: 'C:/Users/Alice/Documents',
    homeDir: 'C:/Users/Alice',
    localAppDataDir: 'C:/Users/Alice/AppData/Local',
    platform: 'win32',
    profile: 'codex',
  });

  assert.equal(plan.platform, 'win32');
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.sources.map((source) => source.archivePath), [
    'home/.codex',
    'AppData/Roaming/Codex',
    'AppData/Roaming/OpenAI',
    'AppData/Roaming/OpenAI/Codex',
    'AppData/Local/Codex',
    'Documents/Codex',
  ]);
  assert.match(plan.notes.join('\n'), /Windows support is planned/);
});

test('renders a CLI-readable profile plan', () => {
  const plan = buildProfilePathPlan({ homeDir: '/Users/alice', platform: 'darwin', profile: 'codex' });
  const text = profilePathPlanToText(plan);

  assert.match(text, /Codex profile path plan/);
  assert.match(text, /Platform: darwin/);
  assert.match(text, /supported/);
  assert.match(text, /\/Users\/alice\/\.codex -> home\/\.codex/);
});

test('rejects unknown profiles', () => {
  assert.throws(
    () => buildProfilePathPlan({ homeDir: '/Users/alice', platform: 'darwin', profile: 'unknown' }),
    /Unsupported profile/,
  );
});
