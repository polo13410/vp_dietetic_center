import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // TODO: Replace with real API data
  const appointments: Array<{
    id: string;
    date: string;
    title: string;
    patientName: string;
    notes?: string;
  }> = [];

  const dailyAppointments = appointments
    .filter((app) => isSameDay(new Date(app.date), selectedDate))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <div className="flex items-center gap-4">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau rendez-vous
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly calendar view */}
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
                const dayAppointments = appointments.filter((app) =>
                  isSameDay(new Date(app.date), day),
                );
                return (
                  <Button
                    key={index}
                    variant={isSameDay(day, selectedDate) ? 'default' : 'outline'}
                    className="h-24 flex flex-col items-center justify-start p-2"
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="text-xs">{format(day, 'EEE', { locale: fr })}</span>
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                    <span className="text-xs">
                      {dayAppointments.length > 0 ? (
                        `${dayAppointments.length} rdv`
                      ) : (
                        <CalendarIcon className="h-4 w-4" />
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
              Agenda du {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
            </CardTitle>
            <CardDescription>
              {dailyAppointments.length === 0
                ? 'Aucun rendez-vous prévu'
                : `${dailyAppointments.length} rendez-vous`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dailyAppointments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">Aucun rendez-vous pour ce jour</p>
                  <Button variant="outline" className="mt-4">
                    Planifier un rendez-vous
                  </Button>
                </div>
              ) : (
                dailyAppointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-md p-3 hover:bg-accent transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(appointment.date), 'HH:mm')}
                        </p>
                        <h3 className="font-semibold mt-1">{appointment.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-primary mt-1">{appointment.patientName}</p>
                    {appointment.notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {appointment.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
