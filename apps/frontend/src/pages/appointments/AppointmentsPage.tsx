import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type AgendaAppointment, AgendaGrid } from '../../components/appointments/AgendaGrid';
import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { AppointmentsTable } from '../../components/appointments/AppointmentsTable';
import { Button } from '../../components/ui/button';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

type View = 'week' | 'day' | 'list';
const VIEWS: { value: View; label: string }[] = [
  { value: 'week', label: 'Semaine' },
  { value: 'day', label: 'Jour' },
  { value: 'list', label: 'Liste' },
];

/**
 * The agenda: week (default) or day on a time grid, or the full list. View and date live in
 * the URL, so going back from an appointment returns to the same place.
 */
export default function AppointmentsPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'week';
  const date = useMemo(() => {
    const raw = params.get('date');
    // Whole days: the agenda fetches from midnight
    return startOfDay(raw ? new Date(`${raw}T00:00:00`) : new Date());
  }, [params]);
  const [booking, setBooking] = useState<{ startAt?: string } | null>(null);

  const set = (next: { view?: View; date?: Date }) => {
    const p = new URLSearchParams(params);
    if (next.view) p.set('view', next.view);
    if (next.date) p.set('date', format(next.date, 'yyyy-MM-dd'));
    setParams(p, { replace: true });
  };

  const days = useMemo(() => {
    if (view === 'day') return [date];
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [view, date]);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', 'agenda', days[0].toISOString(), days.length],
    queryFn: async () => {
      const { data } = await api.get('/appointments', {
        params: {
          from: days[0].toISOString(),
          to: addDays(days[days.length - 1], 1).toISOString(),
          limit: 100,
        },
      });
      return (data.data ?? data) as AgendaAppointment[];
    },
    enabled: view !== 'list',
  });

  // Weekends only take room when something is booked on them
  const shownDays =
    view === 'week'
      ? days.filter((d) => d.getDay() % 6 !== 0 || appointments.some((a) => new Date(a.startAt).toDateString() === d.toDateString()))
      : days;

  const step = view === 'day' ? 1 : 7;
  const title =
    view === 'day'
      ? format(date, 'EEEE d MMMM yyyy', { locale: fr })
      : `${format(days[0], 'd MMM', { locale: fr })} – ${format(days[6], 'd MMM yyyy', { locale: fr })}`;

  const bookingDefaults = useMemo(() => booking ?? undefined, [booking]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold mr-2">Rendez-vous</h1>
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => set({ view: v.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === v.value ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view !== 'list' && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => set({ date: addDays(date, -step) })} title="Précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => set({ date: new Date() })}>
              Aujourd’hui
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => set({ date: addDays(date, step) })} title="Suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-medium first-letter:uppercase">{title}</span>
          </div>
        )}

        <Button size="sm" className="ml-auto" onClick={() => setBooking({})}>
          <Plus className="w-4 h-4" /> Nouveau rendez-vous
        </Button>
      </div>

      {view === 'list' ? (
        <AppointmentsTable />
      ) : (
        <>
          <AgendaGrid
            days={shownDays}
            appointments={appointments}
            onSlotClick={(start) => setBooking({ startAt: format(start, "yyyy-MM-dd'T'HH:mm") })}
          />
          <p className="text-xs text-muted-foreground">
            Cliquez sur un créneau libre pour prendre un rendez-vous. ✓ séance finalisée · ✎ séance en cours.
          </p>
        </>
      )}

      <AppointmentFormDialog
        open={booking !== null}
        onOpenChange={(open) => !open && setBooking(null)}
        defaultValues={bookingDefaults}
      />
    </div>
  );
}
