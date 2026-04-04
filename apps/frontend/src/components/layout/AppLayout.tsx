import { useState } from 'react';
import { Outlet } from 'react-router';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [_sidebarWidth, setSidebarWidth] = useState(256);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onWidthChange={setSidebarWidth} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
