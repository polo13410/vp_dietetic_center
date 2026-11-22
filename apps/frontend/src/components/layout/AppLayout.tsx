import { Outlet, useLocation } from 'react-router';

import { Header } from './Header';
import { getPageWidth, PageShell } from './PageShell';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <PageShell width={getPageWidth(pathname)}>
            <Outlet />
          </PageShell>
        </main>
      </div>
    </div>
  );
}
