import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function openAdvancedSection(name: RegExp | string) {
  clickNav(/^设置$/i);
  fireEvent.click(screen.getByRole('button', { name }));
}

function clickNav(name: RegExp | string) {
  fireEvent.click(within(screen.getByRole('navigation', { name: /GUI 分区/i })).getByRole('button', { name }));
}

function expectNav(name: RegExp | string) {
  expect(within(screen.getByRole('navigation', { name: /GUI 分区/i })).getByRole('button', { name })).toBeInTheDocument();
}

function runDoctorFromStorage() {
  clickNav(/存储位置/i);
  fireEvent.click(screen.getByRole('button', { name: /运行目标端检查/i }));
}

function openBackup() {
  clickNav(/备份/i);
}

async function selectRuntimeMode(name: RegExp | string) {
  clickNav(/^设置$/i);
  const group = screen.getByRole('group', { name: /开发运行模式/i });
  fireEvent.click(within(group).getByRole('button', { name }));

  await waitFor(() => {
    expect(within(group).getByRole('button', { name })).toHaveClass('segment--active');
  });
}

async function selectHttpHelperMode() {
  await selectRuntimeMode(/开发连接/i);
}

async function selectLocalBridgeMode() {
  await selectRuntimeMode(/^本机$/i);
}

async function selectDesktopHelperMode() {
  await selectRuntimeMode(/桌面 App/i);
}

