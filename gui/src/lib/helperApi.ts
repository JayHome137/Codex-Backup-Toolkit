import type { BackupConfig } from './config';

export type SecretInput = {
  account: string;
  secret: string;
  service: string;
};

export type DeleteSecretInput = Omit<SecretInput, 'secret'>;

export type BackupHistoryEntry = {
  action: 'backup' | 'syncLocalAuthoritative';
  archivePaths: string[];
  exitCode: number;
  finishedAt: string;
  startedAt: string;
  status: 'success' | 'error';
  target: string;
};

export type AutomationStatus = {
  installDir: string;
  installDirExists: boolean;
  label: string;
  lastError?: string;
  loaded: boolean;
  plistExists: boolean;
  plistPath: string;
  schedule: string;
  scheduledScriptExists: boolean;
  scheduledScriptPath: string;
  stderrLogPath: string;
  stdoutLogPath: string;
};

type HelperOkResponse = {
  schema: 'codex-backup-helper.v1';
  version: 1;
  status: 'ok';
};

const schema = 'codex-backup-helper.v1' as const;

export function createHelperApi(baseUrl = 'http://127.0.0.1:37371', fetcher: typeof fetch = fetch) {
  const request = async (path: string, init: RequestInit): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`ERR_HELPER_UNAVAILABLE: ${message}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`ERR_HELPER_UNAVAILABLE: 助手返回了无效 JSON：${message}`);
    }

    if (!response.ok) {
      throw new Error(`ERR_HELPER_FAILED: ${messageFromErrorBody(body)}`);
    }

    return body;
  };

  return {
    async loadConfig(): Promise<BackupConfig> {
      const body = await request('/config', { method: 'GET' });
      if (!isConfigResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 配置响应不符合协议。');
      return normalizeConfig(body.config);
    },

    async saveConfig(config: BackupConfig): Promise<BackupConfig> {
      const body = await request('/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!isConfigResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 配置响应不符合协议。');
      return normalizeConfig(body.config);
    },

    async saveSecret(input: SecretInput): Promise<{ status: 'ok' }> {
      const body = await request('/secret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!isOkResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: secret 响应不符合协议。');
      return { status: 'ok' };
    },

    async deleteSecret(input: DeleteSecretInput): Promise<{ status: 'ok' }> {
      const body = await request('/secret', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!isOkResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: secret 响应不符合协议。');
      return { status: 'ok' };
    },

    async loadHistory(): Promise<BackupHistoryEntry[]> {
      const body = await request('/history', { method: 'GET' });
      if (!isHistoryResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 历史响应不符合协议。');
      return body.history.entries;
    },

    async loadAutomationStatus(): Promise<AutomationStatus> {
      const body = await request('/automation', { method: 'GET' });
      if (!isAutomationResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 自动化状态响应不符合协议。');
      return body.automation;
    },
  };
}

function normalizeConfig(config: BackupConfig): BackupConfig {
  return {
    ...defaultBackupConfig(),
    ...config,
  };
}

function defaultBackupConfig(): BackupConfig {
  return {
    target: 'local',
    localDir: '$HOME/CodexBackups',
    smbHost: 'nas.example.local',
    smbUser: 'backup-user',
    smbShare: 'CodexBackup',
    webdavUrl: 'https://webdav.example.com/remote.php/dav/files/user/CodexBackup',
    webdavUser: 'backup-user',
    rcloneRemote: 'gdrive:CodexBackup',
    encrypt: false,
    ageRecipient: '',
    ageRecipientFile: '',
    retentionCount: 10,
    retentionDays: 30,
    remoteRetention: false,
    syncEnabled: false,
    syncCheckIntervalHours: 24,
    syncMinBackupIntervalHours: 24,
  };
}

function isOkResponse(value: unknown): value is HelperOkResponse {
  const body = value as Partial<HelperOkResponse>;
  return !!body && body.schema === schema && body.version === 1 && body.status === 'ok';
}

function isConfigResponse(value: unknown): value is HelperOkResponse & { config: BackupConfig } {
  const body = value as Partial<HelperOkResponse> & { config?: unknown };
  return isOkResponse(value) && !!body.config && typeof body.config === 'object' && typeof (body.config as BackupConfig).target === 'string';
}

function isHistoryResponse(value: unknown): value is HelperOkResponse & { history: { entries: BackupHistoryEntry[]; version: 1 } } {
  const body = value as Partial<HelperOkResponse> & { history?: { entries?: unknown } };
  return isOkResponse(value) && !!body.history && Array.isArray(body.history.entries);
}

function isAutomationResponse(value: unknown): value is HelperOkResponse & { automation: AutomationStatus } {
  const body = value as Partial<HelperOkResponse> & { automation?: Partial<AutomationStatus> };
  return isOkResponse(value)
    && !!body.automation
    && typeof body.automation.label === 'string'
    && typeof body.automation.loaded === 'boolean'
    && typeof body.automation.plistExists === 'boolean'
    && typeof body.automation.installDirExists === 'boolean'
    && typeof body.automation.scheduledScriptExists === 'boolean'
    && typeof body.automation.plistPath === 'string'
    && typeof body.automation.installDir === 'string'
    && typeof body.automation.scheduledScriptPath === 'string'
    && typeof body.automation.stdoutLogPath === 'string'
    && typeof body.automation.stderrLogPath === 'string'
    && typeof body.automation.schedule === 'string';
}

function messageFromErrorBody(value: unknown): string {
  if (value && typeof value === 'object') {
    const body = value as { message?: unknown; stderr?: unknown; errorCode?: unknown };
    if (typeof body.message === 'string') return body.message;
    if (typeof body.stderr === 'string') return body.stderr;
    if (typeof body.errorCode === 'string') return body.errorCode;
  }
  return 'helper request failed';
}
