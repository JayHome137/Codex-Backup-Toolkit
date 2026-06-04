import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows WebDAV command preview after selecting WebDAV target', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /targets/i }));
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('WebDAV URL')).toBeInTheDocument();
    expect(screen.getByText(/CODEX_BACKUP_WEBDAV_URL=/)).toBeInTheDocument();
  });

  it('runs doctor through the preview-only mock runner', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /run doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /logs/i }));

    await waitFor(() => {
      expect(screen.getByText(/Doctor passed\./)).toBeInTheDocument();
    });
  });
});
