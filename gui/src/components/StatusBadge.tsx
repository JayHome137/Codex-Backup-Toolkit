import { CheckCircle2, CircleAlert, CircleX } from 'lucide-react';
import type { CommandStatus } from '../lib/commands';

type StatusBadgeProps = {
  status: CommandStatus | 'idle';
  label: string;
};

const icons = {
  idle: CircleAlert,
  success: CheckCircle2,
  warning: CircleAlert,
  error: CircleX,
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const Icon = icons[status];

  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
