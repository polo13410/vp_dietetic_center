import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, Search, Settings, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useCurrentUser, useLogout } from '../../hooks/useAuth';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const { mutate: logout } = useLogout();
  const user = useCurrentUser();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Open global search modal
    }
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 shrink-0">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher un patient, RDV, note... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
          />
        </div>
      </form>

      <div className="flex items-center gap-1.5 ml-auto">
        <ThemeToggle />
        <NotificationCenter />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="w-4 h-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="w-56 bg-popover border rounded-md shadow-md p-1 z-50"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent outline-none"
                onSelect={() => navigate('/profile')}
              >
                <User className="w-4 h-4" />
                Profil
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent outline-none"
                onSelect={() => navigate('/settings')}
              >
                <Settings className="w-4 h-4" />
                Paramètres
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent outline-none"
                onSelect={() => logout()}
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
