import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { type Area, AREAS } from '../layout/areas';

interface SectionProps {
  title: ReactNode;
  /** Icon shown in a coloured chip next to the title */
  icon?: LucideIcon;
  description?: ReactNode;
  /** Top-right action (a button or link) */
  action?: ReactNode;
  /** Colour of the icon chip; defaults to the primary green */
  area?: Area;
  /** Removes the body padding, for a table that runs edge to edge */
  flush?: boolean;
  /** `compact`: smaller header and padding, for dense screens (patient summary, side panel) */
  size?: 'default' | 'compact';
  className?: string;
  /** Anchor of the card, for links that lead to it (« ?onglet=mesures#poids ») */
  id?: string;
  children?: ReactNode;
}

/** The one content card of the app: coloured icon + title + optional action, then content. */
export function Section({
  title,
  icon: Icon,
  description,
  action,
  area,
  flush,
  size = 'default',
  className,
  id,
  children,
}: SectionProps) {
  const style = area ? AREAS[area] : undefined;
  const compact = size === 'compact';

  return (
    <section
      id={id}
      className={cn('scroll-mt-4 rounded-xl border bg-card text-card-foreground shadow-sm', className)}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-3',
          // Compact cards are narrow: the action stays on the title's line
          compact ? 'flex-nowrap px-4 pb-2 pt-3' : 'flex-wrap p-5 sm:p-6',
        )}
      >
        <div className={cn('flex min-w-0 items-center', compact ? 'min-h-11 flex-1 gap-2.5' : 'gap-3')}>
          {Icon && (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg',
                compact ? 'size-8' : 'size-10',
                style ? [style.soft, style.text] : 'bg-accent text-primary',
              )}
              aria-hidden
            >
              <Icon className={compact ? 'size-4' : 'size-5'} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className={cn('font-semibold leading-tight', compact ? 'text-lg' : 'text-xl')}>{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children && (
        <div className={cn(!flush && (compact ? 'px-4 pb-4' : 'px-5 pb-5 sm:px-6 sm:pb-6'))}>
          {children}
        </div>
      )}
    </section>
  );
}
