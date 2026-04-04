import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Patient statuses
  ACTIVE: { label: 'Actif', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  INACTIVE: { label: 'Inactif', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  ARCHIVED: { label: 'Archive', className: 'bg-muted text-muted-foreground border-border' },

  // Appointment statuses
  SCHEDULED: { label: 'Planifie', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  CONFIRMED: { label: 'Confirme', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
  COMPLETED: { label: 'Termine', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  CANCELLED: { label: 'Annule', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  NO_SHOW: { label: 'Absent', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800' },

  // Note statuses
  DRAFT: { label: 'Brouillon', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  FINALIZED: { label: 'Finalise', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },

  // Task statuses
  PENDING: { label: 'En attente', className: 'bg-muted text-muted-foreground border-border' },
  IN_PROGRESS: { label: 'En cours', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  DONE: { label: 'Termine', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },

  // Note types
  FREE: { label: 'Libre', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
  STRUCTURED: { label: 'Structuree', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' },

  // Appointment types
  IN_PERSON: { label: 'En cabinet', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  VIDEO: { label: 'Video', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
  PHONE: { label: 'Telephone', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
