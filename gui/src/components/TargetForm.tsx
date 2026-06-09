import type { BackupConfig, BackupTarget } from '../lib/config';
import { targetLabels } from '../lib/config';

type TargetFormProps = {
  config: BackupConfig;
  onChange(config: BackupConfig): void;
  onWebdavPasswordChange(value: string): void;
  webdavPassword: string;
};

const primaryTargets: BackupTarget[] = ['local', 'webdav'];

export function TargetForm({ config, onChange, onWebdavPasswordChange, webdavPassword }: TargetFormProps) {
  const update = <Key extends keyof BackupConfig>(key: Key, value: BackupConfig[Key]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="target-form">
      <div className="segmented-control" role="group" aria-label="备份目标端">
        {primaryTargets.map((target) => (
          <button
            className={config.target === target ? 'segment segment--active' : 'segment'}
            key={target}
            onClick={() => update('target', target)}
            type="button"
          >
            {targetLabels[target]}
          </button>
        ))}
      </div>

      <div className="form-grid">
        {config.target === 'local' && (
          <div className="target-card field--wide">
            <label className="field">
              <span>本地备份目录</span>
              <input aria-label="本地备份目录" value={config.localDir} onChange={(event) => update('localDir', event.target.value)} />
            </label>
            <p className="muted-copy">备份文件会保存到这个文件夹；如果文件夹不存在，检查时会确认它能否创建。</p>
          </div>
        )}

        {config.target === 'webdav' && (
          <div className="target-card field--wide">
            <label className="field field--wide">
              <span>WebDAV 地址</span>
              <input aria-label="WebDAV 地址" placeholder="https://example.com/remote.php/dav/files/user/CodexBackup" value={config.webdavUrl} onChange={(event) => update('webdavUrl', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>WebDAV 账号</span>
              <input aria-label="WebDAV 账号" autoComplete="username" value={config.webdavUser} onChange={(event) => update('webdavUser', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>WebDAV 密码或应用专用密码</span>
              <input
                aria-label="WebDAV 密码"
                autoComplete="current-password"
                type="password"
                value={webdavPassword}
                onChange={(event) => onWebdavPasswordChange(event.target.value)}
              />
            </label>
            <p className="target-note">请先在 WebDAV 服务端手动创建这个目标文件夹。连接检测会验证账号密码和目录是否可访问，但不会自动创建根目录。</p>
          </div>
        )}

        <label className="field">
          <span>保留份数</span>
          <input
            min="0"
            type="number"
            value={config.retentionCount}
            onChange={(event) => update('retentionCount', Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>保留天数</span>
          <input
            min="0"
            type="number"
            value={config.retentionDays}
            onChange={(event) => update('retentionDays', Number(event.target.value))}
          />
        </label>

        <details className="details-panel field--wide target-advanced-options">
          <summary>高级备份设置</summary>
          <div className="form-grid form-grid--nested">
            {(config.target === 'webdav' || config.target === 'rclone') && (
              <label className="toggle-row field--wide">
                <input checked={config.remoteRetention} onChange={(event) => update('remoteRetention', event.target.checked)} type="checkbox" />
                <span>启用远端保留策略</span>
              </label>
            )}

            <label className="toggle-row field--wide">
              <input checked={config.encrypt} onChange={(event) => update('encrypt', event.target.checked)} type="checkbox" />
              <span>使用 age 加密归档</span>
            </label>

            {config.encrypt && (
              <>
                <label className="field field--wide">
                  <span>age 收件人</span>
                  <input
                    placeholder="age1..."
                    value={config.ageRecipient}
                    onChange={(event) => update('ageRecipient', event.target.value)}
                  />
                </label>
                <label className="field field--wide">
                  <span>age 收件人文件</span>
                  <input
                    placeholder="/path/to/recipients.txt"
                    value={config.ageRecipientFile}
                    onChange={(event) => update('ageRecipientFile', event.target.value)}
                  />
                </label>
              </>
            )}

            <label className="toggle-row field--wide">
              <input checked={config.syncEnabled} onChange={(event) => update('syncEnabled', event.target.checked)} type="checkbox" />
              <span>启用定时一致性检查</span>
            </label>

            <label className="field">
              <span>检查频率（小时）</span>
              <input
                min="1"
                type="number"
                value={config.syncCheckIntervalHours}
                onChange={(event) => update('syncCheckIntervalHours', Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>最小备份间隔（小时）</span>
              <input
                min="1"
                type="number"
                value={config.syncMinBackupIntervalHours}
                onChange={(event) => update('syncMinBackupIntervalHours', Number(event.target.value))}
              />
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}
