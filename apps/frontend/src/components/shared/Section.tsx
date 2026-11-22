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
  className?: string;
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
  className,
  children,
}: SectionProps) {
  const style = area ? AREAS[area] : undefined;

  return (
    <section
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                style ? [style.soft, style.text] : 'bg-accent text-primary',
              )}
              aria-hidden
            >
              <Icon className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children && <div className={cn(!flush && 'px-5 pb-5 sm:px-6 sm:pb-6')}>{children}</div>}
    </section>
  );
}
