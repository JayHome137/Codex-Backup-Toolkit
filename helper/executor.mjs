import { spawn } from 'node:child_process';

const defaultTimeoutMs = 120_000;

export function createShellExecutor({ cwd = process.cwd(), timeoutMs = defaultTimeoutMs } = {}) {
  return function executeShellCommand(request) {
    return new Promise((resolve) => {
      const child = spawn('/bin/zsh', ['-lc', request.command], {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        resolve({
          exitCode: 124,
          stdout,
          stderr: `${stderr}${stderr ? '\n' : ''}Helper command timed out after ${timeoutMs}ms.`,
        });
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ exitCode: 1, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${error.message}` });
      });

      child.on('close', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const signalMessage = signal ? `${stderr}${stderr ? '\n' : ''}Process terminated by ${signal}.` : stderr;
        resolve({ exitCode: code ?? 1, stdout, stderr: signalMessage });
      });
    });
  };
}
