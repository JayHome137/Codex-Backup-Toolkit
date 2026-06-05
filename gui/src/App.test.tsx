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

  it('previews latest restore commands for the selected target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /目标端/i }));
    fireEvent.click(screen.getByRole('button', { name: /rclone/i }));
    fireEvent.click(screen.getByRole('button', { name: /恢复/i }));

    expect(screen.getByRole('group', { name: /恢复来源/i })).toBeInTheDocument();
    expect(screen.getByText('最新备份目标端')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_TARGET=rclone/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --latest/).length).toBeGreaterThan(0);
  });

  it('can switch restore preview back to a specific archive', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /恢复/i }));
    fireEvent.click(screen.getByRole('button', { name: /指定归档/i }));

    expect(screen.getByLabelText('归档路径')).toBeInTheDocument();
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --archive/).length).toBeGreaterThan(0);
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

  it('blocks backup commands in local bridge mode', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /本地桥接/i }));
    fireEvent.click(screen.getByRole('button', { name: /预览备份/i }));
    fireEvent.click(screen.getByRole('button', { name: /日志/i }));

    await waitFor(() => {
      expect(screen.getByText(/已被 Web 桥接允许列表阻止/)).toBeInTheDocument();
    });
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
      expect(screen.getByText(/node-local-helper/)).toBeInTheDocument();
    });
  });
});
