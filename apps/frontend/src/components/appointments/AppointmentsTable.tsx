import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { formatDate, todayISO } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { LoadingSpinner } from '../ui/loading-screen';
import { toast } from '../ui/toaster';

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'SCHEDULED', label: 'Planifié' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
  { value: 'NO_SHOW', label: 'Absent' },
];

/** Every appointment, filterable by status and dates, with quick status changes. */
export function AppointmentsTable() {
  // Assistants see every practitioner's appointments
  const showPractitioner = useIsRole('ASSISTANTE');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  // Upcoming appointments first; clear the date to see past ones
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', 'list', { page, status, from, to }],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (status) params.status = status;
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
      toast({ title: 'Statut mis à jour' });
    },
  });

  const appointments = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const filter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Button
                key={s.value}
                variant={status === s.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => filter(() => setStatus(s.value))}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-muted-foreground">Du</label>
            <input
              type="date"
              value={from}
              onChange={(e) => filter(() => setFrom(e.target.value))}
              className="px-2 py-1.5 text-sm border border-input rounded-lg bg-background"
            />
            <label className="text-xs text-muted-foreground">au</label>
            <input
              type="date"
              value={to}
              onChange={(e) => filter(() => setTo(e.target.value))}
              className="px-2 py-1.5 text-sm border border-input rounded-lg bg-background"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : appointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucun rendez-vous</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Durée</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((appt: any) => (
                <tr key={appt.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/appointments/${appt.id}`} className="hover:text-primary">
                      {formatDate(appt.startAt, 'dd/MM/yyyy HH:mm')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/patients/${appt.patientId}`} className="hover:text-primary">
                      {appt.patient?.firstName} {appt.patient?.lastName}
                    </Link>
                    {showPractitioner && appt.practitioner && (
                      <p className="text-xs font-normal text-muted-foreground">
                        avec {appt.practitioner.firstName} {appt.practitioner.lastName}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={appt.type} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{appt.duration} min</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={appt.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/appointments/${appt.id}`}>Voir le rendez-vous</Link>
                        </DropdownMenuItem>
                        {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                          <>
                            <DropdownMenuSeparator />
                            {appt.status === 'SCHEDULED' && (
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'CONFIRMED' })}
                              >
                                Confirmer
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'NO_SHOW' })}>
                              Marquer absent
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => updateStatus.mutate({ id: appt.id, newStatus: 'CANCELLED' })}
                            >
                              Annuler
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} rendez-vous — page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" /> Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
