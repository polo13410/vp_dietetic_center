import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';

import type { PatientAppointment } from '../../lib/patient-file';
import { formatLongDate, formatTime } from '../../lib/utils';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';

/** The patient's appointments, latest first; each opens its detail. */
export function PatientAppointments({ appointments }: { appointments: PatientAppointment[] }) {
  const sorted = [...appointments].sort((a, b) => b.startAt.localeCompare(a.startAt));
  return (
    <Section size="compact" icon={CalendarDays} area="agenda" title="Rendez-vous" flush>
      {sorted.length === 0 ? (
        <p className="px-4 pb-4 text-base text-muted-foreground">Aucun rendez-vous.</p>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto border-t">
          {sorted.map((appt) => (
            <li key={appt.id}>
              <Link
                to={`/appointments/${appt.id}`}
                className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span>
                  <span className="font-medium">
                    {formatLongDate(appt.startAt)} à {formatTime(appt.startAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {' '}
                    · {appt.duration} min{appt.reason ? ` · ${appt.reason}` : ''}
                  </span>
                </span>
                <span className="flex gap-2">
                  <StatusBadge status={appt.type} />
                  <StatusBadge status={appt.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
