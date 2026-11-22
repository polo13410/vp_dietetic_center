import { LogOut, Search, Settings, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCurrentUser, useLogout } from '../../hooks/useAuth';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { GlobalSearchDialog } from '../search/GlobalSearchDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ThemeToggle } from '../ui/theme-toggle';

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { mutate: logout } = useLogout();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const canSearch = !!user && user.role !== 'ADMIN';

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (canSearch) setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSearch]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      {/* Search trigger (patients' data: not for admins) */}
      {canSearch && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-11 min-w-0 flex-1 max-w-xl cursor-pointer items-center gap-3 rounded-lg border border-input bg-muted px-3 text-base text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-5 shrink-0" aria-hidden />
          <span className="truncate">
            <span className="sm:hidden">Rechercher</span>
            <span className="hidden sm:inline">Rechercher un patient, un rendez-vous…</span>
          </span>
          <kbd className="ml-auto hidden shrink-0 items-center rounded border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground lg:inline-flex">
            Ctrl K
          </kbd>
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mon compte"
              className="ml-1 inline-flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : <User />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-2">
              <p className="text-base font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
