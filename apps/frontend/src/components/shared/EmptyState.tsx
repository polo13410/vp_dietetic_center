import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { type Area, AREAS } from '../layout/areas';

import { PearMascot } from './PearMascot';

interface EmptyStateProps {
  /** One sentence saying what is missing ("Aucune séance pour l'instant") */
  title: ReactNode;
  description?: ReactNode;
  /** The button that moves things forward ("Démarrer le bilan") */
  action?: ReactNode;
  /** The pear mascot, or a coloured icon when the mascot would be too much */
  illustration?: 'pear' | 'pear-calm';
  icon?: LucideIcon;
  area?: Area;
  className?: string;
}

/** An empty list or area that guides: illustration or icon, one sentence, the next action. */
export function EmptyState({
  title,
  description,
  action,
  illustration,
  icon: Icon,
  area,
  className,
}: EmptyStateProps) {
  const style = area ? AREAS[area] : undefined;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      {illustration ? (
        <PearMascot mood={illustration === 'pear-calm' ? 'calm' : 'happy'} className="h-24" />
      ) : (
        Icon && (
          <span
            className={cn(
              'flex size-14 items-center justify-center rounded-2xl',
              style ? [style.soft, style.text] : 'bg-accent text-primary',
            )}
            aria-hidden
          >
            <Icon className="size-7" />
          </span>
        )
      )}
      <div className="max-w-md space-y-1">
        <p className="text-lg font-medium text-foreground">{title}</p>
        {description && <p className="text-base text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
