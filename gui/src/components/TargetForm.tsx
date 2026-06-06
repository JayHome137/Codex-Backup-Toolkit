import type { BackupConfig, BackupTarget } from '../lib/config';
import { targetLabels } from '../lib/config';

type TargetFormProps = {
  config: BackupConfig;
  onChange(config: BackupConfig): void;
};

const targets = Object.keys(targetLabels) as BackupTarget[];

export function TargetForm({ config, onChange }: TargetFormProps) {
  const update = <Key extends keyof BackupConfig>(key: Key, value: BackupConfig[Key]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="target-form">
      <div className="segmented-control" role="group" aria-label="备份目标端">
        {targets.map((target) => (
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
          <label className="field field--wide">
            <span>本地输出目录</span>
            <input value={config.localDir} onChange={(event) => update('localDir', event.target.value)} />
          </label>
        )}

        {config.target === 'smb' && (
          <>
            <label className="field">
              <span>SMB 主机</span>
              <input value={config.smbHost} onChange={(event) => update('smbHost', event.target.value)} />
            </label>
            <label className="field">
              <span>SMB 用户</span>
              <input value={config.smbUser} onChange={(event) => update('smbUser', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>SMB 共享名</span>
              <input value={config.smbShare} onChange={(event) => update('smbShare', event.target.value)} />
            </label>
          </>
        )}

        {config.target === 'webdav' && (
          <>
            <label className="field field--wide">
              <span>WebDAV 地址</span>
              <input value={config.webdavUrl} onChange={(event) => update('webdavUrl', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>WebDAV 用户</span>
              <input value={config.webdavUser} onChange={(event) => update('webdavUser', event.target.value)} />
            </label>
          </>
        )}

        {config.target === 'rclone' && (
          <label className="field field--wide">
            <span>rclone remote</span>
            <input value={config.rcloneRemote} onChange={(event) => update('rcloneRemote', event.target.value)} />
          </label>
        )}

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
    </div>
  );
}
