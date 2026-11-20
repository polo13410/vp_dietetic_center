import { format, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, PenLine, Phone, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { cn } from '../../lib/utils';

export interface AgendaAppointment {
  id: string;
  startAt: string;
  duration: number;
  type: string;
  status: string;
  reason?: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  consultation?: { id: string; status: 'DRAFT' | 'FINALIZED' } | null;
}

const HOUR_PX = 56;
const DEFAULT_START = 8;
const DEFAULT_END = 19;

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'border-l-blue-500 bg-blue-50 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100',
  CONFIRMED: 'border-l-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100',
  COMPLETED: 'border-l-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100',
  CANCELLED: 'border-l-red-400 bg-muted text-muted-foreground line-through',
  NO_SHOW: 'border-l-orange-400 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100',
};

/**
 * A time grid (one column per day). Appointments are placed by time and length; clicking an
 * empty slot books an appointment there.
 */
export function AgendaGrid({
  days,
  appointments,
  onSlotClick,
}: {
  days: Date[];
  appointments: AgendaAppointment[];
  onSlotClick: (start: Date) => void;
}) {
  // Show the working day, stretched to fit appointments outside of it
  const hours = appointments.map((a) => new Date(a.startAt).getHours());
  const ends = appointments.map((a) => {
    const end = new Date(new Date(a.startAt).getTime() + a.duration * 60000);
    return end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
  });
  const startHour = Math.min(DEFAULT_START, ...hours);
  const endHour = Math.max(DEFAULT_END, ...ends);
  const hourLabels = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const now = useNow();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[640px]">
        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn('border-l border-border px-2 py-2 text-center', isToday(day) && 'bg-primary/5')}
            >
              <p className="text-xs uppercase text-muted-foreground">{format(day, 'EEE', { locale: fr })}</p>
              <p className={cn('text-sm font-semibold', isToday(day) && 'text-primary')}>{format(day, 'd MMM', { locale: fr })}</p>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div>
            {hourLabels.map((h) => (
              <div key={h} className="relative text-right pr-2 text-[11px] text-muted-foreground" style={{ height: HOUR_PX }}>
                <span className="relative -top-2">{`${h}:00`}</span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayAppointments = appointments.filter((a) => isSameDay(new Date(a.startAt), day));
            const nowTop = ((now.getHours() - startHour) * 60 + now.getMinutes()) * (HOUR_PX / 60);
            return (
              <div key={day.toISOString()} className={cn('relative border-l border-border', isToday(day) && 'bg-primary/5')}>
                {/* Half-hour slots */}
                {hourLabels.flatMap((h) =>
                  [0, 30].map((m) => (
                    <button
                      key={`${h}:${m}`}
                      type="button"
                      onClick={() => {
                        const start = new Date(day);
                        start.setHours(h, m, 0, 0);
                        onSlotClick(start);
                      }}
                      className={cn(
                        'block w-full hover:bg-primary/10 transition-colors',
                        m === 0 ? 'border-t border-border' : 'border-t border-dashed border-border/50',
                      )}
                      style={{ height: HOUR_PX / 2 }}
                      title={`Nouveau rendez-vous le ${format(day, 'd MMM', { locale: fr })} à ${h}:${m === 0 ? '00' : '30'}`}
                    />
                  )),
                )}

                {/* Now */}
                {isToday(day) && nowTop >= 0 && nowTop <= hourLabels.length * HOUR_PX && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-red-500" style={{ top: nowTop }}>
                    <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  </div>
                )}

                {dayAppointments.map((a) => (
                  <AppointmentBlock key={a.id} appt={a} startHour={startHour} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AppointmentBlock({ appt, startHour }: { appt: AgendaAppointment; startHour: number }) {
  const start = new Date(appt.startAt);
  const top = ((start.getHours() - startHour) * 60 + start.getMinutes()) * (HOUR_PX / 60);
  const height = Math.max(appt.duration * (HOUR_PX / 60), 22);
  const TypeIcon = appt.type === 'VIDEO' ? Video : appt.type === 'PHONE' ? Phone : null;
  return (
    <Link
      to={`/appointments/${appt.id}`}
      className={cn(
        'absolute left-1 right-1 z-20 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm hover:shadow-md transition-shadow',
        STATUS_STYLE[appt.status] ?? STATUS_STYLE.SCHEDULED,
      )}
      style={{ top, height }}
      title={`${format(start, 'HH:mm')} · ${appt.patient?.firstName} ${appt.patient?.lastName}${appt.reason ? ` · ${appt.reason}` : ''}`}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold tabular-nums">{format(start, 'HH:mm')}</span>
        {TypeIcon && <TypeIcon className="h-3 w-3 opacity-70" />}
        {appt.consultation?.status === 'FINALIZED' && <CheckCircle2 className="ml-auto h-3 w-3" />}
        {appt.consultation?.status === 'DRAFT' && <PenLine className="ml-auto h-3 w-3" />}
      </div>
      <p className="truncate font-medium">
        {appt.patient?.firstName} {appt.patient?.lastName}
      </p>
      {height > 48 && appt.reason && <p className="truncate opacity-70">{appt.reason}</p>}
    </Link>
  );
}

/** The current time, refreshed every minute (for the "now" line). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
