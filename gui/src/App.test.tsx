import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows WebDAV command preview after selecting WebDAV target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('WebDAV 地址')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
  });

  it('runs doctor through the preview-only mock runner', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /运行检查/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/环境检查通过/)).toBeInTheDocument();
    });
  });

  it('copies command previews to the clipboard', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /复制备份命令/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('./scripts/codexbackup.sh --target local'));
    });
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('shows a config.env preview for the selected target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getAllByText(/config.env 预览/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/# CODEX_BACKUP_WEBDAV_PASSWORD=/).length).toBeGreaterThan(0);
  });

  it('previews opt-in remote retention for cloud targets', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('启用远端保留策略')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_REMOTE_RETENTION=0/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('启用远端保留策略'));

    expect(screen.getAllByText(/CODEX_BACKUP_REMOTE_RETENTION=1/).length).toBeGreaterThan(0);
  });

  it('previews latest restore commands for the selected target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /rclone/i }));
    fireEvent.click(screen.getByRole('button', { name: /恢复/i }));

    expect(screen.getByRole('group', { name: /恢复来源/i })).toBeInTheDocument();
    expect(screen.getByText('最新备份目标端')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_TARGET=rclone/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --plan --latest/).length).toBeGreaterThan(0);
  });

  it('can switch restore preview back to a specific archive', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /恢复/i }));
    fireEvent.click(screen.getByRole('button', { name: /指定归档/i }));

    expect(screen.getByLabelText('归档路径')).toBeInTheDocument();
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --plan --archive/).length).toBeGreaterThan(0);
  });

  it('keeps a history of preview runs in Logs', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /运行检查/i }));
    fireEvent.click(screen.getByRole('button', { name: /预览备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/运行历史/i)).toBeInTheDocument();
      expect(screen.getByText(/环境检查命令/i)).toBeInTheDocument();
      expect(screen.getByText(/备份命令/i)).toBeInTheDocument();
    });
  });

  it('uses the local bridge allowlist mode for doctor commands', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /本地桥接/i }));
    fireEvent.click(screen.getByRole('button', { name: /运行检查/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/模拟助手已接受环境检查/)).toBeInTheDocument();
      expect(screen.getByText(/协议: codex-backup-helper\.v1/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 环境检查/)).toBeInTheDocument();
    });
  });

  it('runs backup commands in local bridge mode', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /本地桥接/i }));
    fireEvent.click(screen.getByRole('button', { name: /执行备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/模拟助手已接受备份执行/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 备份执行/)).toBeInTheDocument();
    });
  });

  it('shows config checks and encryption guidance for cloud targets', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByText('配置检查')).toBeInTheDocument();
    expect(screen.getByText(/云端或第三方存储建议开启 age 加密/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('使用 age 加密归档'));

    expect(screen.getByLabelText('age 收件人')).toBeInTheDocument();
    expect(screen.getByText(/启用加密时必须配置 CODEX_BACKUP_AGE_RECIPIENT/)).toBeInTheDocument();
  });

  it('sends backup execution requests through the HTTP helper transport', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/history')) {
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          history: { version: 1, entries: [] },
        });
      }

      const request = JSON.parse(String(init?.body));

      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'Backup written to:\n  /tmp/CodexBackups/codex-backup-mac.tar.gz',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'node-local-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /HTTP 助手/i }));
    fireEvent.click(screen.getByRole('button', { name: /确认真实备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /执行真实备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/Backup written to/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 备份执行/)).toBeInTheDocument();
    });
    const runCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/run'));
    expect(runCall).toBeTruthy();
    const request = JSON.parse(String(runCall?.[1]?.body));
    expect(request.kind).toBe('backup');
    expect(request.command).toBeUndefined();
    expect(request.action).toMatchObject({ type: 'backup', target: 'local' });
  });

  it('requires confirmation before running a real backup and refreshes helper history after success', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/run')) {
        const request = JSON.parse(String(init?.body));
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'Backup written to:\n  /tmp/CodexBackups/codex-backup-mac.tar.gz',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'node-local-helper',
            startedAt: '2026-06-06T00:00:00.000Z',
            finishedAt: '2026-06-06T00:00:01.000Z',
          },
        });
      }

      if (url.endsWith('/history')) {
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          history: {
            version: 1,
            entries: [{
              action: 'backup',
              target: 'local',
              status: 'success',
              startedAt: '2026-06-06T00:00:00.000Z',
              finishedAt: '2026-06-06T00:00:01.000Z',
              exitCode: 0,
              archivePaths: ['/tmp/CodexBackups/codex-backup-mac.tar.gz'],
            }],
          },
        });
      }

      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /HTTP 助手/i }));

    expect(screen.getByText('真实备份确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /确认真实备份/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /执行真实备份/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /确认真实备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /执行真实备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/Backup written to/)).toBeInTheDocument();
      expect(screen.getAllByText(/codex-backup-mac\.tar\.gz/).length).toBeGreaterThan(0);
    });

    const runCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/run'));
    expect(runCall).toBeTruthy();
    const request = JSON.parse(String(runCall?.[1]?.body));
    expect(request.kind).toBe('backup');
    expect(request.command).toBeUndefined();
    expect(request.action).toMatchObject({ type: 'backup', target: 'local' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/history', expect.objectContaining({ method: 'GET' }));
  });

  it('uses the HTTP helper transport when HTTP helper mode is selected', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));

      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: '助手返回环境检查正常',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'node-local-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /HTTP 助手/i }));
    fireEvent.click(screen.getByRole('button', { name: /运行检查/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/助手返回环境检查正常/)).toBeInTheDocument();
      expect(screen.getByText(/助手: node-local-helper/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:37371/run',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends restore plan requests through the HTTP helper without a raw restore command', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));

      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'Codex restore plan\nNo files were changed.',
          stderr: '',
          audit: {
            commandKind: request.kind,
            decision: 'allowed',
            helper: 'node-local-helper',
            startedAt: '2026-06-04T00:00:00.000Z',
            finishedAt: '2026-06-04T00:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /HTTP 助手/i }));
    fireEvent.click(screen.getByRole('button', { name: /恢复/i }));
    fireEvent.click(screen.getByRole('button', { name: /指定归档/i }));
    fireEvent.click(screen.getByRole('button', { name: /生成预案/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/Codex restore plan/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 恢复预案/)).toBeInTheDocument();
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.kind).toBe('restorePlan');
    expect(request.command).toBeUndefined();
    expect(request.action).toMatchObject({ type: 'restorePlan', source: 'archive' });
  });

  it('checks helper health without running a command', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://127.0.0.1:37371/health');
      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          helper: 'node-local-helper',
          host: '127.0.0.1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /HTTP 助手/i }));
    fireEvent.click(screen.getByRole('button', { name: /检查助手/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/助手在线/)).toBeInTheDocument();
      expect(screen.getAllByText(/node-local-helper/).length).toBeGreaterThan(0);
      expect(screen.getByText('helper 在线')).toBeInTheDocument();
    });
  });

  it('disables helper actions after helper health check fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:37371');
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getByText('helper 离线')).toBeInTheDocument();
      expect(screen.getByText(/请先在本机启动 helper/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));

    expect(screen.getByRole('button', { name: /加载配置/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /保存配置/i })).toBeDisabled();
  });

  it('re-enables helper actions after a later helper health check succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:37371'))
      .mockResolvedValueOnce(jsonResponse({
        schema: 'codex-backup-helper.v1',
        version: 1,
        status: 'ok',
        helper: 'node-local-helper',
        host: '127.0.0.1',
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getByText('helper 离线')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getByText('helper 在线')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));

    expect(screen.getByRole('button', { name: /加载配置/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /保存配置/i })).not.toBeDisabled();
  });

  it('loads and saves persisted helper config from the target page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/config') && init?.method === 'GET') {
        return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok', config: { ...baseConfigResponse(), target: 'webdav' } });
      }
      if (String(input).endsWith('/config') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok', config: body });
      }
      throw new Error(`unexpected request ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /加载配置/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('WebDAV 地址')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));
    expect(screen.getByText(/已从 helper 加载持久化配置/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));

    fireEvent.click(screen.getByRole('button', { name: /保存配置/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/配置已保存到 helper/)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/config', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/config', expect.objectContaining({ method: 'PUT' }));
  });

  it('saves Keychain secrets for WebDAV through the helper', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://127.0.0.1:37371/secret');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toMatchObject({ service: 'codexbackup-webdav', secret: 'secret-value' });
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'secret-value' } });
    fireEvent.click(screen.getByRole('button', { name: /保存密钥/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/密钥已写入 macOS Keychain/)).toBeInTheDocument();
    });
  });

  it('loads helper backup history in Logs', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      history: {
        version: 1,
        entries: [{
          action: 'backup',
          target: 'local',
          status: 'success',
          startedAt: '2026-06-06T00:00:00.000Z',
          finishedAt: '2026-06-06T00:00:01.000Z',
          exitCode: 0,
          archivePaths: ['/tmp/CodexBackups/codex-backup-mac.tar.gz'],
        }],
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /日志/i }));
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByText(/已加载 1 条 helper 备份历史/)).toBeInTheDocument();
      expect(screen.getAllByText(/codex-backup-mac\.tar\.gz/).length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/history', expect.objectContaining({ method: 'GET' }));
  });

  it('shows helper lifecycle controls and product paths in Settings', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /设置/i }));

    expect(screen.getByText('桌面 helper')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /启动 helper/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /停止 helper/i })).toBeInTheDocument();
    expect(screen.getByText('~/Library/Application Support/CodexBackupToolkit/config.json')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Application Support/CodexBackupToolkit/history.json')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Logs/CodexBackup/desktop-helper.out.log')).toBeInTheDocument();
    expect(screen.getByText('0.10.0')).toBeInTheDocument();
  });

  it('keeps real backup confirmation disabled in desktop mode outside Tauri', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /桌面/i }));

    expect(screen.getByText('真实备份确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /执行真实备份/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /确认真实备份/i }));
    expect(screen.getByRole('button', { name: /执行真实备份/i })).toBeDisabled();
  });

  it('shows latest backup result artifacts from helper history', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      schema: 'codex-backup-helper.v1',
      version: 1,
      status: 'ok',
      history: {
        version: 1,
        entries: [{
          action: 'backup',
          target: 'local',
          status: 'success',
          startedAt: '2026-06-06T00:00:00.000Z',
          finishedAt: '2026-06-06T00:00:01.000Z',
          exitCode: 0,
          archivePaths: ['/tmp/CodexBackups/codex-backup-mac.tar.gz'],
        }],
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /日志/i }));
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByText('最新备份结果')).toBeInTheDocument();
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-mac.tar.gz').length).toBeGreaterThan(0);
      expect(screen.getByText('/tmp/CodexBackups/codex-backup-mac.tar.gz.sha256')).toBeInTheDocument();
      expect(screen.getByText('/tmp/CodexBackups/codex-backup-mac.manifest.txt')).toBeInTheDocument();
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function baseConfigResponse() {
  return {
    localDir: '$HOME/CodexBackups',
    smbHost: 'nas.example.local',
    smbShare: 'CodexBackup',
    smbUser: 'backup-user',
    webdavUrl: 'https://webdav.example.com/remote.php/dav/files/user/CodexBackup',
    webdavUser: 'backup-user',
    rcloneRemote: 'gdrive:CodexBackup',
    encrypt: false,
    ageRecipient: '',
    ageRecipientFile: '',
    retentionCount: 10,
    retentionDays: 30,
    remoteRetention: false,
  };
}
