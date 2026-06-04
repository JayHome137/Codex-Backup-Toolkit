import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
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
      expect(screen.getByText(/Native helper not connected yet\./)).toBeInTheDocument();
      expect(screen.getByText(/Allowed command kind: doctor/)).toBeInTheDocument();
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
});
