import { useState } from 'react';

import { Bell, LogOut, Search } from 'lucide-react';

import { useLogout } from '../../hooks/useAuth';
import { Button } from '../ui/button';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const { mutate: logout } = useLogout();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Open global search modal
    }
  };

  return (
    <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher un patient, RDV, note... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
          />
        </div>
      </form>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={() => logout()} title="Déconnexion">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
