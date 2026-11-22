import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { formatLongDate, formatTime, todayISO } from '../../lib/utils';
import { EmptyState } from '../shared/EmptyState';
import { Pagination } from '../shared/Pagination';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { LoadingSpinner } from '../ui/loading-screen';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/toaster';

const ALL = 'ALL';
const STATUSES = [
  { value: ALL, label: 'Tous les statuts' },
  { value: 'SCHEDULED', label: 'Planifiés' },
  { value: 'CONFIRMED', label: 'Confirmés' },
  { value: 'COMPLETED', label: 'Terminés' },
  { value: 'CANCELLED', label: 'Annulés' },
  { value: 'NO_SHOW', label: 'Absents' },
];

interface ListedAppointment {
  id: string;
  patientId: string;
  startAt: string;
  duration: number;
  type: string;
  status: string;
  patient?: { firstName: string; lastName: string };
  practitioner?: { firstName: string; lastName: string };
}

/** Every appointment, filterable by status and dates, with quick status changes. */
export function AppointmentsTable() {
  // Assistants see every practitioner's appointments
  const showPractitioner = useIsRole('ASSISTANTE');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ALL);
  // Upcoming appointments first; clear the date to see past ones
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'list', { page, status, from, to }],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (status !== ALL) params.status = status;
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(`${to}T23:59:59`).toISOString();
      return (await api.get('/appointments', { params })).data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch(`/appointments/${id}`, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Rendez-vous mis à jour' });
    },
  });

  const appointments: ListedAppointment[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const filter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-56 space-y-1.5">
          <label htmlFor="appointments-status" className="text-sm font-medium text-muted-foreground">
            Statut
          </label>
          <Select value={status} onValueChange={(value) => filter(() => setStatus(value))}>
            <SelectTrigger id="appointments-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="appointments-from" className="text-sm font-medium text-muted-foreground">
            Du
          </label>
          <Input
            id="appointments-from"
            type="date"
            value={from}
            onChange={(e) => filter(() => setFrom(e.target.value))}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="appointments-to" className="text-sm font-medium text-muted-foreground">
            Au
          </label>
          <Input
            id="appointments-to"
            type="date"
            value={to}
            onChange={(e) => filter(() => setTo(e.target.value))}
            className="w-44"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            area="agenda"
            title="Aucun rendez-vous sur cette période."
            description="Changez les dates ou le statut pour en voir d’autres."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-sm text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Lieu</th>
                  <th className="px-5 py-3 font-medium">Durée</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appointments.map((appt) => {
                  const name = `${appt.patient?.firstName ?? ''} ${appt.patient?.lastName ?? ''}`.trim();
                  const open = appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED';
                  return (
                    <tr key={appt.id} className="h-14">
                      <td className="whitespace-nowrap px-5 py-2">
                        <Link to={`/appointments/${appt.id}`} className="font-medium hover:text-primary">
                          {formatLongDate(appt.startAt, true)} · {formatTime(appt.startAt)}
                        </Link>
                      </td>
                      <td className="px-5 py-2">
                        <Link to={`/patients/${appt.patientId}`} className="hover:text-primary">
                          {name}
                        </Link>
                        {showPractitioner && appt.practitioner && (
                          <p className="text-sm text-muted-foreground">
                            avec {appt.practitioner.firstName} {appt.practitioner.lastName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-2">
                        <StatusBadge status={appt.type} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-muted-foreground">{appt.duration} min</td>
                      <td className="px-5 py-2">
                        <StatusBadge status={appt.status} />
                      </td>
                      <td className="px-5 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions pour le rendez-vous de ${name}`}>
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/appointments/${appt.id}`}>Voir le rendez-vous</Link>
                            </DropdownMenuItem>
                            {open && (
                              <>
                                <DropdownMenuSeparator />
                                {appt.status === 'SCHEDULED' && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'CONFIRMED' })}
                                  >
                                    Confirmer
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'NO_SHOW' })}
                                >
                                  Marquer absent
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'CANCELLED' })}
                                >
                                  Annuler le rendez-vous
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
    </div>
  );
}
