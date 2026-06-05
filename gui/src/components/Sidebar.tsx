import { ArchiveRestore, Clock3, DatabaseBackup, FileText, Gauge, HardDrive } from 'lucide-react';

export type SectionId = 'overview' | 'targets' | 'schedule' | 'restore' | 'logs';

type SidebarProps = {
  activeSection: SectionId;
  onSectionChange(section: SectionId): void;
};

const items = [
  { id: 'overview', label: '概览', icon: Gauge },
  { id: 'targets', label: '目标端', icon: HardDrive },
  { id: 'schedule', label: '计划', icon: Clock3 },
  { id: 'restore', label: '恢复', icon: ArchiveRestore },
  { id: 'logs', label: '日志', icon: FileText },
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
          <p>网页版预览版</p>
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
