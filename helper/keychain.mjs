import { createShellExecutor } from './executor.mjs';

export function createKeychain({ executor = createShellExecutor() } = {}) {
  return {
    async saveSecret({ service, account, secret }) {
      validateInput({ service, account });
      if (typeof secret !== 'string' || secret.length === 0) throw new Error('secret is required.');
      const result = await executor({
        kind: 'keychain',
        command: `security add-generic-password -U -s ${quote(service)} -a ${quote(account)} -w ${quote(secret)}`,
      });
      return statusFromResult(result);
    },
    async readSecret({ service, account }) {
      validateInput({ service, account });
      const result = await executor({
        kind: 'keychain',
        command: `security find-generic-password -s ${quote(service)} -a ${quote(account)} -w`,
      });
      const status = statusFromResult(result);
      return status.status === 'ok' ? { status: 'ok', secret: String(result.stdout ?? '').trim() } : status;
    },
    async deleteSecret({ service, account }) {
      validateInput({ service, account });
      const result = await executor({
        kind: 'keychain',
        command: `security delete-generic-password -s ${quote(service)} -a ${quote(account)}`,
      });
      return statusFromResult(result);
    },
  };
}

function validateInput({ service, account }) {
  if (typeof service !== 'string' || service.trim() === '') throw new Error('service is required.');
  if (typeof account !== 'string' || account.trim() === '') throw new Error('account is required.');
}

function statusFromResult(result) {
  const exitCode = Number.isInteger(result?.exitCode) ? result.exitCode : 1;
  if (exitCode === 0) return { status: 'ok' };
  return { status: 'error', exitCode, stderr: String(result?.stderr ?? '') };
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}
