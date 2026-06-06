import { buildDoctorCommand, targetLabels, type BackupConfig, type ConfigCheck } from './config';

export type TargetSetupStep = {
  detail: string;
  label: string;
  status: 'ready' | 'todo' | 'blocked';
};

export type TargetSetupFailure = {
  detail: string;
  label: string;
};

export type TargetSetupGuide = {
  commonFailures: TargetSetupFailure[];
  level: 'ready' | 'needs-action' | 'blocked';
  nextAction: string;
  safetyNotes: string[];
  steps: TargetSetupStep[];
  title: string;
  validationCommand: string;
};

export function buildTargetSetupGuide(config: BackupConfig, checks: ConfigCheck[]): TargetSetupGuide {
  const blocking = checks.find((check) => check.status === 'error');
  const steps = buildSteps(config, blocking);
  const level = blocking ? 'blocked' : steps.some((step) => step.status === 'todo') ? 'needs-action' : 'ready';

  return {
    commonFailures: commonFailures(config.target),
    level,
    nextAction: blocking ? `先处理配置阻断项：${blocking.detail}` : nextAction(config),
    safetyNotes: [
      '目标端检查只运行 codexbackup --doctor，不会创建备份归档。',
      '保存配置不会写入密码；SMB/WebDAV 密码请使用 Keychain 或运行前临时环境变量。',
      '这个向导不会安装、卸载或修改定时任务；恢复仍只生成预案。',
    ],
    steps,
    title: `${targetTitle(targetLabels[config.target])}设置向导`,
    validationCommand: buildDoctorCommand(config),
  };
}

function targetTitle(label: string): string {
  return /[A-Za-z]/.test(label) ? `${label} ` : label;
}

function buildSteps(config: BackupConfig, blocking?: ConfigCheck): TargetSetupStep[] {
  const targetStep: TargetSetupStep = blocking
    ? { label: '补齐目标端配置', detail: blocking.detail, status: 'blocked' }
    : targetSpecificStep(config);

  const steps: TargetSetupStep[] = [
    targetStep,
    { label: '运行目标端检查', detail: '使用当前表单生成 codexbackup --doctor 命令，只读检查依赖、路径和目标端可访问性。', status: blocking ? 'blocked' : 'todo' },
  ];

  if (config.target === 'smb' || config.target === 'webdav') {
    steps.splice(1, 0, {
      label: '保存或临时提供密码',
      detail: config.target === 'smb'
        ? 'SMB 密码不要写入 config.env，可在设置页写入 Keychain 或运行前临时导出 CODEX_BACKUP_PASSWORD。'
        : 'WebDAV 密码不要写入 config.env，可在设置页写入 Keychain 或运行前临时导出 CODEX_BACKUP_WEBDAV_PASSWORD。',
      status: 'todo',
    });
  }

  if (config.target === 'webdav' || config.target === 'rclone') {
    steps.splice(steps.length - 1, 0, {
      label: '评估加密',
      detail: config.encrypt ? '已开启 age 加密；请确认收件人或收件人文件可用。' : '云端或第三方存储建议后续开启 age 加密；当前加密仍是可选能力。',
      status: config.encrypt ? 'ready' : 'todo',
    });
  }

  if (config.target === 'rclone') {
    steps.splice(1, 0, {
      label: '确认 rclone remote',
      detail: '先在终端完成 rclone config，并确认 remote 名称能访问目标云盘路径。',
      status: 'todo',
    });
  }

  steps.push({ label: '执行手动备份确认', detail: 'doctor 通过后回到概览页，手动确认真实备份摘要后再执行一次受控备份。', status: 'todo' });
  return steps;
}

function targetSpecificStep(config: BackupConfig): TargetSetupStep {
  if (config.target === 'local') {
    return { label: '确认输出目录', detail: `当前输出目录：${config.localDir}`, status: 'ready' };
  }
  if (config.target === 'smb') {
    return { label: '确认 NAS 信息', detail: `主机 ${config.smbHost}，共享名 ${config.smbShare}，用户 ${config.smbUser}。`, status: 'ready' };
  }
  if (config.target === 'webdav') {
    return { label: '确认 WebDAV 地址', detail: `地址 ${config.webdavUrl}，用户 ${config.webdavUser}。`, status: 'ready' };
  }
  return { label: '确认 rclone remote', detail: `当前 remote：${config.rcloneRemote}`, status: 'ready' };
}

function nextAction(config: BackupConfig): string {
  if (config.target === 'local') return '运行目标端检查，确认本地目录和基础依赖可用。';
  if (config.target === 'smb') return '确认 NAS 信息和密码来源后运行目标端检查。';
  if (config.target === 'webdav') return '确认 WebDAV 地址、用户和密码来源后运行目标端检查。';
  return '确认 rclone config 和 remote 名称后运行目标端检查。';
}

function commonFailures(target: BackupConfig['target']): TargetSetupFailure[] {
  if (target === 'local') {
    return [
      { label: '目录权限', detail: '输出目录无法创建或写入时，请换到用户目录下的可写路径。' },
      { label: '磁盘空间不足', detail: '归档生成前请确认目标磁盘有足够空间。' },
    ];
  }
  if (target === 'smb') {
    return [
      { label: '主机不可达', detail: '确认 NAS 主机名、局域网、VPN 和 SMB 服务状态。' },
      { label: '认证失败', detail: '确认用户名和 Keychain 或临时环境变量中的密码。' },
      { label: '共享名错误', detail: '确认共享名是 NAS 暴露的 share 名称，不是本地挂载路径。' },
    ];
  }
  if (target === 'webdav') {
    return [
      { label: '401 或 403', detail: '确认 WebDAV 用户、应用密码或服务端权限。' },
      { label: '地址不可访问', detail: '确认 URL 是完整 WebDAV 目录地址，并能从本机访问。' },
      { label: '云端空间不足', detail: '确认 WebDAV 目标目录有足够可用容量。' },
    ];
  }
  return [
    { label: 'remote 不存在', detail: '先运行 rclone config，确认 remote 名称和路径拼写。' },
    { label: '云端授权过期', detail: '重新登录或刷新 rclone provider 授权。' },
    { label: '远端空间不足', detail: '确认 provider 配额和目标目录可写。' },
  ];
}
