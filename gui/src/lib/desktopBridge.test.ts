import { describe, expect, it, vi } from 'vitest';
import { createDesktopBridge, createDesktopHelperApi, createDesktopHelperTransport, getBackupArtifacts } from './desktopBridge';

describe('desktop bridge', () => {
  it('detects desktop availability from the injected invoke function', () => {
    const bridge = createDesktopBridge({ invoke: vi.fn() });

    expect(bridge.isDesktop).toBe(true);
  });

  it('returns unavailable status when no invoke function exists', async () => {
    const bridge = createDesktopBridge({ invoke: null });

    await expect(bridge.helperStatus()).resolves.toMatchObject({ online: false, managed: false, source: 'unavailable' });
  });

  it('delegates helper lifecycle commands to Tauri invoke', async () => {
    const invokeMock = vi.fn(async (command: string) => ({ command, online: true, managed: command !== 'helper_status', source: 'managed' }));
    const invoke = async <T,>(command: string): Promise<T> => invokeMock(command) as Promise<T>;
    const bridge = createDesktopBridge({ invoke });

    await bridge.desktopDiagnostics();
    await bridge.helperStatus();
    await bridge.helperStart();
    await bridge.helperStop();
    await bridge.toolkitStatus();

    expect(invokeMock).toHaveBeenCalledWith('desktop_diagnostics');
    expect(invokeMock).toHaveBeenCalledWith('helper_status');
    expect(invokeMock).toHaveBeenCalledWith('helper_start');
    expect(invokeMock).toHaveBeenCalledWith('helper_stop');
    expect(invokeMock).toHaveBeenCalledWith('toolkit_status');
  });

  it('returns default diagnostics outside Tauri desktop', async () => {
    const bridge = createDesktopBridge({ invoke: null });

    await expect(bridge.desktopDiagnostics()).resolves.toMatchObject({
      helper: { online: false, source: 'unavailable' },
      paths: {
        configPath: '~/Library/Application Support/CodexBackupToolkit/config.json',
        desktopHelperStdoutLogPath: '~/Library/Logs/CodexBackup/desktop-helper.out.log',
      },
      toolkit: { available: false, source: 'unavailable' },
      version: '0.26.0',
    });
  });

  it('sends helper requests through the desktop helper api', async () => {
    const invokeMock = vi.fn(async (_command: string, payload: unknown) => ({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      history: { version: 1, entries: [] },
      payload,
    }));
    const invoke = async <T,>(command: string, payload?: Record<string, unknown>): Promise<T> => invokeMock(command, payload) as Promise<T>;
    const api = createDesktopHelperApi(createDesktopBridge({ invoke }));

    await expect(api.loadHistory()).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith('helper_request', { request: { method: 'GET', path: '/history' } });
  });

  it('loads automation status through the desktop helper api', async () => {
    const invokeMock = vi.fn(async (_command: string, payload: unknown) => ({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      automation: {
        label: 'dev.codexbackup.toolkit',
        loaded: true,
        plistExists: true,
        installDirExists: true,
        scheduledScriptExists: true,
        plistPath: '/Users/test/Library/LaunchAgents/dev.codexbackup.toolkit.plist',
        installDir: '/Users/test/Library/Application Support/CodexBackupToolkit',
        scheduledScriptPath: '/Users/test/Library/Application Support/CodexBackupToolkit/scripts/codexscheduledbackup.sh',
        stdoutLogPath: '/Users/test/Library/Logs/CodexBackup/backup.out.log',
        stderrLogPath: '/Users/test/Library/Logs/CodexBackup/backup.err.log',
        schedule: '03:00 / 每 3 天',
      },
      payload,
    }));
    const invoke = async <T,>(command: string, payload?: Record<string, unknown>): Promise<T> => invokeMock(command, payload) as Promise<T>;
    const api = createDesktopHelperApi(createDesktopBridge({ invoke }));

    await expect(api.loadAutomationStatus()).resolves.toMatchObject({ label: 'dev.codexbackup.toolkit', loaded: true });
    expect(invokeMock).toHaveBeenCalledWith('helper_request', { request: { method: 'GET', path: '/automation' } });
  });

  it('sends run requests through the desktop helper transport', async () => {
    const invokeMock = vi.fn(async (_command: string, payload: unknown) => ({
      schema: 'codex-backup-helper.v1',
      version: 1,
      requestId: 'request-1',
      status: 'ok',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      audit: {
        commandKind: 'backup',
        decision: 'allowed',
        helper: 'desktop-helper',
        startedAt: '2026-06-06T00:00:00.000Z',
        finishedAt: '2026-06-06T00:00:01.000Z',
      },
      payload,
    }));
    const invoke = async <T,>(command: string, payload?: Record<string, unknown>): Promise<T> => invokeMock(command, payload) as Promise<T>;
    const transport = createDesktopHelperTransport(createDesktopBridge({ invoke }));

    await expect(transport.send({
      schema: 'codex-backup-helper.v1',
      version: 1,
      requestId: 'request-1',
      createdAt: '2026-06-06T00:00:00.000Z',
      kind: 'backup',
    })).resolves.toMatchObject({ requestId: 'request-1', status: 'ok' });
    expect(invokeMock).toHaveBeenCalledWith('helper_request', expect.objectContaining({ request: expect.objectContaining({ method: 'POST', path: '/run' }) }));
  });

  it('derives sha256 and manifest paths from backup archive paths', () => {
    expect(getBackupArtifacts(['/tmp/codex-backup.tar.gz'])).toEqual({
      archivePath: '/tmp/codex-backup.tar.gz',
      checksumPath: '/tmp/codex-backup.tar.gz.sha256',
      manifestPath: '/tmp/codex-backup.manifest.txt',
    });
    expect(getBackupArtifacts(['/tmp/codex-backup.tar.gz.age'])).toEqual({
      archivePath: '/tmp/codex-backup.tar.gz.age',
      checksumPath: '/tmp/codex-backup.tar.gz.age.sha256',
      manifestPath: '/tmp/codex-backup.manifest.txt',
    });
  });
});
