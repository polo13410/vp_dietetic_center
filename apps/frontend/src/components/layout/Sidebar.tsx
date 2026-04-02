import { NavLink } from 'react-router';

import {
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Salad,
  Settings,
  Users,
} from 'lucide-react';

import { useCurrentUser } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/appointments', icon: Calendar, label: 'Rendez-vous' },
  { to: '/notes', icon: FileText, label: 'Notes cliniques' },
  { to: '/tasks', icon: CheckSquare, label: 'Tâches' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/reports', icon: BarChart2, label: 'Reporting' },
];

const adminItems = [{ to: '/admin', icon: Settings, label: 'Administration' }];

export function Sidebar() {
  const user = useCurrentUser();

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">VP</span>
          </div>
          <span className="font-semibold text-sm text-foreground">Dietetic Center</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Admin section */}
        {user?.role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Administration
              </span>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground',
                  )
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-primary">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
