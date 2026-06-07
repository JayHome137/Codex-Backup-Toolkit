import type { BackupConfig } from './config';
import type { AutomationStatus, BackupHistoryEntry, DeleteSecretInput, SecretInput } from './helperApi';
import type { HelperRequest, HelperResponse, HelperTransport } from './helperProtocol';

type InvokeFunction = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type HelperSource = 'managed' | 'external' | 'unavailable';

export type DesktopHelperStatus = {
  lastError?: string;
  managed: boolean;
  online: boolean;
  port?: number;
  source: HelperSource;
};

export type DesktopToolkitStatus = {
  available: boolean;
  helperPath?: string;
  lastError?: string;
  rootPath?: string;
  scriptsPath?: string;
  source: 'bundle' | 'environment' | 'development' | 'unavailable';
};

export type DesktopPaths = {
  appSupportDir: string;
  automationStderrLogPath: string;
  automationStdoutLogPath: string;
  configPath: string;
  desktopHelperStderrLogPath: string;
  desktopHelperStdoutLogPath: string;
  historyPath: string;
  logDir: string;
};

export type DesktopDiagnostics = {
  helper: DesktopHelperStatus;
  paths: DesktopPaths;
  toolkit: DesktopToolkitStatus;
  version: string;
};

export type DesktopBridge = {
  desktopDiagnostics(): Promise<DesktopDiagnostics>;
  helperRequest<T = unknown>(request: DesktopHelperRequest): Promise<T>;
  helperStart(): Promise<DesktopHelperStatus>;
  helperStatus(): Promise<DesktopHelperStatus>;
  helperStop(): Promise<DesktopHelperStatus>;
  isDesktop: boolean;
  openPath(path: string): Promise<{ status: 'ok' }>;
  toolkitStatus(): Promise<DesktopToolkitStatus>;
};

export type DesktopHelperRequest = {
  body?: unknown;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  path: '/health' | '/config' | '/secret' | '/history' | '/automation' | '/run';
};

type BridgeOptions = {
  invoke?: InvokeFunction | null;
};

const schema = 'codex-backup-helper.v1' as const;

export function createDesktopBridge(options: BridgeOptions = {}): DesktopBridge {
  const invoke = options.invoke ?? getTauriInvoke();

  if (!invoke) {
    return createUnavailableBridge();
  }

  return {
    desktopDiagnostics(): Promise<DesktopDiagnostics> {
      return invoke<DesktopDiagnostics>('desktop_diagnostics');
    },
    helperRequest<T = unknown>(request: DesktopHelperRequest): Promise<T> {
      return invoke<T>('helper_request', { request });
    },
    helperStart(): Promise<DesktopHelperStatus> {
      return invoke<DesktopHelperStatus>('helper_start');
    },
    helperStatus(): Promise<DesktopHelperStatus> {
      return invoke<DesktopHelperStatus>('helper_status');
    },
    helperStop(): Promise<DesktopHelperStatus> {
      return invoke<DesktopHelperStatus>('helper_stop');
    },
    isDesktop: true,
    openPath(path: string): Promise<{ status: 'ok' }> {
      return invoke<{ status: 'ok' }>('open_path', { path });
    },
    toolkitStatus(): Promise<DesktopToolkitStatus> {
      return invoke<DesktopToolkitStatus>('toolkit_status');
    },
  };
}

