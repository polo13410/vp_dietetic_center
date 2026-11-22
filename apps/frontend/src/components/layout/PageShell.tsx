import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export type PageWidth = 'default' | 'wide';

const WIDTHS: Record<PageWidth, string> = {
  default: 'max-w-5xl',
  wide: 'max-w-screen-2xl',
};

/** Pages that need room (agenda, session) get the wide variant; every other page is centred at the default width. */
export function getPageWidth(pathname: string): PageWidth {
  if (pathname === '/appointments' || pathname === '/appointments/') return 'wide';
  if (pathname.startsWith('/consultations/')) return 'wide';
  return 'default';
}

interface PageShellProps {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

/** Page template used by AppLayout: one centred width, shared margins (docs/DESIGN.md § 4). */
export function PageShell({ width = 'default', className, children }: PageShellProps) {
  return (
    <div
      data-width={width}
      className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8', WIDTHS[width], className)}
    >
      {children}
    </div>
  );
}
