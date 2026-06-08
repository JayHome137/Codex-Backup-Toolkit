import { Archive, ArchiveRestore, DatabaseBackup, FileText, Gauge, HardDrive, Settings } from 'lucide-react';

export type SectionId = 'overview' | 'backup' | 'guide' | 'install' | 'health' | 'diagnostics' | 'targets' | 'schedule' | 'restore' | 'logs' | 'settings';

type SidebarProps = {
  activeSection: SectionId;
  onSectionChange(section: SectionId): void;
};

const items = [
  { id: 'overview', label: '概览', icon: Gauge },
  { id: 'backup', label: '备份', icon: Archive },
  { id: 'targets', label: '存储位置', icon: HardDrive },
  { id: 'restore', label: '恢复', icon: ArchiveRestore },
  { id: 'logs', label: '记录', icon: FileText },
  { id: 'settings', label: '设置', icon: Settings },
] as const;

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-icon" aria-hidden="true">
          <DatabaseBackup size={18} />
        </div>
        <div>
          <h1>CodexBackup</h1>
          <p>桌面预览版</p>
        </div>
      </div>
      <nav className="nav-list" aria-label="GUI 分区">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={item.id === activeSection ? 'nav-item nav-item--active' : 'nav-item'}
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              type="button"
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