export function createDesktopHelperApi(bridge: DesktopBridge) {
  return {
    async loadConfig(): Promise<BackupConfig> {
      const body = await bridge.helperRequest({ method: 'GET', path: '/config' });
      if (!isConfigResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 配置响应不符合协议。');
      return body.config;
    },

    async saveConfig(config: BackupConfig): Promise<BackupConfig> {
      const body = await bridge.helperRequest({ method: 'PUT', path: '/config', body: config });
      if (!isConfigResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 配置响应不符合协议。');
      return body.config;
    },

    async saveSecret(input: SecretInput): Promise<{ status: 'ok' }> {
      const body = await bridge.helperRequest({ method: 'POST', path: '/secret', body: input });
      if (!isOkResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: secret 响应不符合协议。');
      return { status: 'ok' };
    },

    async deleteSecret(input: DeleteSecretInput): Promise<{ status: 'ok' }> {
      const body = await bridge.helperRequest({ method: 'DELETE', path: '/secret', body: input });
      if (!isOkResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: secret 响应不符合协议。');
      return { status: 'ok' };
    },

    async loadHistory(): Promise<BackupHistoryEntry[]> {
      const body = await bridge.helperRequest({ method: 'GET', path: '/history' });
      if (!isHistoryResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 历史响应不符合协议。');
      return body.history.entries;
    },

    async loadAutomationStatus(): Promise<AutomationStatus> {
      const body = await bridge.helperRequest({ method: 'GET', path: '/automation' });
      if (!isAutomationResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 自动化状态响应不符合协议。');
      return body.automation;
    },
  };
}

export function createDesktopHelperTransport(bridge: DesktopBridge): HelperTransport {
  return {
    async send(request: HelperRequest): Promise<HelperResponse> {
      const body = await bridge.helperRequest({ method: 'POST', path: '/run', body: request });
      if (!isHelperResponse(body)) throw new Error('ERR_HELPER_UNAVAILABLE: 助手响应不符合协议。');
      return body;
    },
  };
}

export function getBackupArtifacts(paths: string[]): { archivePath: string; checksumPath: string; manifestPath: string } | null {
  const archivePath = paths.find((path) => /\.tar\.gz(\.age)?$/.test(path));
  if (!archivePath) return null;

  const baseArchive = archivePath.replace(/\.age$/, '');
  return {
    archivePath,
    checksumPath: `${archivePath}.sha256`,
    manifestPath: baseArchive.replace(/\.tar\.gz$/, '.manifest.txt'),
  };
}

function createUnavailableBridge(): DesktopBridge {
  return {
    async desktopDiagnostics(): Promise<DesktopDiagnostics> {
      return unavailableDiagnostics();
    },
    async helperRequest(): Promise<never> {
      throw new Error('ERR_DESKTOP_UNAVAILABLE: 当前不是 Tauri 桌面环境。');
    },
    async helperStart(): Promise<DesktopHelperStatus> {
      return unavailableStatus();
    },
    async helperStatus(): Promise<DesktopHelperStatus> {
      return unavailableStatus();
    },
    async helperStop(): Promise<DesktopHelperStatus> {
      return unavailableStatus();
    },
    isDesktop: false,
    async openPath(): Promise<never> {
      throw new Error('ERR_DESKTOP_UNAVAILABLE: 当前不是 Tauri 桌面环境。');
    },
    async toolkitStatus(): Promise<DesktopToolkitStatus> {
      return { available: false, lastError: '当前不是 Tauri 桌面环境。', source: 'unavailable' };
    },
  };
}

function unavailableDiagnostics(): DesktopDiagnostics {
  return {
    helper: unavailableStatus(),
    paths: defaultDesktopPaths(),
    toolkit: { available: false, lastError: '当前不是 Tauri 桌面环境。', source: 'unavailable' },
    version: '0.27.0',
  };
}

function defaultDesktopPaths(): DesktopPaths {
  return {
    appSupportDir: '~/Library/Application Support/CodexBackupToolkit',
    automationStderrLogPath: '~/Library/Logs/CodexBackup/backup.err.log',
    automationStdoutLogPath: '~/Library/Logs/CodexBackup/backup.out.log',
    configPath: '~/Library/Application Support/CodexBackupToolkit/config.json',
    desktopHelperStderrLogPath: '~/Library/Logs/CodexBackup/desktop-helper.err.log',
    desktopHelperStdoutLogPath: '~/Library/Logs/CodexBackup/desktop-helper.out.log',
    historyPath: '~/Library/Application Support/CodexBackupToolkit/history.json',
    logDir: '~/Library/Logs/CodexBackup',
  };
}

function unavailableStatus(): DesktopHelperStatus {
  return { lastError: '当前不是 Tauri 桌面环境。', managed: false, online: false, source: 'unavailable' };
}

function getTauriInvoke(): InvokeFunction | null {
  const maybeWindow = globalThis as typeof globalThis & { __TAURI__?: { core?: { invoke?: InvokeFunction } } };
  return maybeWindow.__TAURI__?.core?.invoke ?? null;
}

function isOkResponse(value: unknown): value is { schema: typeof schema; status: 'ok'; version: 1 } {
  const body = value as { schema?: unknown; status?: unknown; version?: unknown };
  return !!body && body.schema === schema && body.version === 1 && body.status === 'ok';
}

function isConfigResponse(value: unknown): value is { config: BackupConfig; schema: typeof schema; status: 'ok'; version: 1 } {
  const body = value as { config?: unknown };
  return isOkResponse(value) && !!body.config && typeof body.config === 'object' && typeof (body.config as BackupConfig).target === 'string';
}

function isHistoryResponse(value: unknown): value is { history: { entries: BackupHistoryEntry[]; version: 1 }; schema: typeof schema; status: 'ok'; version: 1 } {
  const body = value as { history?: { entries?: unknown } };
  return isOkResponse(value) && !!body.history && Array.isArray(body.history.entries);
}

function isAutomationResponse(value: unknown): value is { automation: AutomationStatus; schema: typeof schema; status: 'ok'; version: 1 } {
  const body = value as { automation?: Partial<AutomationStatus> };
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

function isHelperResponse(value: unknown): value is HelperResponse {
  const response = value as Partial<HelperResponse>;
  return (
    !!response &&
    response.schema === schema &&
    response.version === 1 &&
    typeof response.requestId === 'string' &&
    (response.status === 'ok' || response.status === 'error') &&
    typeof response.exitCode === 'number' &&
    typeof response.stdout === 'string' &&
    typeof response.stderr === 'string' &&
    !!response.audit &&
    typeof response.audit === 'object' &&
    (response.audit.decision === 'allowed' || response.audit.decision === 'blocked') &&
    typeof response.audit.helper === 'string'
  );
}
