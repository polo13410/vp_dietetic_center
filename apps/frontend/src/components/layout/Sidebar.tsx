import {
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Menu,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { NavLink } from 'react-router';

import { useLocalStorage } from '../../hooks/use-local-storage';
import { useCurrentUser } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/appointments', icon: Calendar, label: 'Rendez-vous' },
  { to: '/calendar', icon: Calendar, label: 'Calendrier' },
  { to: '/notes', icon: FileText, label: 'Notes cliniques' },
  { to: '/tasks', icon: CheckSquare, label: 'Tâches' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/analytics', icon: LineChart, label: 'Analytiques' },
  { to: '/reports', icon: BarChart2, label: 'Reporting' },
  { to: '/profile', icon: User, label: 'Profil' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
];

const adminItems = [{ to: '/admin', icon: Settings, label: 'Administration' }];

interface SidebarProps {
  onWidthChange?: (width: number) => void;
}

export function Sidebar({ onWidthChange }: SidebarProps) {
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useLocalStorage('sidebarCollapsed', false);

  const sidebarWidth = collapsed ? 64 : 256;

  useEffect(() => {
    onWidthChange?.(sidebarWidth);
  }, [collapsed, onWidthChange, sidebarWidth]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev: boolean) => !prev);
  }, [setCollapsed]);

  // Alt+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 's') {
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapsed]);

  return (
    <aside
      className={cn(
        'shrink-0 bg-card border-r border-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo + Toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">VP</span>
            </div>
            <span className="font-semibold text-sm text-foreground">Dietetic Center</span>
          </div>
        )}
        <button onClick={toggleCollapsed} className="p-2 rounded-md hover:bg-muted" title="Alt+S">
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}

        {/* Admin section */}
        {user?.role === 'ADMIN' && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Administration
                </span>
              </div>
            )}
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-lg',
            collapsed && 'justify-center px-0',
          )}
        >
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-primary">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
