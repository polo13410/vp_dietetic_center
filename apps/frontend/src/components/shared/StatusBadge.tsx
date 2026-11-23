import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

/** Semantic tones from globals.css (docs/DESIGN.md § 1.2): strong text on a soft background */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  info: 'bg-info-soft text-info border-info/25',
  neutral: 'bg-neutral-soft text-neutral border-neutral/25',
};

const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  // Appointment statuses
  SCHEDULED: { label: 'Planifié', tone: 'info' },
  CONFIRMED: { label: 'Confirmé', tone: 'info' },
  COMPLETED: { label: 'Terminé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  NO_SHOW: { label: 'Absent', tone: 'warning' },

  // Task statuses
  PENDING: { label: 'En attente', tone: 'neutral' },
  IN_PROGRESS: { label: 'En cours', tone: 'info' },
  DONE: { label: 'Terminée', tone: 'success' },

  // Task priorities
  LOW: { label: 'Basse', tone: 'neutral' },
  MEDIUM: { label: 'Moyenne', tone: 'info' },
  HIGH: { label: 'Haute', tone: 'warning' },
  URGENT: { label: 'Urgente', tone: 'danger' },

  // Document types
  ANALYSIS: { label: 'Analyse', tone: 'info' },
  PRESCRIPTION: { label: 'Ordonnance', tone: 'info' },
  REPORT: { label: 'Compte rendu', tone: 'info' },
  CONSENT: { label: 'Consentement', tone: 'success' },
  OTHER: { label: 'Autre', tone: 'neutral' },

  // Appointment types
  IN_PERSON: { label: 'En cabinet', tone: 'neutral' },
  VIDEO: { label: 'Vidéo', tone: 'neutral' },
  PHONE: { label: 'Téléphone', tone: 'neutral' },

  // Practices
  DEFAULT: { label: 'Par défaut', tone: 'success' },
};

interface StatusBadgeProps {
  status: string;
  /** Overrides the label (e.g. a status the table does not know yet) */
  label?: string;
  /** Overrides the tone */
  tone?: BadgeTone;
  className?: string;
}

/** Every status or type shown as a pill. Add new statuses to the table above, in French. */
export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      data-tone={tone ?? config?.tone ?? 'neutral'}
      className={cn(TONE_CLASSES[tone ?? config?.tone ?? 'neutral'], className)}
    >
      {label ?? config?.label ?? status}
    </Badge>
  );
}
