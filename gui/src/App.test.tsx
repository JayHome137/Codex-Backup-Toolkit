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

    fireEvent.click(screen.getByRole('button', { name: /targets/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('WebDAV URL')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
  });

  it('runs doctor through the preview-only mock runner', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /run doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Doctor passed\./)).toBeInTheDocument();
    });
  });

  it('copies command previews to the clipboard', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /copy backup command/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('./scripts/codexbackup.sh --target local'));
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('shows a config.env preview for the selected target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /targets/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getAllByText(/config.env preview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/# CODEX_BACKUP_WEBDAV_PASSWORD=/).length).toBeGreaterThan(0);
  });

  it('keeps a history of preview runs in Logs', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /run doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Run history/i)).toBeInTheDocument();
      expect(screen.getByText(/Doctor command/i)).toBeInTheDocument();
      expect(screen.getByText(/Backup command/i)).toBeInTheDocument();
    });
  });

  it('uses the local bridge allowlist mode for doctor commands', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /local bridge/i }));
    fireEvent.click(screen.getByRole('button', { name: /run doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mock helper accepted doctor\./)).toBeInTheDocument();
      expect(screen.getByText(/schema: codex-backup-helper\.v1/)).toBeInTheDocument();
      expect(screen.getByText(/commandKind: doctor/)).toBeInTheDocument();
    });
  });

  it('blocks backup commands in local bridge mode', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /local bridge/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Blocked by Web bridge allowlist\./)).toBeInTheDocument();
    });
  });

  it('uses the HTTP helper transport when HTTP Helper mode is selected', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));

      return new Response(
        JSON.stringify({
          schema: 'codex-backup-helper.v1',
          version: 1,
          requestId: request.requestId,
          status: 'ok',
          exitCode: 0,
          stdout: 'doctor ok from helper',
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

    fireEvent.click(screen.getByRole('button', { name: /http helper/i }));
    fireEvent.click(screen.getByRole('button', { name: /run doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/doctor ok from helper/)).toBeInTheDocument();
      expect(screen.getByText(/helper: node-local-helper/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /http helper/i }));
    fireEvent.click(screen.getByRole('button', { name: /check helper/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Helper is online/)).toBeInTheDocument();
      expect(screen.getByText(/node-local-helper/)).toBeInTheDocument();
    });
  });
});
