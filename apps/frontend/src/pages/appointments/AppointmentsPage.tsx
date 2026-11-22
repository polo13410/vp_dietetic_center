import { useQuery } from '@tanstack/react-query';
import { addDays, format, isToday, startOfDay, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type AgendaAppointment, AgendaGrid } from '../../components/appointments/AgendaGrid';
import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { AppointmentsTable } from '../../components/appointments/AppointmentsTable';
import { PageHeader } from '../../components/shared/PageHeader';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import api from '../../lib/api';

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

  const step = view === 'day' ? 1 : 7;
  const showsToday = days.some((day) => isToday(day));
  const title =
    view === 'day'
      ? format(date, 'EEEE d MMMM yyyy', { locale: fr })
      : `${format(days[0], 'd MMM', { locale: fr })} – ${format(days[6], 'd MMM yyyy', { locale: fr })}`;

  const bookingDefaults = useMemo(() => booking ?? undefined, [booking]);

  return (
    <>
      <PageHeader
        area="agenda"
        title="Agenda"
        actions={
          <Button onClick={() => setBooking({})}>
            <Plus aria-hidden /> Nouveau rendez-vous
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <SegmentedControl label="Affichage" options={VIEWS} value={view} onChange={(next) => set({ view: next })} />
          {view !== 'list' && (
            <div className="flex flex-1 flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={view === 'day' ? 'Jour précédent' : 'Semaine précédente'}
                onClick={() => set({ date: addDays(date, -step) })}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p className="min-w-[13rem] text-center text-xl font-semibold first-letter:uppercase" aria-live="polite">
                {title}
              </p>
              <Button
                variant="ghost"
                size="icon"
                aria-label={view === 'day' ? 'Jour suivant' : 'Semaine suivante'}
                onClick={() => set({ date: addDays(date, step) })}
              >
                <ChevronRight aria-hidden />
              </Button>
              {!showsToday && (
                <Button variant="outline" className="ml-auto" onClick={() => set({ date: new Date() })}>
                  Revenir à aujourd’hui
                </Button>
              )}
            </div>
          )}
        </Card>

        {view === 'list' ? (
          <AppointmentsTable />
        ) : (
          <>
            <AgendaGrid
              days={days}
              appointments={appointments}
              onSlotClick={(start) => setBooking({ startAt: format(start, "yyyy-MM-dd'T'HH:mm") })}
            />
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              Touchez un créneau libre pour prendre un rendez-vous.
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-4 text-success" aria-hidden /> séance commencée
              </span>
            </p>
          </>
        )}
      </div>

      <AppointmentFormDialog
        open={booking !== null}
        onOpenChange={(open) => !open && setBooking(null)}
        defaultValues={bookingDefaults}
      />
    </>
  );
}
