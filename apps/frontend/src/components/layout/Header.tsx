import { LogOut, Search, Settings, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useCurrentUser, useLogout } from '../../hooks/useAuth';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { GlobalSearchDialog } from '../search/GlobalSearchDialog';
import { Button } from '../ui/button';
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

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 shrink-0">
      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 text-sm bg-muted border border-border rounded-lg text-muted-foreground hover:border-primary/30 transition-colors cursor-pointer"
      >
        <Search className="w-4 h-4" />
        <span>Rechercher un patient, RDV, note...</span>
        <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <div className="flex items-center gap-1.5 ml-auto">
        <ThemeToggle />
        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <User className="w-4 h-4" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings className="w-4 h-4" />
              Parametres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut className="w-4 h-4" />
              Deconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
