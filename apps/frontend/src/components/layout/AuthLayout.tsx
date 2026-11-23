import type { ReactNode } from 'react';
import { Outlet } from 'react-router';

import { Card } from '../ui/card';

/** Signed-out pages: the logo and one centred card. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo_full_transparent.png" alt="VP Dietetic Center" className="mx-auto h-20" />
          <p className="mt-2 text-base text-muted-foreground">Espace praticienne</p>
        </div>
        <Card className="p-6 sm:p-8">
          <Outlet />
        </Card>
      </div>
    </div>
  );
}

/** Title and one-sentence explanation at the top of a signed-out card. */
export function AuthTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children && <p className="text-base text-muted-foreground">{children}</p>}
    </div>
  );
}

/** What went wrong, and how to fix it, above the form's button. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-base text-danger">
      {children}
    </p>
  );
}
