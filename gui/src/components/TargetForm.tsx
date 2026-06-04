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
      <div className="segmented-control" role="group" aria-label="Backup target">
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
            <span>Local output directory</span>
            <input value={config.localDir} onChange={(event) => update('localDir', event.target.value)} />
          </label>
        )}

        {config.target === 'smb' && (
          <>
            <label className="field">
              <span>SMB host</span>
              <input value={config.smbHost} onChange={(event) => update('smbHost', event.target.value)} />
            </label>
            <label className="field">
              <span>SMB user</span>
              <input value={config.smbUser} onChange={(event) => update('smbUser', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>SMB share</span>
              <input value={config.smbShare} onChange={(event) => update('smbShare', event.target.value)} />
            </label>
          </>
        )}

        {config.target === 'webdav' && (
          <>
            <label className="field field--wide">
              <span>WebDAV URL</span>
              <input value={config.webdavUrl} onChange={(event) => update('webdavUrl', event.target.value)} />
            </label>
            <label className="field field--wide">
              <span>WebDAV user</span>
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

        <label className="toggle-row field--wide">
          <input checked={config.encrypt} onChange={(event) => update('encrypt', event.target.checked)} type="checkbox" />
          <span>Encrypt archives with age</span>
        </label>

        <label className="field">
          <span>Retention count</span>
          <input
            min="0"
            type="number"
            value={config.retentionCount}
            onChange={(event) => update('retentionCount', Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Retention days</span>
          <input
            min="0"
            type="number"
            value={config.retentionDays}
            onChange={(event) => update('retentionDays', Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
