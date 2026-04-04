import { useQuery } from '@tanstack/react-query';
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import api from '../../lib/api';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<{ startAt?: string }>({});

  const weekEnd = addDays(weekStart, 6);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', 'calendar', weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await api.get('/appointments', {
        params: {
          from: weekStart.toISOString(),
          to: addDays(weekEnd, 1).toISOString(),
          limit: 100,
        },
      });
      return data.data ?? data;
    },
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dailyAppointments = (appointments as any[])
    .filter((appt) => isSameDay(new Date(appt.startAt), selectedDate))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const openNewAppointment = (date?: Date) => {
    const d = date ?? selectedDate;
    const dateStr = format(d, "yyyy-MM-dd'T'09:00");
    setDialogDefaults({ startAt: dateStr });
    setDialogOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <Button onClick={() => openNewAppointment()}>
          <Plus className="h-4 w-4" />
          Nouveau rendez-vous
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly calendar */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Semaine du {format(weekStart, 'd MMMM yyyy', { locale: fr })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                    setSelectedDate(new Date());
                  }}
                >
                  Aujourd'hui
                </Button>
                <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>Cliquez sur un jour pour voir les rendez-vous</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, index) => {
                const dayAppts = (appointments as any[]).filter((appt) =>
                  isSameDay(new Date(appt.startAt), day),
                );
                const isToday = isSameDay(day, new Date());
                return (
                  <Button
                    key={index}
                    variant={isSameDay(day, selectedDate) ? 'default' : 'outline'}
                    className={`h-24 flex flex-col items-center justify-start p-2 ${isToday && !isSameDay(day, selectedDate) ? 'border-primary' : ''}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="text-xs">{format(day, 'EEE', { locale: fr })}</span>
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                    <span className="text-xs">
                      {dayAppts.length > 0 ? (
                        `${dayAppts.length} rdv`
                      ) : (
                        <CalendarIcon className="h-4 w-4 opacity-30" />
                      )}
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily agenda */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
            </CardTitle>
            <CardDescription>
              {dailyAppointments.length === 0
                ? 'Aucun rendez-vous prevu'
                : `${dailyAppointments.length} rendez-vous`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyAppointments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">Aucun rendez-vous pour ce jour</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => openNewAppointment(selectedDate)}
                  >
                    Planifier un rendez-vous
                  </Button>
                </div>
              ) : (
                dailyAppointments.map((appt: any) => (
                  <Link
                    key={appt.id}
                    to={`/appointments/${appt.id}`}
                    className="block border border-border rounded-lg p-3 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">
                          {format(new Date(appt.startAt), 'HH:mm')} — {appt.duration} min
                        </p>
                        <p className="text-sm text-primary mt-0.5">
                          {appt.patient?.lastName} {appt.patient?.firstName}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                    {appt.reason && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {appt.reason}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AppointmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={dialogDefaults}
      />
    </div>
  );
}
