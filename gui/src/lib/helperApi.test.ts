import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from './config';
import { createHelperApi } from './helperApi';

describe('helper API client', () => {
  it('loads persisted config from the helper', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok', config: { ...defaultConfig, target: 'webdav' } }));
    const api = createHelperApi('http://127.0.0.1:37371', fetcher as typeof fetch);

    await expect(api.loadConfig()).resolves.toMatchObject({ target: 'webdav' });
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:37371/config', expect.objectContaining({ method: 'GET' }));
  });

  it('saves config through PUT /config', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ target: 'local', localDir: '$HOME/CodexBackups' });
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok', config: defaultConfig });
    });
    const api = createHelperApi('http://127.0.0.1:37371', fetcher as typeof fetch);

    await expect(api.saveConfig(defaultConfig)).resolves.toMatchObject({ target: 'local' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:37371/config',
      expect.objectContaining({ method: 'PUT', headers: { 'content-type': 'application/json' } }),
    );
  });

  it('saves and deletes secrets without returning the secret', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    const api = createHelperApi('http://127.0.0.1:37371', fetcher as typeof fetch);

    await expect(api.saveSecret({ service: 'codexbackup-webdav', account: 'backup@example', secret: 'secret-value' })).resolves.toEqual({ status: 'ok' });
    await expect(api.deleteSecret({ service: 'codexbackup-webdav', account: 'backup@example' })).resolves.toEqual({ status: 'ok' });

    expect(calls[0].input).toBe('http://127.0.0.1:37371/secret');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ service: 'codexbackup-webdav', account: 'backup@example', secret: 'secret-value' });
    expect(calls[1].init?.method).toBe('DELETE');
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ service: 'codexbackup-webdav', account: 'backup@example' });
  });

  it('loads backup history entries', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      history: {
        version: 1,
        entries: [{ action: 'backup', target: 'local', status: 'success', startedAt: '2026-06-06T00:00:00.000Z', finishedAt: '2026-06-06T00:00:01.000Z', exitCode: 0, archivePaths: ['/tmp/codex-backup.tar.gz'] }],
      },
    }));
    const api = createHelperApi('http://127.0.0.1:37371', fetcher as typeof fetch);

    await expect(api.loadHistory()).resolves.toEqual([
      expect.objectContaining({ target: 'local', status: 'success', archivePaths: ['/tmp/codex-backup.tar.gz'] }),
    ]);
  });

  it('loads read-only automation status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      automation: {
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
      },
    }));
    const api = createHelperApi('http://127.0.0.1:37371', fetcher as typeof fetch);

    await expect(api.loadAutomationStatus()).resolves.toMatchObject({
      label: 'dev.codexbackup.toolkit',
      loaded: false,
      plistExists: true,
      schedule: '03:00 / 每 3 天',
    });
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:37371/automation', expect.objectContaining({ method: 'GET' }));
  });

  it('throws typed unavailable errors for invalid helper responses', async () => {
    const api = createHelperApi('http://127.0.0.1:37371', async () => jsonResponse({ status: 'ok' }));

    await expect(api.loadConfig()).rejects.toThrow('ERR_HELPER_UNAVAILABLE');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
