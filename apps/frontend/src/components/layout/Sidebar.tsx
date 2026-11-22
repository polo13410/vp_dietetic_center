import { type LucideIcon, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { useLocalStorage } from '../../hooks/use-local-storage';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useCurrentUser } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

import { type Area, AREAS } from './areas';

interface NavItem {
  to: string;
  label: string;
  area: Area;
  /** Only for these roles (default: everyone the list is for) */
  roles?: string[];
}

// Practitioners work with their patients; notes, documents and tasks live in each patient's file
const clinicalItems: NavItem[] = [
  { to: '/dashboard', label: 'Accueil', area: 'home' },
  { to: '/patients', label: 'Patients', area: 'patients' },
  { to: '/appointments', label: 'Agenda', area: 'agenda' },
  { to: '/invoices', label: 'Factures', area: 'invoices', roles: ['PRATICIENNE'] },
  { to: '/settings', label: 'Paramètres', area: 'settings' },
];

// Admins manage the app and its users, never patients
const adminItems: NavItem[] = [
  { to: '/admin/users', label: 'Utilisateurs', area: 'users' },
  { to: '/admin/audit', label: 'Journal d’accès', area: 'audit' },
  { to: '/settings', label: 'Paramètres', area: 'settings' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administratrice',
  PRATICIENNE: 'Praticienne',
  ASSISTANTE: 'Assistante',
};

/** iPad landscape and desktop keep the full sidebar; narrower screens get an icon rail. */
const WIDE_SCREEN = '(min-width: 1024px)';

/**
 * Wide screens: open sidebar that the user can shrink to a rail (remembered, Alt+S).
 * iPad portrait and narrower: rail by default, "Menu" opens the full sidebar over the page.
 */
export function Sidebar() {
  const isWide = useMediaQuery(WIDE_SCREEN);
  const [collapsed, setCollapsed] = useLocalStorage('sidebarCollapsed', false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  const toggle = useCallback(() => {
    if (isWide) setCollapsed((prev: boolean) => !prev);
    else setDrawerOpen((prev) => !prev);
  }, [isWide, setCollapsed]);

  // Close the drawer when the page changes or the screen gets wide enough
  useEffect(() => setDrawerOpen(false), [pathname, isWide]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 's') toggle();
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  if (isWide) {
    return (
      <SidebarPanel
        expanded={!collapsed}
        onToggle={toggle}
        toggleIcon={collapsed ? PanelLeftOpen : PanelLeftClose}
        toggleLabel={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
      />
    );
  }

  return (
    <>
      <SidebarPanel
        expanded={false}
        onToggle={toggle}
        toggleIcon={Menu}
        toggleLabel="Ouvrir le menu"
      />
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden
            onClick={() => setDrawerOpen(false)}
          />
          <SidebarPanel
            expanded
            overlay
            onToggle={() => setDrawerOpen(false)}
            toggleIcon={X}
            toggleLabel="Fermer le menu"
          />
        </>
      )}
    </>
  );
}

interface SidebarPanelProps {
  expanded: boolean;
  overlay?: boolean;
  onToggle: () => void;
  toggleIcon: LucideIcon;
  toggleLabel: string;
}

function SidebarPanel({
  expanded,
  overlay,
  onToggle,
  toggleIcon: ToggleIcon,
  toggleLabel,
}: SidebarPanelProps) {
  const user = useCurrentUser();
  const items = (user?.role === 'ADMIN' ? adminItems : clinicalItems).filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200',
        expanded ? 'w-64' : 'w-[76px]',
        overlay && 'fixed inset-y-0 left-0 z-50 w-72 shadow-xl',
      )}
    >
      {/* Logo + toggle */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border px-4',
          expanded ? 'justify-between' : 'justify-center px-0',
        )}
      >
        {expanded && (
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/logo_small.png" alt="" className="size-9" />
            <span className="truncate text-base font-semibold text-foreground">
              Dietetic Center
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          aria-expanded={expanded}
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ToggleIcon className="size-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-4', expanded ? 'px-3' : 'px-2')}>
        {items.map(({ to, label, area }) => {
          const style = AREAS[area];
          const Icon = style.icon;
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={expanded ? undefined : label}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-12 items-center gap-3 rounded-lg text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  expanded ? 'px-3' : 'justify-center',
                  isActive
                    ? cn(style.soft, style.text, 'font-semibold')
                    : 'text-foreground hover:bg-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className={cn('absolute inset-y-2 left-0 w-1 rounded-r-full', style.solid)}
                      aria-hidden
                    />
                  )}
                  <Icon className={cn('size-6 shrink-0', style.text)} aria-hidden />
                  {expanded && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className={cn('flex items-center gap-3 px-1 py-1', !expanded && 'justify-center px-0')}>
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent"
            aria-hidden
          >
            <span className="text-sm font-semibold text-accent-foreground">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </span>
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {user ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
