import { format, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, Phone, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { cn, formatTime } from '../../lib/utils';
import { Card } from '../ui/card';

export interface AgendaAppointment {
  id: string;
  startAt: string;
  duration: number;
  type: string;
  status: string;
  reason?: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  consultation?: { id: string } | null;
}

/** 45 minutes leave room for the time and the name on two lines */
const HOUR_PX = 64;
const DEFAULT_START = 8;
const DEFAULT_END = 19;

/** Semantic tones (docs/DESIGN.md § 1.2), as StatusBadge uses them */
const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'border-l-info bg-info-soft text-foreground',
  CONFIRMED: 'border-l-info bg-info-soft text-foreground',
  COMPLETED: 'border-l-success bg-success-soft text-foreground',
  CANCELLED: 'border-l-danger bg-muted text-muted-foreground line-through',
  NO_SHOW: 'border-l-warning bg-warning-soft text-foreground',
};

const COLUMNS = (days: number) => `3.5rem repeat(${days}, minmax(0, 1fr))`;

const TYPE_ICONS: Record<string, { icon: typeof Video; label: string }> = {
  VIDEO: { icon: Video, label: 'Vidéo' },
  PHONE: { icon: Phone, label: 'Téléphone' },
};

/** « 9 h » */
const hourLabel = (hour: number) => `${hour} h`;

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
    <Card className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: COLUMNS(days.length) }}>
          <div />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn('border-l border-border px-2 py-2 text-center', isToday(day) && 'bg-primary/5')}
            >
              <p className="text-sm text-muted-foreground">{format(day, 'EEEE', { locale: fr })}</p>
              <p className={cn('text-base font-semibold', isToday(day) && 'text-primary')}>
                {format(day, 'd MMM', { locale: fr })}
              </p>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: COLUMNS(days.length) }}>
          <div>
            {hourLabels.map((h) => (
              <div key={h} className="relative pr-2 text-right text-sm text-muted-foreground" style={{ height: HOUR_PX }}>
                <span className="relative -top-2">{hourLabel(h)}</span>
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
                        'block w-full transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none',
                        m === 0 ? 'border-t border-border' : 'border-t border-dashed border-border/50',
                      )}
                      style={{ height: HOUR_PX / 2 }}
                      aria-label={`Nouveau rendez-vous le ${format(day, 'EEEE d MMMM', { locale: fr })} à ${h} h ${m === 0 ? '00' : '30'}`}
                    />
                  )),
                )}

                {/* Now */}
                {isToday(day) && nowTop >= 0 && nowTop <= hourLabels.length * HOUR_PX && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-danger" style={{ top: nowTop }}>
                    <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-danger" />
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
    </Card>
  );
}

function AppointmentBlock({ appt, startHour }: { appt: AgendaAppointment; startHour: number }) {
  const start = new Date(appt.startAt);
  const top = ((start.getHours() - startHour) * 60 + start.getMinutes()) * (HOUR_PX / 60);
  const height = Math.max(appt.duration * (HOUR_PX / 60), 24);
  const type = TYPE_ICONS[appt.type];
  const name = `${appt.patient?.firstName ?? ''} ${appt.patient?.lastName ?? ''}`.trim();
  return (
    <Link
      to={`/appointments/${appt.id}`}
      className={cn(
        'absolute left-1 right-1 z-20 overflow-hidden rounded-md border-l-4 px-2 py-1 text-sm leading-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        STATUS_STYLE[appt.status] ?? STATUS_STYLE.SCHEDULED,
      )}
      style={{ top, height }}
      aria-label={[
        `${formatTime(start)}, ${name}`,
        type?.label,
        appt.consultation ? 'séance commencée' : null,
        appt.status === 'CANCELLED' ? 'annulé' : appt.status === 'NO_SHOW' ? 'absent' : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold tabular-nums">{formatTime(start)}</span>
        {type && <type.icon className="size-3.5 text-muted-foreground" aria-hidden />}
        {appt.consultation && <CheckCircle2 className="ml-auto size-3.5 text-success" aria-hidden />}
      </div>
      <p className="truncate font-medium">{name}</p>
      {height > 64 && appt.reason && <p className="truncate text-muted-foreground">{appt.reason}</p>}
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
