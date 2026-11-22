import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cn } from '../../lib/utils';
import { type Area, AREAS } from '../layout/areas';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Detail pages: where "back" goes, and what it says ("Patients") */
  back?: { to: string; label: string };
  /** The page's main action (one, at most two buttons) */
  actions?: ReactNode;
  /** Colours the icon with the area's colour (docs/DESIGN.md § 1.3) */
  area?: Area;
  /** Hides the area icon (e.g. a patient's file shows their name, not a generic icon) */
  hideIcon?: boolean;
  className?: string;
}

/** Top of every page: back link, title, subtitle and main action. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  area,
  hideIcon,
  className,
}: PageHeaderProps) {
  const style = area ? AREAS[area] : undefined;
  const Icon = style?.icon;

  return (
    <header className={cn('mb-6 space-y-3 sm:mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {Icon && !hideIcon && (
            <span
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-xl',
                style.soft,
                style.text,
              )}
              aria-hidden
            >
              <Icon className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
