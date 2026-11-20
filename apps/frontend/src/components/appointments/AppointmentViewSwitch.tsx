import { CalendarDays, List } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '../../lib/utils';

const views = [
  { to: '/appointments', icon: List, label: 'Liste' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendrier' },
];

/** Switches between the list and calendar views of "Rendez-vous". */
export function AppointmentViewSwitch() {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {views.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