describe('App', () => {
  it('shows WebDAV command preview after selecting WebDAV target', () => {
    render(<App />);

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('WebDAV 地址')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
  });

  it('shows a target setup guide with validation and common failure guidance', async () => {
    render(<App />);

    clickNav(/存储位置/i);

    expect(screen.getByText('本地目录设置向导')).toBeInTheDocument();
    expect(screen.getByText('确认输出目录')).toBeInTheDocument();
    expect(screen.getAllByText('运行目标端检查').length).toBeGreaterThan(0);
    expect(screen.getByText(/不会安装、卸载或修改定时任务/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /复制验证命令/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('./scripts/codexbackup.sh --doctor --target local'));
    });

    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByText('WebDAV 设置向导')).toBeInTheDocument();
    expect(screen.getByText('保存或临时提供密码')).toBeInTheDocument();
    expect(screen.getByText('评估加密')).toBeInTheDocument();
    expect(screen.getByText('401 或 403')).toBeInTheDocument();
    expect(screen.getByText('地址不可访问')).toBeInTheDocument();
  });

  it('runs doctor through the preview-only mock runner', async () => {
    render(<App />);

    runDoctorFromStorage();
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/环境检查通过/)).toBeInTheDocument();
    });
  });

  it('shows structured target check results after running doctor', async () => {
    render(<App />);

    runDoctorFromStorage();

    await waitFor(() => {
      expect(screen.getByText('目标端检查')).toBeInTheDocument();
      expect(screen.getByText('4 项检查，0 个失败，0 个警告。')).toBeInTheDocument();
      expect(screen.getByText('zsh 可用')).toBeInTheDocument();
      expect(screen.getByText('tar 可用')).toBeInTheDocument();
    });
  });

  it('shows target doctor advice after doctor output is available', async () => {
    render(<App />);

    runDoctorFromStorage();

    await waitFor(() => {
      expect(screen.getByText('目标端处理建议')).toBeInTheDocument();
      expect(screen.getByText('检查通过')).toBeInTheDocument();
      expect(screen.getByText(/按真实备份确认流程执行第一次受控备份/)).toBeInTheDocument();
    });
  });

  it('shows a simplified overview status without duplicating backup execution details', () => {
    render(<App />);

    expect(screen.getByText('当前备份状态')).toBeInTheDocument();
    expect(screen.getAllByText('存储位置').length).toBeGreaterThan(0);
    expect(screen.getByText('下一步')).toBeInTheDocument();
    expect(screen.queryByText('备份本机数据')).not.toBeInTheDocument();
    expect(screen.queryByText('最新备份结果')).not.toBeInTheDocument();

    expectNav(/^概览$/i);
    expectNav(/^备份$/i);
    expectNav(/^存储位置$/i);
    expectNav(/^恢复$/i);
    expectNav(/^记录$/i);
    expectNav(/^设置$/i);

    expect(screen.queryByRole('button', { name: /^引导$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^安装$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^健康$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^诊断$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^计划$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /运行模式/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /开发连接/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /桌面 App/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行真实恢复/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /安装定时任务/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /开始备份/i }));
    expect(screen.getByText('备份本机数据')).toBeInTheDocument();

    clickNav(/^设置$/i);
    expect(screen.getByText('高级诊断入口')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /首启引导/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /健康检查/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /定时备份状态/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /开发运行模式/i })).toBeInTheDocument();
  });

  it('reads local settings and saved paths from one overview action', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/config')) {
        return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok', config: { ...baseConfigResponse(), target: 'webdav' } });
      }
      if (String(input).endsWith('/history')) {
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          history: {
            version: 1,
            entries: [{
              action: 'backup',
              target: 'webdav',
              status: 'success',
              startedAt: '2026-06-08T00:00:00.000Z',
              finishedAt: '2026-06-08T00:00:02.000Z',
              exitCode: 0,
              archivePaths: ['/tmp/CodexBackups/codex-backup-latest.tar.gz'],
            }],
          },
        });
      }
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /一键读取本机设置/i }));

    await waitFor(() => {
      expect(screen.getByText('本机设置和保存目录')).toBeInTheDocument();
      expect(screen.getAllByText('WebDAV').length).toBeGreaterThan(0);
      expect(screen.getByText('https://webdav.example.com/remote.php/dav/files/user/CodexBackup')).toBeInTheDocument();
      expect(screen.getByText('~/.codex')).toBeInTheDocument();
      expect(screen.getByText('~/Documents/Codex')).toBeInTheDocument();
      expect(screen.getByText('~/Library/Application Support/CodexBackupToolkit/config.json')).toBeInTheDocument();
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-latest.tar.gz').length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/config', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/history', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/run'), expect.anything());
  });

  it('shows backup health summary and next actions', async () => {
    render(<App />);

    openAdvancedSection(/健康检查/i);

    expect(screen.getByText('日常使用状态')).toBeInTheDocument();
    expect(screen.getByText('首次使用')).toBeInTheDocument();
    expect(screen.getByText('健康度')).toBeInTheDocument();
    expect(screen.getByText('备份健康度')).toBeInTheDocument();
    expect(screen.getByText('本机服务')).toBeInTheDocument();
    expect(screen.getAllByText('最近备份').length).toBeGreaterThan(0);
    expect(screen.getByText('一致性')).toBeInTheDocument();
    expect(screen.getByText('建议动作')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开目标端/i })).toBeInTheDocument();
  });

  it('keeps automation mutation and real restore controls out of the simplified overview', () => {
    render(<App />);

    expect(screen.getByText('当前备份状态')).toBeInTheDocument();
    expect(screen.getByText(/执行备份在备份页/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行真实恢复/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /安装定时任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /卸载定时任务/i })).not.toBeInTheDocument();
  });

  it('guides first-run validation without exposing install, uninstall, or real restore actions', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = new URL(String(_url)).pathname;
      if (method === 'GET' && path === '/history') {
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          history: { version: 1, entries: [] },
        });
      }
      if (method === 'GET' && path === '/automation') {
        return jsonResponse({
          schema: 'codex-backup-helper.v1',
          version: 1,
          status: 'ok',
          automation: {
            label: 'dev.codexbackup.toolkit',
            loaded: false,
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
        });
      }
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    openAdvancedSection(/首启引导/i);

    expect(screen.getByText('首启验证流程')).toBeInTheDocument();
    expect(screen.getByText('恢复安全边界')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /安装定时任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /卸载定时任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行真实恢复/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /运行环境检查/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('目标端检查')).toBeInTheDocument();
      expect(screen.getAllByText('4 项检查，0 个失败，0 个警告。').length).toBeGreaterThan(0);
    });

    openAdvancedSection(/首启引导/i);
    fireEvent.click(screen.getAllByRole('button', { name: /刷新健康状态/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/已刷新健康状态/)).toBeInTheDocument();
    });

    await selectHttpHelperMode();
    openBackup();

    expect(screen.getByText('备份本机数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即备份/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/run'), expect.anything());
  });

  it('shows post-install release verification without adding updater, signing, or real restore controls', async () => {
    render(<App />);

    openAdvancedSection(/安装验证/i);

    expect(screen.getByText('安装后验证')).toBeInTheDocument();
    expect(screen.getByText('CodexBackup_0.36.2_aarch64.dmg')).toBeInTheDocument();
    expect(screen.getByText('CodexBackup_0.36.2_aarch64.dmg.sha256')).toBeInTheDocument();
    expect(screen.getByText('shasum -a 256 -c CodexBackup_0.36.2_aarch64.dmg.sha256')).toBeInTheDocument();
    expect(screen.getByText('未签名限制')).toBeInTheDocument();
    expect(screen.getByText('校验结果判断')).toBeInTheDocument();
    expect(screen.getByText(/OK 表示下载文件和发布校验一致/)).toBeInTheDocument();
    expect(screen.getByText('打不开时')).toBeInTheDocument();
    expect(screen.getByText(/系统设置 > 隐私与安全/)).toBeInTheDocument();
    expect(screen.getByText('安装后 smoke 检查')).toBeInTheDocument();
    expect(screen.getByText('发布可信度')).toBeInTheDocument();
    expect(screen.getByText('安装落地验收')).toBeInTheDocument();
    expect(screen.getByText('桌面运行时')).toBeInTheDocument();
    expect(screen.getByText('首次备份验收')).toBeInTheDocument();
    expect(screen.getByText('Release 产物完整')).toBeInTheDocument();
    expect(screen.getByText('已知限制明确')).toBeInTheDocument();
    expect(screen.getByText('打开引导页并运行环境检查。')).toBeInTheDocument();
    expect(screen.getByText(/不执行真实恢复，不安装或卸载定时任务/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动更新/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /签名/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /公证/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行真实恢复/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /复制校验命令/i })[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('shasum -a 256 -c CodexBackup_0.36.2_aarch64.dmg.sha256');
    });
  });

  it('shows a macOS diagnostic center without exposing automation mutation or real restore controls', () => {
    render(<App />);

    openAdvancedSection(/macOS 诊断/i);

    expect(screen.getByText('macOS 诊断中心')).toBeInTheDocument();
    expect(screen.getByText('macOS 桌面成熟度')).toBeInTheDocument();
    expect(screen.getByText('本机服务运行状态')).toBeInTheDocument();
    expect(screen.getAllByText('内置资源').length).toBeGreaterThan(0);
    expect(screen.getByText('发布验收脚本')).toBeInTheDocument();
    expect(screen.getByText(/macOS 诊断只读取状态和路径/)).toBeInTheDocument();
    expect(screen.getByText('诊断路径')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Logs/CodexBackup/desktop-helper.err.log')).toBeInTheDocument();
    expect(screen.getByText('macOS release smoke')).toBeInTheDocument();
    expect(screen.getByText('npm run desktop:build && npm run desktop:checksum && npm run desktop:smoke')).toBeInTheDocument();
    expect(screen.getByText('不安装、不卸载、不加载或卸载 launchd；不执行真实恢复。')).toBeInTheDocument();
    expect(screen.getByText('建议修复路径')).toBeInTheDocument();
    expect(screen.getByText('打开桌面 App 版本')).toBeInTheDocument();
    expect(screen.getByText('在设置页启动本机服务')).toBeInTheDocument();
    expect(screen.getByText('读取计划状态')).toBeInTheDocument();
    expect(screen.getByText('完成首次真实备份验收')).toBeInTheDocument();
    expect(screen.getByText('只读取自动化状态，不加载、不卸载、不重写定时任务。')).toBeInTheDocument();
    expect(screen.getByText('真实备份需要手动确认，恢复仍只生成预案。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /安装定时任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /卸载定时任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /执行真实恢复/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /前往处理/i })[0]);
    expect(screen.getByText('本机服务')).toBeInTheDocument();
  });

  it('lets the install readiness panel navigate to settings, targets, logs, and restore', async () => {
    render(<App />);

    openAdvancedSection(/安装验证/i);
    fireEvent.click(screen.getByRole('button', { name: /验收打开设置/ }));
    expect(screen.getByText('本机服务')).toBeInTheDocument();

    openAdvancedSection(/安装验证/i);
    fireEvent.click(screen.getByRole('button', { name: /验收运行目标端检查/ }));
    expect(screen.getByRole('heading', { name: '存储位置' })).toBeInTheDocument();

    openAdvancedSection(/安装验证/i);
    fireEvent.click(screen.getByRole('button', { name: /验收刷新历史/ }));
    expect(screen.getByText('备份记录')).toBeInTheDocument();

    openAdvancedSection(/安装验证/i);
    fireEvent.click(screen.getByRole('button', { name: /验收打开恢复预案/ }));
    expect(screen.getAllByText('恢复预览').length).toBeGreaterThan(0);
  });

  it('refreshes backup health by reading helper history and automation status', async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = new URL(String(_url)).pathname;
      if (method === 'GET' && path === '/history') {
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
              archivePaths: ['/tmp/CodexBackups/codex-backup-health.tar.gz'],
            }],
          },
        });
      }
      if (method === 'GET' && path === '/automation') {
        return jsonResponse({
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
        });
      }
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    openAdvancedSection(/健康检查/i);
    fireEvent.click(screen.getByRole('button', { name: /刷新健康状态/i }));

    await waitFor(() => {
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-health.tar.gz').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/定时任务已加载/).length).toBeGreaterThan(0);
      expect(screen.getByText(/已刷新健康状态/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/history', { method: 'GET' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/automation', { method: 'GET' });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/run'), expect.anything());
  });

  it('shows first real backup acceptance from helper history', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => {
      const path = new URL(String(_url)).pathname;
      if (path === '/history') {
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
              archivePaths: ['/tmp/CodexBackups/codex-backup-acceptance.tar.gz'],
            }],
          },
        });
      }
      return jsonResponse({ schema: 'codex-backup-helper.v1', version: 1, status: 'ok' });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await selectHttpHelperMode();
    clickNav(/记录/i);
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByText('首次备份验收')).toBeInTheDocument();
      expect(screen.getByText('首次真实备份验收通过。')).toBeInTheDocument();
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-acceptance.tar.gz.sha256').length).toBeGreaterThan(0);
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-acceptance.manifest.txt').length).toBeGreaterThan(0);
    });
  });

  it('copies command previews to the clipboard', async () => {
    render(<App />);

    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /复制备份命令预览/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('./scripts/codexbackup.sh --target local'));
    });
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('shows a config.env preview for the selected target', () => {
    render(<App />);

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getAllByText(/config.env 预览/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CODEX_BACKUP_WEBDAV_URL=/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/# CODEX_BACKUP_WEBDAV_PASSWORD=/).length).toBeGreaterThan(0);
  });

  it('previews opt-in remote retention for cloud targets', () => {
    render(<App />);

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByLabelText('启用远端保留策略')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_REMOTE_RETENTION=0/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('启用远端保留策略'));

    expect(screen.getAllByText(/CODEX_BACKUP_REMOTE_RETENTION=1/).length).toBeGreaterThan(0);
  });

  it('previews latest restore commands for the selected target', () => {
    render(<App />);

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /rclone/i }));
    clickNav(/恢复/i);

    expect(screen.getByRole('group', { name: /恢复来源/i })).toBeInTheDocument();
    expect(screen.getByText('最新备份目标端')).toBeInTheDocument();
    expect(screen.getAllByText(/CODEX_BACKUP_TARGET=rclone/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --plan --latest/).length).toBeGreaterThan(0);
    expect(screen.getByText('最新备份恢复预案')).toBeInTheDocument();
    expect(screen.getByText(/不会解压归档/)).toBeInTheDocument();
  });

  it('can switch restore preview back to a specific archive', () => {
    render(<App />);

    clickNav(/恢复/i);
    fireEvent.click(screen.getByRole('button', { name: /指定归档/i }));

    expect(screen.getByLabelText('归档路径')).toBeInTheDocument();
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --plan --archive/).length).toBeGreaterThan(0);
    expect(screen.getByText('指定归档恢复预案')).toBeInTheDocument();
    expect(screen.getByText(/确认归档路径来自可信的 helper 历史或手动选择/)).toBeInTheDocument();
  });

  it('keeps a history of preview runs in Logs', async () => {
    render(<App />);

    runDoctorFromStorage();
    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /立即备份/i }));
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/运行历史/i)).toBeInTheDocument();
      expect(screen.getByText(/目标端检查命令/i)).toBeInTheDocument();
      expect(screen.getAllByText(/真实备份/i).length).toBeGreaterThan(0);
    });
  });

  it('uses the local bridge allowlist mode for doctor commands', async () => {
    render(<App />);

    await selectLocalBridgeMode();
    runDoctorFromStorage();
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/模拟助手已接受环境检查/)).toBeInTheDocument();
      expect(screen.getByText(/协议: codex-backup-helper\.v1/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 环境检查/)).toBeInTheDocument();
    });
  });

  it('runs backup commands in local bridge mode', async () => {
    render(<App />);

    await selectLocalBridgeMode();
    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /立即备份/i }));
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/模拟助手已接受备份执行/)).toBeInTheDocument();
      expect(screen.getByText(/命令类型: 备份执行/)).toBeInTheDocument();
    });
  });

  it('shows config checks and encryption guidance for cloud targets', () => {
    render(<App />);

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));

    expect(screen.getByText('配置检查')).toBeInTheDocument();
    expect(screen.getByText(/云端或第三方存储建议开启 age 加密/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('使用 age 加密归档'));

    expect(screen.getByLabelText('age 收件人')).toBeInTheDocument();
    expect(screen.getAllByText(/启用加密时必须配置 CODEX_BACKUP_AGE_RECIPIENT/).length).toBeGreaterThan(0);
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

    await selectHttpHelperMode();
    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /确认备份内容/i }));
    fireEvent.click(screen.getByRole('button', { name: /立即备份/i }));
    clickNav(/记录/i);

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

    await selectHttpHelperMode();
    openBackup();

    expect(screen.getByText('备份本机数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /确认备份内容/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /立即备份/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /确认备份内容/i }));
    fireEvent.click(screen.getByRole('button', { name: /立即备份/i }));
    clickNav(/记录/i);

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

  it('sends local authoritative sync requests through the HTTP helper transport', async () => {
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
          stdout: 'Sync status: drift\nSync action: backup-created\nBackup written to:\n  /tmp/CodexBackups/codex-backup-sync.tar.gz',
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
              action: 'syncLocalAuthoritative',
              target: 'local',
              status: 'success',
              startedAt: '2026-06-06T00:00:00.000Z',
              finishedAt: '2026-06-06T00:00:01.000Z',
              exitCode: 0,
              archivePaths: ['/tmp/CodexBackups/codex-backup-sync.tar.gz'],
            }],
          },
        });
      }

      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await selectHttpHelperMode();
    openBackup();
    fireEvent.click(screen.getByRole('button', { name: /生成同步备份/i }));
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/Sync action: backup-created/)).toBeInTheDocument();
      expect(screen.getByText('一致性备份')).toBeInTheDocument();
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-sync.tar.gz').length).toBeGreaterThan(0);
    });

    const runCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/run'));
    const request = JSON.parse(String(runCall?.[1]?.body));
    expect(request.kind).toBe('sync');
    expect(request.command).toBeUndefined();
    expect(request.action).toMatchObject({ type: 'syncLocalAuthoritative', target: 'local' });
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

    await selectHttpHelperMode();
    runDoctorFromStorage();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:37371/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/助手返回环境检查正常/)).toBeInTheDocument();
      expect(screen.getByText(/服务: node-local-helper/)).toBeInTheDocument();
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

    await selectHttpHelperMode();
    clickNav(/恢复/i);
    fireEvent.click(screen.getByRole('button', { name: /指定归档/i }));
    fireEvent.click(screen.getByRole('button', { name: /生成预案/i }));
    clickNav(/记录/i);

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

    await selectHttpHelperMode();
    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/本机服务已连接/).length).toBeGreaterThan(0);
    });
    clickNav(/记录/i);
    expect(screen.getAllByText(/node-local-helper/).length).toBeGreaterThan(0);
  });

  it('disables helper actions after helper health check fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:37371');
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getAllByText('本机服务未连接').length).toBeGreaterThan(0);
      expect(screen.getByText(/请先启动本机服务/)).toBeInTheDocument();
    });

    clickNav(/存储位置/i);

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
      expect(screen.getByText('本机服务未连接')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /重新检查/i }));

    await waitFor(() => {
      expect(screen.getByText('本机服务已连接')).toBeInTheDocument();
    });

    clickNav(/存储位置/i);

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

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /加载配置/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('WebDAV 地址')).toBeInTheDocument();
    });
    clickNav(/记录/i);
    expect(screen.getByText(/已从本机服务加载保存的配置/)).toBeInTheDocument();
    clickNav(/存储位置/i);

    fireEvent.click(screen.getByRole('button', { name: /保存配置/i }));
    clickNav(/记录/i);

    await waitFor(() => {
      expect(screen.getByText(/配置已保存到本机/)).toBeInTheDocument();
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

    clickNav(/存储位置/i);
    fireEvent.click(screen.getByRole('button', { name: /webdav/i }));
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'secret-value' } });
    fireEvent.click(screen.getByRole('button', { name: /保存密钥/i }));
    clickNav(/记录/i);

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

    clickNav(/记录/i);
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByText(/已加载 1 条备份记录/)).toBeInTheDocument();
      expect(screen.getAllByText(/codex-backup-mac\.tar\.gz/).length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:37371/history', expect.objectContaining({ method: 'GET' }));
  });

  it('shows helper lifecycle controls and product paths in Settings', () => {
    render(<App />);

    clickNav(/^设置$/i);

    expect(screen.getByText('本机服务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /启动服务/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /停止服务/i })).toBeInTheDocument();
    expect(screen.getByText('~/Library/Application Support/CodexBackupToolkit/config.json')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Application Support/CodexBackupToolkit/history.json')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Logs/CodexBackup/desktop-helper.out.log')).toBeInTheDocument();
    expect(screen.getByText('0.36.2')).toBeInTheDocument();
  });

  it('shows desktop readiness in Settings for first launch', () => {
    render(<App />);

    clickNav(/^设置$/i);

    expect(screen.getByText('首次启动核对')).toBeInTheDocument();
    expect(screen.getByText('高级诊断入口')).toBeInTheDocument();
    expect(screen.getByText(/日常使用只需要概览、备份、存储位置、恢复和记录/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /安装验证/i })).toBeInTheDocument();
  });

  it('shows a first-launch checklist in Settings', () => {
    render(<App />);

    clickNav(/^设置$/i);

    expect(screen.getByText('首次启动核对')).toBeInTheDocument();
    expect(screen.getByText('本机服务状态')).toBeInTheDocument();
    expect(screen.getByText('toolkit 来源')).toBeInTheDocument();
    expect(screen.getByText('配置和历史路径')).toBeInTheDocument();
    expect(screen.getByText('真实恢复仍为预案')).toBeInTheDocument();
  });

  it('shows read-only automation status on the schedule page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://127.0.0.1:37371/automation');
      return jsonResponse({
        schema: 'codex-backup-helper.v1',
        version: 1,
        status: 'ok',
        automation: {
          label: 'dev.codexbackup.toolkit',
          loaded: false,
          plistExists: true,
          installDirExists: true,
          scheduledScriptExists: false,
          plistPath: '/Users/test/Library/LaunchAgents/dev.codexbackup.toolkit.plist',
          installDir: '/Users/test/Library/Application Support/CodexBackupToolkit',
          scheduledScriptPath: '/Users/test/Library/Application Support/CodexBackupToolkit/scripts/codexscheduledbackup.sh',
          stdoutLogPath: '/Users/test/Library/Logs/CodexBackup/backup.out.log',
          stderrLogPath: '/Users/test/Library/Logs/CodexBackup/backup.err.log',
          schedule: '03:00 / 每 3 天',
          lastError: 'Job is not loaded',
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    openAdvancedSection(/定时备份状态/i);
    expect(screen.getByText('自动化状态')).toBeInTheDocument();
    expect(screen.getByText(/只读检查/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /安装任务/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /卸载任务/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /刷新自动化状态/i }));

    await waitFor(() => {
      expect(screen.getByText('dev.codexbackup.toolkit')).toBeInTheDocument();
      expect(screen.getAllByText('未加载').length).toBeGreaterThan(0);
      expect(screen.getByText('03:00 / 每 3 天')).toBeInTheDocument();
      expect(screen.getByText('/Users/test/Library/LaunchAgents/dev.codexbackup.toolkit.plist')).toBeInTheDocument();
      expect(screen.getByText('/Users/test/Library/Application Support/CodexBackupToolkit')).toBeInTheDocument();
      expect(screen.getByText('/Users/test/Library/Logs/CodexBackup/backup.out.log')).toBeInTheDocument();
      expect(screen.getByText('Job is not loaded')).toBeInTheDocument();
    });
  });

  it('keeps real backup confirmation disabled in desktop mode outside Tauri', async () => {
    render(<App />);

    await selectDesktopHelperMode();
    openBackup();

    expect(screen.getByText('备份本机数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即备份/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /确认备份内容/i }));
    expect(screen.getByRole('button', { name: /立即备份/i })).toBeDisabled();
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

    clickNav(/记录/i);
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByText('最新备份结果')).toBeInTheDocument();
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-mac.tar.gz').length).toBeGreaterThan(0);
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-mac.tar.gz.sha256').length).toBeGreaterThan(0);
      expect(screen.getAllByText('/tmp/CodexBackups/codex-backup-mac.manifest.txt').length).toBeGreaterThan(0);
    });
  });

  it('generates a restore plan from a backup history archive without executing restore', async () => {
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

    clickNav(/记录/i);
    fireEvent.click(screen.getByRole('button', { name: /刷新历史/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /生成恢复预案/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /生成恢复预案/i }));

    expect(screen.getByRole('group', { name: /恢复来源/i })).toBeInTheDocument();
    expect(screen.getByLabelText('归档路径')).toHaveValue('/tmp/CodexBackups/codex-backup-mac.tar.gz');
    expect(screen.getAllByText(/\.\/scripts\/codexrestore\.sh --plan --archive \/tmp\/CodexBackups\/codex-backup-mac\.tar\.gz/).length).toBeGreaterThan(0);
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
