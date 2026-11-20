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

  // Session statuses
  DRAFT: { label: 'Brouillon', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  FINALIZED: { label: 'Finalisée', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },

  // Task statuses
  PENDING: { label: 'En attente', className: 'bg-muted text-muted-foreground border-border' },
  IN_PROGRESS: { label: 'En cours', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  DONE: { label: 'Terminée', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },

  // Task priorities
  LOW: { label: 'Basse', className: 'bg-muted text-muted-foreground border-border' },
  MEDIUM: { label: 'Moyenne', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800' },
  HIGH: { label: 'Haute', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  URGENT: { label: 'Urgente', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },

  // Document types
  ANALYSIS: { label: 'Analyse', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' },
  PRESCRIPTION: { label: 'Ordonnance', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
  REPORT: { label: 'Compte rendu', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  CONSENT: { label: 'Consentement', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  OTHER: { label: 'Autre', className: 'bg-muted text-muted-foreground border-border' },

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
