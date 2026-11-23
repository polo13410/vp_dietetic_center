import { Outlet, useLocation } from 'react-router';

import { useThemeFromAccount } from '../../hooks/useMe';

import { Header } from './Header';
import { getPageWidth, PageShell } from './PageShell';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { pathname } = useLocation();
  useThemeFromAccount();

  // Only `main` scrolls; the page itself never does. `relative` makes `main` (and the frame
  // around it) the containing block of absolutely positioned content such as `sr-only` labels
  // and radios: otherwise they are placed against the viewport at their spot in the long page,
  // stretch the document and make the whole page scroll, sidebar included (REFONTE lot 12).
  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-y-auto">
          <PageShell width={getPageWidth(pathname)}>
            <Outlet />
          </PageShell>
        </main>
      </div>
    </div>
  );
}
